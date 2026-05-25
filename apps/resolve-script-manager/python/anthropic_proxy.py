"""Anthropic proxy client — drop-in replacement for `anthropic.Anthropic`.

Scripts that need Claude (cull, highlight scoring, scene tagging) no longer
talk to Anthropic directly. They route through The Role Room backend, which
validates the user's session, supplies the real Anthropic key, and tracks
usage per-user for metering.

This module mirrors *just* the surface the post-agent scripts use:
  client = Anthropic()                       # reads RR_BEARER_TOKEN + base URL from env
  msg = client.messages.create(
      model=..., max_tokens=..., messages=[...], system=...
  )
  text = "".join(b.text for b in msg.content if hasattr(b, "text"))

Response objects are attribute-accessible (block.text, msg.content, msg.usage)
so existing script code does NOT need to change beyond the import line.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


DEFAULT_BASE_URL = "https://creatorhubn.com/api/post-agent"
ENV_BASE_URL = "RR_POST_AGENT_BASE_URL"
ENV_BEARER = "RR_BEARER_TOKEN"


class APIError(RuntimeError):
    """Raised on non-2xx responses or transport failures.

    Attributes mirror the Anthropic SDK's APIError so error-handling in scripts
    can stay generic (`except APIError as e: print(e.status_code, e.message)`).
    """

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(f"[{status_code} {code}] {message}")
        self.status_code = status_code
        self.code = code
        self.message = message


class _Block:
    """Mimics an Anthropic content block. `block.text` returns the text string."""

    __slots__ = ("type", "text")

    def __init__(self, data: dict[str, Any]):
        self.type = data.get("type", "text")
        self.text = data.get("text", "")


class _Message:
    """Mimics an anthropic.types.Message. Supports .content, .model, .usage."""

    def __init__(self, data: dict[str, Any]):
        self._raw = data
        self.id = data.get("id", "")
        self.model = data.get("model", "")
        self.role = data.get("role", "assistant")
        self.stop_reason = data.get("stop_reason")
        self.content = [_Block(b) for b in data.get("content", [])]
        self.usage = data.get("usage", {})


class _Messages:
    def __init__(self, parent: "Anthropic"):
        self._parent = parent

    def create(self, **kwargs: Any) -> _Message:
        return self._parent._post("/anthropic/messages", kwargs)


class Anthropic:
    """Drop-in replacement for `anthropic.Anthropic()` that proxies via The Role Room backend."""

    def __init__(
        self,
        bearer_token: str | None = None,
        base_url: str | None = None,
        timeout: float = 90.0,
        api_key: str | None = None,  # accepted but unused — backend supplies real key
    ):
        self.bearer = bearer_token or os.environ.get(ENV_BEARER) or ""
        self.base_url = (base_url or os.environ.get(ENV_BASE_URL) or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        # api_key kwarg is accepted for SDK compat but ignored — backend uses its own.
        _ = api_key
        self.messages = _Messages(self)

    def _post(self, path: str, body: dict[str, Any]) -> _Message:
        if not self.bearer:
            raise APIError(
                401,
                "missing_bearer",
                f"{ENV_BEARER} env var is not set. Sign in to The Role Room from Post Agent Settings.",
            )
        url = f"{self.base_url}{path}"
        payload = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.bearer}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "RoleRoomPostAgent/0.1",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read().decode("utf-8"))
            except Exception:
                err_body = {}
            raise APIError(
                e.code,
                err_body.get("error", "http_error"),
                err_body.get("detail") or e.reason or "Upstream error",
            ) from e
        except urllib.error.URLError as e:
            raise APIError(0, "network_error", f"Cannot reach {self.base_url}: {e.reason}") from e
        return _Message(data)
