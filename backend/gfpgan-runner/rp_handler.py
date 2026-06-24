"""RunPod Serverless handler for the GFPGAN photo-enhancer runner.

This wraps the exact same ``enhance()`` core used by the FastAPI ``/enhance``
route in ``app.py`` — only the transport differs (RunPod job event instead of
an HTTP request), so the serverless path produces byte-identical output to the
HTTP Pod/CPU runner. Custom portrait retouch + LUT + frequency-sep all come
along because they live inside ``enhance()``.

Why serverless: a shoot is bursty (100–500 RAW at once, then idle for
hours/days). RunPod spins a GPU worker on demand and tears it down when idle,
so idle cost is $0 — unlike an always-on Pod that bills around the clock.
Weights are pulled from B2 on first enhance (already seeded there), cached on
the worker for the rest of its life.

Backend contract (see backend/server/photo-enhancer-routes.ts):
  POST https://api.runpod.ai/v2/<endpointId>/runsync
  body: { "input": { imageBase64, model, settings, controls, ... } }   # == EnhancePayload
  -> { "output": { success, imageBase64, mimeType, modelUsed, processingMs, ... } }
On failure the output carries an ``error`` string so the backend can fall back
to the CPU runner without a 5xx.
"""
from __future__ import annotations

import logging

import runpod  # provided by the runpod pip package in the serverless image

# Importing app.py builds the FastAPI app object but does NOT start uvicorn, so
# this is cheap + side-effect-free for our purposes. enhance() is a plain
# function that returns a dict / raises (HTTPException carries .detail).
from app import EnhancePayload, enhance

logger = logging.getLogger("gfpgan-rp-handler")


def handler(event: dict) -> dict:
    payload_in = (event or {}).get("input") or {}
    if not isinstance(payload_in, dict):
        return {"error": "input must be an object matching EnhancePayload"}
    try:
        payload = EnhancePayload(**payload_in)
    except Exception as exc:  # noqa: BLE001 — pydantic validation
        return {"error": f"invalid input: {exc}"}
    try:
        return enhance(payload)
    except Exception as exc:  # noqa: BLE001 — HTTPException or runtime failure
        detail = getattr(exc, "detail", None) or str(exc)
        logger.warning("enhance failed in serverless handler: %s", detail)
        return {"error": str(detail)}


runpod.serverless.start({"handler": handler})
