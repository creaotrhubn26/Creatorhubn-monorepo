"""Analyze Exported Video — takes a finished (edited+exported) video file,
detects shot cuts via ffmpeg, optionally narrates each shot with Claude
Vision, then imports the video into Resolve as a new timeline with one
marker per detected cut.

Use case: Bjarne already has an exported wedding film. He drops it into
Post Agent to see his own edit broken down shot-by-shot, navigate via
named markers in Resolve, and potentially re-edit or generate alt cuts.

Input via params:
  videoPath:        absolute path to the exported video file (mp4/mov/mxf)
  sceneThreshold:   float 0..1, ffmpeg scene-detect sensitivity (default 0.4)
  narrate:          bool, run Claude Vision per shot to name markers (default false)
  timelineName:     optional name for the new Resolve timeline

Steps:
  1. ffmpeg -vf "select='gt(scene,T)',showinfo" -f null - → parse pts_time
     from stderr to get cut points
  2. (optional) extract 1 thumbnail per shot at midpoint
  3. (optional) batch-call Claude Vision with thumbnails for narration
  4. import video → new timeline → marker per cut

Output: list of cuts with optional narrations + Resolve timeline ID
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


SIDECAR_FFMPEG_PATHS = (
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
)


def find_ffmpeg() -> tuple[str | None, str | None]:
    env_ffmpeg = os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
    if env_ffmpeg and os.path.isfile(env_ffmpeg):
        env_ffprobe = env_ffmpeg.replace("ffmpeg", "ffprobe")
        if os.path.isfile(env_ffprobe):
            return env_ffmpeg, env_ffprobe
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if ffmpeg and ffprobe:
        return ffmpeg, ffprobe
    for c in SIDECAR_FFMPEG_PATHS:
        if os.path.isfile(c):
            p = c.replace("ffmpeg", "ffprobe")
            if os.path.isfile(p):
                return c, p
    return None, None


def probe_video(ffprobe: str, path: str) -> dict:
    """Get duration + frame-rate so we can convert cut-times to frame numbers."""
    try:
        r = subprocess.run(
            [
                ffprobe, "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=r_frame_rate,duration:format=duration",
                "-of", "json", path,
            ],
            capture_output=True, text=True, timeout=20,
        )
        data = json.loads(r.stdout)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"ffprobe failed: {exc}")
        return {"frameRate": 25.0, "duration": 0.0}

    stream = (data.get("streams") or [{}])[0]
    rate = stream.get("r_frame_rate", "25/1")
    try:
        num, den = rate.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 25.0
    except (ValueError, ZeroDivisionError):
        fps = 25.0
    duration = float(stream.get("duration") or data.get("format", {}).get("duration") or 0.0)
    return {"frameRate": fps, "duration": duration}


PTS_RE = re.compile(r"pts_time:([\d.]+)")


def detect_cuts(ffmpeg: str, path: str, threshold: float) -> list[float]:
    """Run ffmpeg scene-detect, return list of cut times in seconds (sorted)."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    cuts = sorted({float(m) for m in PTS_RE.findall(proc.stderr)})
    return cuts


def extract_frame(ffmpeg: str, video: str, time_sec: float, dest: str) -> bool:
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{time_sec:.3f}",
        "-i", video,
        "-vframes", "1",
        "-q:v", "5",
        "-vf", "scale=512:-1",
        dest,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=20)
        return r.returncode == 0 and os.path.isfile(dest)
    except Exception:  # noqa: BLE001
        return False


SILENCEDETECT_RE = re.compile(r"silence_(start|end): ([\d.]+)")


def detect_audio_sections(ffmpeg: str, video: str, duration: float) -> list[dict]:
    """Classify audio-track regions as 'music' / 'dialogue' / 'silence' by
    combining ffmpeg silencedetect with RMS-energy analysis.

    Music typically = continuous moderate-to-high RMS with few silence gaps.
    Dialogue = variable RMS with frequent short silences (between words).
    Silence = below threshold for >0.4s.

    Returns: [{ start, end, type, rmsDb, silenceRatio }] sorted by start.
    The 'type' is a best-guess label; for very mixed content (music + voice
    over) we pick whichever character dominates.
    """
    # 1) Run silencedetect to find silent gaps
    silence_cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", video,
        "-af", "silencedetect=noise=-32dB:d=0.4",
        "-vn", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(silence_cmd, capture_output=True, text=True, timeout=300)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"silencedetect failed: {exc}")
        return [{"start": 0.0, "end": duration, "type": "unknown", "rmsDb": None, "silenceRatio": None}]

    silences: list[tuple[float, float]] = []
    cur_start: float | None = None
    for kind, val in SILENCEDETECT_RE.findall(r.stderr):
        t = float(val)
        if kind == "start":
            cur_start = t
        elif kind == "end" and cur_start is not None:
            silences.append((cur_start, t))
            cur_start = None
    if cur_start is not None:
        silences.append((cur_start, duration))

    # 2) Build non-silent intervals (= candidate music or dialogue)
    audio_regions: list[tuple[float, float]] = []
    cursor = 0.0
    for s_start, s_end in silences:
        if s_start - cursor > 0.2:
            audio_regions.append((cursor, s_start))
        cursor = s_end
    if duration - cursor > 0.2:
        audio_regions.append((cursor, duration))

    # 3) For each non-silent region, measure RMS + count internal short
    #    silences (proxy for word-gaps in dialogue). High RMS + few gaps
    #    = music; lower RMS + many gaps = dialogue.
    sections: list[dict] = []
    for start, end in audio_regions:
        region_dur = end - start
        if region_dur < 0.5:
            continue
        rms_db = _measure_rms_db(ffmpeg, video, start, region_dur)
        # Count short silences inside this region (between words)
        inner = [s for s in silences if start <= s[0] <= end]
        silence_ratio = sum(min(end, e) - max(start, b) for b, e in inner) / region_dur if region_dur > 0 else 0
        # Heuristic classification
        if rms_db is not None and rms_db > -22 and silence_ratio < 0.08:
            kind = "music"
        elif rms_db is not None and rms_db > -30 and silence_ratio < 0.04:
            kind = "music"  # quiet music
        elif silence_ratio > 0.15:
            kind = "dialogue"
        else:
            kind = "dialogue" if (rms_db or -60) > -35 else "ambient"
        sections.append({
            "start": start,
            "end": end,
            "type": kind,
            "rmsDb": rms_db,
            "silenceRatio": silence_ratio,
        })

    # 4) Add the silence sections back in
    for s_start, s_end in silences:
        sections.append({"start": s_start, "end": s_end, "type": "silence", "rmsDb": None, "silenceRatio": 1.0})
    sections.sort(key=lambda s: s["start"])
    return sections


def _measure_rms_db(ffmpeg: str, video: str, start_sec: float, duration: float) -> float | None:
    """Run volumedetect on a clip slice → return mean RMS in dB, or None."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-ss", f"{start_sec:.3f}",
        "-t", f"{duration:.3f}",
        "-i", video,
        "-vn",
        "-af", "volumedetect",
        "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        m = re.search(r"mean_volume: ([-\d.]+) dB", r.stderr)
        return float(m.group(1)) if m else None
    except Exception:  # noqa: BLE001
        return None


def detect_beats(video: str, ffmpeg: str, duration: float, source_audio_path: str | None = None) -> list[float]:
    """Beat detection via librosa (optional dep). Returns beat times in
    seconds. Empty list if librosa unavailable or detection fails. We use
    the venv-py312 if it has librosa, else system python.

    If source_audio_path is provided, beats are detected on the PRISTINE
    source song (downloaded via fetch_source_song.py) instead of the
    mixed audio in the exported video. This gives a much cleaner
    beat-grid because dialogue/SFX/applause don't confuse librosa.
    """
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else "python3"

    use_source = bool(source_audio_path and os.path.isfile(source_audio_path))
    if use_source:
        tmp_audio = source_audio_path
        bridge.log(f"Using pristine source audio for beat-grid: {os.path.basename(source_audio_path)}")
    else:
        # Extract audio from video to a temp WAV
        tmp_audio = os.path.join(os.path.dirname(video), ".trrpa_beat.wav")
        extract_cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-i", video,
            "-ac", "1", "-ar", "22050",
            "-vn", "-f", "wav", tmp_audio,
        ]
        subprocess.run(extract_cmd, capture_output=True, timeout=120, check=False)
    try:
        if not os.path.isfile(tmp_audio):
            return []
        # Use librosa subprocess so we don't import it into the manager-side python
        snippet = (
            "import sys, json\n"
            "try:\n"
            "  import librosa, numpy as np\n"
            "except ImportError:\n"
            "  print(json.dumps({'error': 'librosa_not_installed'})); sys.exit(0)\n"
            "y, sr = librosa.load(sys.argv[1], sr=22050)\n"
            "tempo, beats = librosa.beat.beat_track(y=y, sr=sr)\n"
            "times = librosa.frames_to_time(beats, sr=sr).tolist()\n"
            "print(json.dumps({'beats': times, 'tempo': float(tempo)}))\n"
        )
        r = subprocess.run(
            [python, "-c", snippet, tmp_audio],
            capture_output=True, text=True, timeout=180,
        )
        try:
            data = json.loads((r.stdout or "").strip().splitlines()[-1])
            if "error" in data:
                bridge.warn(f"beat-detection skipped: {data['error']}")
                return []
            return data.get("beats", [])
        except (json.JSONDecodeError, IndexError):
            return []
    finally:
        if not use_source:
            try:
                os.remove(tmp_audio)
            except OSError:
                pass


def auto_align_source_in_video(ffmpeg: str, video_path: str, source_audio: str, duration: float) -> dict:
    """Find where source_audio starts inside video_path via chroma cross-correlation.

    Strategy: compute chroma features for both audios at low rate (22.05 kHz),
    take the first ~6 seconds of the source song as a 'fingerprint window',
    slide it across the video's chroma matrix, return the offset with highest
    inner-product similarity.

    Returns { offsetSec, confidence (0..1), windowSeconds } or { offsetSec: None } on failure.
    """
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else "python3"

    # Extract video audio first
    tmp_video_audio = os.path.join(os.path.dirname(video_path), ".trrpa_video_audio.wav")
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-i", video_path, "-ac", "1", "-ar", "22050", "-vn", "-f", "wav", tmp_video_audio],
            capture_output=True, timeout=180, check=False,
        )
        if not os.path.isfile(tmp_video_audio):
            return {"offsetSec": None}

        snippet = (
            "import sys, json\n"
            "try:\n"
            "  import librosa, numpy as np\n"
            "except ImportError:\n"
            "  print(json.dumps({'error': 'librosa_not_installed'})); sys.exit(0)\n"
            "src_path, vid_path = sys.argv[1], sys.argv[2]\n"
            # Sliding window: first 6 seconds of source as fingerprint
            "y_src, sr = librosa.load(src_path, sr=22050, duration=6.0)\n"
            "y_vid, _ = librosa.load(vid_path, sr=22050)\n"
            "if len(y_src) < sr or len(y_vid) < len(y_src):\n"
            "  print(json.dumps({'offsetSec': None, 'reason': 'too_short'})); sys.exit(0)\n"
            "hop = 512\n"
            "ch_src = librosa.feature.chroma_cqt(y=y_src, sr=sr, hop_length=hop)\n"
            "ch_vid = librosa.feature.chroma_cqt(y=y_vid, sr=sr, hop_length=hop)\n"
            # Normalize chroma vectors per-frame so the dot-product becomes cosine similarity
            "def norm(c):\n"
            "  n = np.linalg.norm(c, axis=0, keepdims=True); n[n==0]=1; return c / n\n"
            "ch_src_n = norm(ch_src); ch_vid_n = norm(ch_vid)\n"
            "win = ch_src_n.shape[1]\n"
            "if ch_vid_n.shape[1] < win:\n"
            "  print(json.dumps({'offsetSec': None, 'reason': 'video_shorter_than_window'})); sys.exit(0)\n"
            "best = (-1.0, 0)\n"
            "second = -1.0\n"
            "for i in range(ch_vid_n.shape[1] - win + 1):\n"
            "  sim = float(np.sum(ch_src_n[:, :win] * ch_vid_n[:, i:i+win]) / win)\n"
            "  if sim > best[0]:\n"
            "    second = best[0]; best = (sim, i)\n"
            "  elif sim > second:\n"
            "    second = sim\n"
            "offset_sec = best[1] * hop / sr\n"
            # Confidence = ratio of best to second-best (clamped, common heuristic for peak detection)
            "confidence = min(1.0, (best[0] - max(second, 0)) / max(best[0], 0.001))\n"
            "print(json.dumps({'offsetSec': offset_sec, 'confidence': confidence, 'similarity': best[0], 'windowSeconds': win * hop / sr}))\n"
        )
        r = subprocess.run(
            [python, "-c", snippet, source_audio, tmp_video_audio],
            capture_output=True, text=True, timeout=240,
        )
        for line in (r.stdout or "").splitlines()[::-1]:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if isinstance(data, dict):
                    if "error" in data:
                        bridge.warn(f"auto-align skipped: {data['error']}")
                        return {"offsetSec": None}
                    return data
            except json.JSONDecodeError:
                continue
        return {"offsetSec": None}
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"auto-align failed: {exc}")
        return {"offsetSec": None}
    finally:
        try:
            os.remove(tmp_video_audio)
        except OSError:
            pass


def audio_section_for_time(sections: list[dict], t: float) -> dict | None:
    for s in sections:
        if s["start"] <= t < s["end"]:
            return s
    return None


def nearest_beat(beats: list[float], t: float, tolerance_s: float = 0.15) -> dict:
    """Distance to nearest beat + on-beat verdict for a cut time."""
    if not beats:
        return {"hasBeats": False}
    # Binary-search nearest beat
    lo, hi = 0, len(beats) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if beats[mid] < t:
            lo = mid + 1
        else:
            hi = mid
    nearest_idx = lo if lo == 0 else (lo if abs(beats[lo] - t) < abs(beats[lo - 1] - t) else lo - 1)
    nearest_t = beats[nearest_idx]
    delta = t - nearest_t
    abs_delta = abs(delta)
    return {
        "hasBeats": True,
        "nearestBeatTime": nearest_t,
        "deltaSeconds": delta,
        "onBeat": abs_delta <= tolerance_s,
        "verdict": (
            "på beat" if abs_delta <= tolerance_s
            else "nær beat" if abs_delta <= tolerance_s * 2
            else "av-beat"
        ),
    }


def measure_motion(ffmpeg: str, video: str, start_sec: float, end_sec: float) -> float | None:
    """Rough motion score over a shot interval — averages per-frame scene-change
    delta from ffmpeg's scdet filter. Returns 0..1 (higher = more motion).
    None on failure. Quick approximation, used as Claude prompt context.
    """
    duration = max(0.05, end_sec - start_sec)
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-y",
        "-ss", f"{start_sec:.3f}",
        "-t", f"{duration:.3f}",
        "-i", video,
        "-vf", "scdet=threshold=0:sc_pass=0",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        deltas = [float(m) for m in re.findall(r"lavfi\.scd\.mafd=([\d.]+)", r.stderr)]
        if not deltas:
            return None
        avg = sum(deltas) / len(deltas)
        return min(1.0, avg / 30.0)  # mafd is mean absolute frame diff, typical 0-30
    except Exception:  # noqa: BLE001
        return None


def describe_shot_length(duration: float) -> str:
    if duration < 0.6: return "ultra-kort"
    if duration < 1.5: return "kort"
    if duration < 4.0: return "medium"
    if duration < 10.0: return "lang"
    return "veldig lang"


def describe_motion(score: float | None) -> str:
    if score is None: return "ukjent bevegelse"
    if score < 0.10: return "statisk/lite bevegelse"
    if score < 0.25: return "moderat bevegelse"
    if score < 0.50: return "mye bevegelse/handling"
    return "rask bevegelse/kutt-intensitet"


def narrate_with_claude(shot_meta: list[dict]) -> list[str]:
    """Send 3 frames per shot (start/mid/end) + duration + motion score to
    Claude Vision so the narration considers motion across the shot, not
    just a single still. Falls back to 'Shot N' on any failure.

    shot_meta: [{ index, duration, motion, frames: [path_start, path_mid, path_end] }]
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        bridge.warn("ANTHROPIC_API_KEY not set — skipping narration, using generic labels")
        return [f"Shot {s['index']+1}" for s in shot_meta]

    try:
        import anthropic  # type: ignore
    except ImportError:
        bridge.warn("anthropic python package not installed — skipping narration")
        return [f"Shot {s['index']+1}" for s in shot_meta]

    client = anthropic.Anthropic(api_key=api_key)
    out: list[str] = []
    for s in shot_meta:
        frames: list[str] = s.get("frames") or []
        usable = [p for p in frames if p and os.path.isfile(p)]
        if not usable:
            out.append(f"Shot {s['index']+1}")
            continue

        try:
            content: list[dict] = []
            labels = ["[start]", "[midt]", "[slutt]"][: len(usable)]
            for label, p in zip(labels, usable):
                with open(p, "rb") as f:
                    b64 = base64.standard_b64encode(f.read()).decode("utf-8")
                content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}})
                content.append({"type": "text", "text": label})

            duration_s = s.get("duration", 0.0)
            motion_label = describe_motion(s.get("motion"))
            length_label = describe_shot_length(duration_s)
            audio_label = s.get("audioLabel") or "ukjent lyd"
            beat_label = s.get("beatLabel") or ""

            prompt = (
                f"Du ser {len(usable)} bilder fra ETT shot i en bryllups-/eventfilm: "
                f"start, midt og slutt. Shot-varighet: {duration_s:.1f}s ({length_label}). "
                f"Bevegelse: {motion_label}. Lyd: {audio_label}"
                f"{f' · {beat_label}' if beat_label else ''}.\n\n"
                "Skriv 3-6 ord på norsk som beskriver HVA SOM SKJER i shotet — "
                "inkluder bevegelsen mellom bildene hvis relevant. Hvis det er musikk "
                "uten dialog, prøv å fange stemningen ('Slow-mo seremoni med musikk'). "
                "Hvis dialog/tale, beskriv handling ('Brudefar holder tale'). "
                "Tenk som en marker-tittel i et redigeringsprogram. Eksempler: "
                "'Brudefar gråter under tale', 'Kamera følger ringbyttingen', "
                "'Slow-mo brudemarsj med musikk', 'Brytar zoomer inn på kake'.\n\n"
                "Kun beskrivelsen, ingen anførselstegn, ingen forklaring."
            )
            content.append({"type": "text", "text": prompt})

            msg = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=80,
                messages=[{"role": "user", "content": content}],
            )
            text = ""
            for block in msg.content:
                if getattr(block, "type", None) == "text":
                    text = getattr(block, "text", "").strip()
                    break
            out.append(text or f"Shot {s['index']+1}")
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Claude narration for shot {s['index']+1} failed: {exc}")
            out.append(f"Shot {s['index']+1}")

        if (s["index"] + 1) % 5 == 0:
            bridge.progress(s["index"] + 1, len(shot_meta), f"Narrated {s['index']+1}/{len(shot_meta)}")
    return out


def run(params: dict, dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    try:
        threshold = float(params.get("sceneThreshold", 0.4))
    except (TypeError, ValueError):
        threshold = 0.4
    threshold = max(0.05, min(0.95, threshold))
    narrate = bool(params.get("narrate", False))
    timeline_name = (params.get("timelineName") or "").strip() or f"{os.path.splitext(os.path.basename(video_path))[0]} — analyzed"
    source_song_path = (params.get("sourceSongPath") or "").strip() or None
    # Offset where the source song starts in the exported video (in seconds).
    # Lets the analyzer align the source's beat-grid to the actual placement
    # in the exported timeline (song doesn't have to start at t=0).
    try:
        source_song_offset = float(params.get("sourceSongOffsetSec", 0.0))
    except (TypeError, ValueError):
        source_song_offset = 0.0

    ffmpeg, ffprobe = find_ffmpeg()
    if not ffmpeg or not ffprobe:
        bridge.error("ffmpeg/ffprobe not on PATH — install via Dependencies modal")
        sys.exit(1)

    bridge.progress(0, 100, "Probing video metadata…")
    meta = probe_video(ffprobe, video_path)
    fps = meta["frameRate"]
    duration = meta["duration"]

    bridge.progress(10, 100, "Detecting shot cuts…")
    cuts = detect_cuts(ffmpeg, video_path, threshold)
    # Always include t=0 as the first shot start
    if not cuts or cuts[0] > 0.05:
        cuts = [0.0] + cuts

    # Audio analysis — separate pass so shot-detection isn't influenced
    # by audio (music underneath shouldn't add false cuts).
    bridge.progress(20, 100, "Analyzing audio sections…")
    audio_sections = detect_audio_sections(ffmpeg, video_path, duration)
    # Beat-detection is more expensive — only run if we found enough music
    # OR if a pristine source song was provided (always use that if given).
    music_total = sum(s["end"] - s["start"] for s in audio_sections if s["type"] == "music")
    beats: list[float] = []
    beats_from_source = False
    auto_align_info: dict = {}
    if source_song_path:
        # If no manual offset was given, auto-detect where the source song
        # starts in the exported video via chroma cross-correlation. This
        # is the difference between "Sangen starter ved 0:30" og "vi gjettet
        # at den startet på t=0".
        if source_song_offset == 0.0:
            bridge.progress(20, 100, "Finner hvor source-sangen starter i videoen…")
            auto_align_info = auto_align_source_in_video(ffmpeg, video_path, source_song_path, duration)
            if auto_align_info.get("offsetSec") is not None:
                detected = float(auto_align_info["offsetSec"])
                confidence = float(auto_align_info.get("confidence") or 0)
                if confidence >= 0.05:  # any signal above noise floor
                    source_song_offset = detected
                    bridge.log(
                        f"Source-song auto-aligned: sangen starter ved {detected:.2f}s "
                        f"i video (confidence {confidence:.2f})"
                    )
                else:
                    bridge.warn(f"Auto-align confidence too low ({confidence:.2f}) — using offset=0")

        bridge.progress(25, 100, "Detecting beats on pristine source song…")
        raw_beats = detect_beats(video_path, ffmpeg, duration, source_audio_path=source_song_path)
        # Translate source-relative beat times to exported-video timeline
        beats = [b + source_song_offset for b in raw_beats if 0 <= b + source_song_offset <= duration]
        beats_from_source = True
        bridge.log(f"Source-song beats translated with offset {source_song_offset:.2f}s — "
                   f"{len(beats)} beats within video timeline")
    elif music_total > 5.0:
        bridge.progress(25, 100, "Detecting beats (librosa, mixed audio)…")
        beats = detect_beats(video_path, ffmpeg, duration)

    # Compute per-shot audio + beat context regardless of narrate flag —
    # it shows up in the result table and gets used by Claude if narrating.
    def _audio_label_for_shot(start: float, end: float) -> str:
        overlaps = [s for s in audio_sections if s["end"] > start and s["start"] < end]
        if not overlaps:
            return "stille"
        # Pick the dominant type across the shot
        type_dur: dict[str, float] = {}
        for s in overlaps:
            overlap = min(end, s["end"]) - max(start, s["start"])
            type_dur[s["type"]] = type_dur.get(s["type"], 0) + max(0, overlap)
        dom = max(type_dur.items(), key=lambda kv: kv[1])[0]
        labels = {"music": "musikk", "dialogue": "dialog/tale", "silence": "stille", "ambient": "rom-lyd", "unknown": "lyd"}
        return labels.get(dom, dom)

    shot_meta_for_narration: list[dict] = []
    bridge.progress(30, 100, "Computing per-shot context (motion + audio + beats)…")
    tmp_dir = os.path.join(os.path.dirname(video_path), ".trrpa_thumbs")
    if narrate and not dry_run:
        os.makedirs(tmp_dir, exist_ok=True)
    for i, cut in enumerate(cuts):
        next_cut = cuts[i + 1] if i + 1 < len(cuts) else duration
        shot_dur = max(0.05, next_cut - cut)
        audio_label = _audio_label_for_shot(cut, next_cut)
        beat_info = nearest_beat(beats, cut) if beats else {"hasBeats": False}
        beat_label = ""
        if beat_info.get("hasBeats") and audio_label == "musikk":
            beat_label = f"kutt {beat_info['verdict']}"
        frames: list[str] = []
        if narrate and not dry_run:
            t_start = cut + shot_dur * 0.10
            t_mid = cut + shot_dur * 0.50
            t_end = cut + shot_dur * 0.90
            for label, t in [("a", t_start), ("b", t_mid), ("c", t_end)]:
                dest = os.path.join(tmp_dir, f"shot_{i:03d}_{label}.jpg")
                if extract_frame(ffmpeg, video_path, t, dest):
                    frames.append(dest)
        motion = measure_motion(ffmpeg, video_path, cut, next_cut) if shot_dur > 0.2 else None
        shot_meta_for_narration.append({
            "index": i,
            "duration": shot_dur,
            "motion": motion,
            "frames": frames,
            "audioLabel": audio_label,
            "beatInfo": beat_info,
            "beatLabel": beat_label,
        })
        if (i + 1) % 5 == 0:
            bridge.progress(30 + int(20 * (i + 1) / len(cuts)), 100, f"Context {i+1}/{len(cuts)}")

    narrations: list[str] = []
    if narrate and not dry_run:
        bridge.progress(55, 100, "Narrating shots with Claude Vision…")
        narrations = narrate_with_claude(shot_meta_for_narration)
        while len(narrations) < len(cuts):
            narrations.append(f"Shot {len(narrations) + 1}")
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass

    meta_by_idx = {m["index"]: m for m in shot_meta_for_narration}
    plan = []
    for i, cut in enumerate(cuts):
        next_cut = cuts[i + 1] if i + 1 < len(cuts) else duration
        m = meta_by_idx.get(i, {})
        beat_info = m.get("beatInfo", {})
        plan.append({
            "index": i,
            "time": cut,
            "frame": int(cut * fps),
            "durationSeconds": max(0.0, next_cut - cut),
            "motionScore": m.get("motion"),
            "audioType": m.get("audioLabel"),
            "onBeat": bool(beat_info.get("onBeat")),
            "beatDelta": beat_info.get("deltaSeconds"),
            "name": narrations[i] if i < len(narrations) else f"Shot {i+1}",
        })

    if dry_run:
        bridge.result({
            "summary": f"Would detect {len(cuts)} cuts and place markers in '{timeline_name}'",
            "videoPath": video_path,
            "frameRate": fps,
            "durationSeconds": duration,
            "cutCount": len(cuts),
            "samplePlan": plan[:10],
        })
        return

    bridge.progress(75, 100, "Importing video + creating timeline in Resolve…")
    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)
    project = conn.project
    media_pool = project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool")
        sys.exit(1)

    # Import the exported video
    items = media_pool.ImportMedia([video_path])
    if not items:
        bridge.error(f"ImportMedia failed for {video_path}")
        sys.exit(1)

    # Create a new timeline from the imported clip
    timeline = media_pool.CreateTimelineFromClips(timeline_name, items)
    if not timeline:
        bridge.error(f"CreateTimelineFromClips failed for '{timeline_name}'")
        sys.exit(1)

    # Add markers per cut. Color encodes the audio + beat context:
    #   Blue  = cut lands on a music beat (well-timed musical edit)
    #   Yellow = cut over music but off-beat
    #   Green = cut over dialogue (story-driven)
    #   White = cut over silence/ambient (transition or B-roll handoff)
    bridge.progress(90, 100, "Placing markers…")
    markers_added = 0
    markers_failed = 0
    for entry in plan:
        audio_type = entry.get("audioType")
        if entry.get("onBeat") and audio_type == "musikk":
            color = "Blue"
        elif audio_type == "musikk":
            color = "Yellow"
        elif audio_type == "dialog/tale":
            color = "Green"
        else:
            color = "White"

        # Annotate marker name with audio + beat hint so it shows in
        # the Resolve markers list without opening the note.
        suffix = ""
        if entry.get("onBeat") and audio_type == "musikk":
            suffix = " ♪ på beat"
        elif audio_type == "musikk":
            delta = entry.get("beatDelta")
            if delta is not None:
                suffix = f" ♪ {delta * 1000:+.0f}ms"
        marker_name = f"{entry['name']}{suffix}"

        note_lines = [
            f"Varighet: {entry.get('durationSeconds', 0):.1f}s",
            f"Lyd: {audio_type or '?'}",
        ]
        if entry.get("motionScore") is not None:
            note_lines.append(f"Bevegelse: {int(entry['motionScore'] * 100)}%")
        if entry.get("beatDelta") is not None:
            note_lines.append(f"Beat-delta: {entry['beatDelta'] * 1000:+.0f}ms")

        try:
            ok = timeline.AddMarker(
                entry["frame"],
                color,
                marker_name,
                " · ".join(note_lines),
                1,
                "",
            )
            if ok:
                markers_added += 1
            else:
                markers_failed += 1
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"AddMarker @ frame {entry['frame']} failed: {exc}")
            markers_failed += 1

    bridge.progress(100, 100, "Done.")

    music_total = sum(s["end"] - s["start"] for s in audio_sections if s["type"] == "music")
    dialogue_total = sum(s["end"] - s["start"] for s in audio_sections if s["type"] == "dialogue")
    silence_total = sum(s["end"] - s["start"] for s in audio_sections if s["type"] == "silence")
    on_beat_cuts = sum(1 for e in plan if e.get("onBeat") and e.get("audioType") == "musikk")
    off_beat_cuts = sum(1 for e in plan if e.get("audioType") == "musikk" and not e.get("onBeat"))

    bridge.result({
        "projectName": project.GetName(),
        "timelineName": timeline_name,
        "frameRate": fps,
        "durationSeconds": duration,
        "cutCount": len(cuts),
        "markersAdded": markers_added,
        "markersFailed": markers_failed,
        "narrated": narrate,
        "audioBreakdown": {
            "musicSeconds": music_total,
            "dialogueSeconds": dialogue_total,
            "silenceSeconds": silence_total,
            "beatsDetected": len(beats),
            "beatsFromPristineSource": beats_from_source,
            "sourceSongOffsetSec": source_song_offset if source_song_path else None,
            "sourceSongAutoAligned": bool(auto_align_info.get("offsetSec") is not None),
            "sourceSongAlignConfidence": auto_align_info.get("confidence"),
            "onBeatCuts": on_beat_cuts,
            "offBeatCuts": off_beat_cuts,
            "musicEditPrecisionPct": round(100 * on_beat_cuts / max(1, on_beat_cuts + off_beat_cuts)),
        },
        "samplePlan": plan[:15],
    })


if __name__ == "__main__":
    bridge.main_guard(run)
