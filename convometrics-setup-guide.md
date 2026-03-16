# Convometrics Setup Guide

Complete setup instructions for running Convometrics locally and in production.

## Quick Start (5 minutes)

### Prerequisites
- **Node.js 18+** (check: `node --version`)
- **Python 3.11+** (check: `python --version`)
- **Supabase account** (free tier works)
- **OpenAI API key** (for AI analysis)

### 1. Clone and Install

```bash
git clone https://github.com/Lindadao92/convometrics.git
cd convometrics

# Install frontend dependencies
cd dashboard && npm install

# Install backend dependencies (optional - for data ingestion)
cd ../backend && pip install -r requirements.txt
```

### 2. Environment Setup

Create `dashboard/.env.local`:

```env
# Supabase (get from https://supabase.com/dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-key-here

# Optional: Demo mode (shows sample data)
DEMO_MODE=true
```

### 3. Run Development Server

```bash
cd dashboard
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Database Setup

Convometrics uses Supabase (PostgreSQL) for data storage. The demo includes 146,644 conversations from the ShareChat dataset.

### Schema Overview

```sql
-- Conversations: Core conversation data
conversations (
  id UUID PRIMARY KEY,
  conversation_id TEXT,
  user_id TEXT,
  messages JSONB,
  intent TEXT,              -- AI-classified intent
  quality_score INTEGER,    -- 0-100 quality rating
  completion_status TEXT,   -- completed, failed, abandoned
  cluster_id UUID,          -- topic cluster assignment
  metadata JSONB,
  created_at TIMESTAMP
);

-- Topic Clusters: Grouped conversation topics
topic_clusters (
  id UUID PRIMARY KEY,
  cluster_name TEXT UNIQUE,
  topic_labels TEXT[],
  conversation_count INTEGER,
  updated_at TIMESTAMP
);
```

### Database Seeding (Optional)

To seed with demo data:

```bash
cd backend/scripts
python seed_perplexity_demo.py
```

This creates realistic conversation data for testing the analytics.

## AI Workers

Convometrics includes background workers for conversation analysis:

### Intent Classifier

Analyzes conversations to determine user intent:

```bash
cd backend
python -m workers.intent_classifier --limit 100
```

**What it does:**
- Reads conversations with null intent
- Sends to GPT-4o-mini for classification
- Returns free-form topic labels (e.g., "python web scraping", "resume writing")
- Updates `conversations.intent` column

### Topic Clusterer

Groups similar intents into topic clusters:

```bash
cd backend
python -m workers.topic_clusterer
```

**What it does:**
- Reads all distinct intent labels
- Uses GPT-4o-mini to group into 10-20 high-level categories
- Creates/updates topic_clusters table
- Assigns conversations to clusters via cluster_id

### Running Workers in Production

Set up cron jobs or use a process manager:

```bash
# Run every hour
0 * * * * cd /path/to/convometrics/backend && python -m workers.intent_classifier --limit 500

# Run daily at 2 AM
0 2 * * * cd /path/to/convometrics/backend && python -m workers.topic_clusterer
```

## Data Ingestion

### CSV Upload (Web Interface)

1. Go to `/upload` in the dashboard
2. Select CSV file with columns: `messages`, `user_id`, `timestamp`
3. Upload and wait for processing
4. Run AI workers to analyze new conversations

### API Ingestion (Programmatic)

```bash
curl -X POST "http://localhost:3000/api/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "conversations": [
      {
        "conversation_id": "conv_123",
        "user_id": "user_456",
        "messages": [
          {"role": "user", "content": "How do I fix this Python error?"},
          {"role": "assistant", "content": "Here are some troubleshooting steps..."}
        ],
        "metadata": {"platform": "support_chat", "source": "api"}
      }
    ]
  }'
```

## Production Deployment

### Vercel (Recommended for Dashboard)

1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub fork
   - Set build directory to `dashboard`

2. **Environment Variables:**
   Add all variables from `.env.local` to Vercel dashboard

3. **Deploy:**
   - Vercel auto-deploys on push to main
   - Custom domains supported

### Backend Workers (Separate Hosting)

Deploy workers on a VPS, cloud function, or container service:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
CMD ["python", "-m", "workers.intent_classifier"]
```

## Troubleshooting

### Common Issues

**"No data available yet"**
- Check environment variables are set correctly
- Verify Supabase connection in browser network tab
- Run database seeding script if needed

**OpenAI API errors**
- Check API key is valid and has credits
- Monitor rate limits (GPT-4o-mini: 200 req/min)
- Check OpenAI status page

**Build errors**
- Clear `.next` folder: `rm -rf .next`
- Delete node_modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility

### Performance Optimization

**Large datasets (100K+ conversations):**
- Increase worker batch sizes
- Use database connection pooling
- Consider message content truncation for analysis
- Monitor Supabase usage limits

**Dashboard optimization:**
- Enable React production build: `npm run build`
- Use CDN for static assets
- Cache API responses with appropriate headers

## Security

### API Keys
- Never commit `.env` files to git
- Use different keys for dev/staging/production
- Rotate keys regularly

### Database Access
- Use Supabase Row Level Security (RLS)
- Limit service role key usage to backend only
- Monitor database access logs

---

**Built by Linda Dao** - Solo founder who believes AI product teams deserve better than vanity metrics.