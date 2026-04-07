import { sql } from "@vercel/postgres";

// Create all tables if they don't exist
export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS orgs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text,
      slug text UNIQUE,
      vapi_api_key text,
      retell_api_key text,
      webhook_secret text DEFAULT gen_random_uuid()::text,
      posthog_api_key text,
      mixpanel_token text,
      slack_webhook_url text,
      linear_api_key text,
      created_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS org_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES orgs(id),
      email text UNIQUE,
      created_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calls (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES orgs(id),
      external_call_id text,
      platform text,
      started_at timestamptz,
      ended_at timestamptz,
      duration_seconds int,
      transcript jsonb,
      raw_payload jsonb,
      intent text,
      outcome text,
      outcome_confidence float,
      sentiment_score float,
      flags text[],
      ai_analysis text,
      caller_phone text,
      analysis_status text DEFAULT 'pending',
      created_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS weekly_briefings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES orgs(id),
      week_start date,
      week_end date,
      total_calls int,
      reported_completion_rate float,
      actual_resolution_rate float,
      gap_points int,
      top_failing_intents jsonb,
      hidden_patterns jsonb,
      sprint_recommendation jsonb,
      briefing_markdown text,
      pushed_to_posthog boolean DEFAULT false,
      pushed_to_mixpanel boolean DEFAULT false,
      pushed_to_slack boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    )
  `;
}
