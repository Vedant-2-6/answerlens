import { z } from "zod";
import type { OcrPage, NormRect } from "@answerlens/types";

// 1. Schemas (P-02)
export const AnswerBlockCandidateSchema = z.object({
  index: z.number().int().nonnegative(),
  kind: z.enum(['answer','label-only','rough-work','struck-out','illegible','diagram','page-meta']),
  text: z.string().max(6000),
  label: z.string().max(20).nullable(),
  note: z.string().max(200).nullable(),
  illegibleSpans: z.number().int().nonnegative(),
  approxTopFraction: z.number().min(0).max(1),
  approxBottomFraction: z.number().min(0).max(1),
  continuedFromPrevious: z.boolean(),
  continuesToNextPage: z.boolean(),
});

export const P02OutputSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  pageEmpty: z.boolean(),
  orientationSuspect: z.boolean(),
  blocks: z.array(AnswerBlockCandidateSchema)
});

export type P02Result = z.infer<typeof P02OutputSchema>;

// 2. Prompts
const P02_SYSTEM_PROMPT = `You extract handwritten student answers from a scanned page.

You will receive an image of the page and the OCR text of the page.

Your task is to transcribe and segment every distinct block of student writing.

RULES:
1. Extract ALL handwritten text. Do not miss any answers or rough work.
2. Segment into logical blocks. A block is one answer, or one section of rough work.
3. If a block is an answer, set kind to 'answer'.
4. If a block is just a question number, set kind to 'label-only'.
5. If it is crossed out, set kind to 'struck-out'.
6. If it is unreadable, set kind to 'illegible' and record the number of unreadable words in illegibleSpans.
7. If it is a drawing, set kind to 'diagram' and describe it briefly in 'note'.
8. If it is a page number or header, set kind to 'page-meta'.
9. Transcribe text exactly. Fix minor spelling ONLY if it is clearly a handwriting artifact.
10. If the block has a written label (e.g. "Ans 1", "b)"), put it in 'label'.
11. Provide approxTopFraction (0.0 to 1.0) and approxBottomFraction (0.0 to 1.0) indicating vertical position.
12. Set continuedFromPrevious/continuesToNextPage if the text flows across page boundaries.`;

async function callOmniRouteVisionJSON(
  omnirouteBaseUrl: string,
  omnirouteApiKey: string,
  model: string,
  systemPrompt: string,
  userPromptText: string,
  imageBase64: string
): Promise<any> {
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: [
          { type: "text", text: userPromptText },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ],
    temperature: 0,
    response_format: { type: "json_object" },
    stream: false
  };

  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < 3) {
    try {
      const response = await fetch(`${omnirouteBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${omnirouteApiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`OmniRoute error ${response.status}: ${errText}`);
        if (response.status >= 500 || response.status === 429) {
          throw err;
        }
        throw err;
      }

      const responseText = await response.text();
      let content = "";
      try {
        const json = JSON.parse(responseText);
        content = json.choices[0].message.content;
      } catch (e) {
        const lines = responseText.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.choices?.[0]?.delta?.content) content += chunk.choices[0].delta.content;
            } catch (err) {}
          }
        }
      }
      
      content = content.replace(/^```(?:json)?\n?/i, "").replace(/```$/i, "").trim();
      return JSON.parse(content);
    } catch (err: any) {
      lastError = err;
      if (err.message.includes("OmniRoute error") && !err.message.includes("5") && !err.message.includes("429")) {
        throw err;
      }
      attempt++;
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastError;
}

function applySemanticValidators(result: P02Result, ocrPage: OcrPage): P02Result {
  // 1. Index density: renumber silently
  result.blocks.forEach((b, i) => b.index = i);

  // 2. Fraction ordering
  for (const b of result.blocks) {
    if (b.approxTopFraction >= b.approxBottomFraction) {
      const temp = b.approxTopFraction;
      b.approxTopFraction = b.approxBottomFraction;
      b.approxBottomFraction = temp;
    }
  }

  // 3. Monotonic layout
  result.blocks.sort((a, b) => a.approxTopFraction - b.approxTopFraction);
  result.blocks.forEach((b, i) => b.index = i); // re-apply index

  // 4. Empty consistency
  if (result.pageEmpty && result.blocks.length > 0) {
    result.pageEmpty = false;
  }

  // 5. Diagram note
  for (const b of result.blocks) {
    if (b.kind === 'diagram' && !b.note) {
      b.note = "Diagram detected";
    }
  }

  return result;
}

export async function extractAnswerPage(
  ocrPage: OcrPage,
  imageBase64: string,
  omnirouteBaseUrl: string,
  omnirouteApiKey: string,
  model: string
): Promise<P02Result> {
  const userPrompt = `TASK CONTEXT
Page Index: ${ocrPage.pageIndex}
OCR Text Hints:
<<<DOCUMENT>>>
${ocrPage.rawText}
<<<END DOCUMENT>>>

Analyze the provided image and extract all blocks.`;

  try {
    const rawJson = await callOmniRouteVisionJSON(omnirouteBaseUrl, omnirouteApiKey, model, P02_SYSTEM_PROMPT, userPrompt, imageBase64);
    let parsed = P02OutputSchema.parse(rawJson);
    return applySemanticValidators(parsed, ocrPage);
  } catch (error: any) {
    // 1-retry repair
    const repairPrompt = `${userPrompt}\n\nYour previous response was rejected. Error: ${error.message}. Return only corrected JSON conforming to the schema.`;
    const repairedJson = await callOmniRouteVisionJSON(omnirouteBaseUrl, omnirouteApiKey, model, P02_SYSTEM_PROMPT, repairPrompt, imageBase64);
    let parsed = P02OutputSchema.parse(repairedJson);
    return applySemanticValidators(parsed, ocrPage);
  }
}