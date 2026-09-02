import { z } from "zod";
import type { OcrPage, NormRect } from "@answerlens/types";
import { callLLMJSON, getLLMCredentials } from "@answerlens/providers";

// 1. Schemas (P-02)
export const AnswerBlockCandidateSchema = z.object({
  index: z.number().int().nonnegative(),
  kind: z.enum(['answer','label-only','rough-work','struck-out','illegible','diagram','page-meta','mcq']),
  text: z.string().max(6000),
  label: z.string().max(20).nullable(),
  note: z.string().max(200).nullable(),
  illegibleSpans: z.number().int().nonnegative(),
  approxTopFraction: z.number().min(0).max(1),
  approxBottomFraction: z.number().min(0).max(1),
  continuedFromPrevious: z.boolean(),
  continuesToNextPage: z.boolean(),
  finalAnswerText: z.string().max(500).nullable().optional(),
});

export const P02OutputSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  pageEmpty: z.boolean(),
  orientationSuspect: z.boolean(),
  imageQuality: z.enum(['good', 'degraded', 'unusable']).default('good'),
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
9. If the block is a filled or circled bubble (multiple choice), set kind to 'mcq'.
10. Transcribe text exactly. Fix minor spelling ONLY if it is clearly a handwriting artifact.
11. If the block has a written label (e.g. "Ans 1", "b)"), put it in 'label'.
12. Provide approxTopFraction (0.0 to 1.0) and approxBottomFraction (0.0 to 1.0) indicating vertical position.
13. Set continuedFromPrevious/continuesToNextPage if the text flows across page boundaries.
14. If the block contains a final numeric or symbolic answer (e.g. "x = 5", "3/4", "y = x^2 + 2x + 1"), extract just that final answer/conclusion and put it in 'finalAnswerText'. If there is no single final answer, set it to null.
15. If the page is too blurry, dark, or cropped to read reliably, set imageQuality to 'unusable'. If it's readable but difficult, set it to 'degraded'. Otherwise 'good'.

EXPECTED JSON FORMAT:
{
  "pageIndex": 1,
  "pageEmpty": false,
  "orientationSuspect": false,
  "imageQuality": "good",
  "blocks": [
    {
      "index": 0,
      "kind": "answer",
      "label": "Q1",
      "text": "The answer is...",
      "note": "string or null",
      "approxTopFraction": 0.1,
      "approxBottomFraction": 0.4,
      "illegibleSpans": 0,
      "continuedFromPrevious": false,
      "continuesToNextPage": false,
      "finalAnswerText": "5"
    }
  ]
}`;

export const P02ChunkOutputSchema = z.object({
  pages: z.array(P02OutputSchema)
});
export type P02ChunkResult = z.infer<typeof P02ChunkOutputSchema>;

async function callOmniRouteVisionJSON(
  systemPrompt: string,
  userPromptText: string,
  imagesBase64: string[]
): Promise<any> {
  const payloadBase = {
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: [
          { type: "text", text: userPromptText },
          ...imagesBase64.map(b64 => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }))
        ]
      }
    ],
    temperature: 0,
    response_format: { type: "json_object" },
    stream: false
  };

  const credentials = getLLMCredentials();
  const res = await callLLMJSON(payloadBase, credentials);
  return res.parsed;
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
  imageBase64: string
): Promise<P02Result> {
  const userPrompt = `TASK CONTEXT\nPage Index: ${ocrPage.pageIndex}\nOCR Text Hints:\n<<<DOCUMENT>>>\n${ocrPage.rawText}\n<<<END DOCUMENT>>>\n\nAnalyze the provided image and extract all blocks.`;
  try {
    const rawJson = await callOmniRouteVisionJSON(P02_SYSTEM_PROMPT, userPrompt, [imageBase64]);
    let parsed = P02OutputSchema.parse(rawJson);
    return applySemanticValidators(parsed, ocrPage);
  } catch (error: any) {
    const repairPrompt = `${userPrompt}\n\nYour previous response was rejected. Error: ${error.message}. Return only corrected JSON conforming to the schema.`;
    const repairedJson = await callOmniRouteVisionJSON(P02_SYSTEM_PROMPT, repairPrompt, [imageBase64]);
    let parsed = P02OutputSchema.parse(repairedJson);
    return applySemanticValidators(parsed, ocrPage);
  }
}

export async function extractAnswerPagesChunk(
  ocrPages: OcrPage[],
  imagesBase64: string[]
): Promise<P02ChunkResult> {
  const userPrompt = `TASK CONTEXT\nYou are analyzing ${ocrPages.length} pages simultaneously.\n\n` + 
    ocrPages.map(p => `--- PAGE ${p.pageIndex} ---\nOCR Text Hints:\n<<<DOCUMENT>>>\n${p.rawText}\n<<<END DOCUMENT>>>\n`).join("\n") +
    `\n\nAnalyze the provided images and extract all blocks for EACH page. Match each output page object to its corresponding pageIndex.`;

  const chunkSystemPrompt = P02_SYSTEM_PROMPT.replace(
    /EXPECTED JSON FORMAT:[\s\S]*/,
    `EXPECTED JSON FORMAT:
{
  "pages": [
    {
      "pageIndex": 1,
      "pageEmpty": false,
      "orientationSuspect": false,
      "imageQuality": "good",
      "blocks": [
        {
          "index": 0,
          "kind": "answer",
          "label": "Q1",
          "text": "The answer is...",
          "note": "string or null",
          "approxTopFraction": 0.1,
          "approxBottomFraction": 0.4,
          "illegibleSpans": 0,
          "continuedFromPrevious": false,
          "continuesToNextPage": false
        }
      ]
    }
  ]
}`
  );

  try {
    const rawJson = await callOmniRouteVisionJSON(chunkSystemPrompt, userPrompt, imagesBase64);
    let parsed = P02ChunkOutputSchema.parse(rawJson);
    parsed.pages = parsed.pages.map(p => {
      const originalOcr = ocrPages.find(op => op.pageIndex === p.pageIndex);
      return originalOcr ? applySemanticValidators(p, originalOcr) : p;
    });
    return parsed;
  } catch (error: any) {
    const repairPrompt = `${userPrompt}\n\nYour previous response was rejected. Error: ${error.message}. Return only corrected JSON conforming to the schema.`;
    const repairedJson = await callOmniRouteVisionJSON(chunkSystemPrompt, repairPrompt, imagesBase64);
    let parsed = P02ChunkOutputSchema.parse(repairedJson);
    parsed.pages = parsed.pages.map(p => {
      const originalOcr = ocrPages.find(op => op.pageIndex === p.pageIndex);
      return originalOcr ? applySemanticValidators(p, originalOcr) : p;
    });
    return parsed;
  }
}