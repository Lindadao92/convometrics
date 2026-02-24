import { NextRequest, NextResponse } from "next/server";
import { computeMockSafetyData } from "@/lib/mockSegmentData";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "ai_assistant";
  return NextResponse.json(computeMockSafetyData(segment));
}
