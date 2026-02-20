"""
Explore tucnguyen/ShareChat dataset from HuggingFace.
The dataset has five configs: chatgpt, claude, gemini, grok, perplexity.
Uses streaming=True to avoid OOM on large datasets.
"""

import itertools
import json

from datasets import load_dataset

DATASET   = "tucnguyen/ShareChat"
CONFIGS   = ["chatgpt", "claude", "gemini", "grok", "perplexity"]
N_EXAMPLES = 3


MAX_STR_LEN = 300  # truncate long string values for readability


def truncate(obj, max_len=MAX_STR_LEN):
    """Recursively truncate long strings in a dict/list for display."""
    if isinstance(obj, str):
        return obj[:max_len] + ("…" if len(obj) > max_len else "")
    if isinstance(obj, dict):
        return {k: truncate(v, max_len) for k, v in obj.items()}
    if isinstance(obj, list):
        return [truncate(v, max_len) for v in obj]
    return obj


def explore_config(name: str, config: str):
    print(f"\n{'='*60}")
    print(f"Config: {config}")
    print("="*60)

    ds = load_dataset(name, config, split="train", streaming=True)
    examples = list(itertools.islice(ds, N_EXAMPLES))

    if not examples:
        print("  [!] No examples returned.")
        return

    print(f"Columns : {list(examples[0].keys())}")
    print(f"(Row count unavailable in streaming mode)\n")

    for i, ex in enumerate(examples):
        print(f"--- Example {i+1} ---")
        print(json.dumps(truncate(ex), indent=2, ensure_ascii=False, default=str))
        print()


if __name__ == "__main__":
    print(f"Dataset : {DATASET}")
    print(f"Configs : {CONFIGS}")

    for config in CONFIGS:
        try:
            explore_config(DATASET, config)
        except Exception as e:
            print(f"\n[ERROR] Config '{config}' failed: {e}")
