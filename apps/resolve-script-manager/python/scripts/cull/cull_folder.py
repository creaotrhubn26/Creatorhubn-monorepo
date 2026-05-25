"""Cull Folder — full pipeline: scan → thumbnails → Claude Vision → decisions JSON.

Pipeline:
  1. Discover video files (or take from --params clips list)
  2. Extract thumbnails via extract_thumbnails (delegated)
  3. Local pre-filter: reject obvious failures (too short, file too small, blur, exposure)
  4. Send remaining to Claude Vision (Haiku for speed, Sonnet fallback for edge cases)
  5. Build CullSession with per-clip decision + AI suggestion + score
  6. Emit result — Tauri frontend persists via save_cull_session command

Params:
  sourcePath:      folder/card path (required)
  sourceLabel:     human label (e.g. "CANON_C80")
  preflight:       { multiCamera, externalAudio, groupByTimecode, rejectTcDuplicates, projectTemplate }
  framesPerClip:   thumbnails per clip (default 3)
  model:           "claude-haiku-4-5" or "claude-sonnet-4-6" (default haiku)
  skipVision:      true → only local pre-filter (no API calls, no costs)
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()


VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".mxf", ".avi", ".mkv", ".braw", ".r3d", ".arri"}


SIMILARITY_WINDOW_SECONDS = 120  # clips within this window + same scene = candidate group
SIDECAR_FFMPEG_PATHS = (
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
)


def find_ffmpeg() -> tuple[str | None, str | None]:
    """Locate ffmpeg + ffprobe — env override → PATH → common Homebrew/MacPorts paths."""
    env_ffmpeg = os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
    if env_ffmpeg and os.path.isfile(env_ffmpeg):
        env_ffprobe = env_ffmpeg.replace("ffmpeg", "ffprobe")
        if os.path.isfile(env_ffprobe):
            return env_ffmpeg, env_ffprobe

    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if ffmpeg and ffprobe:
        return ffmpeg, ffprobe

    for candidate in SIDECAR_FFMPEG_PATHS:
        if os.path.isfile(candidate):
            probe = candidate.replace("ffmpeg", "ffprobe")
            if os.path.isfile(probe):
                return candidate, probe

    return ffmpeg, ffprobe


BEST_TAKE_PROMPT = """You are picking the best take among N similar wedding clips from the same moment.
Look at the thumbnails — each labeled with the clip filename.

Return ONLY a JSON object:
- hero: the filename of the strongest take
- reasoning: max 20 words
- alternates: array of filenames that are also useful (B-cam coverage, different angles)
- rejects: filenames to drop (worse versions, same as hero)

Criteria: focus sharpness, framing, subject visibility, expression/emotion, audio cue (if speech).
If you cannot tell which is best, set "hero": null and "reasoning": "no clear winner"."""


CULL_PROMPT_TEMPLATE = """You are a wedding-videography cull assistant.
Look at the provided thumbnails from a single video clip.

Return ONLY a JSON object with these fields:
- scene: one of [bride_prep, groom_prep, ceremony, vows, ring_exchange, first_kiss, portrait, entrance, speeches, cake, first_dance, party, drone, detail, candid, unknown]
- quality_score: integer 0-100 — focus, exposure, composition, audio likelihood
- highlight_score: integer 0-100 — emotional impact, "wow" moments, energy
- full_film_score: integer 0-100 — narrative value, continuity, completeness
- ai_suggestion: one of [keep, reject, maybe]
- tags: array, subset of [emotional, kiss, rings, entrance, speech, laughing, dance, drone, details, blurry, dark, overexposed, no_subject]
- notes: max 15 words explaining the suggestion

Context: this is from {source_label}. {extra_context}

Rules:
- "reject" only when clearly unusable (severe blur, all-black, no subject, <1s)
- "maybe" when borderline — let Bjarne decide
- Highlight scores >70 are reserved for genuine standout moments
- Return ONLY the JSON, no prose"""


def discover_clips(source: str) -> list[str]:
    found = []
    for root, _dirs, files in os.walk(source):
        for fname in files:
            if os.path.splitext(fname)[1].lower() in VIDEO_EXTS:
                found.append(os.path.join(root, fname))
    return sorted(found)


def file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def local_prefilter(clip_path: str, duration: float | None, size_bytes: int) -> tuple[str | None, str | None]:
    """Return (decision, reason) — decision in ("reject", "maybe", None=pass)."""
    if duration is not None and duration < 1.2:
        return ("reject", "duration < 1.2s — likely accidental trigger")
    if size_bytes < 200 * 1024:
        return ("reject", "file < 200KB — likely empty or corrupt")
    name = os.path.basename(clip_path).lower()
    if re.search(r"corrupt|trash|test", name):
        return ("maybe", "filename suggests caution")
    return (None, None)


def probe_duration(ffprobe: str | None, clip_path: str) -> float | None:
    if not ffprobe:
        return None
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", clip_path],
            capture_output=True, text=True, timeout=10,
        )
        return float(out.stdout.strip()) if out.stdout.strip() else None
    except (subprocess.TimeoutExpired, ValueError):
        return None


def probe_start_tc(ffprobe: str | None, clip_path: str) -> str | None:
    if not ffprobe:
        return None
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "stream_tags=timecode:format_tags=timecode",
             "-of", "default=noprint_wrappers=1:nokey=1", clip_path],
            capture_output=True, text=True, timeout=10,
        )
        lines = [line for line in out.stdout.strip().split("\n") if line]
        return lines[0] if lines else None
    except subprocess.TimeoutExpired:
        return None


def thumb_path(cache_dir: str, clip_path: str, frame_no: int) -> str:
    h = hashlib.sha1(clip_path.encode("utf-8")).hexdigest()[:16]
    return os.path.join(cache_dir, h, f"f{frame_no}.jpg")


def extract_thumbnail(ffmpeg: str, clip_path: str, target: str, timestamp: float) -> bool:
    if os.path.exists(target):
        return True
    os.makedirs(os.path.dirname(target), exist_ok=True)
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-ss", f"{timestamp:.3f}", "-i", clip_path,
        "-frames:v", "1",
        "-vf", "scale='if(gt(iw,640),640,iw)':-2",
        "-q:v", "5", target,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        return r.returncode == 0 and os.path.exists(target)
    except subprocess.TimeoutExpired:
        return False


def parse_tc_to_seconds(tc: str | None) -> float | None:
    """Parse HH:MM:SS:FF or HH:MM:SS.FFF to seconds. Returns None on failure."""
    if not tc:
        return None
    cleaned = tc.strip()
    # Drop trailing frame component
    cleaned = re.sub(r"[:.](\d{1,3})$", "", cleaned)
    parts = cleaned.split(":")
    if len(parts) != 3:
        return None
    try:
        h, m, s = (int(p) for p in parts)
        return h * 3600 + m * 60 + s
    except ValueError:
        return None


def build_similar_groups(decisions: list[dict]) -> list[dict]:
    """Group clips that are likely from the same moment.

    Strategy: sort by start_tc seconds; within the same scene tag, walk window-by-window
    and accumulate clips whose start_tc is within SIMILARITY_WINDOW_SECONDS of the previous.
    Clips without scene tags or TC are skipped (no false positives).
    """
    with_time = []
    for d in decisions:
        tc_seconds = parse_tc_to_seconds(d.get("startTimecode"))
        if tc_seconds is None or not d.get("scene") or d.get("decision") == "reject":
            continue
        with_time.append((d.get("scene"), tc_seconds, d))

    if not with_time:
        return []

    with_time.sort(key=lambda x: (x[0], x[1]))

    groups: list[dict] = []
    current: list[dict] = []
    current_scene: str | None = None
    last_time: float | None = None

    def flush():
        if len(current) >= 2:
            members = sorted(current, key=lambda d: d.get("startTimecode") or "")
            groups.append({
                "groupId": str(uuid.uuid4())[:8],
                "scene": members[0].get("scene"),
                "startTimecode": members[0].get("startTimecode"),
                "clipPaths": [m["clipPath"] for m in members],
                "clipNames": [m["clipName"] for m in members],
                "hero": None,
                "heroReasoning": None,
                "alternates": [],
                "rejects": [],
            })

    for scene, tc, d in with_time:
        if scene != current_scene or (last_time is not None and tc - last_time > SIMILARITY_WINDOW_SECONDS):
            flush()
            current = [d]
            current_scene = scene
            last_time = tc
        else:
            current.append(d)
            last_time = tc
    flush()

    return groups


def compute_audio_fingerprint(clip_path: str, fpcalc: str | None) -> str | None:
    """Return a chromaprint fingerprint string for the first 30 seconds of audio.

    Requires `fpcalc` on PATH (brew install chromaprint). Returns None if missing.
    """
    if not fpcalc or not os.path.isfile(clip_path):
        return None
    try:
        result = subprocess.run(
            [fpcalc, "-length", "30", "-raw", clip_path],
            capture_output=True, text=True, timeout=20,
        )
        if result.returncode != 0:
            return None
        for line in result.stdout.splitlines():
            if line.startswith("FINGERPRINT="):
                return line[len("FINGERPRINT="):].strip()
    except subprocess.TimeoutExpired:
        return None
    return None


def fingerprint_distance(fp_a: str | None, fp_b: str | None) -> int | None:
    """Hamming distance between two chromaprint raw fingerprints (comma-separated ints).

    Smaller = more similar. < 0.05 of bit-length is typically 'same audio source'.
    """
    if not fp_a or not fp_b:
        return None
    try:
        a = [int(x) for x in fp_a.split(",") if x]
        b = [int(x) for x in fp_b.split(",") if x]
    except ValueError:
        return None
    n = min(len(a), len(b))
    if n == 0:
        return None
    distance = 0
    for i in range(n):
        distance += bin(a[i] ^ b[i]).count("1")
    return distance


def annotate_groups_with_audio(groups: list[dict], decisions: list[dict]) -> None:
    """Run chromaprint on each clip in each group; mark group with audio confidence.

    audioConfidence:
      - "confirmed"      → all pairs in group have hamming distance < threshold
      - "partial"        → at least one pair matches, but not all
      - "metadata_only"  → fpcalc ran but no pairs match
      - "unavailable"    → fpcalc not installed
    """
    fpcalc = shutil.which("fpcalc")
    if not fpcalc:
        for group in groups:
            group["audioConfidence"] = "unavailable"
        return

    path_by_name = {os.path.basename(d["clipPath"]): d["clipPath"] for d in decisions}

    for group in groups:
        bridge.log(f"Audio-fingerprinting {len(group['clipNames'])} clips in group {group['groupId']}")
        fingerprints: dict[str, str | None] = {}
        for name in group["clipNames"]:
            clip_path = path_by_name.get(name)
            if not clip_path:
                continue
            fingerprints[name] = compute_audio_fingerprint(clip_path, fpcalc)

        valid = {k: v for k, v in fingerprints.items() if v}
        if len(valid) < 2:
            group["audioConfidence"] = "unavailable"
            continue

        # Compute pairwise distances, normalised by fingerprint length
        names = list(valid.keys())
        sample_len = min(len(v.split(",")) for v in valid.values() if v)
        threshold_bits = int(sample_len * 32 * 0.18)  # ~18% bit-error = same source

        matched_pairs = 0
        total_pairs = 0
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                dist = fingerprint_distance(valid[names[i]], valid[names[j]])
                if dist is None:
                    continue
                total_pairs += 1
                if dist <= threshold_bits:
                    matched_pairs += 1

        if total_pairs == 0:
            group["audioConfidence"] = "metadata_only"
        elif matched_pairs == total_pairs:
            group["audioConfidence"] = "confirmed"
            group["audioMatchNote"] = (
                f"All {len(names)} clips share the same audio fingerprint — definitely the same moment."
            )
        elif matched_pairs > 0:
            group["audioConfidence"] = "partial"
            group["audioMatchNote"] = (
                f"{matched_pairs} of {total_pairs} pairs share audio — some clips may be from adjacent moments."
            )
        else:
            group["audioConfidence"] = "metadata_only"
            group["audioMatchNote"] = (
                "Visuals + timecode suggest same moment, but audio fingerprints differ. "
                "Likely separate takes shot close in time."
            )


def call_best_take_vision(client, model: str, members: list[dict]) -> dict | None:
    """Send all member-thumbnails to Claude with the BEST_TAKE_PROMPT and get a hero pick."""
    contents = []
    for member in members[:8]:  # cap at 8 to keep token use sane
        thumb = member["thumbnails"][0] if member.get("thumbnails") else None
        if not thumb or not os.path.isfile(thumb):
            continue
        with open(thumb, "rb") as fh:
            b64 = base64.standard_b64encode(fh.read()).decode("ascii")
        contents.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })
        contents.append({"type": "text", "text": f"filename: {member['clipName']}"})
    contents.append({"type": "text", "text": BEST_TAKE_PROMPT})

    try:
        message = client.messages.create(
            model=model, max_tokens=384,
            messages=[{"role": "user", "content": contents}],
        )
        text = "".join(b.text for b in message.content if hasattr(b, "text")).strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        return json.loads(text)
    except Exception as exc:
        bridge.warn(f"Best-take Vision call failed: {exc}")
        return None


def call_claude_vision(client, model: str, thumbnails: list[str], prompt: str) -> dict | None:
    contents = []
    for thumb in thumbnails:
        with open(thumb, "rb") as fh:
            b64 = base64.standard_b64encode(fh.read()).decode("ascii")
        contents.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })
    contents.append({"type": "text", "text": prompt})

    try:
        message = client.messages.create(
            model=model,
            max_tokens=512,
            messages=[{"role": "user", "content": contents}],
        )
        text = "".join(b.text for b in message.content if hasattr(b, "text")).strip()
        # Strip code-fence if Claude wraps the JSON
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        return json.loads(text)
    except Exception as exc:
        bridge.warn(f"Claude Vision call failed: {exc}")
        return None


def run(params: dict, dry_run: bool) -> None:
    source = params.get("sourcePath")
    if not source:
        bridge.error("Missing required input: sourcePath")
        sys.exit(1)
    source = os.path.expanduser(source)
    if not os.path.isdir(source):
        bridge.error(f"sourcePath is not a directory: {source}")
        sys.exit(1)

    source_label = params.get("sourceLabel") or os.path.basename(os.path.normpath(source))
    frames_per_clip = int(params.get("framesPerClip", 3))
    model = params.get("model", "claude-haiku-4-5")
    skip_vision = bool(params.get("skipVision", False))
    preflight = params.get("preflight") or {
        "multiCamera": False,
        "externalAudio": False,
        "groupByTimecode": False,
        "rejectTcDuplicates": False,
        "projectTemplate": "wedding_film",
    }

    clip_paths = params.get("clips") or discover_clips(source)
    bridge.log(f"Found {len(clip_paths)} video files in {source}")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would cull {len(clip_paths)} clips via local pre-filter + {model}",
            "sourceLabel": source_label,
            "framesPerClip": frames_per_clip,
            "model": model,
            "skipVision": skip_vision,
            "preflight": preflight,
            "estimatedApiCalls": 0 if skip_vision else len(clip_paths),
        })
        return

    ffmpeg, ffprobe = find_ffmpeg()
    if not ffmpeg:
        bridge.error(
            "ffmpeg not found. Install via `brew install ffmpeg` (macOS), or set "
            "RESOLVE_SCRIPT_MANAGER_FFMPEG=/path/to/ffmpeg"
        )
        sys.exit(1)

    cache_dir = os.path.join(
        os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent"),
        "thumbnails",
    )
    os.makedirs(cache_dir, exist_ok=True)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    client = None
    if not skip_vision:
        bearer = os.environ.get("RR_BEARER_TOKEN")
        if not bearer and not api_key:
            bridge.warn("Ikke logget inn til The Role Room (RR_BEARER_TOKEN mangler) og ingen ANTHROPIC_API_KEY — local-only")
            skip_vision = True
        else:
            try:
                # Use The Role Room proxy when bearer token is set; otherwise fall
                # back to the direct Anthropic SDK (dev/admin path).
                if bearer:
                    from anthropic_proxy import Anthropic  # type: ignore[import-not-found]
                    client = Anthropic(bearer_token=bearer)
                else:
                    import anthropic  # type: ignore[import-not-found]
                    client = anthropic.Anthropic(api_key=api_key)
            except ImportError:
                bridge.warn("anthropic_proxy ikke tilgjengelig — local-only mode")
                skip_vision = True

    extra_context_parts = []
    if preflight.get("multiCamera"):
        extra_context_parts.append("Bjarne shot with multiple cameras — expect duplicate moments.")
    if preflight.get("externalAudio"):
        extra_context_parts.append("External audio recorders used — speech clips matter.")
    extra_context = " ".join(extra_context_parts) or "Standard wedding cull."

    decisions: list[dict] = []
    tc_groups: dict[str, list[str]] = {}

    total_clips = len(clip_paths)
    for index, path in enumerate(clip_paths):
        clip_name = os.path.basename(path)
        bridge.progress(index, total_clips, f"Culling {clip_name}")
        size = file_size(path)
        duration = probe_duration(ffprobe, path)
        start_tc = probe_start_tc(ffprobe, path)

        # Pre-filter
        prefilter_decision, prefilter_reason = local_prefilter(path, duration, size)

        # Thumbnail extraction (only if not pre-rejected)
        thumbnails: list[str] = []
        if prefilter_decision != "reject":
            positions = [(i + 1) / (frames_per_clip + 1) for i in range(frames_per_clip)]
            if duration and duration > 0.5:
                for i, frac in enumerate(positions):
                    ts = duration * frac
                    target = thumb_path(cache_dir, path, i + 1)
                    if extract_thumbnail(ffmpeg, path, target, ts):
                        thumbnails.append(target)
            else:
                target = thumb_path(cache_dir, path, 1)
                if extract_thumbnail(ffmpeg, path, target, 1.0):
                    thumbnails.append(target)

        # Vision scoring
        ai = None
        if prefilter_decision != "reject" and client and thumbnails:
            prompt = CULL_PROMPT_TEMPLATE.format(source_label=source_label, extra_context=extra_context)
            ai = call_claude_vision(client, model, thumbnails, prompt)

        # Compose final decision (user-overridable later)
        decision = prefilter_decision or (ai.get("ai_suggestion") if ai else "pending") or "pending"

        # Tag for TC grouping
        if preflight.get("groupByTimecode") and start_tc:
            tc_key = start_tc[:11]  # HH:MM:SS — group within same second
            tc_groups.setdefault(tc_key, []).append(path)

        decisions.append({
            "clipPath": path,
            "clipName": clip_name,
            "thumbnails": thumbnails,
            "sizeBytes": size,
            "durationSeconds": duration,
            "startTimecode": start_tc,
            "decision": decision,
            "aiSuggestion": (ai or {}).get("ai_suggestion") or prefilter_decision,
            "scene": (ai or {}).get("scene"),
            "qualityScore": (ai or {}).get("quality_score"),
            "highlightScore": (ai or {}).get("highlight_score"),
            "fullFilmScore": (ai or {}).get("full_film_score"),
            "tags": (ai or {}).get("tags", []),
            "notes": (ai or {}).get("notes") or prefilter_reason,
            "userOverrode": False,
        })

        if (index + 1) % 10 == 0 or index == len(clip_paths) - 1:
            bridge.log(f"Culled {index + 1}/{len(clip_paths)} clips")

    # TC duplicate detection
    if preflight.get("rejectTcDuplicates") and tc_groups:
        for tc_key, group in tc_groups.items():
            if len(group) > 1:
                # Keep the largest-file in the group, mark rest as maybe
                sorted_group = sorted(group, key=file_size, reverse=True)
                for dup in sorted_group[1:]:
                    for d in decisions:
                        if d["clipPath"] == dup and d["decision"] != "reject":
                            d["decision"] = "maybe"
                            d["notes"] = f"TC duplicate of {os.path.basename(sorted_group[0])}"

    # Similar-clip grouping — by scene + start_tc window
    similar_groups = build_similar_groups(decisions)

    # Audio-fingerprint confirmation per group
    if similar_groups:
        annotate_groups_with_audio(similar_groups, decisions)

    if client and similar_groups and params.get("bestTakeModel"):
        # Run a deeper Sonnet pass per group to pick the hero
        best_model = params.get("bestTakeModel", "claude-sonnet-4-6")
        for group in similar_groups:
            if len(group["clipPaths"]) < 2:
                continue
            members = [d for d in decisions if d["clipPath"] in group["clipPaths"] and d.get("thumbnails")]
            if len(members) < 2:
                continue
            hero = call_best_take_vision(client, best_model, members)
            if hero:
                group["hero"] = hero.get("hero")
                group["heroReasoning"] = hero.get("reasoning")
                group["alternates"] = hero.get("alternates", [])
                group["rejects"] = hero.get("rejects", [])

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    card_hash = hashlib.sha1(
        "\n".join(sorted(os.path.basename(c) for c in clip_paths)).encode("utf-8")
    ).hexdigest()[:16]
    session = {
        "sessionId": session_id,
        "sourcePath": source,
        "sourceLabel": source_label,
        "cardHash": card_hash,
        "createdAt": now,
        "updatedAt": now,
        "preflight": preflight,
        "decisions": decisions,
        "similarGroups": similar_groups,
    }

    bridge.result({
        "session": session,
        "summary": {
            "totalClips": len(decisions),
            "kept": sum(1 for d in decisions if d["decision"] == "keep"),
            "rejected": sum(1 for d in decisions if d["decision"] == "reject"),
            "maybe": sum(1 for d in decisions if d["decision"] == "maybe"),
            "pending": sum(1 for d in decisions if d["decision"] == "pending"),
            "tcGroups": {k: len(v) for k, v in tc_groups.items() if len(v) > 1},
            "similarGroupCount": len(similar_groups),
        },
    })


if __name__ == "__main__":
    bridge.main_guard(run)
