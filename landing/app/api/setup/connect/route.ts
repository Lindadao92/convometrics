import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";
import { backfillVapi, backfillRetell, testVapiConnection, testRetellConnection } from "@/lib/backfill";
import { analyzePendingCalls } from "@/lib/analyze-call";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, apiKey } = await req.json();
  if (!platform || !apiKey) {
    return NextResponse.json({ error: "platform and apiKey required" }, { status: 400 });
  }

  let valid = false;
  if (platform === "vapi") valid = await testVapiConnection(apiKey);
  else if (platform === "retell") valid = await testRetellConnection(apiKey);
  else return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });

  if (!valid) {
    return NextResponse.json({ error: "Could not connect. Check your API key." }, { status: 400 });
  }

  // Save API key
  if (platform === "vapi") {
    await sql`UPDATE orgs SET vapi_api_key = ${apiKey} WHERE id = ${session.orgId}::uuid`;
  } else {
    await sql`UPDATE orgs SET retell_api_key = ${apiKey} WHERE id = ${session.orgId}::uuid`;
  }

  // Fire-and-forget backfill + analysis
  (async () => {
    try {
      const imported = platform === "vapi"
        ? await backfillVapi(session.orgId, apiKey)
        : await backfillRetell(session.orgId, apiKey);
      console.log(`[setup] Backfill: ${imported} calls for org ${session.orgId}`);
      const analyzed = await analyzePendingCalls(session.orgId);
      console.log(`[setup] Analyzed: ${analyzed} calls for org ${session.orgId}`);
    } catch (err) {
      console.error(`[setup] Backfill error:`, err);
    }
  })();

  return NextResponse.json({ connected: true, platform });
}
