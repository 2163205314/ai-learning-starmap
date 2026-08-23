import asyncio
import json
from unittest import mock

from django.test import SimpleTestCase

from lsp_gateway import gateway_server


class LspProtocolTests(SimpleTestCase):
    def test_message_frame_uses_utf8_byte_length(self):
        payload = {"jsonrpc": "2.0", "method": "test", "params": {"text": "中文"}}

        frame = gateway_server.encode_lsp_message(payload)
        header, body = frame.split(b"\r\n\r\n", 1)

        self.assertEqual(header, f"Content-Length: {len(body)}".encode("ascii"))
        self.assertEqual(json.loads(body), payload)

    def test_framed_message_can_be_read_back(self):
        payload = {"jsonrpc": "2.0", "id": 1, "result": {"ok": True}}

        async def read_payload():
            reader = asyncio.StreamReader()
            reader.feed_data(gateway_server.encode_lsp_message(payload))
            reader.feed_eof()
            return await gateway_server.read_lsp_message(reader)

        result = asyncio.run(read_payload())

        self.assertEqual(result, payload)

    def test_oversized_lsp_message_is_rejected(self):
        async def read_oversized_payload():
            reader = asyncio.StreamReader()
            reader.feed_data(f"Content-Length: {gateway_server.MAX_LSP_MESSAGE_BYTES + 1}\r\n\r\n".encode("ascii"))
            reader.feed_eof()
            return await gateway_server.read_lsp_message(reader)

        with self.assertRaises(ValueError):
            asyncio.run(read_oversized_payload())


class LspGatewaySecurityTests(SimpleTestCase):
    def test_token_is_required(self):
        self.assertTrue(gateway_server.request_is_authorized("/python?token=secret", "secret"))
        self.assertFalse(gateway_server.request_is_authorized("/python?token=wrong", "secret"))
        self.assertFalse(gateway_server.request_is_authorized("/python", "secret"))

    def test_only_loopback_page_origins_are_allowed(self):
        self.assertTrue(gateway_server.origin_is_allowed("http://127.0.0.1:8000"))
        self.assertTrue(gateway_server.origin_is_allowed("http://localhost:8001"))
        self.assertFalse(gateway_server.origin_is_allowed("https://example.com"))
        self.assertFalse(gateway_server.origin_is_allowed(None))

    def test_health_reports_pyright_availability_without_exposing_command(self):
        gateway = gateway_server.Gateway("secret")
        with mock.patch("lsp_gateway.gateway_server.resolve_pyright_command", return_value=["node", "server.js"]):
            status, _headers, body = gateway.process_request("/health?token=secret", {})

        payload = json.loads(body)
        self.assertEqual(status, 200)
        self.assertTrue(payload["languages"]["python"])
        self.assertNotIn("command", payload)

    def test_health_rejects_wrong_token(self):
        gateway = gateway_server.Gateway("secret")

        status, _headers, body = gateway.process_request("/health?token=wrong", {})

        self.assertEqual(status, 401)
        self.assertEqual(json.loads(body)["error"], "unauthorized")
