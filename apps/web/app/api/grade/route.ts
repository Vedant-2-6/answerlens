import { NextResponse } from "next/server";
import { deriveRubric, evaluateAnswer } from "@answerlens/grading";

export async function POST(req: Request) {
  try {
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}