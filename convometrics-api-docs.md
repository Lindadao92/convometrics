# Convometrics API Documentation

Complete API reference for integrating with Convometrics conversation analytics.

## Base URL

**Local Development:** `http://localhost:3000/api`  
**Production:** `https://convometrics.vercel.app/api`

## Authentication

Most endpoints are public for the demo. In production, API keys would be required:

```bash
curl -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     "https://convometrics.vercel.app/api/overview"
```

## Core Endpoints

### GET /api/overview

Returns high-level conversation analytics and health metrics.

**Query Parameters:**
- `segment` (string, optional): Demo segment (ai_assistant, ai_companion, ai_support, ai_tutor)
- `days` (integer, optional): Time range in days (default: 30)

**Response:**
```json
{
  "stats": {
    "total": 146644,
    "analyzed": 89234,
    "avgQuality": 73,
    "completionRate": 67.5,
    "failureRate": 15.2,
    "avgTurns": 8.3,
    "totalMessages": 1205892,
    "topTopic": "code_help"
  },
  "healthScore": 68,
  "topPerformingTopics": [
    {
      "intent": "explain_concept",
      "avgQuality": 89,
      "count": 1204,
      "completionRate": 85.2
    }
  ],
  "worstPerformingTopics": [
    {
      "intent": "technical_problem", 
      "avgQuality": 45,
      "count": 892,
      "failRate": 42.1
    }
  ]
}
```

### GET /api/conversations

Returns paginated list of conversations with filtering options.

**Query Parameters:**
- `segment` (string): Demo segment or empty for real data
- `intent` (string, optional): Filter by specific intent
- `status` (string, optional): Filter by completion status
- `platform` (string, optional): Filter by platform
- `min_score` (integer, optional): Minimum quality score
- `max_score` (integer, optional): Maximum quality score
- `page` (integer, optional): Page number (default: 0)
- `format` (string, optional): "csv" for CSV export

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv_12345",
      "user_id": "user_67890", 
      "intent": "code_help",
      "quality_score": 78,
      "completion_status": "completed",
      "platform": "chatgpt",
      "turns": 6,
      "created_at": "2026-03-01T15:30:00Z",
      "firstUserMessage": "I'm getting a TypeError in my Python script..."
    }
  ],
  "total": 25690,
  "page": 0,
  "pageSize": 25,
  "intents": ["code_help", "explain_concept", "debug_error", "..."]
}
```

### GET /api/intents

Returns intent analysis with success rates and performance metrics.

**Query Parameters:**
- `segment` (string): Demo segment 
- `days` (integer): Time range
- `sort` (string): Sort by "volume", "quality", "success_rate" (default: volume)

**Response:**
```json
{
  "intents": [
    {
      "intent": "code_help",
      "count": 12450,
      "avgQuality": 73,
      "successRate": 68.2,
      "failRate": 23.1, 
      "trends": {
        "quality": [65, 68, 71, 73],
        "volume": [2800, 3100, 3200, 3350]
      }
    }
  ],
  "summary": {
    "totalIntents": 47,
    "avgSuccessRate": 64.8,
    "topIntent": "code_help",
    "emergingIntent": "ai_safety_questions"
  }
}
```

### GET /api/intents/[slug]

Returns detailed analysis for a specific intent.

**Path Parameters:**
- `slug` (string): Intent name (URL-encoded)

**Response:**
```json
{
  "intent": "code_help",
  "metrics": {
    "totalConversations": 12450,
    "avgQuality": 73,
    "successRate": 68.2,
    "avgTurns": 7.8
  },
  "recentConversations": [
    {
      "id": "conv_123",
      "quality_score": 85,
      "outcome": "solved",
      "summary": "User needed help with Python async/await syntax"
    }
  ],
  "patterns": {
    "commonWords": ["python", "error", "function", "debug"],
    "successFactors": ["specific error message", "code examples provided"],
    "failureReasons": ["vague problem description", "deprecated library"]
  },
  "recommendations": [
    "Ask users to include full error messages",
    "Provide working code examples",
    "Check for deprecated library usage"
  ]
}
```

### GET /api/quality

Returns quality score distribution and improvement trends.

**Response:**
```json
{
  "distribution": [
    {"label": "0–20", "count": 1240},
    {"label": "21–40", "count": 3567},
    {"label": "41–60", "count": 12450},
    {"label": "61–80", "count": 18230},
    {"label": "81–100", "count": 8901}
  ],
  "trends": {
    "daily": [67, 69, 71, 73, 75],
    "weekly": [68, 70, 72, 74]
  },
  "insights": [
    "Quality improving 2.3% month-over-month",
    "Technical conversations score 15% higher than general chat"
  ]
}
```

### GET /api/patterns

Returns hidden patterns and insights from conversation analysis.

**Response:**
```json
{
  "patterns": [
    {
      "id": "polite_churn",
      "name": "The Polite Churner",
      "description": "Users who say 'ok thanks' but return with the same problem within 7 days",
      "frequency": "18% of conversations",
      "impact": "3x higher churn risk",
      "examples": ["ok thanks", "got it", "that helps"],
      "recommendation": "Follow up with specific validation questions"
    },
    {
      "id": "exhaustion_loop", 
      "name": "Exhaustion Loops",
      "description": "High-engagement sessions where users eventually give up without resolution",
      "frequency": "12% of long conversations (>15 turns)",
      "impact": "Appears engaged but 67% satisfaction drop",
      "recommendation": "Escalate to human after 10 turns without progress"
    }
  ],
  "insights": [
    "Conversations ending with specific solutions have 89% satisfaction",
    "Follow-up questions increase completion rate by 23%"
  ]
}
```

### GET /api/platforms

Returns platform-specific performance metrics.

**Response:**
```json
{
  "platforms": [
    {
      "platform": "chatgpt",
      "conversations": 45230,
      "avgQuality": 74,
      "completionRate": 71.2,
      "avgTurns": 6.8
    },
    {
      "platform": "claude",
      "conversations": 23456,
      "avgQuality": 78, 
      "completionRate": 73.1,
      "avgTurns": 5.2
    }
  ],
  "comparison": {
    "highestQuality": "claude",
    "highestVolume": "chatgpt", 
    "mostEfficient": "claude"
  }
}
```

### POST /api/analyze

Analyze new conversation data (real-time analysis).

**Request Body:**
```json
{
  "conversation": {
    "messages": [
      {"role": "user", "content": "How do I fix this React error?"},
      {"role": "assistant", "content": "Here are some steps to debug React errors..."},
      {"role": "user", "content": "That worked perfectly, thank you!"}
    ],
    "user_id": "user_123",
    "metadata": {"platform": "support_chat"}
  }
}
```

**Response:**
```json
{
  "analysis": {
    "intent": "debug_error",
    "qualityScore": 87,
    "completionStatus": "completed",
    "confidence": 0.94,
    "insights": {
      "satisfactionSignals": ["worked perfectly", "thank you"],
      "resolutionIndicators": ["specific steps provided"],
      "sentiment": "positive"
    }
  },
  "recommendations": [
    "Strong resolution - similar approach for React debugging",
    "User expressed clear satisfaction"
  ]
}
```

## Data Ingestion

### POST /api/upload

Upload conversation data via CSV or JSON.

**Request (multipart/form-data):**
```bash
curl -X POST "http://localhost:3000/api/upload" \
     -F "file=@conversations.csv"
```

**CSV Format:**
- `messages`: JSON array of message objects
- `user_id`: String identifier  
- `timestamp`: ISO 8601 format
- `conversation_id` (optional): Unique identifier
- `metadata` (optional): JSON object with additional data

### POST /api/ingest

Programmatic data ingestion endpoint.

**Request Body:**
```json
{
  "conversations": [
    {
      "conversation_id": "conv_123",
      "user_id": "user_456", 
      "messages": [
        {"role": "user", "content": "User message"},
        {"role": "assistant", "content": "AI response"}
      ],
      "metadata": {"platform": "api", "source": "integration"}
    }
  ]
}
```

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Invalid query parameter",
  "code": "INVALID_PARAMETER",
  "details": {
    "parameter": "days",
    "value": "invalid_number",
    "expected": "integer between 1 and 365"
  }
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (invalid endpoint or resource)
- `429` - Rate Limited (too many requests)
- `500` - Server Error

## Rate Limits

**Demo/Free Tier:**
- 1000 requests per hour per IP
- 10 concurrent requests

**Production:**
- Based on plan tier
- Higher limits for authenticated requests

## SDKs and Examples

### JavaScript/TypeScript

```javascript
import ConvometricsClient from 'convometrics-sdk';

const client = new ConvometricsClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://convometrics.vercel.app/api'
});

// Get overview metrics
const overview = await client.getOverview({ days: 30 });

// Analyze conversation
const analysis = await client.analyze({
  messages: [
    { role: 'user', content: 'I need help with my code' },
    { role: 'assistant', content: 'I can help debug your code...' }
  ]
});
```

### Python

```python
import requests

class ConvometricsClient:
    def __init__(self, api_key, base_url="https://convometrics.vercel.app/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}
    
    def get_overview(self, days=30):
        response = requests.get(
            f"{self.base_url}/overview",
            params={"days": days},
            headers=self.headers
        )
        return response.json()
    
    def analyze_conversation(self, messages, user_id=None):
        data = {
            "conversation": {
                "messages": messages,
                "user_id": user_id
            }
        }
        response = requests.post(
            f"{self.base_url}/analyze", 
            json=data,
            headers=self.headers
        )
        return response.json()

# Usage
client = ConvometricsClient("your-api-key")
overview = client.get_overview(days=7)
```

## Webhooks (Coming Soon)

Subscribe to real-time events:

```json
{
  "event": "conversation_analyzed",
  "data": {
    "conversation_id": "conv_123",
    "intent": "code_help",
    "quality_score": 78,
    "timestamp": "2026-03-06T15:30:00Z"
  }
}
```

**Available Events:**
- `conversation_analyzed` - New conversation analysis completed
- `pattern_detected` - Hidden pattern identified
- `quality_alert` - Quality score drops below threshold
- `trend_change` - Significant metric change detected

---

For questions or support, contact [linda@convometrics.com](mailto:linda@convometrics.com).