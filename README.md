# IRL AI - Convometrics

**Real conversation analytics for AI product teams**

IRL AI analyzes your ChatGPT, Claude, Gemini, Grok, and Perplexity conversations to surface hidden patterns that traditional metrics miss. Stop measuring vanity metrics - start measuring what actually matters.

## What We Find That You Miss

- **The Polite Churner**: Users who say "ok thanks" but cancel within 7 days
- **Frustration Transfer**: How failed AI interactions poison human agent CSAT  
- **The Exhaustion Loop**: "High engagement" sessions that are actually users giving up
- **Intent Success Rates**: Which user intents your AI handles well vs. catastrophically

## Demo

View our [live demo analysis](https://convometrics.vercel.app) of a fictional AI support agent handling 4,832 conversations.

## Architecture

**Frontend**: Next.js 14, React, Tailwind CSS, TypeScript  
**Backend**: Supabase (PostgreSQL), Edge Functions  
**AI Workers**: OpenAI GPT-4 for intent classification, quality scoring, completion detection  
**Hosting**: Vercel (frontend), Supabase (backend)  

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Setup

1. **Clone and install**:
   ```bash
   git clone https://github.com/Lindadao92/convometrics.git
   cd convometrics
   cd dashboard && npm install
   ```

2. **Environment variables** (`dashboard/.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Visit**: http://localhost:3000

### Database Setup

The demo includes 146,644 conversations from the ShareChat dataset. To seed your own database:

```bash
cd backend/scripts
python seed_perplexity_demo.py
```

## Deployment

**Frontend**: Automatically deploys to Vercel on push to main  
**Backend**: Supabase handles database and edge functions  

## Data Sources

We analyze conversation data from:
- ChatGPT exports
- Claude conversation histories  
- Anthropic API logs
- Custom chat applications
- Support ticket transcripts

**Privacy**: All analysis happens on your data. We don't store conversations.

## Business Model

**Target Customers**: AI product teams at Cursor AI, Perplexity, Character AI, Anthropic, OpenAI  
**Pricing**: Usage-based SaaS - pay per conversation analyzed  
**Goal**: $2K → $10K MRR in 90 days  

## Use Cases

### For AI Product Teams
- **Intent Analysis**: Which user requests succeed vs fail
- **Quality Benchmarking**: Real success rates, not completion rates  
- **User Journey Mapping**: Where users get stuck in conversation flows
- **Churn Prevention**: Identify at-risk users before they leave

### For Customer Success
- **Support Optimization**: Which AI failures create the most human work
- **Agent Training**: What questions should escalate immediately  
- **CSAT Recovery**: Fix conversation patterns that poison human interactions

## Key Features

### Intent Classification
Automatically categorize every conversation by user intent and outcome. Stop guessing what your users want.

### Success Rate Analysis  
Traditional metrics show completion. We show actual problem resolution.

### Pattern Detection
Surface conversation patterns invisible to single-session analysis.

### Actionable Insights
Not just data - specific recommendations ranked by business impact.

## Technical Details

### AI Workers Architecture

**Intent Classifier**:
- Analyzes conversation flow and user language
- Classifies into 20+ intent categories
- Determines success/failure outcome
- Runs on OpenAI GPT-4

**Quality Scorer**:
- Measures conversation effectiveness
- Detects false-positive resolutions
- Identifies user frustration signals  
- Combines multiple quality dimensions

**Completion Detector**:
- Distinguishes genuine resolution from abandonment
- Tracks conversation state transitions
- Flags premature closures

### Data Pipeline

1. **Ingestion**: Upload CSV, JSON, or API integration
2. **Processing**: AI workers analyze each conversation
3. **Storage**: Structured data in Supabase PostgreSQL
4. **Analysis**: Real-time dashboard with insights
5. **Export**: PDF reports, API access, webhooks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly  
4. Create pull request for review
5. Never push directly to main

## Contact

**Founder**: Linda Dao  
**Email**: linda@convometrics.com  
**LinkedIn**: https://linkedin.com/in/lindadao92  
**Location**: San Francisco, CA  

---

*Built by a solo founder who believes AI product teams deserve better than vanity metrics.*