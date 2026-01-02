import { NextResponse } from "next/server";

import { fetchAllPatients } from "@/lib/demomed";

const clampLimit = (raw: string | null) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
};

const parseMaxPages = (raw: string | null) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(Math.trunc(parsed), 1);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const maxPages = parseMaxPages(searchParams.get("maxPages"));

  try {
    const result = await fetchAllPatients({ limit, maxPages });

    return NextResponse.json({
      data: result.patients,
      meta: {
        count: result.patients.length,
        pagesFetched: result.pagesFetched,
        totalPages: result.totalPages,
        limit: result.limit,
      },
    });
  } catch (error) {
    console.error("Failed to fetch patients", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch patients", message },
      { status: 500 },
    );
  }
}
