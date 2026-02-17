import atexit
import logging
import uuid
from datetime import datetime, timezone

from convometrics.consumer import Consumer

logger = logging.getLogger("convometrics")

DEFAULT_HOST = "https://api.convometrics.com"
FLUSH_AT = 20
FLUSH_INTERVAL = 10.0
MAX_RETRIES = 3
TIMEOUT = 15


class Convometrics:
    """Convometrics client that batches and sends conversation data
    via a background thread.

    Args:
        api_key: Your Convometrics API key.
        host: API host. Defaults to https://api.convometrics.com.
        flush_at: Batch size threshold before auto-flushing.
        flush_interval: Seconds between automatic flushes.
        max_retries: Max retry attempts on failure.
        timeout: HTTP request timeout in seconds.
    """

    def __init__(
        self,
        api_key,
        host=None,
        flush_at=None,
        flush_interval=None,
        max_retries=None,
        timeout=None,
    ):
        if not api_key:
            raise ValueError("api_key is required")

        self.api_key = api_key
        self.host = host or DEFAULT_HOST
        self.flush_at = flush_at or FLUSH_AT
        self.flush_interval = flush_interval or FLUSH_INTERVAL
        self.max_retries = max_retries or MAX_RETRIES
        self.timeout = timeout or TIMEOUT

        self._consumer = Consumer(
            api_key=self.api_key,
            host=self.host,
            flush_at=self.flush_at,
            flush_interval=self.flush_interval,
            max_retries=self.max_retries,
            timeout=self.timeout,
        )
        self._consumer.start()

        atexit.register(self._atexit_flush)

    def _atexit_flush(self):
        try:
            self.flush()
            self.shutdown()
        except Exception:
            pass

    def track_conversation(self, conversation_id, messages, user_id=None, metadata=None):
        """Enqueue a conversation for async delivery.

        Args:
            conversation_id: Unique identifier for the conversation.
            messages: List of message dicts, each with 'role' and 'content' keys.
            user_id: Optional user identifier.
            metadata: Optional dict of extra metadata.

        Returns:
            True if the message was enqueued successfully.
        """
        if not conversation_id:
            raise ValueError("conversation_id is required")
        if not messages or not isinstance(messages, list):
            raise ValueError("messages must be a non-empty list")

        for i, msg in enumerate(messages):
            if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                raise ValueError(
                    f"messages[{i}] must be a dict with 'role' and 'content' keys"
                )

        event = {
            "type": "track_conversation",
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "conversation_id": conversation_id,
            "messages": messages,
        }
        if user_id is not None:
            event["user_id"] = user_id
        if metadata is not None:
            event["metadata"] = metadata

        self._consumer.enqueue(event)
        logger.debug("Enqueued conversation %s (%d messages)", conversation_id, len(messages))
        return True

    def flush(self):
        """Force-flush all queued events. Blocks until the current batch is sent."""
        self._consumer.flush()

    def shutdown(self):
        """Stop the background consumer thread."""
        self._consumer.stop()
