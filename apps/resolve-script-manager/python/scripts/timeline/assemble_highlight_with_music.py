"""Assemble Highlight With Music — ende-til-ende preview-builder som
syr sammen scan_and_recommend_music + picks + cross-correlation + crossfade
til en final MP4 uten å gå via Resolve.

Gjør jobben en redaktør gjorde manuelt i 6 iterasjoner (v1→v6):
  1. Last picks fra extract_highlight_from_film cache
  2. Last advisor-anbefalinger (scan_and_recommend_music output)
  3. Hvis sang ikke nedlastet: yt-dlp den fra YouTube til source_songs/
  4. librosa beat-track + chorus per nedlastet sang (cache i /tmp)
  5. Chroma-CENS cross-correlation source-video ↔ YT-versjon → sync-offset
  6. Smart-reorder picks (ascending score, climax sist)
  7. Beat-snap pick-durations til hele beat-counts av sangens BPM
  8. Build ffmpeg filter_complex med trim + scale+pad + ducked-original + YT-song
     + amix + xfade-kjede + acrossfade
  9. Render H.264 MP4 til Desktop (eller spesifisert path)

Bruker:
  python assemble_highlight_with_music.py --params='{
    "videoPath": "/path/to/source.mp4",
    "musicStrategy": "main+climax" | "single" | "auto",
    "outputPath": "/path/to/output.mp4",       # optional
    "crossfadeSec": 0.30,                       # optional
    "climaxCrossfadeSec": 1.50                  # optional
  }'

Forutsetninger:
  - extract_highlight_from_film er kjørt → last_highlight_picks.json finnes
  - scan_and_recommend_music er kjørt → music_advisor.json finnes
  - librosa + scipy + shazamio installert i venv
  - yt-dlp + ffmpeg/ffprobe i PATH
"""

from __future__ import annotations

import bisect
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
PICKS_PATH = os.path.join(CACHE_DIR, "last_highlight_picks.json")
ADVISOR_PATH = os.path.join(CACHE_DIR, "music_advisor.json")
SONGS_DIR = os.path.join(CACHE_DIR, "source_songs")


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


def safe_query(s: str) -> str:
    return re.sub(r"[^\w\s-]", "", s)[:80].strip()


def yt_download(yt_dlp: str, ffmpeg: str, title: str, artist: str) -> str | None:
    os.makedirs(SONGS_DIR, exist_ok=True)
    query = f"{title} {artist}".strip()
    safe = safe_query(query)
    final = os.path.join(SONGS_DIR, f"{safe}.wav")
    if os.path.isfile(final):
        return final
    bridge.log(f"  Downloading '{query}'…")
    cmd = [yt_dlp, "--no-playlist", "--quiet", "--no-warnings",
           "-x", "--audio-format", "wav", "--audio-quality", "0",
           "--ffmpeg-location", ffmpeg,
           "-o", os.path.join(SONGS_DIR, f"{safe}.%(ext)s"),
           f"ytsearch1:{query}"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            bridge.warn(f"yt-dlp failed for '{query}': {(r.stderr or '')[:200]}")
            return None
    except subprocess.TimeoutExpired:
        bridge.warn(f"yt-dlp timed out for '{query}'")
        return None
    if os.path.isfile(final):
        return final
    # yt-dlp sometimes saves with slight casing variations
    for cand in os.listdir(SONGS_DIR):
        if cand.lower().startswith(safe.lower()) and cand.lower().endswith(".wav"):
            return os.path.join(SONGS_DIR, cand)
    return None


def analyze_song(audio_path: str) -> dict:
    """Compute tempo, beat-times, chorus-position via librosa. Cached in /tmp."""
    import librosa  # type: ignore
    import numpy as np
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = len(y) / sr
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    tempo_val = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    # Chorus = highest-RMS 8-sec window in 20%-65% body of song (beat-aligned)
    hop = sr // 4
    rms = librosa.feature.rms(y=y, frame_length=sr, hop_length=hop)[0]
    rms_dt = hop / sr
    win = int(8.0 / rms_dt)
    if win > 1:
        kernel = np.ones(win) / win
        rms_smooth = np.convolve(rms, kernel, mode="same")
    else:
        rms_smooth = rms
    start_idx = int(0.20 * duration / rms_dt)
    end_idx = int(0.65 * duration / rms_dt)
    if end_idx <= start_idx:
        end_idx = start_idx + 10
    best_idx = start_idx + int(np.argmax(rms_smooth[start_idx:end_idx]))
    chorus = best_idx * rms_dt
    next_beat = beats[beats >= chorus]
    chorus_aligned = float(next_beat[0]) if len(next_beat) > 0 else chorus
    return {
        "tempo": tempo_val,
        "beat_interval": 60.0 / max(tempo_val, 1.0),
        "chorus_start": chorus_aligned,
        "beat_times": beats.tolist(),
        "duration": duration,
    }


def cross_correlate_sync(ffmpeg: str, source_video: str, yt_path: str,
                         source_anchor: float, window: float = 40.0) -> dict:
    """Chroma-CENS-based source ↔ YT alignment.

    Returns dict with sync_offset and confidence. sync_offset such that:
        yt_time = source_time + sync_offset
    """
    import librosa  # type: ignore
    import numpy as np
    from scipy.signal import correlate  # type: ignore

    sr = 22050
    hop = 1024
    fd, tmp = tempfile.mkstemp(suffix=".wav"); os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{source_anchor - window/2:.3f}", "-t", f"{window:.3f}",
             "-i", source_video, "-vn", "-ac", "1", "-ar", str(sr), tmp],
            check=True, timeout=60,
        )
        src_y, _ = librosa.load(tmp, sr=sr, mono=True)
    finally:
        try: os.unlink(tmp)
        except OSError: pass

    yt_y, _ = librosa.load(yt_path, sr=sr, mono=True)
    src_c = librosa.feature.chroma_cens(y=src_y, sr=sr, hop_length=hop)
    yt_c = librosa.feature.chroma_cens(y=yt_y, sr=sr, hop_length=hop)
    src_c = src_c / (np.linalg.norm(src_c, axis=0, keepdims=True) + 1e-9)
    yt_c = yt_c / (np.linalg.norm(yt_c, axis=0, keepdims=True) + 1e-9)
    n_src = src_c.shape[1]
    n_yt = yt_c.shape[1]
    if n_yt < n_src:
        return {"sync_offset": 0.0, "confidence": 0.0}
    scores = np.zeros(n_yt - n_src + 1)
    for k in range(12):
        scores += correlate(yt_c[k], src_c[k], mode="valid")
    best_i = int(np.argmax(scores))
    yt_offset = best_i * hop / sr
    src_start = source_anchor - window / 2
    return {
        "sync_offset": yt_offset - src_start,
        "confidence": float(scores[best_i] / n_src),
        "yt_offset_at_anchor": yt_offset,
        "source_anchor": source_anchor,
    }


def build_filter_complex(specs: list[dict], xfade_normal: float,
                          xfade_climax: float,
                          aspect: str = "16:9") -> str:
    # Aspect → output dimensions + scale-filter
    if aspect == "9:16":
        w, h = 1080, 1920
        scale_filter = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
    elif aspect == "1:1":
        w, h = 1080, 1080
        scale_filter = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
    else:  # 16:9 default — letterbox if source is different aspect
        w, h = 1920, 1080
        scale_filter = (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"
        )
    parts = []
    for i, s in enumerate(specs):
        vs, ve = s["video_start"], s["video_end"]
        ss, se = s["yt_start"], s["yt_end"]
        dur = s["dur"]
        fade = min(0.20, dur * 0.2)
        parts.append(
            f"[0:v]trim=start={vs:.3f}:end={ve:.3f},setpts=PTS-STARTPTS,"
            f"{scale_filter},format=yuv420p,fps=25[v{i}]"
        )
        parts.append(
            f"[0:a]atrim=start={vs:.3f}:end={ve:.3f},asetpts=PTS-STARTPTS,"
            f"aresample=48000,volume=0.25[aOrig{i}]"
        )
        parts.append(
            f"[{s['song_idx']}:a]atrim=start={ss:.3f}:end={se:.3f},"
            f"asetpts=PTS-STARTPTS,aresample=48000,volume=0.75,"
            f"afade=t=in:d={fade:.2f},afade=t=out:st={dur-fade:.3f}:d={fade:.2f}[aMus{i}]"
        )
        parts.append(
            f"[aOrig{i}][aMus{i}]amix=inputs=2:duration=shortest:dropout_transition=0[a{i}]"
        )
    durs = [s["dur"] for s in specs]
    cum = durs[0]
    prev_v, prev_a = "[v0]", "[a0]"
    for i in range(1, len(specs)):
        xfade = xfade_climax if specs[i].get("is_climax") else xfade_normal
        safe = min(xfade, durs[i-1] * 0.8, durs[i] * 0.8)
        out_v, out_a = f"[vx{i}]", f"[ax{i}]"
        curve = "exp" if specs[i].get("is_climax") else "tri"
        parts.append(
            f"{prev_v}[v{i}]xfade=transition=fade:duration={safe:.2f}:"
            f"offset={cum-safe:.3f}{out_v}"
        )
        parts.append(
            f"{prev_a}[a{i}]acrossfade=d={safe:.2f}:c1={curve}:c2={curve}{out_a}"
        )
        cum += durs[i] - safe
        prev_v, prev_a = out_v, out_a
    parts.append(f"{prev_v}null[outv]")
    parts.append(f"{prev_a}anull[outa]")
    return ";".join(parts), cum


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    output_path = (params.get("outputPath") or "").strip()
    base = os.path.splitext(os.path.basename(video_path))[0]
    default_filename = f"{base}_highlight.mp4"
    if not output_path:
        output_path = os.path.expanduser(f"~/Desktop/{default_filename}")
    else:
        output_path = os.path.expanduser(output_path)
        # If user passed a directory, append our default filename
        if os.path.isdir(output_path) or output_path.endswith(("/", os.sep)):
            output_path = os.path.join(output_path.rstrip(os.sep), default_filename)
        elif not os.path.splitext(output_path)[1]:
            # No extension — assume it's a directory-like path
            output_path = os.path.join(output_path, default_filename)
        elif not output_path.lower().endswith(".mp4"):
            # Has wrong extension — replace with .mp4
            output_path = os.path.splitext(output_path)[0] + ".mp4"
    bridge.log(f"Output: {output_path}")

    strategy = (params.get("musicStrategy") or "main+climax").lower()
    xfade_normal = float(params.get("crossfadeSec") or 0.30)
    xfade_climax = float(params.get("climaxCrossfadeSec") or 1.50)

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    yt_dlp = find_tool("yt-dlp")
    missing = [n for n, v in [("ffmpeg", ffmpeg), ("ffprobe", ffprobe),
                              ("yt-dlp", yt_dlp)] if not v]
    if missing:
        bridge.error(f"Missing tools: {', '.join(missing)}")
        sys.exit(1)

    if not os.path.isfile(PICKS_PATH):
        bridge.error(f"No picks cached at {PICKS_PATH}. "
                     "Run extract_highlight_from_film first.")
        sys.exit(1)
    if not os.path.isfile(ADVISOR_PATH):
        bridge.error(f"No advisor cached at {ADVISOR_PATH}. "
                     "Run scan_and_recommend_music first.")
        sys.exit(1)

    with open(PICKS_PATH) as f: pick_data = json.load(f)
    with open(ADVISOR_PATH) as f: advisor = json.load(f)

    picks = pick_data["picks"]

    # Apply pickOverrides from frontend (Trim-toolbar in CreativeEditorView).
    # Format: { "<pickIndex>": { "startSec": float, "endSec": float } }
    overrides_raw = params.get("pickOverrides") or {}
    overrides: dict[int, dict] = {}
    if isinstance(overrides_raw, dict):
        for k, v in overrides_raw.items():
            try: overrides[int(k)] = v if isinstance(v, dict) else {}
            except (TypeError, ValueError): continue
    if overrides:
        n_applied = 0
        for p in picks:
            o = overrides.get(p.get("index"))
            if not o: continue
            if "startSec" in o: p["startSec"] = float(o["startSec"])
            if "endSec"   in o: p["endSec"]   = float(o["endSec"])
            p["durationSec"] = max(0.1, p["endSec"] - p["startSec"])
            n_applied += 1
        bridge.log(f"Applied {n_applied} pick-overrides from Trim-toolbar")

    # pickOrder from Generate Alternate Edit — if supplied, reorder picks
    pick_order_raw = params.get("pickOrder")
    if isinstance(pick_order_raw, list) and pick_order_raw:
        order_map = {idx: i for i, idx in enumerate(pick_order_raw)}
        picks = [p for p in picks if p.get("index") in order_map]
        picks.sort(key=lambda p: order_map[p["index"]])
        bridge.log(f"Reordered picks per pickOrder: {len(picks)} picks")

    # excludedChapters from CreativeEditorView segment-checkboxes
    excluded_raw = params.get("excludedChapters") or []
    if isinstance(excluded_raw, list) and excluded_raw:
        ex = {str(c).lower() for c in excluded_raw}
        before = len(picks)
        picks = [p for p in picks if (p.get("chapter") or "details").lower() not in ex]
        bridge.log(f"Filtered out {before - len(picks)} picks from excluded chapters: {sorted(ex)}")

    songs = advisor.get("uniqueSongs", [])
    if not songs:
        bridge.error("Advisor has no songs to recommend")
        sys.exit(1)

    # Calculate total highlight duration to determine recommendation
    total_pick_dur = sum(p.get("durationSec") or (p["endSec"] - p["startSec"]) for p in picks)
    bridge.log(f"{len(picks)} picks totalling {total_pick_dur:.1f}s")

    # User-override hooks from frontend music-dropdown
    def find_song(title: str | None) -> dict | None:
        if not title: return None
        t = title.lower().strip()
        for s in songs:
            if (s.get("title") or "").lower().strip() == t:
                return s
        return None

    user_main = find_song(params.get("mainSongTitle"))
    user_climax = find_song(params.get("climaxSongTitle"))

    if strategy == "single":
        main_song = user_main or songs[0]
        climax_song = None
    elif strategy in ("main+climax", "auto"):
        main_song = user_main or songs[0]
        if user_climax:
            climax_song = user_climax
        else:
            # Climax should provide UPWARD energy ramp — prefer a higher-BPM song
            # than the main one. If none are faster, fall back to most-different.
            main_bpm = main_song.get("bpm") or 100
            candidates = [s for s in songs if s.get("bpm") and s != main_song]
            faster = [s for s in candidates if s["bpm"] > main_bpm]
            if faster:
                target = main_bpm * 1.5
                climax_song = min(faster, key=lambda s: abs(s["bpm"] - target))
            elif candidates:
                climax_song = max(candidates, key=lambda s: abs(s["bpm"] - main_bpm))
            else:
                climax_song = None
    else:
        main_song = user_main or songs[0]
        climax_song = None
    bridge.log(f"Main song: '{main_song['title']}' by {main_song['artist']} "
               f"({main_song.get('bpm','?')} BPM, {main_song['percentOfMusic']:.0f}% of source)")
    if climax_song:
        bridge.log(f"Climax: '{climax_song['title']}' by {climax_song['artist']} "
                   f"({climax_song.get('bpm','?')} BPM, energy-contrast)")

    bridge.progress(15, 100, "Downloading songs from YouTube…")
    main_path = yt_download(yt_dlp, ffmpeg, main_song["title"], main_song["artist"])
    if not main_path:
        bridge.error("Failed to download main song")
        sys.exit(1)
    climax_path = None
    if climax_song:
        climax_path = yt_download(yt_dlp, ffmpeg, climax_song["title"], climax_song["artist"])

    bridge.progress(40, 100, "Analyzing tempo + beats + chorus…")
    main_info = analyze_song(main_path)
    bridge.log(f"  Main: {main_info['tempo']:.1f} BPM, "
               f"{len(main_info['beat_times'])} beats, chorus@{main_info['chorus_start']:.1f}s")
    climax_info = None
    if climax_path:
        climax_info = analyze_song(climax_path)
        bridge.log(f"  Climax: {climax_info['tempo']:.1f} BPM, "
                   f"{len(climax_info['beat_times'])} beats")

    bridge.progress(55, 100, "Cross-correlating audio sync…")
    # Anchor main song to where it dominantly plays in source. Use the
    # mid-point of its largest section.
    main_sections = sorted(main_song["sections"], key=lambda s: -(s["endSec"] - s["startSec"]))
    main_anchor = (main_sections[0]["startSec"] + main_sections[0]["endSec"]) / 2
    main_sync = cross_correlate_sync(ffmpeg, video_path, main_path, main_anchor)
    bridge.log(f"  Main sync: yt = source + {main_sync['sync_offset']:.1f} "
               f"(confidence {main_sync['confidence']:.2f})")

    climax_sync = None
    if climax_song and climax_path:
        cmx_sections = sorted(climax_song["sections"], key=lambda s: -(s["endSec"] - s["startSec"]))
        cmx_anchor = (cmx_sections[0]["startSec"] + cmx_sections[0]["endSec"]) / 2
        climax_sync = cross_correlate_sync(ffmpeg, video_path, climax_path, cmx_anchor)
        bridge.log(f"  Climax sync: yt = source + {climax_sync['sync_offset']:.1f} "
                   f"(confidence {climax_sync['confidence']:.2f})")

    bridge.progress(70, 100, "Building beat-snapped specs…")
    # Smart-reorder: non-climax by ascending score, climax last
    if climax_info:
        climax_pick = max(picks, key=lambda p: p["score"])
        rest = sorted([p for p in picks if p != climax_pick], key=lambda p: p["score"])
        ordered = rest + [climax_pick]
    else:
        ordered = sorted(picks, key=lambda p: p["score"])
        climax_pick = None

    inputs = ["-i", video_path, "-i", main_path]
    if climax_path:
        inputs += ["-i", climax_path]
    MAIN_IDX = 1
    CLIMAX_IDX = 2 if climax_path else None

    # Main-song cursor (advances through picks of same song)
    main_beats = main_info["beat_times"]
    main_interval = main_info["beat_interval"]
    first_main_pick = ordered[0] if (climax_pick is None or ordered[0] != climax_pick) else ordered[1]
    main_yt_anchor = first_main_pick["startSec"] + main_sync["sync_offset"]
    main_cursor_idx = bisect.bisect_left(main_beats, main_yt_anchor)

    specs = []
    for p in ordered:
        is_climax = (climax_pick is not None and p == climax_pick)
        if is_climax and climax_info:
            cb = climax_info["beat_times"]
            # Decide whether to cross-correlate or use chorus-aligned start:
            # cross-correlation only makes sense if the climax-song actually
            # plays at this pick's source-time. Check if pick overlaps any
            # section where the song was detected in source.
            pick_t = p["startSec"]
            overlaps_section = any(
                sec["startSec"] <= pick_t <= sec["endSec"]
                for sec in climax_song.get("sections", [])
            )
            if overlaps_section:
                yt_raw = pick_t + climax_sync["sync_offset"]
                idx = bisect.bisect_left(cb, yt_raw)
            else:
                # Different song from what's in source here → start at the
                # song's chorus position (its most-impactful moment)
                idx = bisect.bisect_left(cb, climax_info["chorus_start"])
            # Safety: clamp to keep idx + n_beats within bounds
            n_beats = 5
            idx = max(0, min(idx, len(cb) - n_beats - 1))
            yt_start = cb[idx]
            yt_end = cb[idx + n_beats]
            dur = yt_end - yt_start
            mid = (p["startSec"] + p["endSec"]) / 2
            specs.append({"pick": p, "is_climax": True,
                "video_start": mid - dur/2, "video_end": mid + dur/2,
                "yt_start": yt_start, "yt_end": yt_end,
                "dur": dur, "song_idx": CLIMAX_IDX})
        else:
            orig_dur = p["endSec"] - p["startSec"]
            n_beats = max(1, round(orig_dur / main_interval))
            new_idx = min(main_cursor_idx + n_beats, len(main_beats) - 1)
            yt_start = main_beats[main_cursor_idx]
            yt_end = main_beats[new_idx]
            snapped = yt_end - yt_start
            main_cursor_idx = new_idx
            mid = (p["startSec"] + p["endSec"]) / 2
            specs.append({"pick": p, "is_climax": False,
                "video_start": mid - snapped/2, "video_end": mid + snapped/2,
                "yt_start": yt_start, "yt_end": yt_end,
                "dur": snapped, "song_idx": MAIN_IDX})

    if dry_run:
        bridge.result({
            "wouldRender": output_path,
            "picks": len(specs),
            "totalDur": sum(s["dur"] for s in specs),
            "mainSong": main_song["title"],
            "climaxSong": climax_song["title"] if climax_song else None,
            "mainSyncConfidence": main_sync["confidence"],
            "climaxSyncConfidence": climax_sync["confidence"] if climax_sync else None,
        })
        return

    bridge.progress(80, 100, "Rendering MP4…")
    aspect = (params.get("aspectRatio") or "16:9").strip()
    if aspect not in ("16:9", "9:16", "1:1"): aspect = "16:9"
    bridge.log(f"Render aspect: {aspect}")
    filter_complex, total_dur = build_filter_complex(specs, xfade_normal, xfade_climax, aspect=aspect)
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "warning",
           *inputs, "-filter_complex", filter_complex,
           "-map", "[outv]", "-map", "[outa]",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-c:a", "aac", "-b:a", "192k", output_path]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
    if r.returncode != 0:
        bridge.error(f"ffmpeg failed: {(r.stderr or '')[-1500:]}")
        sys.exit(1)

    size_mb = os.path.getsize(output_path) / (1024*1024)
    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"✓ {output_path} ({size_mb:.1f} MB, {total_dur:.1f}s)")
    bridge.result({
        "outputPath": output_path,
        "durationSec": round(total_dur, 1),
        "sizeMb": round(size_mb, 1),
        "picksUsed": len(specs),
        "mainSong": {"title": main_song["title"], "artist": main_song["artist"],
                     "bpm": main_song.get("bpm"),
                     "syncConfidence": main_sync["confidence"]},
        "climaxSong": ({"title": climax_song["title"], "artist": climax_song["artist"],
                        "bpm": climax_song.get("bpm"),
                        "syncConfidence": climax_sync["confidence"]}
                       if climax_song else None),
        "crossfadeNormalSec": xfade_normal,
        "crossfadeClimaxSec": xfade_climax,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
