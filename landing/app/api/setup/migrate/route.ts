import { NextRequest, NextResponse } from "next/server";
import { ensureTables } from "@/lib/db";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTables();
    return NextResponse.json({ migrated: true });
  } catch (err) {
    console.error("[migrate] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
