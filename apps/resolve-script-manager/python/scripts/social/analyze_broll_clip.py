"""Analyze B-roll Clip — bruk Claude vision-AI for å gi rik strukturert
metadata om en B-roll-klipp.

Ekstraherer 3-5 keyframes med jevne intervaller, sender til Claude
via anthropic-proxy med strukturert prompt for å tagge:
  - Visuelt innhold: objekter, mennesker, scene-type, location, time-
    of-day, lighting, color-palette
  - Motion: stativ/handhåndtert/dolly/zoom/pan/tilt/statisk
  - Shot-type: wide/medium/close-up/extreme-close-up
  - Mood: liste av stemnings-tags
  - Audio-context: sannsynlige ambient-kategorier (ute/inne, stille/
    travel, naturlig/teknisk)
  - Suggested-for: hvilke chapter-typer / kontexter klippet passer i

Output strukturert JSON som autopilot context-matching kan bruke.

Input params:
  videoPath:      sti til B-roll-klipp
  postAgentBaseUrl: Role Room base URL for anthropic-proxy
  bearerToken:    RR_BEARER_TOKEN
  model:          (optional, default "claude-sonnet-4-6")
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _get_duration(ffmpeg: str, video_path: str) -> float:
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    if os.path.isfile(ffprobe):
        try:
            r = subprocess.run([
                ffprobe, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "csv=p=0", video_path,
            ], capture_output=True, text=True, timeout=20)
            if r.returncode == 0:
                return float(r.stdout.strip() or 0)
        except (ValueError, subprocess.TimeoutExpired): pass
    return 0.0


def _extract_keyframes(
    ffmpeg: str, video_path: str, out_dir: str, count: int,
) -> list[str]:
    """Extract `count` keyframes jevnt fordelt over klipp-varigheten,
    resize ned til max 800px bredde for å spare token-budsjett."""
    duration = _get_duration(ffmpeg, video_path)
    if duration <= 0:
        return []

    frames: list[str] = []
    # Hopp 5% inn og 5% ut for å unngå black-bars/fade-ins
    inset = max(0.1, duration * 0.05)
    available = duration - 2 * inset
    if count == 1:
        timestamps = [inset + available / 2]
    else:
        step = available / (count - 1) if count > 1 else 0
        timestamps = [inset + step * i for i in range(count)]

    for i, ts in enumerate(timestamps):
        out_path = os.path.join(out_dir, f"frame_{i}.jpg")
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", str(ts), "-i", video_path,
            "-vframes", "1",
            "-vf", "scale='min(800,iw)':-2:flags=lanczos",
            "-q:v", "4",
            out_path,
        ]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if r.returncode == 0 and os.path.isfile(out_path):
                frames.append(out_path)
        except subprocess.TimeoutExpired:
            continue
    return frames


def _frame_to_b64(path: str) -> str | None:
    try:
        with open(path, "rb") as f:
            data = f.read()
        return base64.b64encode(data).decode("ascii")
    except OSError:
        return None


VISION_SYSTEM_PROMPT = """Du er en visuell-analyse-AI for et B-roll-bibliotek.
Du analyserer keyframes fra et B-roll-klipp og returnerer STRUKTURERT JSON
som beskriver hva som er i klippet. Output brukes til autopilot-matching
mot scene-kontekst — så vær PRESIS og KONSEKVENT med tag-vokabularet.

Returnér KUN gyldig JSON. Ingen markdown, ingen prose."""

VISION_USER_PROMPT = """Analyser disse keyframene fra et B-roll-klipp og
returner JSON-format:

{
  "summary": "Kort 1-setnings beskrivelse",
  "objects": ["array av primær-objekter, max 8"],
  "people": true/false,
  "peopleCount": 0,
  "scene": "interior" | "exterior" | "mixed",
  "location": "f.eks. office, cafe, street, kitchen, nature, vehicle",
  "timeOfDay": "morning" | "midday" | "afternoon" | "evening" | "night" | "unknown",
  "lighting": "natural soft" | "natural hard" | "warm artificial" | "cool artificial" | "low-key" | "high-key" | "mixed",
  "mood": ["array av stemnings-tags: calm/intense/joyful/contemplative/intimate/professional/raw/cinematic/etc"],
  "motion": "static" | "subtle" | "panning" | "tracking" | "zoom-in" | "zoom-out" | "handheld" | "drone",
  "shotType": "extreme-wide" | "wide" | "medium" | "close-up" | "extreme-close-up",
  "colorPalette": ["array av 3-5 hex-farger"],
  "audioContext": ["sannsynlige ambient-kategorier: quiet/ambient/busy/voice/music/nature/urban/etc"],
  "suggestedFor": ["array av chapter-typer/contexts klippet passer i: establishing/intimate-moment/transitional/atmospheric/etc"],
  "tags": ["8-15 dominerende tags, lowercase, ingen mellomrom (bruk '-')"]
}

Vær konsekvent — bruk samme tag for samme konsept på tvers av klipp. F.eks.
"close-up" (ikke "closeup" eller "close up"). Tags brukes for matching, så
konsistens er kritisk."""


def _call_claude_vision(
    base_url: str, bearer: str, model: str,
    frame_b64_list: list[str],
) -> dict[str, Any] | None:
    """Kall anthropic-proxy med multi-image prompt. Returnerer parset
    JSON-output eller None ved feil."""
    content: list[dict[str, Any]] = [
        {"type": "text", "text": VISION_USER_PROMPT}
    ]
    for b64 in frame_b64_list:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            },
        })

    body = {
        "model": model,
        "max_tokens": 1500,
        "system": VISION_SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": content},
        ],
    }
    url = base_url.rstrip("/") + "/anthropic/messages"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            err_body = exc.read().decode("utf-8")
        except Exception: err_body = "(no body)"
        bridge.error(f"Claude proxy HTTP {exc.code}: {err_body[:300]}")
        return None
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        bridge.error(f"Claude proxy feilet: {exc}")
        return None

    # Hent tekst-content
    text_parts: list[str] = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
    full_text = "\n".join(text_parts).strip()

    # Strip potensielle markdown-codefences
    if full_text.startswith("```"):
        full_text = full_text.split("\n", 1)[1] if "\n" in full_text else full_text
        if full_text.endswith("```"):
            full_text = full_text[:-3]
        full_text = full_text.strip()
        if full_text.startswith("json"):
            full_text = full_text[4:].strip()

    try:
        return json.loads(full_text)
    except json.JSONDecodeError as exc:
        bridge.warn(f"Kunne ikke parse Claude-output som JSON: {exc}")
        bridge.warn(f"Raw: {full_text[:300]}")
        return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' mangler")
        sys.exit(1)

    base_url = (params.get("postAgentBaseUrl") or "").strip()
    bearer = (params.get("bearerToken") or "").strip()
    if not base_url or not bearer:
        bridge.error("postAgentBaseUrl + bearerToken er påkrevd")
        sys.exit(1)

    model = (params.get("model") or "claude-sonnet-4-6").strip()
    frame_count = int(params.get("frameCount") or 4)

    if dry_run:
        bridge.result({
            "wouldAnalyze": video_path,
            "frameCount": frame_count,
            "model": model,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    bridge.log(f"Ekstraherer {frame_count} keyframes fra {os.path.basename(video_path)} …")
    with tempfile.TemporaryDirectory() as tmpdir:
        frames = _extract_keyframes(ffmpeg, video_path, tmpdir, frame_count)
        if not frames:
            bridge.error("Kunne ikke ekstrahere keyframes")
            sys.exit(1)
        bridge.log(f"Hentet {len(frames)} frames · sender til Claude vision …")

        b64_frames = []
        for f in frames:
            b64 = _frame_to_b64(f)
            if b64: b64_frames.append(b64)

        if not b64_frames:
            bridge.error("Kunne ikke encode frames")
            sys.exit(1)

        analysis = _call_claude_vision(base_url, bearer, model, b64_frames)
        if analysis is None:
            bridge.error("Vision-analyse feilet")
            sys.exit(1)

        bridge.log(f"Vision-analyse OK: {analysis.get('summary', '(no summary)')[:80]}")
        bridge.result({
            "visionAnalysis": analysis,
            "tags": analysis.get("tags", []),
            "framesAnalyzed": len(b64_frames),
            "model": model,
        })


bridge.main_guard(run)
