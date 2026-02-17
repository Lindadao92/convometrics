from convometrics.client import Convometrics

_default_client = None


def init(api_key, **kwargs):
    """Initialize the default Convometrics client.

    Args:
        api_key: Your Convometrics API key (e.g. "cm_xxx").
        **kwargs: Additional options passed to the Convometrics client
            (host, flush_at, flush_interval, max_retries, timeout).
    """
    global _default_client
    if _default_client is not None:
        _default_client.flush()
        _default_client.shutdown()
    _default_client = Convometrics(api_key, **kwargs)
    return _default_client


def track_conversation(conversation_id, messages, user_id=None, metadata=None):
    """Track a conversation using the default client.

    Must call init() first.
    """
    if _default_client is None:
        raise RuntimeError(
            "convometrics.init() must be called before track_conversation()"
        )
    return _default_client.track_conversation(
        conversation_id=conversation_id,
        messages=messages,
        user_id=user_id,
        metadata=metadata,
    )


def flush():
    """Flush any pending messages on the default client."""
    if _default_client is None:
        raise RuntimeError("convometrics.init() must be called before flush()")
    _default_client.flush()


def shutdown():
    """Flush and shut down the default client."""
    global _default_client
    if _default_client is not None:
        _default_client.flush()
        _default_client.shutdown()
        _default_client = None


__all__ = ["init", "track_conversation", "flush", "shutdown", "Convometrics"]
__version__ = "0.1.0"
