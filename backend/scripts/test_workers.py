"""
Test run: run all three AI workers on 1,000 randomly sampled conversations
that have at least MIN_TURNS turns and have not yet been analyzed.

Runs intent classification, quality scoring, and completion status in a single
pass per conversation (3 LLM calls each). Updates the DB after every conversation.

Usage (from backend/):
    python -m scripts.test_workers
    python -m scripts.test_workers --target 200 --min-turns 5

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
"""

import argparse
import os
import random
import time

# load_dotenv MUST be called before importing workers so their module-level
# os.environ[] reads succeed.
from dotenv import load_dotenv
load_dotenv()

from openai import OpenAI, RateLimitError       # noqa: E402
from supabase import create_client             # noqa: E402

from workers.intent_classifier import analyze_intent          # noqa: E402
from workers.quality_scorer    import score_quality           # noqa: E402
from workers.task_completion   import analyze_completion, find_abandon_point  # noqa: E402

RATE_LIMIT_BACKOFF = 60  # seconds to wait after a rate-limit error
FETCH_BATCH = 20         # conversations fetched per Supabase IN query


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Test AI workers on a random sample.")
    p.add_argument("--target",    type=int, default=1000, help="Number of conversations to analyze (default: 1000)")
    p.add_argument("--min-turns", type=int, default=3,    help="Minimum turns_count from metadata (default: 3)")
    return p.parse_args()


# ── Helpers ───────────────────────────────────────────────────────────────────

def call_with_backoff(fn, *args):
    """Call fn(*args), retrying once after RATE_LIMIT_BACKOFF seconds on rate limit."""
    try:
        return fn(*args)
    except RateLimitError:
        print(f"  [rate limit] backing off {RATE_LIMIT_BACKOFF}s...", flush=True)
        time.sleep(RATE_LIMIT_BACKOFF)
        return fn(*args)  # let any second error propagate


# ── Main ─────────────────────────────────────────────────────────────────────

def run():
    args   = parse_args()
    TARGET = args.target
    MIN_TURNS = args.min_turns

    sb     = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    # ── Step 1: find eligible candidates ──────────────────────────────────────
    print(f"Fetching unanalyzed conversations (intent IS NULL, completion_status IS NULL)...", flush=True)

    result = (
        sb.table("conversations")
        .select("id, metadata")
        .is_("intent", "null")
        .is_("completion_status", "null")
        .execute()
    )
    all_rows = result.data
    print(f"  Total unanalyzed: {len(all_rows):,}", flush=True)

    candidates = [
        r["id"] for r in all_rows
        if (r.get("metadata") or {}).get("turns_count", 0) >= MIN_TURNS
    ]
    print(f"  With ≥ {MIN_TURNS} turns:  {len(candidates):,}", flush=True)

    if not candidates:
        print("\n[!] No eligible conversations found. Check that:")
        print("    • Workers haven't already processed everything")
        print("    • metadata.turns_count is populated (only ShareChat imports set this)")
        return

    sample_ids = random.sample(candidates, min(TARGET, len(candidates)))
    print(f"  Sampling:         {len(sample_ids):,}\n", flush=True)

    # ── Step 2: process in batches ────────────────────────────────────────────
    analyzed = 0
    skipped  = 0
    errors   = 0
    t0       = time.time()

    for batch_start in range(0, len(sample_ids), FETCH_BATCH):
        batch_ids = sample_ids[batch_start : batch_start + FETCH_BATCH]

        rows = (
            sb.table("conversations")
            .select("id, messages")
            .in_("id", batch_ids)
            .execute()
        )

        for row in rows.data:
            conv_id  = row["id"]
            messages = row.get("messages") or []

            if not messages:
                skipped += 1
                continue

            try:
                update: dict = {}

                # 1. Intent classification
                intent = call_with_backoff(analyze_intent, client, messages)
                if intent:
                    update["intent"] = intent

                # 2. Quality scoring
                quality = call_with_backoff(score_quality, client, messages)
                if quality is not None:
                    update["quality_score"] = quality

                # 3. Completion status (+ abandon_point for failed/abandoned)
                status = call_with_backoff(analyze_completion, client, messages)
                if status:
                    update["completion_status"] = status
                    if status in {"abandoned", "failed"}:
                        ap = find_abandon_point(messages)
                        if ap is not None:
                            update["abandon_point"] = ap

                if update:
                    sb.table("conversations").update(update).eq("id", conv_id).execute()
                    analyzed += 1
                else:
                    skipped += 1

            except Exception as e:
                print(f"  [error] {conv_id}: {e}", flush=True)
                errors += 1

        # Progress after each fetch batch
        done    = min(batch_start + FETCH_BATCH, len(sample_ids))
        elapsed = time.time() - t0
        rate    = done / elapsed if elapsed > 0 else 0
        eta     = (len(sample_ids) - done) / rate if rate > 0 else 0
        print(
            f"  [{done:>5}/{len(sample_ids)}]  "
            f"analyzed={analyzed}  skipped={skipped}  errors={errors}  "
            f"rate={rate:.1f}/s  ETA={eta:.0f}s",
            flush=True,
        )

    # ── Summary ───────────────────────────────────────────────────────────────
    elapsed = time.time() - t0
    print(f"\n{'='*55}", flush=True)
    print(f"  TEST RUN COMPLETE  ({elapsed:.0f}s)", flush=True)
    print(f"{'='*55}", flush=True)
    print(f"  Sampled    {len(sample_ids):>6,}", flush=True)
    print(f"  Analyzed   {analyzed:>6,}", flush=True)
    print(f"  Skipped    {skipped:>6,}  (empty messages)", flush=True)
    print(f"  Errors     {errors:>6,}", flush=True)
    print(f"{'='*55}\n", flush=True)


if __name__ == "__main__":
    run()
