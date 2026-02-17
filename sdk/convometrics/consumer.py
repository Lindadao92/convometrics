import json
import logging
import time
from queue import Empty, Queue
from threading import Event, Thread

from convometrics.request import post

logger = logging.getLogger("convometrics")

BATCH_ENDPOINT = "/v1/ingest"

# Sentinel object to signal a flush request.
_FLUSH = object()


class Consumer(Thread):
    """Background daemon thread that batches and sends events to the API.

    Modeled after the Mixpanel/PostHog consumer pattern:
    - Events are added to an in-memory queue from the main thread.
    - The consumer thread drains the queue in batches.
    - Automatic periodic flushing and size-based flushing.
    - Exponential backoff on transient failures.
    """

    def __init__(self, api_key, host, flush_at, flush_interval, max_retries, timeout):
        super().__init__(daemon=True)
        self.api_key = api_key
        self.host = host
        self.flush_at = flush_at
        self.flush_interval = flush_interval
        self.max_retries = max_retries
        self.timeout = timeout

        self._queue = Queue()
        self._flush_event = Event()
        self._stop_event = Event()

    def enqueue(self, event):
        """Add an event to the queue (called from the main thread)."""
        self._queue.put(event)
        if self._queue.qsize() >= self.flush_at:
            self._flush_event.set()

    def flush(self):
        """Request a flush and block until the queue is drained."""
        self._queue.put(_FLUSH)
        self._flush_event.set()
        # Wait for the consumer thread to process the flush sentinel.
        # We do this by putting a blocking event in the queue.
        done = Event()
        self._queue.put(done)
        self._flush_event.set()
        done.wait(timeout=30)

    def stop(self):
        """Signal the consumer to stop after draining remaining events."""
        self._stop_event.set()
        self._flush_event.set()

    def run(self):
        """Main loop for the consumer thread."""
        logger.debug("Consumer thread started")
        while not self._stop_event.is_set():
            # Wait for flush signal or timeout (periodic flush).
            self._flush_event.wait(timeout=self.flush_interval)
            self._flush_event.clear()
            self._drain_queue()

        # Final drain on shutdown.
        self._drain_queue()
        logger.debug("Consumer thread stopped")

    def _drain_queue(self):
        """Pull all items from the queue and send them in batches."""
        batch = []
        while True:
            try:
                item = self._queue.get_nowait()
            except Empty:
                break

            if item is _FLUSH:
                # Flush sentinel: send what we have so far.
                if batch:
                    self._send_batch(batch)
                    batch = []
                continue

            if isinstance(item, Event):
                # Completion signal for blocking flush.
                if batch:
                    self._send_batch(batch)
                    batch = []
                item.set()
                continue

            batch.append(item)
            if len(batch) >= self.flush_at:
                self._send_batch(batch)
                batch = []

        if batch:
            self._send_batch(batch)

    def _send_batch(self, batch):
        """Send a batch of events with exponential backoff retries."""
        url = self.host.rstrip("/") + BATCH_ENDPOINT
        payload = json.dumps({"batch": batch})
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        for attempt in range(self.max_retries + 1):
            try:
                response = post(url, data=payload, headers=headers, timeout=self.timeout)
                if response.status_code >= 500:
                    raise Exception(f"Server error: {response.status_code}")
                if response.status_code == 429:
                    raise Exception("Rate limited")
                if response.status_code >= 400:
                    logger.error(
                        "Batch rejected (status %d): %s",
                        response.status_code,
                        response.text[:200],
                    )
                    return  # Don't retry client errors (except 429).
                logger.debug("Sent batch of %d events", len(batch))
                return
            except Exception as e:
                if attempt < self.max_retries:
                    backoff = min(2**attempt, 30)
                    logger.warning(
                        "Batch send failed (attempt %d/%d): %s. Retrying in %ds...",
                        attempt + 1,
                        self.max_retries + 1,
                        str(e),
                        backoff,
                    )
                    time.sleep(backoff)
                else:
                    logger.error(
                        "Batch send failed after %d attempts: %s. Dropping %d events.",
                        self.max_retries + 1,
                        str(e),
                        len(batch),
                    )
