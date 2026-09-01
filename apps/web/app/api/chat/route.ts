import { NextRequest, NextResponse } from "next/server";
import { callLLMJSON, getLLMCredentials } from "@answerlens/providers";

export async function POST(req: NextRequest) {
  try {
    const { query, ocrContext, gradingContext } = await req.json();

    const omnirouteBaseUrl = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
    const omnirouteApiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || "gemini-3.6-flash";

    if (!omnirouteApiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    const systemPrompt = `You are the AnswerLens AI Assistant. You help teachers review student answer sheets and understand the grading.
You have access to the raw OCR text of the student's answer sheet, and the AI's grading output.
Answer the teacher's query concisely and accurately based on the context.

Context:
[OCR Text]
${ocrContext}

[Grading Output]
${gradingContext}
`;

    const payloadBase = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.2
    };

    const credentials = getLLMCredentials(omnirouteApiKey, model, omnirouteBaseUrl);
    const { raw } = await callLLMJSON(payloadBase, credentials);

    return NextResponse.json({ answer: raw });
  } catch (error: any) {
    console.error("[Chat API]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
