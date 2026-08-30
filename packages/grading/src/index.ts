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
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  };
  
  let attempt = 0;
  let response;
  while (attempt < 15) {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      break;
    }
    if (response.status === 429) {
      attempt++;
      if (attempt < 15) {
        let waitTimeMs = Math.min(attempt * 10000, 60000);
        const errText = await response.clone().text().catch(() => "");
        const match = errText.match(/retry in ([\d\.]+)s/i);
        if (match && match[1]) {
          waitTimeMs = (parseFloat(match[1]) * 1000) + 2000;
        }
        console.log(`[Rate Limit Grading] Waiting ${Math.round(waitTimeMs/1000)}s before attempt ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTimeMs));
        continue;
      }
    }
    throw new Error(`OmniRoute error: ${await response.text()}`);
  }
  
  let content = (await response!.json()).choices[0].message.content;
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
For mathematical solutions, evaluate the steps logic carefully even if the final answer is wrong.
For bad or cluttered handwriting, infer the student's intent generously where the technical terms or formulas are identifiable.

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
  items: { question: Question, rubric: RubricPoint[], answerText: string }[],
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