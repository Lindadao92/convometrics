# Feature Request: Topic Consolidation Worker

## Problem
The intent classifier creates many micro-topics that are semantically identical:
- "python web scraping" + "python website scraping" + "scrape websites python"
- "resume writing" + "writing resume" + "resume creation"  
- "react component help" + "react components" + "help with react components"

This leads to:
- Fragmented analytics (100+ topics instead of 20 meaningful ones)
- Difficulty identifying patterns  
- Poor dashboard UX with too many tiny categories

## Solution
Create `backend/workers/topic_consolidator.py` that:

1. **Analyzes existing topics** - Fetches all intents with 3+ conversations
2. **Finds similar groups** - Uses GPT-4o-mini to identify semantic duplicates  
3. **Suggests consolidations** - Proposes canonical forms (e.g. "python web scraping" for all variants)
4. **Applies changes** - Updates conversation.intent column in bulk

## Implementation Details

### Algorithm
```python
# 1. Get topic frequencies
topic_counts = {"python web scraping": 15, "scrape websites python": 8, "python website scraping": 12}

# 2. Send to GPT for grouping
prompt = "Group these topics by similarity: python web scraping, scrape websites python, python website scraping"
response = {"groups": [{"canonical": "python web scraping", "variants": ["scrape websites python", "python website scraping"]}]}

# 3. Update database
UPDATE conversations SET intent = 'python web scraping' WHERE intent IN ('scrape websites python', 'python website scraping')
```

### Safety Features
- **Dry run mode** - Preview changes before applying
- **Minimum threshold** - Only consolidate topics with 3+ conversations
- **Conservative grouping** - Only group truly identical concepts
- **Audit log** - Track all consolidation decisions

### Usage
```bash
# Preview consolidations
python -m workers.topic_consolidator

# Apply consolidations  
python -m workers.topic_consolidator --apply

# Target specific topics
python -m workers.topic_consolidator --topics "python,javascript,react"
```

## Impact
- **Better analytics** - Cleaner topic distribution in dashboard
- **Easier insights** - Focus on meaningful patterns vs noise  
- **Improved UX** - Dashboard shows 15-20 clear topics instead of 100+ fragments
- **Better reporting** - Client reports show coherent topic categories

## Technical Notes
- Use `gpt-4o-mini` (cheaper for this task)
- Process in batches of 50 topics to avoid token limits
- Store consolidation history for rollback if needed
- Run weekly/monthly to maintain topic hygiene

## Priority
**Medium** - Would improve dashboard clarity but not critical for launch

## Files to Create
1. `backend/workers/topic_consolidator.py` - Main consolidation logic
2. `backend/scripts/consolidation_history.py` - Track/rollback changes  
3. Add consolidation metrics to admin dashboard

## Success Metrics
- Reduce unique topic count by 60-80%
- Improve topic coherence scores in dashboard
- Faster insight discovery in analytics