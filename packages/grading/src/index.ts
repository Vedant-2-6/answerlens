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

async function callOmniRouteJSON(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<{ parsed: any, raw: string }> {
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
  const parsed = JSON.parse(content);
  return { parsed, raw: content };
}

export async function deriveRubric(
  question: Question,
  baseUrl: string,
  apiKey: string,
  model: string,
  settings?: any
): Promise<RubricPoint[]> {
  if (!question.maxMarks) return [];
  const userPrompt = `Question: ${question.text}\nMax Marks: ${question.maxMarks}`;
  
  let sysPrompt = P04_SYSTEM_PROMPT;
  if (settings) {
    const mods = [];
    if (settings.focus === "steps") mods.push("- Emphasize steps, workings, and methodology when breaking down marks.");
    else if (settings.focus === "answer") mods.push("- Emphasize the correct final answer when breaking down marks.");
    if (settings.allowPartial === false) mods.push("- Partial marks are strictly disabled. Make points atomic (no half-marks).");
    sysPrompt += "\n\nTEACHER INSTRUCTIONS:\n" + mods.join("\n");
  }

  let lastRaw = "";
  try {
    const { parsed, raw } = await callOmniRouteJSON(baseUrl, apiKey, model, sysPrompt, userPrompt);
    lastRaw = raw;
    const arrayTarget = Array.isArray(parsed) ? parsed : (parsed.rubric || parsed.points || parsed.rubricPoints || Object.values(parsed)[0] || parsed);
    return RubricSchema.parse(arrayTarget);
  } catch (err: any) {
    const repair = `${userPrompt}\n\nYour previous response failed validation: ${err.message}.\nYou generated:\n${lastRaw}\n\nReturn ONLY a JSON array of rubric points summing to ${question.maxMarks}.`;
    const { parsed } = await callOmniRouteJSON(baseUrl, apiKey, model, sysPrompt, repair);
    const arrayTarget = Array.isArray(parsed) ? parsed : (parsed.rubric || parsed.points || parsed.rubricPoints || Object.values(parsed)[0] || parsed);
    return RubricSchema.parse(arrayTarget);
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
  model: string,
  settings?: any
): Promise<{ marks: number; verdict: Verdict; rubricVerdicts: RubricVerdict[] }> {
  if (rubric.length === 0) return { marks: 0, verdict: "zero", rubricVerdicts: [] };

  const userPrompt = `Question: ${question.text}\nRubric: ${JSON.stringify(rubric)}\nStudent Answer: ${answerText}`;

  let sysPrompt = P05_SYSTEM_PROMPT;
  if (settings) {
    const mods = [];
    if (settings.focus === "steps") mods.push("- Evaluate based on steps, workings, and methodology.");
    else if (settings.focus === "answer") mods.push("- Evaluate strictly based on the final answer.");
    if (settings.allowPartial === false) mods.push("- Partial marking is disabled. DO NOT return 'partial' as a verdict, only 'met' or 'unmet'.");
    sysPrompt += "\n\nTEACHER INSTRUCTIONS:\n" + mods.join("\n");
  }

  let raw, lastRaw = "";
  try {
    const res = await callOmniRouteJSON(baseUrl, apiKey, model, sysPrompt, userPrompt);
    lastRaw = res.raw;
    raw = EvaluationSchema.parse(res.parsed);
  } catch (err: any) {
    const repair = `${userPrompt}\n\nError: ${err.message}.\nYou generated:\n${lastRaw}\nReturn corrected JSON.`;
    const res = await callOmniRouteJSON(baseUrl, apiKey, model, sysPrompt, repair);
    raw = EvaluationSchema.parse(res.parsed);
  }

  let totalMarks = 0;
  let requiredFailed = false;

  const verdicts: RubricVerdict[] = raw.rubricVerdicts;
  for (const v of verdicts) {
    const point = rubric.find(r => r.id === v.pointId);
    if (!point) continue;
    if (v.verdict === 'met') totalMarks += point.weight;
    else if (v.verdict === 'partial') totalMarks += (settings?.allowPartial === false ? 0 : (point.weight * 0.5));
    
    if (point.required && v.verdict === 'unmet') {
      requiredFailed = true;
    }
  }

  if (requiredFailed) totalMarks = 0;
  
  // Fix floating point issues
  totalMarks = Math.round(totalMarks * 100) / 100;

  if (question.maxMarks && totalMarks > question.maxMarks) {
    totalMarks = question.maxMarks;
  }

  let finalVerdict: Verdict = "partial";
  if (totalMarks === 0) finalVerdict = "zero";
  else if (question.maxMarks && totalMarks >= question.maxMarks) finalVerdict = "full";

  return { marks: totalMarks, verdict: finalVerdict, rubricVerdicts: verdicts };
}