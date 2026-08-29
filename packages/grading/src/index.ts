import { z } from "zod";
import type { Question, RubricPoint, RubricVerdict, Verdict } from "@answerlens/types";

// ----------------------------------------------------------------------------
// P-04 Rubric Derivation
// ----------------------------------------------------------------------------

export const RubricPointSchema = z.object({
  id: z.string(),
  text: z.string(),
  weight: z.number(),
  required: z.boolean()
});
export const RubricSchema = z.array(RubricPointSchema);

const P04_SYSTEM_PROMPT = `You are an expert examiner. Derive a grading rubric for the given question.
Break the expected answer into distinct points.
Assign each point a weight (marks).
The sum of all weights MUST EXACTLY equal the question's max marks.
Set 'required' to true only for points without which the answer is fundamentally wrong.
Return a JSON array of these points.`;

async function callOmniRouteJSON(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  };
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`OmniRoute error: ${await response.text()}`);
  let content = (await response.json()).choices[0].message.content;
  content = content.replace(/^```(?:json)?\n?/i, "").replace(/```$/i, "").trim();
  // Sometimes models wrap array in { "rubric": [...] } despite instructions
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : (parsed.rubric || parsed.points || parsed);
}

export async function deriveRubric(
  question: Question,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<RubricPoint[]> {
  if (!question.maxMarks) return [];
  const userPrompt = `Question: ${question.text}\nMax Marks: ${question.maxMarks}`;
  try {
    const raw = await callOmniRouteJSON(baseUrl, apiKey, model, P04_SYSTEM_PROMPT, userPrompt);
    return RubricSchema.parse(raw);
  } catch (err: any) {
    const repair = `${userPrompt}\n\nYour previous response failed validation: ${err.message}. Return ONLY a JSON array of rubric points summing to ${question.maxMarks}.`;
    const repaired = await callOmniRouteJSON(baseUrl, apiKey, model, P04_SYSTEM_PROMPT, repair);
    return RubricSchema.parse(repaired);
  }
}

// ----------------------------------------------------------------------------
// P-05 Answer Evaluation
// ----------------------------------------------------------------------------

export const EvaluationSchema = z.object({
  rubricVerdicts: z.array(z.object({
    pointId: z.string(),
    verdict: z.enum(["met", "partial", "unmet"]),
    justification: z.string()
  }))
});

const P05_SYSTEM_PROMPT = `You are an expert grader. Evaluate the student's answer against the rubric.
For each point, return a verdict (met, partial, or unmet) and a short 1-sentence justification.
Do not invent marks. Do not grade grammar unless specified in the rubric.
Return JSON matching the schema { "rubricVerdicts": [ ... ] }.`;

export async function evaluateAnswer(
  question: Question,
  rubric: RubricPoint[],
  answerText: string,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ marks: number; verdict: Verdict; rubricVerdicts: RubricVerdict[] }> {
  if (rubric.length === 0) return { marks: 0, verdict: "zero", rubricVerdicts: [] };

  const userPrompt = `Question: ${question.text}
Rubric: ${JSON.stringify(rubric)}
Student Answer: ${answerText}`;

  let raw;
  try {
    raw = await callOmniRouteJSON(baseUrl, apiKey, model, P05_SYSTEM_PROMPT, userPrompt);
    raw = EvaluationSchema.parse(raw);
  } catch (err: any) {
    const repair = `${userPrompt}\n\nError: ${err.message}. Return corrected JSON.`;
    raw = await callOmniRouteJSON(baseUrl, apiKey, model, P05_SYSTEM_PROMPT, repair);
    raw = EvaluationSchema.parse(raw);
  }

  let totalMarks = 0;
  let requiredFailed = false;

  const verdicts: RubricVerdict[] = raw.rubricVerdicts;
  for (const v of verdicts) {
    const point = rubric.find(r => r.id === v.pointId);
    if (!point) continue;
    if (v.verdict === 'met') totalMarks += point.weight;
    else if (v.verdict === 'partial') totalMarks += (point.weight * 0.5);
    
    if (point.required && v.verdict === 'unmet') {
      requiredFailed = true;
    }
  }

  if (requiredFailed) totalMarks = 0;
  if (question.maxMarks && totalMarks > question.maxMarks) totalMarks = question.maxMarks;

  let finalVerdict: Verdict = "partial";
  if (totalMarks === 0) finalVerdict = "zero";
  else if (totalMarks === question.maxMarks) finalVerdict = "full";

  return { marks: totalMarks, verdict: finalVerdict, rubricVerdicts: verdicts };
}