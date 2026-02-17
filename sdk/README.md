# Convometrics Python SDK

Track and analyze conversations with the Convometrics API.

## Installation

```bash
pip install convometrics
```

## Quick Start

```python
import convometrics

convometrics.init(api_key="cm_your_api_key")

convometrics.track_conversation(
    conversation_id="conv_123",
    messages=[
        {"role": "user", "content": "Hello, I need help with billing"},
        {"role": "assistant", "content": "I'd be happy to help with billing!"},
    ],
    user_id="user_456",
    metadata={"channel": "web", "department": "support"},
)

# On shutdown
convometrics.flush()
convometrics.shutdown()
```

## Advanced Usage

```python
from convometrics import Convometrics

client = Convometrics(
    api_key="cm_your_api_key",
    flush_at=50,          # Batch size before auto-flush (default: 20)
    flush_interval=30.0,  # Seconds between flushes (default: 10)
    max_retries=5,        # Retry attempts on failure (default: 3)
    timeout=30,           # HTTP timeout in seconds (default: 15)
)

client.track_conversation(
    conversation_id="conv_789",
    messages=[{"role": "user", "content": "Hi"}],
)

client.flush()
client.shutdown()
```
