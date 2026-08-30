import type { Question, VisionPage, MappingResult } from "@answerlens/types";

export async function mapAnswersLLM(
  questions: Question[],
  visionPages: VisionPage[],
  omnirouteBaseUrl: string,
  omnirouteApiKey: string,
  model: string
): Promise<{ mappings: MappingResult[], orphans: any[] }> {
  const prompt = `You are an expert examiner mapping a student's answer sheet to the original question paper.
  
RULES:
1. The student may answer out of order (e.g. Q3 then Q1). Map them correctly.
2. A single answer may span multiple pages. You can map a question to multiple page indices.
3. If the student answers extra choices (e.g. did 4 out of 3), map all of them.
4. If a student starts Q1, jumps to Q2, and returns to Q1 later, flag the second occurrence as an anomaly (interleaved: true).
5. For diagrams/maps/MCQs without text, infer which question they belong to based on context.
6. Return a JSON object with a 'mappings' array.

QUESTION PAPER:
${JSON.stringify(questions.map(q => ({ id: q.id, label: q.labelRaw, text: q.text, marks: q.maxMarks })), null, 2)}

STUDENT ANSWER PAGES:
${visionPages.map(vp => `--- PAGE ${vp.pageIndex} ---\n${vp.transcription}`).join("\n\n")}

RETURN JSON FORMAT:
{
  "mappings": [
    {
      "questionId": "Q-1-a",
      "pagesSpanned": [0, 1],
      "confidence": 0.95,
      "reasoning": "Explicitly labelled 1(a)",
      "interleaved": false
    }
  ]
}
`;

  const payload = {
    model,
    messages: [
      { role: "system", content: "You output strict JSON for examination mapping." },
      { role: "user", content: prompt }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  };

  const response = await fetch(`${omnirouteBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${omnirouteApiKey}` },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OmniRoute Mapping Error: ${await response.text()}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;
  content = content.replace(/^```json\n?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(content);

  const mappings: MappingResult[] = [];
  
  for (const m of parsed.mappings) {
    const pagesSpanned: number[] = m.pagesSpanned || [];
    const transcription = pagesSpanned.map(pIdx => visionPages.find(vp => vp.pageIndex === pIdx)?.transcription || "").join("\n\n");
    
    const regions = pagesSpanned.flatMap(pIdx => {
      const vp = visionPages.find(v => v.pageIndex === pIdx);
      return (vp?.approximate_regions || []).map(r => ({ ...r, pageIndex: pIdx }));
    });

    mappings.push({
      questionId: m.questionId,
      regions,
      tier: m.confidence > 0.8 ? "exact" : "approximate",
      confidence: m.confidence,
      transcription,
      labelEvidence: m.confidence,
      semanticEvidence: m.confidence,
      orderEvidence: 1.0,
      suppressed: m.confidence < 0.4 || m.interleaved
    });
  }

  return { mappings, orphans: [] };
}
