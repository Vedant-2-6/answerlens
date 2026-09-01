import { z } from "zod";
import type { Question, RubricPoint, RubricVerdict, Verdict } from "@answerlens/types";
import { mathEquivalenceCheck, extractExpectedAnswer } from "./math-verify";
import { callLLMJSON, getLLMCredentials } from "@answerlens/providers";

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
For math or logical problems, separate the steps/formulas from the final answer to allow partial marking.
Set 'required' to true only for points without which the answer is fundamentally wrong.

Return a JSON object matching exactly this structure:
{
  "rubric": [
    {
      "id": "1",
      "description": "string",
      "weight": 2.5,
      "required": false
    }
  ]
}`;

async function callOmniRouteJSON(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<{ parsed: any, raw: string }> {
  const payloadBase = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  };

  const credentials = getLLMCredentials(apiKey, model, baseUrl);
  return callLLMJSON(payloadBase, credentials);
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
For mathematical solutions, evaluate the steps logic carefully even if the final answer is wrong.
Base every verdict only on what is actually legible in the transcription. If handwriting is
unclear, say so explicitly in the justification rather than guessing what the student probably
meant — an illegible answer is not evidence of understanding, even if a technical term or formula
is partially recognizable. When genuinely uncertain, use 'partial' or 'unmet' rather than 'met',
and say why in the justification.
When comparing a student's answer to what is expected, judge correctness by mathematical or
factual equivalence, not exact notation or phrasing. Accept equivalent numeric forms (fractions,
decimals, percentages), equivalent algebraic forms (expanded vs. factored), and different valid
methods that reach the same correct result. Do not deduct marks for notation style or handwriting
formatting alone.
If the answer demonstrates a complete, internally consistent, correct method that isn't listed in
the rubric, still award full credit for the equivalent rubric points it satisfies, and note in
the justification that an alternate valid method was used.

Return JSON matching exactly this structure:
{
  "rubricVerdicts": [
    {
      "pointId": "1",
      "verdict": "met",
      "justification": "string"
    }
  ]
}`;

export async function evaluateAnswer(
  question: Question,
  rubric: RubricPoint[],
  answerText: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  settings?: any,
  finalAnswerText?: string | null
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

    if (finalAnswerText && /final answer|final result|correct value|numeric value|symbolic value|correct answer|verdict|conclusion/i.test(point.text)) {
      const expectedMath = extractExpectedAnswer(point.text);
      if (expectedMath) {
        const mathRes = mathEquivalenceCheck(expectedMath, finalAnswerText);
        if (mathRes === true) {
          v.verdict = "met";
          v.justification = `[Math Verified] Student's final answer (${finalAnswerText}) is mathematically equivalent to the expected answer (${expectedMath}).`;
        } else if (mathRes === false) {
          v.verdict = "unmet";
          v.justification = `[Math Verified] Student's final answer (${finalAnswerText}) is NOT mathematically equivalent to the expected answer (${expectedMath}).`;
        }
      }
    }

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

// ----------------------------------------------------------------------------
// BATCH ENDPOINTS
// ----------------------------------------------------------------------------

export async function deriveRubricsBatch(
  questions: Question[],
  baseUrl: string,
  apiKey: string,
  model: string,
  settings?: any
): Promise<Record<string, RubricPoint[]>> {
  const validQs = questions.filter(q => q.maxMarks && q.maxMarks > 0);
  if (validQs.length === 0) return {};

  const userPrompt = `Generate a rubric for each of the following questions.\n\n` +
    validQs.map(q => `ID: ${q.id}\nQuestion: ${q.text}\nMax Marks: ${q.maxMarks}`).join("\n\n");

  let sysPrompt = P04_SYSTEM_PROMPT.replace(
    /Return a JSON object matching exactly this structure:[\s\S]*/,
    `Return a JSON object matching exactly this structure, using the question ID as the key:
{
  "rubrics": {
    "Q-1": [
      {
        "id": "1",
        "text": "string",
        "weight": 2.5,
        "required": false
      }
    ]
  }
}`
  );

  if (settings) {
    const mods = [];
    if (settings.focus === "steps") mods.push("- Emphasize steps, workings, and methodology when breaking down marks.");
    else if (settings.focus === "answer") mods.push("- Emphasize the correct final answer when breaking down marks.");
    if (settings.allowPartial === false) mods.push("- Partial marks are strictly disabled. Make points atomic (no half-marks).");
    sysPrompt += "\n\nTEACHER INSTRUCTIONS:\n" + mods.join("\n");
  }

  const { parsed } = await callOmniRouteJSON(baseUrl, apiKey, model, sysPrompt, userPrompt);
  
  const result: Record<string, RubricPoint[]> = {};
  const rubricsObj = parsed.rubrics || parsed;
  for (const q of validQs) {
    if (rubricsObj[q.id]) {
      try {
        result[q.id] = RubricSchema.parse(rubricsObj[q.id]);
      } catch (e) {
        result[q.id] = [];
      }
    } else {
      result[q.id] = [];
    }
  }
  return result;
}

export async function evaluateAnswersBatch(
  items: { question: Question, rubric: RubricPoint[], answerText: string, finalAnswerText?: string | null }[],
  baseUrl: string,
  apiKey: string,
  model: string,
  settings?: any
): Promise<Record<string, { marks: number; verdict: Verdict; rubricVerdicts: RubricVerdict[] }>> {
  if (items.length === 0) return {};

  const userPrompt = `Evaluate the student answers against the rubrics for the following questions.\n\n` +
    items.map(i => `ID: ${i.question.id}\nQuestion: ${i.question.text}\nRubric: ${JSON.stringify(i.rubric)}\nStudent Answer: ${i.answerText}`).join("\n\n---\n\n");

  let sysPrompt = P05_SYSTEM_PROMPT.replace(
    /Return JSON matching exactly this structure:[\s\S]*/,
    `Return JSON matching exactly this structure, using the question ID as the key:
{
  "evaluations": {
    "Q-1": {
      "rubricVerdicts": [
        {
          "pointId": "1",
          "verdict": "met",
          "justification": "string"
        }
      ]
    }
  }
}`
  );

  if (settings) {
    const mods = [];
    if (settings.focus === "steps") mods.push("- Evaluate based on steps, workings, and methodology.");
    else if (settings.focus === "answer") mods.push("- Evaluate strictly based on the final answer.");
    if (settings.allowPartial === false) mods.push("- Partial marking is disabled. DO NOT return 'partial' as a verdict, only 'met' or 'unmet'.");
    sysPrompt += "\n\nTEACHER INSTRUCTIONS:\n" + mods.join("\n");
  }

  const { parsed } = await callOmniRouteJSON(baseUrl, apiKey, model, sysPrompt, userPrompt);
  
  const result: Record<string, { marks: number; verdict: Verdict; rubricVerdicts: RubricVerdict[] }> = {};
  const evalsObj = parsed.evaluations || parsed;

  for (const item of items) {
    const qid = item.question.id;
    if (item.rubric.length === 0) {
      result[qid] = { marks: 0, verdict: "zero", rubricVerdicts: [] };
      continue;
    }

    let verdicts: RubricVerdict[] = [];
    if (evalsObj[qid] && evalsObj[qid].rubricVerdicts) {
      try {
        verdicts = EvaluationSchema.parse(evalsObj[qid]).rubricVerdicts;
      } catch (e) {
        // Fallback
      }
    }

    let totalMarks = 0;
    let requiredFailed = false;

    for (const v of verdicts) {
      const point = item.rubric.find(r => r.id === v.pointId);
      if (!point) continue;

      if (item.finalAnswerText && /final answer|final result|correct value|numeric value|symbolic value|correct answer|verdict|conclusion/i.test(point.text)) {
        const expectedMath = extractExpectedAnswer(point.text);
        if (expectedMath) {
          const mathRes = mathEquivalenceCheck(expectedMath, item.finalAnswerText);
          if (mathRes === true) {
            v.verdict = "met";
            v.justification = `[Math Verified] Student's final answer (${item.finalAnswerText}) is mathematically equivalent to the expected answer (${expectedMath}).`;
          } else if (mathRes === false) {
            v.verdict = "unmet";
            v.justification = `[Math Verified] Student's final answer (${item.finalAnswerText}) is NOT mathematically equivalent to the expected answer (${expectedMath}).`;
          }
        }
      }

      if (v.verdict === 'met') totalMarks += point.weight;
      else if (v.verdict === 'partial') totalMarks += (settings?.allowPartial === false ? 0 : (point.weight * 0.5));
      if (point.required && v.verdict === 'unmet') requiredFailed = true;
    }

    if (requiredFailed) totalMarks = 0;
    totalMarks = Math.round(totalMarks * 100) / 100;
    if (item.question.maxMarks && totalMarks > item.question.maxMarks) {
      totalMarks = item.question.maxMarks;
    }

    let finalVerdict: Verdict = "partial";
    if (totalMarks === 0) finalVerdict = "zero";
    else if (item.question.maxMarks && totalMarks >= item.question.maxMarks) finalVerdict = "full";

    result[qid] = { marks: totalMarks, verdict: finalVerdict, rubricVerdicts: verdicts };
  }

  return result;
}

export async function critiqueBorderlineAnswer(
  questionText: string,
  transcription: string,
  metVerdicts: { pointId: string; text: string; justification: string }[],
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ pointId: string; grounded: boolean; critique: string }[]> {
  if (metVerdicts.length === 0) return [];

  const sysPrompt = `You are a strict grading auditor.
Verify if the claims made in the grading justifications are actually, literally supported by the student's handwritten transcription.
Do not assume or infer. If the justification claims the student showed a formula or reached a value, but that formula/value is not clearly legible in the transcription, mark it as NOT grounded.

Expected JSON output format:
{
  "verifications": [
    {
      "pointId": "1",
      "grounded": false,
      "critique": "The justification claims the student solved x = 5, but the transcription has no mention of x or 5."
    }
  ]
}`;

  const userPrompt = `Question: ${questionText}
Student Transcription: ${transcription}

Rubric Points Claimed as Met:
${metVerdicts.map(v => `Point ID: ${v.pointId}
Rubric Description: ${v.text}
Grader Justification: ${v.justification}`).join("\n\n")}
`;

  try {
    const credentials = getLLMCredentials(apiKey, model, baseUrl);
    const payloadBase = {
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    };
    const { parsed } = await callLLMJSON(payloadBase, credentials);
    return parsed.verifications || [];
  } catch (e) {
    console.error("[Self Critique Error]", e);
    return metVerdicts.map(v => ({ pointId: v.pointId, grounded: true, critique: "" }));
  }
}