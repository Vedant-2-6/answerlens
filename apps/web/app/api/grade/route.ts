import { NextResponse } from "next/server";
import { deriveRubric, evaluateAnswer } from "@answerlens/grading";
import type { Question, MappingResult, GradingResult } from "@answerlens/types";

export async function POST(req: Request) {
  try {
    const { mapping, question, settings } = await req.json() as { mapping: MappingResult, question?: Question, settings?: any };

    if (process.env.USE_STUBS === "true") {
      const max = question?.maxMarks ?? 5;
      const awarded = Math.max(0, max - 1); // e.g. 7->6, 5->4, 3->2
      
      return NextResponse.json({
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
      } as GradingResult);
    }

    if (!question || !mapping) {
      console.log("Missing mapping or question!", { mapping: JSON.stringify(mapping), question: JSON.stringify(question) });
      return NextResponse.json({ error: "Missing mapping or question" }, { status: 400 });
    }

    if (mapping.suppressed) {
      return NextResponse.json({
        questionId: mapping.questionId,
        marks: 0,
        maxMarks: question.maxMarks,
        verdict: "zero",
        qualitative: "Incorrect",
        feedback: "Grading suppressed due to low mapping confidence.",
        rubricVerdicts: [],
        suppressed: true,
        provisional: true
      } as GradingResult);
    }

    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    
    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "Missing OmniRoute credentials" }, { status: 500 });
    }

    // 1. Derive Rubric
    const rubric = await deriveRubric(question, baseUrl, apiKey, model, settings);

    // 2. Evaluate
    const evaluation = await evaluateAnswer(question, rubric, mapping.transcription, baseUrl, apiKey, model, settings);

    // 3. Construct GradingResult
    const res: GradingResult = {
      questionId: mapping.questionId,
      marks: evaluation.marks,
      maxMarks: question.maxMarks,
      verdict: evaluation.verdict,
      qualitative: evaluation.verdict === "full" ? "Correct" : evaluation.verdict === "partial" ? "Partial" : "Incorrect",
      feedback: evaluation.rubricVerdicts.map(v => v.justification).join(" ").slice(0, 200),
      rubricVerdicts: evaluation.rubricVerdicts,
      suppressed: false,
      provisional: true
    };

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("[POST /api/grade] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}