import { NextResponse } from "next/server";
import { deriveRubricsBatch, evaluateAnswersBatch } from "@answerlens/grading";
import type { Question, MappingResult, GradingResult } from "@answerlens/types";

export async function POST(req: Request) {
  try {
    const { items, settings } = await req.json() as { items: { mapping: MappingResult, question: Question }[], settings?: any };

    if (process.env.USE_STUBS === "true") {
      return NextResponse.json(
        items.map(({ mapping, question }) => {
          const max = question.maxMarks ?? 5;
          const awarded = Math.max(0, max - 1);
          return {
            questionId: mapping.questionId,
            marks: awarded,
            maxMarks: max,
            verdict: awarded === max ? "full" : "partial",
            qualitative: awarded === max ? "Correct" : "Partial",
            feedback: "Stub feedback showing a realistic deduction.",
            rubricVerdicts: [
              { verdict: "met", justification: "Good conceptual understanding." },
              { verdict: "partial", justification: "Missed one edge case." }
            ],
            suppressed: false,
            provisional: true
          } as GradingResult;
        })
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json([]);
    }

    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    
    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "Missing OmniRoute credentials" }, { status: 500 });
    }

    // Filter out suppressed mappings
    const validItems = items.filter(i => !i.mapping.suppressed);
    const suppressedItems = items.filter(i => i.mapping.suppressed);

    // 1. Derive Rubrics
    const questionsToGrade = validItems.map(i => i.question);
    const rubrics = await deriveRubricsBatch(questionsToGrade, baseUrl, apiKey, model, settings);

    // 2. Evaluate
    const evalItems = validItems.map(i => ({
      question: i.question,
      rubric: rubrics[i.question.id] || [],
      answerText: i.mapping.transcription
    }));
    const evaluations = await evaluateAnswersBatch(evalItems, baseUrl, apiKey, model, settings);

    // 3. Construct GradingResults
    const results: GradingResult[] = [];
    
    for (const item of validItems) {
      const qid = item.question.id;
      const evaluation = evaluations[qid];
      if (evaluation) {
        results.push({
          questionId: qid,
          marks: evaluation.marks,
          maxMarks: item.question.maxMarks,
          verdict: evaluation.verdict,
          qualitative: evaluation.verdict === "full" ? "Correct" : evaluation.verdict === "partial" ? "Partial" : "Incorrect",
          feedback: evaluation.rubricVerdicts.map((v: any) => v.justification).join(" ").slice(0, 200),
          rubricVerdicts: evaluation.rubricVerdicts,
          suppressed: false,
          provisional: true
        });
      }
    }

    for (const item of suppressedItems) {
      results.push({
        questionId: item.mapping.questionId,
        marks: 0,
        maxMarks: item.question.maxMarks,
        verdict: "zero",
        qualitative: "Incorrect",
        feedback: "Grading suppressed due to low mapping confidence.",
        rubricVerdicts: [],
        suppressed: true,
        provisional: true
      });
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[POST /api/grade-batch] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
