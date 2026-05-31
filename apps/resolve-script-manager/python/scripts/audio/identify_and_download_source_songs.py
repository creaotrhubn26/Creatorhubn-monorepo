"""Identify & Download Source Songs — scans an exported wedding film, detects
each music section, audio-fingerprints it via Chromaprint, looks up the song
on AcoustID, downloads the matched track from YouTube via yt-dlp.

The downloaded clean songs can then be placed on a separate audio track in
Resolve so the highlight has both the original mix (muted/visible for sync)
AND the pristine source song.

Pipeline:
  1. ffmpeg silencedetect + RMS → list of music sections in the video
  2. For each music section: extract a 30s audio fingerprint via fpcalc
  3. AcoustID API lookup → matches with title, artist, MusicBrainz IDs
  4. yt-dlp search 'title artist' → download top result as WAV
  5. Save metadata + downloaded paths to last_identified_songs.json

Input params:
  videoPath:        absolute path to the source film (required)
  acoustidApiKey:   AcoustID client key (default: '8XaBELgH' — public, for testing)

Output: list of [{ startSec, endSec, title, artist, downloadedPath, error? }]
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
SONGS_DIR = os.path.join(CACHE_DIR, "source_songs")
THUMBS_DIR = os.path.join(CACHE_DIR, "song_thumbs")
DEFAULT_ACOUSTID_KEY = "8XaBELgH"  # AcoustID public Web Plugins key; rate-limited but free


def find_tool(*names: str) -> str | None:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin", "/usr/bin"):
        for n in names:
            p = os.path.join(base, n)
            if os.path.isfile(p):
                return p
    return None


SILENCEDETECT_RE = re.compile(r"silence_(start|end): ([\d.]+)")


def detect_music_sections(ffmpeg: str, video: str, duration: float) -> list[tuple[float, float]]:
    """Reuse the audio-section logic from analyze_exported_video: find non-silent
    regions with high RMS and few internal silence gaps — those are music."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", video,
        "-af", "silencedetect=noise=-32dB:d=0.4",
        "-vn", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except Exception:  # noqa: BLE001
        return []

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

    # Non-silent regions = music candidates
    sections: list[tuple[float, float]] = []
    cursor = 0.0
    for s_start, s_end in silences:
        if s_start - cursor > 3.0:  # ignore very short non-silent gaps
            sections.append((cursor, s_start))
        cursor = s_end
    if duration - cursor > 3.0:
        sections.append((cursor, duration))

    # Filter: keep sections >= 10 sec (real music, not just SFX/clapping)
    return [(s, e) for s, e in sections if (e - s) >= 10.0]


def probe_duration(ffprobe: str, path: str) -> float:
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=20,
        )
        return float((r.stdout or "0").strip())
    except (subprocess.SubprocessError, ValueError):
        return 0.0


def extract_section_for_fingerprint(ffmpeg: str, video: str, start: float, end: float, dest: str) -> bool:
    """Extract a chunk of audio (mono, 16kHz wav) for chromaprint to fingerprint.
    Only takes 30 seconds in the middle of the section (most musical content)."""
    section_dur = end - start
    sample_dur = min(30.0, section_dur)
    sample_start = start + max(0, (section_dur - sample_dur) / 2)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{sample_start:.3f}",
        "-t", f"{sample_dur:.3f}",
        "-i", video,
        "-vn", "-ac", "1", "-ar", "16000",
        "-f", "wav", dest,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=60)
        return r.returncode == 0 and os.path.isfile(dest)
    except Exception:  # noqa: BLE001
        return False


def fingerprint_via_fpcalc(fpcalc: str, audio_path: str) -> tuple[str, int] | None:
    """Returns (fingerprint, duration_seconds) or None on failure."""
    try:
        r = subprocess.run(
            [fpcalc, "-json", audio_path],
            capture_output=True, text=True, timeout=60,
        )
        if r.returncode != 0:
            return None
        data = json.loads(r.stdout)
        return data.get("fingerprint"), int(data.get("duration") or 0)
    except (subprocess.SubprocessError, json.JSONDecodeError):
        return None


def acoustid_lookup(api_key: str, fingerprint: str, duration: int) -> list[dict]:
    """Query AcoustID free API → list of matches with title + artist names."""
    url = "https://api.acoustid.org/v2/lookup"
    params = {
        "client": api_key,
        "duration": str(duration),
        "fingerprint": fingerprint,
        "meta": "recordings,releasegroups",
    }
    full_url = url + "?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(full_url, headers={"User-Agent": "RoleRoomPostAgent/0.1"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        bridge.warn(f"AcoustID HTTP {exc.code}: {exc.reason}")
        return []
    except urllib.error.URLError as exc:
        bridge.warn(f"AcoustID network: {exc.reason}")
        return []
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"AcoustID error: {exc.__class__.__name__}: {exc}")
        return []

    if data.get("status") != "ok":
        bridge.warn(f"AcoustID returned status={data.get('status')}: {data.get('error')}")
        return []

    matches = []
    for result in data.get("results", [])[:3]:
        score = result.get("score", 0)
        for rec in result.get("recordings", [])[:2]:
            title = rec.get("title", "")
            artists = [a.get("name", "") for a in rec.get("artists", []) or []]
            artist = ", ".join(filter(None, artists))
            # Hent release-group ID for cover-art-archive
            rg_id = None
            for rg in rec.get("releasegroups", []) or []:
                if rg.get("id"):
                    rg_id = rg["id"]
                    break
            if title:
                matches.append({
                    "score": score,
                    "title": title,
                    "artist": artist,
                    "mbid": rec.get("id"),
                    "releaseGroupId": rg_id,
                })
    return matches


def shazam_lookup(audio_path: str) -> list[dict]:
    """Fallback: bruk Shazam (shazamio) når AcoustID feiler.
    Returnerer matches i samme format som acoustid_lookup."""
    try:
        import asyncio
        from shazamio import Shazam  # type: ignore
    except ImportError:
        bridge.warn("shazamio ikke installert — kan ikke gjøre fallback")
        return []

    async def _identify():
        shazam = Shazam()
        try:
            return await shazam.recognize(audio_path)
        except AttributeError:
            return await shazam.recognize_song(audio_path)

    try:
        result = asyncio.run(_identify())
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Shazam fallback error: {exc.__class__.__name__}: {exc}")
        return []

    track = (result or {}).get("track") or {}
    title = track.get("title")
    artist = track.get("subtitle")
    if not title:
        return []
    return [{
        "score": 0.85,  # Shazam-match ≈ 85% confidence
        "title": title,
        "artist": artist or "",
        "mbid": None,
        "releaseGroupId": None,
    }]


def fetch_cover_art(release_group_id: str, dest_dir: str, key: str) -> str | None:
    """Cover Art Archive → 250px front cover. None hvis ingen finnes."""
    if not release_group_id: return None
    safe = re.sub(r"[^\w-]", "_", key)[:60]
    out_path = os.path.join(dest_dir, f"cover_{safe}.jpg")
    if os.path.isfile(out_path): return out_path
    url = f"https://coverartarchive.org/release-group/{release_group_id}/front-250"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RoleRoomPostAgent/0.1"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if len(data) < 100: return None
            with open(out_path, "wb") as f: f.write(data)
            return out_path
    except Exception:
        return None


def extract_video_frame(ffmpeg: str, video: str, time_sec: float,
                         dest_dir: str, key: str) -> str | None:
    """Trekk ut ett bilde fra videoen ved time_sec. Returnerer path eller None."""
    safe = re.sub(r"[^\w-]", "_", key)[:60]
    out_path = os.path.join(dest_dir, f"frame_{safe}.jpg")
    if os.path.isfile(out_path): return out_path
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{time_sec:.2f}", "-i", video,
        "-frames:v", "1", "-vf", "scale=200:-1",
        "-q:v", "3", out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=20)
        if r.returncode == 0 and os.path.isfile(out_path) and os.path.getsize(out_path) > 500:
            return out_path
    except Exception:
        pass
    return None


def yt_dlp_search_download(yt_dlp: str, ffmpeg: str, query: str, dest_dir: str) -> str | None:
    """Search YouTube for 'query', download top result as WAV. Returns path or None."""
    os.makedirs(dest_dir, exist_ok=True)
    safe_query = re.sub(r"[^\w\s-]", "", query)[:80].strip()
    out_template = os.path.join(dest_dir, f"{safe_query}.%(ext)s")
    final_path = os.path.join(dest_dir, f"{safe_query}.wav")

    if os.path.isfile(final_path):
        bridge.log(f"Already cached: {final_path}")
        return final_path

    cmd = [
        yt_dlp,
        "--no-playlist", "--quiet", "--no-warnings",
        "-x", "--audio-format", "wav", "--audio-quality", "0",
        "--ffmpeg-location", ffmpeg,
        "-o", out_template,
        f"ytsearch1:{query}",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if proc.returncode != 0:
            bridge.warn(f"yt-dlp failed for '{query}': {(proc.stderr or '')[:200]}")
            return None
    except subprocess.TimeoutExpired:
        bridge.warn(f"yt-dlp timed out for '{query}'")
        return None

    if os.path.isfile(final_path):
        return final_path
    # yt-dlp may save with slightly different casing
    for cand in os.listdir(dest_dir):
        if cand.lower().startswith(safe_query.lower()) and cand.lower().endswith(".wav"):
            return os.path.join(dest_dir, cand)
    return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    api_key = (params.get("acoustidApiKey") or "").strip() or DEFAULT_ACOUSTID_KEY
    # 2-phase mode: identifyOnly skipper yt-dlp, selectedKeys begrenser download
    identify_only = bool(params.get("identifyOnly", False))
    selected_keys_raw = params.get("selectedKeys") or []
    selected_keys: set[str] = (
        {str(k).strip() for k in selected_keys_raw if isinstance(k, str)}
        if isinstance(selected_keys_raw, list) else set()
    )

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    fpcalc = find_tool("fpcalc")
    yt_dlp = find_tool("yt-dlp") if not identify_only else None
    missing = []
    if not ffmpeg: missing.append("ffmpeg")
    if not ffprobe: missing.append("ffprobe")
    if not fpcalc: missing.append("chromaprint (fpcalc)")
    if not identify_only and not yt_dlp: missing.append("yt-dlp")
    if missing:
        bridge.error(f"Mangler verktøy: {', '.join(missing)}. Install via Dependencies modal.")
        sys.exit(1)

    bridge.progress(0, 100, "Probing video metadata…")
    duration = probe_duration(ffprobe, video_path)
    bridge.log(f"Source: {duration:.0f}s")

    bridge.progress(10, 100, "Detecting music sections…")
    sections = detect_music_sections(ffmpeg, video_path, duration)
    bridge.log(f"Detected {len(sections)} music section(s) >= 10s")

    if not sections:
        bridge.error("No music sections detected — film may be dialogue-only or too quiet")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldIdentify": len(sections),
            "sections": [{"startSec": round(s, 1), "endSec": round(e, 1)} for s, e in sections],
        })
        return

    # Fingerprint + lookup each section
    results: list[dict] = []
    tmp_dir = os.path.join(CACHE_DIR, "tmp_fp")
    os.makedirs(tmp_dir, exist_ok=True)
    os.makedirs(SONGS_DIR, exist_ok=True)
    os.makedirs(THUMBS_DIR, exist_ok=True)
    seen_titles: set[str] = set()

    for i, (start, end) in enumerate(sections):
        bridge.progress(
            10 + int(70 * (i + 1) / len(sections)),
            100,
            f"Identifying section {i + 1}/{len(sections)} ({start:.0f}s – {end:.0f}s)",
        )
        fp_audio = os.path.join(tmp_dir, f"section_{i:03d}.wav")
        if not extract_section_for_fingerprint(ffmpeg, video_path, start, end, fp_audio):
            results.append({"startSec": start, "endSec": end, "error": "audio_extract_failed"})
            continue

        fp = fingerprint_via_fpcalc(fpcalc, fp_audio)
        if not fp:
            results.append({"startSec": start, "endSec": end, "error": "fingerprint_failed"})
            continue
        fingerprint, fp_dur = fp

        matches = acoustid_lookup(api_key, fingerprint, fp_dur)
        if not matches:
            # Fallback: prøv Shazam på samme audio-snippet
            bridge.log(f"  AcoustID ga ingen match — prøver Shazam-fallback …")
            matches = shazam_lookup(fp_audio)
            if not matches:
                results.append({"startSec": start, "endSec": end, "error": "no_match"})
                continue
            bridge.log(f"  Shazam-fallback fungerte!")

        top = matches[0]
        key = f"{top['title']}|{top['artist']}"
        if key in seen_titles:
            # Same song probably repeats across sections — reuse the download
            existing = next((r for r in results if r.get("title") == top["title"]
                             and r.get("artist") == top["artist"]
                             and r.get("downloadedPath")), None)
            results.append({
                "startSec": start, "endSec": end,
                "title": top["title"], "artist": top["artist"],
                "downloadedPath": existing["downloadedPath"] if existing else None,
                "score": top["score"],
                "reusedDownload": bool(existing),
            })
            continue
        seen_titles.add(key)

        bridge.log(f"  Match: '{top['title']}' by {top['artist']} (score {top['score']:.2f})")
        query = f"{top['title']} {top['artist']}".strip()
        # Bestem om vi skal laste ned denne sangen
        should_download = (not identify_only) and (
            not selected_keys or key in selected_keys
        )
        downloaded = (
            yt_dlp_search_download(yt_dlp, ffmpeg, query, SONGS_DIR)
            if should_download and yt_dlp else None
        )
        # Thumbnails: album-art + scene-frame (kun under identify-fasen)
        cover_path = None
        frame_path = None
        if identify_only:
            cover_path = fetch_cover_art(top.get("releaseGroupId"), THUMBS_DIR, key)
            frame_path = extract_video_frame(ffmpeg, video_path, start, THUMBS_DIR, key)
        results.append({
            "startSec": start, "endSec": end,
            "title": top["title"], "artist": top["artist"],
            "score": top["score"],
            "query": query,
            "downloadedPath": downloaded,
            "downloadError": (
                None if downloaded or not should_download
                else "yt_dlp_search_failed"
            ),
            "key": key,
            "coverArtPath": cover_path,
            "frameThumbPath": frame_path,
        })

    # Cleanup temp fingerprint audio
    try:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except OSError:
        pass

    bridge.progress(100, 100, "Ferdig.")

    cache_path = os.path.join(CACHE_DIR, "last_identified_songs.json")
    with open(cache_path, "w") as f:
        json.dump({
            "savedAt": time.time(),
            "sourceVideo": video_path,
            "sections": results,
        }, f, indent=2)
    bridge.log(f"Cached → {cache_path}")

    identified = [r for r in results if r.get("title")]
    downloaded = [r for r in results if r.get("downloadedPath")]
    bridge.result({
        "sourceVideo": video_path,
        "sectionsFound": len(sections),
        "songsIdentified": len(identified),
        "songsDownloaded": len(downloaded),
        "cachePath": cache_path,
        "sections": results,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
