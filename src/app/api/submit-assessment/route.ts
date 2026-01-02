import { NextResponse } from "next/server";

import { submitAssessment, type AssessmentPayload } from "@/lib/demomed";

const normalizeIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((id) => id.trim())
    .filter(Boolean);
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AssessmentPayload>;
    const payload: AssessmentPayload = {
      high_risk_patients: normalizeIds(body.high_risk_patients),
      fever_patients: normalizeIds(body.fever_patients),
      data_quality_issues: normalizeIds(body.data_quality_issues),
    };

    const result = await submitAssessment(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to submit assessment", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to submit assessment", message },
      { status: 500 },
    );
  }
}
