"""Classify Scene Looks — Claude Vision tags clips by wedding scene + lighting condition.

Output feeds color/apply_camera_lut.py and color/create_color_groups.py to apply
the right look-template per scene (Bride Prep → Soft Morning, Reception → Warm Filmic, etc.).
"""

from __future__ import annotations

import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()


SCENES = [
    "bride_prep", "groom_prep", "ceremony", "portrait", "reception",
    "speeches", "first_dance", "party", "detail", "drone", "candid",
]

LIGHTING = ["daylight", "golden_hour", "tungsten_indoor", "mixed", "low_light", "stage_led", "candlelight"]


PROMPT = (
    "Classify this wedding clip thumbnail. Return JSON with: "
    f"scene (one of {SCENES}), "
    f"lighting (one of {LIGHTING}), "
    "indoor_outdoor (indoor|outdoor|mixed), "
    "suggested_look (short label e.g. 'Soft Bridal Morning'), "
    "confidence (0-1), "
    "notes (max 15 words)."
)


def run(params: dict, dry_run: bool) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    thumbnails = params.get("thumbnails") or []
    model = params.get("model", "claude-sonnet-4-6")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would classify {len(thumbnails)} clips into scenes + lighting + suggested looks",
            "sceneVocabulary": SCENES,
            "lightingVocabulary": LIGHTING,
            "requiresEnv": "ANTHROPIC_API_KEY",
            "apiKeyPresent": bool(api_key),
            "outputShape": [{"clipName": "C001_001.mov", "scene": "ceremony", "lighting": "mixed", "suggested_look": "Clean Neutral"}],
        })
        return

    if not api_key:
        bridge.error("ANTHROPIC_API_KEY not set.")
        sys.exit(1)
    if not thumbnails:
        bridge.error("No thumbnails provided.")
        sys.exit(1)

    bearer = os.environ.get("RR_BEARER_TOKEN")
    if bearer:
        from anthropic_proxy import Anthropic  # type: ignore[import-not-found]
        client = Anthropic(bearer_token=bearer)
    else:
        try:
            import anthropic  # type: ignore[import-not-found]
        except ImportError:
            bridge.error("Ikke logget inn til The Role Room, og anthropic-pakka mangler.")
            sys.exit(1)
        if not api_key:
            bridge.error("RR_BEARER_TOKEN eller ANTHROPIC_API_KEY må være satt.")
            sys.exit(1)
        client = anthropic.Anthropic(api_key=api_key)
    classifications: list[dict] = []
    for entry in thumbnails:
        frame_path = entry.get("framePath")
        clip_name = entry.get("clipName")
        if not (frame_path and os.path.isfile(frame_path)):
            bridge.warn(f"Skipping {clip_name}: thumbnail missing")
            continue

        with open(frame_path, "rb") as fh:
            image_b64 = base64.standard_b64encode(fh.read()).decode("ascii")

        message = client.messages.create(
            model=model,
            max_tokens=256,
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
        classifications.append(parsed)
        bridge.log(f"Classified {clip_name} → {parsed.get('scene')} ({parsed.get('lighting')})")

    bridge.result({
        "classifications": classifications,
        "scoredCount": len(classifications),
        "model": model,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
