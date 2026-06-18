"""Fetch Source Song — downloads a song from YouTube (or any yt-dlp-supported
URL) for use as the pristine audio reference when analyzing a wedding film.

Why this matters:
  Beat-detection on the audio mixed INTO the exported video gets confused
  by overlapping dialogue, sound effects, applause, etc. The cuts in the
  finished video are tightly tied to the ORIGINAL song's beat-grid — not
  the muddied final mix. By downloading the source song separately, the
  analyzer can run librosa beat-track on a clean signal and produce a
  precise reference grid to compare cut times against.

Scope (intentional limit):
  - Only enabled for wedding-type projects (params.projectType == 'bryllup')
    because that's the private-use case the user explicitly OKed.
  - Output filename includes project id so it lands in the right staging
    folder and doesn't collide between productions.

Input params:
  youtubeUrl:   full YouTube URL or video id
  projectId:    project this song belongs to (for staging folder)
  projectType:  must be 'bryllup' or 'wedding' — guard rail

Output: { localAudioPath, durationSeconds, beats?: number[], tempo?: float }
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


WEDDING_TYPES = {"bryllup", "wedding", "wedding_film", "norwedfilm"}
STAGING_BASE = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging"
)


def find_yt_dlp() -> str | None:
    for cand in [
        os.environ.get("RESOLVE_SCRIPT_MANAGER_YT_DLP"),
        shutil.which("yt-dlp"),
        "/opt/homebrew/bin/yt-dlp",
        "/usr/local/bin/yt-dlp",
    ]:
        if cand and os.path.isfile(cand):
            return cand
    return None


def find_ffmpeg() -> str | None:
    for cand in [
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ]:
        if cand and os.path.isfile(cand):
            return cand
    return None


def detect_beats_librosa(audio_path: str) -> dict:
    """Optional librosa-based beat detection. Returns {} if librosa missing.

    Output keys: beats[], tempo (BPM), duration (sec), key (str), keyConfidence.
    Cached per (audio_path, mtime, size) via bridge.cache_path_for so re-runs
    are instant. (#60 — key + tempo as metadata; #64 — librosa cache)
    """
    cache_path = bridge.cache_path_for(
        "librosa-beats-key", audio_path, extra_key="sr=22050,v2",
    )
    if cache_path and os.path.isfile(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if isinstance(cached, dict) and cached.get("beats"):
                bridge.log(f"Librosa cache hit ({cache_path})")
                return cached
        except (OSError, json.JSONDecodeError):
            pass  # stale or corrupt → recompute

    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else "python3"
    # Krumhansl-Schmuckler-style key estimation via chroma-mean vs major/minor
    # profile correlation. Cheap, well-documented, and good enough for the
    # use-case (metadata tag, not transposition).
    snippet = (
        "import sys, json\n"
        "try:\n"
        "  import librosa, numpy as np\n"
        "except ImportError:\n"
        "  print(json.dumps({'error': 'librosa_not_installed'})); sys.exit(0)\n"
        "y, sr = librosa.load(sys.argv[1], sr=22050)\n"
        "tempo, beats = librosa.beat.beat_track(y=y, sr=sr)\n"
        "times = librosa.frames_to_time(beats, sr=sr).tolist()\n"
        "duration = float(librosa.get_duration(y=y, sr=sr))\n"
        # Key detection
        "chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)\n"
        "major = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])\n"
        "minor = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])\n"
        "key_names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']\n"
        "best = ('C major', -1.0)\n"
        "for shift in range(12):\n"
        "  c = np.roll(chroma, -shift)\n"
        "  maj_corr = float(np.corrcoef(c, major)[0,1])\n"
        "  min_corr = float(np.corrcoef(c, minor)[0,1])\n"
        "  if maj_corr > best[1]:\n"
        "    best = (f'{key_names[shift]} major', maj_corr)\n"
        "  if min_corr > best[1]:\n"
        "    best = (f'{key_names[shift]} minor', min_corr)\n"
        "print(json.dumps({\n"
        "  'beats': times,\n"
        "  'tempo': float(tempo[0] if hasattr(tempo, '__len__') else tempo),\n"
        "  'duration': duration,\n"
        "  'key': best[0],\n"
        "  'keyConfidence': round(float(best[1]), 3),\n"
        "}))\n"
    )
    try:
        r = subprocess.run(
            [python, "-c", snippet, audio_path],
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
                        bridge.warn(f"librosa not available: {data['error']}")
                        return {}
                    if cache_path:
                        try:
                            with open(cache_path, "w", encoding="utf-8") as f:
                                json.dump(data, f)
                        except OSError:
                            pass
                    return data
            except json.JSONDecodeError:
                continue
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"librosa subprocess failed: {exc}")
    return {}


def safe_video_id(url: str) -> str:
    """Extract a stable filename component from any YouTube URL."""
    m = re.search(r"(?:v=|youtu\.be/|/shorts/)([\w-]{6,})", url)
    if m:
        return m.group(1)
    return re.sub(r"[^\w.-]+", "_", url)[:60]


def run(params: dict, dry_run: bool) -> None:
    url = (params.get("youtubeUrl") or "").strip()
    project_id = (params.get("projectId") or "").strip() or "_unscoped"
    project_type = (params.get("projectType") or "").strip().lower()

    if not url:
        bridge.error("youtubeUrl is required")
        sys.exit(1)
    if project_type and project_type not in WEDDING_TYPES:
        bridge.error(
            f"projectType '{project_type}' is not eligible — YouTube-nedlasting "
            "er kun aktivert for bryllups-prosjekter (privat-bruk)."
        )
        sys.exit(1)

    yt_dlp = find_yt_dlp()
    ffmpeg = find_ffmpeg()
    if not yt_dlp:
        bridge.error(
            "yt-dlp er ikke installert. Installer via: brew install yt-dlp "
            "(eller pip3 install yt-dlp)"
        )
        sys.exit(1)
    if not ffmpeg:
        bridge.error("ffmpeg er ikke installert — kreves for audio-ekstraksjon")
        sys.exit(1)

    video_id = safe_video_id(url)
    dest_dir = os.path.join(STAGING_BASE, project_id, "source_songs")
    os.makedirs(dest_dir, exist_ok=True)
    out_template = os.path.join(dest_dir, f"{video_id}.%(ext)s")
    final_path = os.path.join(dest_dir, f"{video_id}.wav")

    if dry_run:
        bridge.result({
            "summary": f"Would download audio from {url} to {final_path}",
            "videoId": video_id,
            "destDir": dest_dir,
        })
        return

    if os.path.isfile(final_path):
        bridge.log(f"Already downloaded — reusing {final_path}")
    else:
        bridge.progress(0, 100, "Laster ned audio via yt-dlp…")
        cmd = [
            yt_dlp,
            "--no-playlist",
            "--quiet",
            "--no-warnings",
            "-x",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "--ffmpeg-location", ffmpeg,
            "-o", out_template,
            url,
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        except subprocess.TimeoutExpired:
            bridge.error("yt-dlp tok > 10 min — avbrutt. Prøv en kortere video.")
            sys.exit(1)
        if proc.returncode != 0:
            bridge.error(
                f"yt-dlp feilet (exit {proc.returncode}). "
                f"Stderr: {(proc.stderr or '')[:300]}"
            )
            sys.exit(1)
        if not os.path.isfile(final_path):
            # yt-dlp sometimes outputs with slightly different ext casing
            for cand in os.listdir(dest_dir):
                if cand.startswith(video_id) and cand.lower().endswith(".wav"):
                    src = os.path.join(dest_dir, cand)
                    if src != final_path:
                        shutil.move(src, final_path)
                    break
        if not os.path.isfile(final_path):
            bridge.error(f"yt-dlp ran but no WAV at {final_path}")
            sys.exit(1)

    bridge.progress(60, 100, "Detekterer beats med librosa…")
    beat_data = detect_beats_librosa(final_path)
    duration = beat_data.get("duration")
    if duration is None:
        # Fallback: ffprobe
        try:
            ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
            r = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=nokey=1:noprint_wrappers=1", final_path],
                capture_output=True, text=True, timeout=15,
            )
            duration = float((r.stdout or "0").strip())
        except Exception:  # noqa: BLE001
            duration = 0.0

    bridge.progress(100, 100, "Ferdig.")

    bridge.result({
        "localAudioPath": final_path,
        "durationSeconds": duration,
        "tempo": beat_data.get("tempo"),
        "key": beat_data.get("key"),
        "keyConfidence": beat_data.get("keyConfidence"),
        "beatsDetected": len(beat_data.get("beats", [])),
        "beats": beat_data.get("beats", []),
        "videoId": video_id,
        "url": url,
        "note": (
            "Lastet ned for privat bruk i bryllups-prosjekt. Sjekk lokale "
            "rettighets-regler før kommersiell distribusjon."
        ),
    })


if __name__ == "__main__":
    bridge.main_guard(run)
