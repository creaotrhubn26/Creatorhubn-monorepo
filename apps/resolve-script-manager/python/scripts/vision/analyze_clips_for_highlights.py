"""Analyze Clips for Highlights — Claude Vision rates each clip for highlight + long-film use.

Reads thumbnail frames (one per clip) and asks Claude to score:
  - highlight_score (0-100): emotional impact, technical quality, "wow" moments
  - full_film_score (0-100): completeness, narrative value
  - tags: emotional / kiss / rings / entrance / speech / laughing / dance / drone / details
  - notes: short freeform observation

Output is consumed by timeline/create_highlight_rough_cut.py via `--params rankedClips=...`.
"""

from __future__ import annotations

import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()


PROMPT = """You are an editor's assistant analysing wedding footage thumbnails.
For each frame, return JSON with: highlight_score (0-100), full_film_score (0-100), tags (subset of [emotional, kiss, rings, entrance, speech, laughing, dance, drone, details]), notes (max 20 words).
Highlight score weighs emotion, kinetic energy and "wow" moments. Full-film score weighs narrative completeness and continuity."""


def run(params: dict, dry_run: bool) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    thumbnails = params.get("thumbnails") or []  # [{clipName, framePath}]
    model = params.get("model", "claude-sonnet-4-6")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would send {len(thumbnails)} thumbnails to {model} for highlight scoring",
            "promptPreview": PROMPT,
            "requiresEnv": "ANTHROPIC_API_KEY",
            "apiKeyPresent": bool(api_key),
            "outputShape": [{"clipName": "C001_001.mov", "highlight_score": 88, "full_film_score": 72, "tags": ["kiss", "emotional"], "notes": "..."}],
        })
        return

    if not thumbnails:
        bridge.error("No thumbnails provided. Run a thumbnail-extraction step first (e.g. ffmpeg or Resolve GrabStill).")
        sys.exit(1)

    bearer = os.environ.get("RR_BEARER_TOKEN")
    if not bearer and not api_key:
        bridge.error("Ikke logget inn til The Role Room (RR_BEARER_TOKEN) og ingen ANTHROPIC_API_KEY satt.")
        sys.exit(1)
    if bearer:
        from anthropic_proxy import Anthropic  # type: ignore[import-not-found]
        client = Anthropic(bearer_token=bearer)
    else:
        try:
            import anthropic  # type: ignore[import-not-found]
        except ImportError:
            bridge.error("Ikke logget inn til The Role Room, og anthropic-pakka mangler. Logg inn fra Settings, eller installer 'pip install anthropic'.")
            sys.exit(1)
        if not api_key:
            bridge.error("RR_BEARER_TOKEN eller ANTHROPIC_API_KEY må være satt.")
            sys.exit(1)
        client = anthropic.Anthropic(api_key=api_key)
    rankings: list[dict] = []
    for entry in thumbnails:
        frame_path = entry.get("framePath")
        clip_name = entry.get("clipName")
        if not (frame_path and os.path.isfile(frame_path)):
            bridge.warn(f"Skipping {clip_name}: thumbnail missing at {frame_path}")
            continue

        with open(frame_path, "rb") as fh:
            image_b64 = base64.standard_b64encode(fh.read()).decode("ascii")

        message = client.messages.create(
            model=model,
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                    {"type": "text", "text": PROMPT},
                ],
            }],
        )
        text = "".join(block.text for block in message.content if hasattr(block, "text"))
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            bridge.warn(f"Could not parse Vision response for {clip_name}: {text[:120]}")
            continue
        parsed["clipName"] = clip_name
        rankings.append(parsed)
        bridge.log(f"Scored {clip_name}: highlight={parsed.get('highlight_score')} full={parsed.get('full_film_score')}")

    rankings.sort(key=lambda r: r.get("highlight_score", 0), reverse=True)
    bridge.result({
        "rankedClips": rankings,
        "scoredCount": len(rankings),
        "model": model,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
