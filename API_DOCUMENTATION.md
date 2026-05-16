# Convometrics API Documentation

## Overview

The Convometrics API provides conversation intelligence and analytics for AI product teams. Our REST API enables you to analyze conversation quality, detect patterns, and extract actionable insights from your AI chat data.

**Base URL**: `https://convometrics.vercel.app/api`  
**Authentication**: API Key (Contact for access)  
**Rate Limits**: 1,000 requests/hour (Enterprise plans available)  
**Data Format**: JSON  

---

## Authentication

Include your API key in the request headers:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://convometrics.vercel.app/api/quality
```

**Getting an API Key**: Contact linda@convometrics.ai for enterprise access.

---

## Core Endpoints

### 1. Quality Analysis

`GET /api/quality`

Analyze conversation quality by intent category, revealing which user requests succeed vs. fail.

**Parameters:**
- `platform` (optional): Filter by AI platform (`chatgpt`, `claude`, `gemini`, `grok`, `perplexity`, `all`)

**Response:**
```json
{
  "intents": [
    {
      "intent": "information_request",
      "count": 2847,
      "avgScore": 73,
      "completionRate": 82,
      "failureRate": 18,
      "buckets": [124, 298, 1205, 1220],
      "topPlatform": "chatgpt",
      "sampleFailed": [
        {
          "id": "conv_123",
          "preview": "I need help with my account but the AI kept giving generic responses..."
        }
      ]
    }
  ],
  "maxBucket": 1220
}
```

**Use Cases:**
- Identify which intents your AI handles poorly
- Compare quality across different AI platforms
- Find specific failed conversations for analysis

---

### 2. Platform Comparison

`GET /api/platforms`

Compare conversation performance across different AI platforms.

**Response:**
```json
{
  "platforms": [
    {
      "platform": "chatgpt",
      "total": 45632,
      "analyzed": 12847,
      "avgTurns": 3.2,
      "medianTurns": 2,
      "pct5Plus": 23,
      "longestTurns": 15,
      "avgQuality": 76,
      "completionRate": 84,
      "failureRate": 16,
      "topIntent": "information_request",
      "statuses": {
        "completed": 10734,
        "failed": 1205,
        "abandoned": 908
      }
    }
  ],
  "pending": 32785,
  "keyFindings": [
    "Claude shows 15% higher completion rates on technical queries",
    "ChatGPT handles creative requests 23% better than alternatives"
  ]
}
```

**Use Cases:**
- Choose the best AI platform for your use case
- Benchmark performance across providers
- Identify platform-specific strengths and weaknesses

---

### 3. Hidden Patterns Detection

`GET /api/patterns`

Discover the three critical conversation patterns that traditional metrics miss.

**Parameters:**
- `segment` (optional): User segment filter
- `days` (optional): Time range in days (default: 30)

**Response:**
```json
{
  "total": 146644,
  "politeChurner": {
    "count": 26396,
    "pct": 18,
    "avgQuality": 34,
    "examples": [
      {
        "id": "conv_456",
        "intent": "account_help",
        "turns": 4,
        "quality": 28,
        "signals": ["gratitude_expression", "low_resolution", "no_followup"]
      }
    ]
  },
  "frustrationTransfer": {
    "count": 17597,
    "pct": 12,
    "avgTurns": 6.3,
    "examples": [
      {
        "id": "conv_789",
        "intent": "technical_support",
        "turns": 8,
        "quality": 22,
        "satisfaction": "frustrated"
      }
    ]
  },
  "exhaustionLoop": {
    "count": 11732,
    "pct": 8,
    "avgTurns": 7.8,
    "examples": [
      {
        "id": "conv_101",
        "intent": "feature_question",
        "turns": 9,
        "quality": 19
      }
    ]
  }
}
```

**Use Cases:**
- Identify users likely to churn despite "positive" interactions
- Detect conversations that generate support escalations
- Find users stuck in unproductive conversation loops

---

### 4. Conversation Upload & Analysis

`POST /api/analyze`

Upload conversation data for analysis. Supports CSV, JSON, and direct API integration.

**Request Body:**
```json
{
  "conversations": [
    {
      "id": "unique_conversation_id",
      "messages": [
        {"role": "user", "content": "I need help with billing"},
        {"role": "assistant", "content": "I can help with that..."},
        {"role": "user", "content": "Thanks, that worked!"}
      ],
      "metadata": {
        "platform": "chatgpt",
        "timestamp": "2026-05-15T10:30:00Z",
        "user_id": "user_123"
      }
    }
  ]
}
```

**Response:**
```json
{
  "processed": 1,
  "analysis": {
    "intent": "billing_support",
    "quality_score": 87,
    "completion_status": "completed",
    "satisfaction_signals": ["gratitude", "resolution_confirmed"],
    "patterns_detected": [],
    "recommendations": [
      "Strong resolution - user confirmed success",
      "Good conversation flow with clear problem solving"
    ]
  }
}
```

**Use Cases:**
- Real-time conversation quality monitoring
- Batch analysis of historical conversations
- Integration with existing chat systems

---

### 5. Performance Dashboard Data

`GET /api/overview`

Get high-level metrics for executive dashboards.

**Response:**
```json
{
  "totalConversations": 146644,
  "analyzedConversations": 89423,
  "averageQuality": 68,
  "completionRate": 74,
  "hiddenChurnRate": 18,
  "supportEscalationRate": 12,
  "topFailureReasons": [
    "Intent misunderstanding",
    "Incomplete information provided",
    "Context switching confusion"
  ],
  "trends": {
    "qualityChange": "+5%",
    "completionChange": "+2%",
    "period": "vs last 30 days"
  }
}
```

**Use Cases:**
- Executive reporting and KPI tracking
- Business impact measurement
- Trend analysis and improvement tracking

---

## Advanced Features

### Real-Time Conversation Monitoring

`GET /api/conversations/{id}/live`

Monitor active conversations with real-time quality scoring and intervention recommendations.

### Intent Classification

`POST /api/intents/classify`

Classify conversation intent using our trained models.

### Custom Quality Metrics

`POST /api/quality/custom`

Define custom quality criteria for your specific use case.

---

## SDKs and Integration

### JavaScript/TypeScript SDK

```javascript
import { ConvometricsClient } from 'convometrics-sdk';

const client = new ConvometricsClient({
  apiKey: 'your_api_key',
  baseUrl: 'https://convometrics.vercel.app/api'
});

// Analyze a conversation
const analysis = await client.analyzeConversation({
  messages: [/* conversation messages */],
  metadata: { platform: 'chatgpt' }
});
```

### Python SDK

```python
from convometrics import ConvometricsClient

client = ConvometricsClient(api_key='your_api_key')

# Get platform comparison
platforms = client.get_platform_comparison()
print(f"Best performing platform: {platforms[0]['platform']}")
```

### Webhook Integration

Configure webhooks to receive real-time notifications when critical patterns are detected:

```json
{
  "event": "polite_churner_detected",
  "conversation_id": "conv_123",
  "risk_score": 0.87,
  "recommended_action": "human_intervention"
}
```

---

## Data Schema

### Conversation Object

```json
{
  "id": "string",
  "messages": [
    {
      "role": "user|assistant",
      "content": "string",
      "timestamp": "ISO 8601"
    }
  ],
  "metadata": {
    "platform": "chatgpt|claude|gemini|grok|perplexity",
    "user_id": "string",
    "session_id": "string",
    "timestamp": "ISO 8601",
    "custom_fields": {}
  },
  "analysis": {
    "intent": "string",
    "quality_score": "number (0-100)",
    "completion_status": "completed|failed|abandoned|in_progress",
    "satisfaction_signals": ["array of strings"],
    "patterns_detected": ["array of pattern names"],
    "recommendations": ["array of strings"]
  }
}
```

---

## Error Handling

All API endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-05-15T10:30:00Z"
}
```

---

## Rate Limits

| Plan | Requests/Hour | Conversations/Month |
|------|---------------|-------------------|
| **Starter** | 100 | 1,000 |
| **Professional** | 1,000 | 10,000 |
| **Enterprise** | 10,000 | Unlimited |

Rate limit headers included in all responses:
- `X-RateLimit-Limit`: Request limit per hour
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Timestamp when limit resets

---

## Privacy & Compliance

### Data Handling
- **GDPR Compliant**: Automatic PII detection and removal
- **SOC 2 Type II**: Enterprise security standards
- **Encryption**: End-to-end encryption for all conversation data
- **Data Residency**: Choose EU or US data centers

### Privacy Features
- Automatic PII masking in conversation content
- Configurable data retention policies (7-365 days)
- Right to erasure support for GDPR compliance
- Audit logs for all data access

---

## Support

### Documentation
- **Developer Guide**: https://docs.convometrics.ai
- **API Reference**: https://api-docs.convometrics.ai
- **Best Practices**: https://guides.convometrics.ai

### Contact
- **Email**: api-support@convometrics.ai
- **Slack**: Join our developer community
- **Phone**: +1 (415) 555-0142 (Enterprise customers)

### SLA
- **Uptime**: 99.9% guaranteed
- **Response Time**: <100ms median
- **Support**: 24/7 for Enterprise customers

---

## Pricing

### API Usage Pricing
- **Conversation Analysis**: $0.001 per conversation
- **Real-time Monitoring**: $0.005 per monitored conversation
- **Custom Models**: Starting at $500/month

### Enterprise Plans
- **Volume discounts**: 50%+ savings on 100K+ conversations/month
- **Custom integrations**: Dedicated engineering support
- **On-premise deployment**: Available for security-sensitive organizations

**Contact sales**: linda@convometrics.ai

---

## Changelog

### v2.1.0 (May 2026)
- Added real-time pattern detection
- Improved cultural satisfaction modeling
- New webhook system for proactive alerts

### v2.0.0 (April 2026)
- Major API redesign for better performance
- Added support for custom quality metrics
- Enhanced international compliance features

### v1.5.0 (March 2026)
- Platform comparison endpoints
- Batch conversation upload
- Python and JavaScript SDKs

---

*This API documentation is maintained by the Convometrics team. For the latest updates, visit https://docs.convometrics.ai*