import { NextResponse } from "next/server";
import { deriveRubricsBatch, evaluateAnswersBatch, critiqueBorderlineAnswer } from "@answerlens/grading";
import type { Question, MappingResult, GradingResult, OptionGroup } from "@answerlens/types";

export async function POST(req: Request) {
  try {
    const { items, settings, optionGroups } = await req.json() as { items: { mapping: MappingResult, question: Question }[], settings?: any, optionGroups?: OptionGroup[] };

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

    // Filter out suppressed mappings
    const validItems = items.filter(i => !i.mapping.suppressed);
    const suppressedItems = items.filter(i => i.mapping.suppressed);

    // 1. Derive Rubrics
    const questionsToGrade = validItems.map(i => i.question);
    const rubrics = await deriveRubricsBatch(questionsToGrade, settings);

    // 2. Evaluate
    const evalItems = validItems.map(i => ({
      question: i.question,
      rubric: rubrics[i.question.id] || [],
      answerText: i.mapping.transcription,
      finalAnswerText: i.mapping.finalAnswerText,
      mappingKind: i.mapping.kind
    }));
    const evaluations = await evaluateAnswersBatch(evalItems, settings);

    // 3. Construct GradingResults
    const results: GradingResult[] = [];
    
    for (const item of validItems) {
      const qid = item.question.id;
      const evaluation = evaluations[qid];
      if (evaluation) {
        let suppressed = false;
        let feedback = evaluation.rubricVerdicts.map((v: any) => v.justification).join(" ").slice(0, 200);
        let qualitative = evaluation.verdict === "full" ? "Correct" : evaluation.verdict === "partial" ? "Partial" : "Incorrect";

        if (item.mapping.confidence >= 0.50 && item.mapping.confidence < 0.75) {
          const metVerdicts = evaluation.rubricVerdicts
            .filter((v: any) => v.verdict === "met" || v.verdict === "partial")
            .map((v: any) => {
              const point = (rubrics[qid] || []).find(r => r.id === v.pointId);
              return {
                pointId: v.pointId,
                text: point ? point.text : "",
                justification: v.justification
              };
            });

          if (metVerdicts.length > 0) {
            const verifications = await critiqueBorderlineAnswer(
              item.question.text,
              item.mapping.transcription,
              metVerdicts
            );
            const ungrounded = verifications.filter(v => !v.grounded);
            if (ungrounded.length > 0) {
              suppressed = true;
              qualitative = "Needs review";
              feedback = `[Audit] Needs review: ${ungrounded.map(u => u.critique).join(" ")}`.slice(0, 200);
            }
          }
        }

        results.push({
          questionId: qid,
          marks: suppressed ? null : evaluation.marks,
          maxMarks: item.question.maxMarks,
          verdict: evaluation.verdict,
          qualitative: qualitative as any,
          feedback,
          rubricVerdicts: evaluation.rubricVerdicts,
          suppressed,
          provisional: true
        });
      }
    }

    for (const item of suppressedItems) {
      results.push({
        questionId: item.mapping.questionId,
        marks: null,
        maxMarks: item.question.maxMarks,
        verdict: "zero",
        qualitative: "Needs review",
        feedback: "Grading was suppressed because the answer sheet block could not be confidently mapped to this question.",
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
