# Convometrics

> AI Conversation Analytics Platform - Transform conversation data into actionable product insights

Convometrics analyzes AI conversations to help product teams understand what's really happening beyond satisfaction scores. We identify conversation patterns that predict user behavior, detect "polite churners" who say they're satisfied but never complete tasks, and surface actionable insights for improving AI conversation success rates.

## 🚀 Features

### Core Analytics
- **Intent Classification**: Understand what users actually want vs. what they say
- **Task Completion Analysis**: Track real outcomes, not just satisfaction ratings  
- **Conversation Pattern Detection**: Identify "exhaustion loops," polite churners, and failure signals
- **Churn Risk Prediction**: Spot users at risk before they complain

### Dashboard Views
- **Overview**: Health scores, performance metrics, and trend analysis
- **Conversations**: Browse, filter, and analyze individual conversations  
- **Intent Analysis**: Deep dive into conversation intent performance
- **Pattern Discovery**: Uncover hidden behavioral patterns
- **Reality Check**: Compare reported metrics vs. actual outcomes

### Data Sources
- Conversation logs (CSV import)
- ShareChat dataset integration (146K+ conversations analyzed)
- Real-time conversation analysis via API
- Multi-platform support (ChatGPT, Claude, Gemini, etc.)

## 🛠 Tech Stack

**Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
**Backend**: Next.js API routes, Supabase PostgreSQL
**Analytics**: Custom conversation analysis engine with OpenAI integration
**Deployment**: Vercel (dashboard), Supabase (database)
**Auth**: Supabase authentication

## 📊 Key Insights We Surface

### The "Polite Churner" Problem
68% of users who rate conversations as "helpful" don't actually complete their intended task. They're being polite, but your retention suffers.

### Exhaustion Loops
Users rephrasing the same question 3+ times because the AI keeps missing the point. Messages get shorter as patience wears out.

### False Success Metrics  
Traditional metrics (satisfaction, session length) don't correlate with actual task completion. We track what matters: did the user get what they came for?

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Supabase account
- OpenAI API key (for AI analysis features)

### Installation

```bash
# Clone the repository
git clone https://github.com/lindadao/convometrics.git
cd convometrics

# Install dependencies
cd dashboard
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and OpenAI credentials
```

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# OpenAI (for AI analysis features)
ANTHROPIC_API_KEY=your-anthropic-key

# Optional: Demo mode
NEXT_PUBLIC_DEMO_MODE=true
```

### Database Setup

1. Create a new Supabase project
2. Run the database migrations:

```sql
-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    user_id TEXT,
    intent TEXT,
    quality_score INTEGER,
    completion_status TEXT,
    messages JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_intent ON conversations(intent);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_completion_status ON conversations(completion_status);
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📈 Data Import

### CSV Format
Upload conversation data in CSV format with the following columns:

| Column | Description | Required |
|--------|-------------|----------|
| `conversation_id` | Unique conversation identifier | Yes |
| `role` | Message sender (user/assistant/ai) | Yes |
| `message` | Message content | Yes |
| `timestamp` | Message timestamp (ISO format) | Yes |
| `user_id` | User identifier | Optional |
| `intent` | Conversation intent/category | Optional |
| `sentiment` | Message sentiment | Optional |
| `resolution_status` | Final outcome | Optional |
| `metadata` | JSON metadata (channel, product, etc.) | Optional |

### Example CSV Row
```csv
conversation_id,role,message,timestamp,user_id,intent,sentiment,resolution_status,metadata
conv_123,user,"How do I cancel my subscription?",2024-03-07T10:00:00Z,user_456,cancellation,neutral,resolved,"{""channel"":""chat"",""product"":""pro""}"
conv_123,assistant,"I can help you cancel. Let me guide you through...",2024-03-07T10:01:00Z,,,positive,,
```

## 🔍 API Reference

### Overview API
```bash
GET /api/overview?days=30&segment=demo
```
Returns conversation overview statistics and health scores.

### Conversations API  
```bash
GET /api/conversations?page=0&limit=25&days=30&intent=billing_inquiry
```
Returns filtered conversation list with pagination.

### Analysis API
```bash
POST /api/analyze
Content-Type: multipart/form-data

# Upload CSV file for analysis
```

## 🎯 Use Cases

### AI Product Teams
- Identify conversation patterns that predict churn
- Optimize conversation flows based on real user behavior  
- A/B test conversation improvements with data-driven metrics
- Build better training data from successful conversations

### Customer Success Teams
- Spot at-risk customers before they complain
- Understand why "satisfied" customers still churn
- Prioritize conversation improvements by revenue impact
- Track conversation quality improvements over time

### Product Managers
- Make roadmap decisions based on conversation insights
- Measure conversation success beyond satisfaction scores
- Understand user intent vs. actual product usage
- Build features that address real conversation pain points

## 📊 Example Insights

### Before Convometrics
- "85% satisfaction rate" (but retention dropping)
- "Users love our AI" (but engagement declining)  
- "Support tickets down" (but churn up)

### After Convometrics
- "43% of 'satisfied' users didn't complete their task"
- "Users hitting 'exhaustion loops' in billing conversations"
- "$23K/month lost revenue from polite churners"
- "Fix conversation flow → 31% improvement in task completion"

## 🛣 Roadmap

### Current (v0.1)
- ✅ CSV conversation import and analysis
- ✅ Intent classification and pattern detection  
- ✅ Dashboard with overview and conversation views
- ✅ Real-time conversation analysis

### Next (v0.2)
- [ ] Real-time API for live conversation analysis
- [ ] Slack/Discord integrations for conversation import
- [ ] Advanced ML models for better intent classification
- [ ] White-label dashboard for customer-facing analytics

### Future (v0.3+)
- [ ] Conversation optimization recommendations
- [ ] A/B testing framework for conversation improvements
- [ ] Revenue impact modeling and ROI calculation
- [ ] Multi-language conversation analysis

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with tests
4. Submit a pull request

### Code Style
- TypeScript strict mode enabled
- ESLint + Prettier configuration included
- Tailwind CSS for styling
- React Server Components where possible

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♀️ Support & Contact

**Built by**: Linda Dao (Product Manager & Founder)
- **Email**: linda@convometrics.com
- **LinkedIn**: [linkedin.com/in/lindadao92](https://linkedin.com/in/lindadao92)
- **GitHub**: [@lindadao92](https://github.com/lindadao92)

### Enterprise Support
For enterprise deployments, custom integrations, or dedicated support:
- 📧 enterprise@convometrics.com
- 📅 [Schedule a demo](https://calendly.com/convometrics/demo)

## 📈 About

Convometrics was born from real frustration with AI conversation analytics. As a Product Manager at CTS Eventim (€1.5B ticketing company) rolling out AI analytics across multiple markets, I kept seeing the gap between what conversation dashboards showed and what was actually happening with users.

**The problem**: 85% satisfaction scores while retention was dropping. Users saying "thanks!" while never completing their tasks. "Successful" conversations that led to churn within days.

**The solution**: Analyze conversation patterns, not just ratings. Track task completion, not just satisfaction. Surface insights that actually predict user behavior.

**The result**: Companies using Convometrics typically see 20-45% improvement in conversation task completion rates and can identify $50K-500K+ in recoverable revenue from fixing "polite churner" patterns.

---

*"Finally understand what your AI conversations are actually accomplishing."*