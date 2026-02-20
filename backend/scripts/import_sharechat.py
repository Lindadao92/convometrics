print("Script starting...", flush=True)

"""
Import tucnguyen/ShareChat conversations into Supabase.

Idempotent: checks for existing conversation_ids before each insert batch
and skips duplicates, so re-running picks up where it left off.

Usage (from backend/):
    python -m scripts.import_sharechat
    python -m scripts.import_sharechat --configs chatgpt,grok
    python -m scripts.import_sharechat --configs perplexity

Requires SUPABASE_URL and SUPABASE_KEY in .env, and a valid HuggingFace login.
"""

import argparse
import hashlib
import os
import time
from collections import defaultdict

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

DATASET      = "tucnguyen/ShareChat"
ALL_CONFIGS  = ["chatgpt", "claude", "gemini", "grok", "perplexity"]

INSERT_BATCH   = 100    # rows per Supabase insert call
PROGRESS_EVERY = 500    # print summary progress every N conversations
STREAM_WINDOW  = 5_000  # rows to buffer before flushing complete conversations

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import tucnguyen/ShareChat into Supabase (English only, idempotent)."
    )
    parser.add_argument(
        "--configs",
        metavar="c1,c2,...",
        type=lambda s: [c.strip() for c in s.split(",")],
        default=ALL_CONFIGS,
        help=(
            f"Comma-separated configs to import (default: all). "
            f"Options: {', '.join(ALL_CONFIGS)}"
        ),
    )
    args = parser.parse_args()

    unknown = [c for c in args.configs if c not in ALL_CONFIGS]
    if unknown:
        parser.error(f"Unknown config(s): {', '.join(unknown)}. Valid: {', '.join(ALL_CONFIGS)}")

    return args


# ── Supabase ──────────────────────────────────────────────────────────────────

def get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def get_or_create_customer(sb) -> str:
    res = sb.table("customers").select("id").limit(1).execute()
    if res.data:
        cid = res.data[0]["id"]
        print(f"Using existing customer: {cid}", flush=True)
        return cid
    ins = sb.table("customers").insert({
        "api_key": "sharechat_import",
        "name":    "ShareChat Import",
    }).execute()
    cid = ins.data[0]["id"]
    print(f"Created new customer: {cid}", flush=True)
    return cid


# ── Helpers ───────────────────────────────────────────────────────────────────

def url_to_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def to_role(raw: str) -> str:
    raw = (raw or "").lower()
    if raw in ("llm", "assistant", "model"):
        return "assistant"
    return "user"


def build_conversation(url: str, platform: str, turns: list[dict], index: int) -> dict:
    turns.sort(key=lambda r: r.get("message_index", 0))

    messages = [
        {"role": to_role(r.get("role", "")), "content": (r.get("plain_text") or "").strip()}
        for r in turns
        if (r.get("plain_text") or "").strip()
    ]

    created_at = None
    for field in ("create_time", "created_at", "message_create_time", "last_updated", "published_at"):
        val = turns[0].get(field)
        if val and isinstance(val, str) and not val.startswith("ts:"):
            created_at = val
            break

    turns_count = turns[0].get("turns_count", len(messages))
    model       = turns[0].get("model") or None

    return {
        "conversation_id":  url_to_id(url),
        "user_id":          f"sharechat_{platform}_{index}",
        "messages":         messages,
        "metadata": {
            "source":       "sharechat",
            "platform":     platform,
            "turns_count":  turns_count,
            "original_url": url,
            "model":        model,
        },
        "intent":            None,
        "quality_score":     None,
        "completion_status": None,
        **({"created_at": created_at} if created_at else {}),
    }


def insert_batch(sb, customer_id: str, rows: list[dict], config: str) -> tuple[int, int]:
    """
    Insert rows into Supabase, skipping any whose conversation_id already exists.
    Returns (inserted, skipped).
    """
    if not rows:
        return 0, 0

    # Dedup: find which conversation_ids already exist
    ids = [r["conversation_id"] for r in rows]
    existing_res = (
        sb.table("conversations")
        .select("conversation_id")
        .in_("conversation_id", ids)
        .execute()
    )
    existing_ids = {r["conversation_id"] for r in existing_res.data}

    new_rows = [r for r in rows if r["conversation_id"] not in existing_ids]
    skipped  = len(rows) - len(new_rows)

    if skipped:
        print(f"    [dedup]  {config}: {skipped} already exist, skipping", flush=True)

    if not new_rows:
        return 0, skipped

    payload = [{"customer_id": customer_id, **r} for r in new_rows]
    for start in range(0, len(payload), INSERT_BATCH):
        chunk = payload[start : start + INSERT_BATCH]
        sb.table("conversations").insert(chunk).execute()
        print(f"    [insert] {config}: inserted {len(chunk)} rows (offset {start})", flush=True)

    return len(new_rows), skipped


# ── Per-config streaming import ───────────────────────────────────────────────

def import_config(sb, customer_id: str, config: str, global_stats: dict) -> int:
    from datasets import load_dataset

    print(f"\n{'─'*60}", flush=True)
    print(f"Starting config {config}...", flush=True)
    print(f"{'─'*60}", flush=True)

    platform_inserted = 0
    platform_skipped  = 0
    pending: list[dict] = []
    window: dict[str, list[dict]] = defaultdict(list)
    ready_urls: list[str] = []

    conv_index  = global_stats["total"]
    rows_seen   = 0
    convs_built = 0

    stream = load_dataset(DATASET, config, split="train", streaming=True)

    for raw_row in stream:
        rows_seen += 1
        if rows_seen % 1000 == 0:
            print(
                f"  [stream] {config}: {rows_seen:,} rows streamed, "
                f"{platform_inserted:,} inserted, {platform_skipped:,} skipped",
                flush=True,
            )

        url  = raw_row.get("url") or ""
        lang = raw_row.get("detected_language_final") or ""
        if not url or lang != "English":
            continue

        window[url].append(raw_row)

        expected = raw_row.get("turns_count", 1)
        if len(window[url]) >= expected:
            ready_urls.append(url)

        if len(ready_urls) >= STREAM_WINDOW or len(window) >= STREAM_WINDOW * 2:
            for u in ready_urls:
                turns = window.pop(u, [])
                if not turns:
                    continue
                conv = build_conversation(u, config, turns, conv_index)
                pending.append(conv)
                conv_index  += 1
                convs_built += 1

                if convs_built % 100 == 0:
                    print(f"  [group]  {config}: {convs_built:,} conversations grouped", flush=True)

            ready_urls.clear()

            if pending:
                ins, skp = insert_batch(sb, customer_id, pending, config)
                platform_inserted += ins
                platform_skipped  += skp
                pending.clear()

            global_stats["total"]           = conv_index
            global_stats[f"{config}_ins"]   = platform_inserted
            global_stats[f"{config}_skip"]  = platform_skipped
            if platform_inserted % PROGRESS_EVERY < INSERT_BATCH:
                _print_progress(global_stats, config)

    # ── Flush remaining ───────────────────────────────────────────────────────
    print(f"  [stream] {config}: stream exhausted at {rows_seen:,} rows", flush=True)

    remaining = set(ready_urls) | set(window.keys())
    print(f"  [flush]  {config}: flushing {len(remaining):,} remaining conversations", flush=True)

    for u in remaining:
        turns = window.pop(u, [])
        if not turns:
            continue
        conv = build_conversation(u, config, turns, conv_index)
        pending.append(conv)
        conv_index += 1

    global_stats["total"] = conv_index

    if pending:
        ins, skp = insert_batch(sb, customer_id, pending, config)
        platform_inserted += ins
        platform_skipped  += skp

    global_stats[f"{config}_ins"]  = platform_inserted
    global_stats[f"{config}_skip"] = platform_skipped

    print(
        f"  ✓ {config} done: {platform_inserted:,} inserted, "
        f"{platform_skipped:,} skipped (already existed)",
        flush=True,
    )
    return platform_inserted


# ── Progress / summary ────────────────────────────────────────────────────────

def _print_progress(stats: dict, current_config: str):
    parts = []
    for c in ALL_CONFIGS:
        ins = stats.get(f"{c}_ins", 0)
        if ins:
            parts.append(f"{c}={ins:,}")
    print(f"  [progress] total_inserted={stats['total']:,}  ({', '.join(parts)})", flush=True)


def print_summary(stats: dict, configs: list[str]):
    print(f"\n{'='*60}", flush=True)
    print(f"  IMPORT COMPLETE — SUMMARY", flush=True)
    print(f"{'='*60}", flush=True)
    print(f"  {'Platform':<14} {'Inserted':>12} {'Skipped':>12}", flush=True)
    print(f"  {'─'*14} {'─'*12} {'─'*12}", flush=True)
    total_ins  = 0
    total_skip = 0
    for c in configs:
        ins  = stats.get(f"{c}_ins",  0)
        skip = stats.get(f"{c}_skip", 0)
        total_ins  += ins
        total_skip += skip
        print(f"  {c:<14} {ins:>12,} {skip:>12,}", flush=True)
    print(f"  {'─'*14} {'─'*12} {'─'*12}", flush=True)
    print(f"  {'TOTAL':<14} {total_ins:>12,} {total_skip:>12,}", flush=True)
    print(f"{'='*60}\n", flush=True)


# ── Entry point ───────────────────────────────────────────────────────────────

def run():
    args        = parse_args()
    configs     = args.configs
    sb          = get_supabase()
    customer_id = get_or_create_customer(sb)

    stats: dict = {"total": 0}
    t0 = time.time()

    print(f"\nDataset : {DATASET}", flush=True)
    print(f"Configs : {configs}", flush=True)
    print(f"Filter  : English only", flush=True)
    print(f"Batch   : {INSERT_BATCH} rows/insert, dedup check per batch\n", flush=True)

    for config in configs:
        try:
            import_config(sb, customer_id, config, stats)
        except Exception:
            import traceback
            print(f"\n[ERROR] Config '{config}' failed:", flush=True)
            traceback.print_exc()

    elapsed = time.time() - t0
    print(f"\nElapsed: {elapsed:.0f}s", flush=True)
    print_summary(stats, configs)


if __name__ == "__main__":
    run()
