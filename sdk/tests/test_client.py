import json
import time
import unittest
from unittest.mock import MagicMock, patch

import convometrics
from convometrics.client import Convometrics
from convometrics.request import Response


class TestModuleInterface(unittest.TestCase):
    def setUp(self):
        convometrics._default_client = None

    def tearDown(self):
        convometrics.shutdown()

    def test_init_creates_client(self):
        with patch("convometrics.client.Consumer"):
            client = convometrics.init(api_key="cm_test")
            self.assertIsNotNone(client)

    def test_track_without_init_raises(self):
        with self.assertRaises(RuntimeError):
            convometrics.track_conversation("conv_1", [{"role": "user", "content": "hi"}])

    def test_flush_without_init_raises(self):
        with self.assertRaises(RuntimeError):
            convometrics.flush()


class TestClient(unittest.TestCase):
    def setUp(self):
        self.consumer_patcher = patch("convometrics.client.Consumer")
        self.mock_consumer_cls = self.consumer_patcher.start()
        self.mock_consumer = MagicMock()
        self.mock_consumer_cls.return_value = self.mock_consumer
        self.client = Convometrics(api_key="cm_test_key")

    def tearDown(self):
        self.consumer_patcher.stop()

    def test_requires_api_key(self):
        with self.assertRaises(ValueError):
            Convometrics(api_key="")

    def test_track_conversation_enqueues(self):
        self.client.track_conversation(
            conversation_id="conv_1",
            messages=[{"role": "user", "content": "hello"}],
            user_id="u1",
            metadata={"key": "val"},
        )
        self.mock_consumer.enqueue.assert_called_once()
        event = self.mock_consumer.enqueue.call_args[0][0]
        self.assertEqual(event["type"], "track_conversation")
        self.assertEqual(event["conversation_id"], "conv_1")
        self.assertEqual(event["user_id"], "u1")
        self.assertEqual(event["metadata"], {"key": "val"})
        self.assertEqual(len(event["messages"]), 1)

    def test_track_validates_conversation_id(self):
        with self.assertRaises(ValueError):
            self.client.track_conversation(
                conversation_id="",
                messages=[{"role": "user", "content": "hi"}],
            )

    def test_track_validates_messages_not_empty(self):
        with self.assertRaises(ValueError):
            self.client.track_conversation(conversation_id="c1", messages=[])

    def test_track_validates_message_structure(self):
        with self.assertRaises(ValueError):
            self.client.track_conversation(
                conversation_id="c1",
                messages=[{"role": "user"}],  # missing content
            )

    def test_optional_fields_omitted(self):
        self.client.track_conversation(
            conversation_id="c1",
            messages=[{"role": "user", "content": "hi"}],
        )
        event = self.mock_consumer.enqueue.call_args[0][0]
        self.assertNotIn("user_id", event)
        self.assertNotIn("metadata", event)

    def test_flush_delegates_to_consumer(self):
        self.client.flush()
        self.mock_consumer.flush.assert_called_once()

    def test_shutdown_stops_consumer(self):
        self.client.shutdown()
        self.mock_consumer.stop.assert_called_once()


class TestConsumerIntegration(unittest.TestCase):
    """Integration test with real consumer thread but mocked HTTP."""

    @patch("convometrics.consumer.post")
    def test_batch_send(self, mock_post):
        mock_post.return_value = Response(200, '{"status":"ok"}')

        client = Convometrics.__new__(Convometrics)
        client.api_key = "cm_test"
        client.host = "https://api.convometrics.com"
        client.flush_at = 2
        client.flush_interval = 0.5
        client.max_retries = 1
        client.timeout = 5

        from convometrics.consumer import Consumer

        client._consumer = Consumer(
            api_key=client.api_key,
            host=client.host,
            flush_at=client.flush_at,
            flush_interval=client.flush_interval,
            max_retries=client.max_retries,
            timeout=client.timeout,
        )
        client._consumer.start()

        client.track_conversation(
            conversation_id="c1",
            messages=[{"role": "user", "content": "hi"}],
        )
        client.track_conversation(
            conversation_id="c2",
            messages=[{"role": "user", "content": "bye"}],
        )
        client.flush()
        client.shutdown()

        self.assertTrue(mock_post.called)
        call_args = mock_post.call_args
        payload = json.loads(call_args[1]["data"] if "data" in call_args[1] else call_args[0][1])
        self.assertIn("batch", payload)
        self.assertGreater(len(payload["batch"]), 0)

    @patch("convometrics.consumer.post")
    def test_retry_on_server_error(self, mock_post):
        mock_post.side_effect = [
            Response(500, "Internal Server Error"),
            Response(200, '{"status":"ok"}'),
        ]

        from convometrics.consumer import Consumer

        consumer = Consumer(
            api_key="cm_test",
            host="https://api.convometrics.com",
            flush_at=1,
            flush_interval=60,
            max_retries=2,
            timeout=5,
        )
        consumer.start()
        consumer.enqueue({"type": "test", "data": "payload"})
        consumer.flush()
        consumer.stop()

        self.assertEqual(mock_post.call_count, 2)


if __name__ == "__main__":
    unittest.main()
