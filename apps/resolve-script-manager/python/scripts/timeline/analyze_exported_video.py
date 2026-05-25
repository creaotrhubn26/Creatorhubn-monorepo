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

            prompt = (
                f"Du ser {len(usable)} bilder fra ETT shot i en bryllups-/eventfilm: "
                f"start, midt og slutt. Shot-varighet: {duration_s:.1f}s ({length_label}). "
                f"Bevegelse: {motion_label}.\n\n"
                "Skriv 3-6 ord på norsk som beskriver HVA SOM SKJER i shotet — "
                "inkluder bevegelsen mellom bildene hvis relevant. Tenk som en "
                "marker-tittel i et redigeringsprogram. Eksempler: "
                "'Brudefar gråter under tale', 'Kamera følger ringbyttingen', "
                "'Brud og brudgom danser', 'Brytar zoomer inn på kake'.\n\n"
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

    narrations: list[str] = []
    shot_meta_for_narration: list[dict] = []
    if narrate and not dry_run:
        # Extract 3 frames per shot (start/mid/end) + measure motion.
        # This gives Claude enough temporal context to describe action,
        # not just a single moment.
        bridge.progress(30, 100, "Extracting frames + measuring motion per shot…")
        tmp_dir = os.path.join(os.path.dirname(video_path), ".trrpa_thumbs")
        os.makedirs(tmp_dir, exist_ok=True)
        for i, cut in enumerate(cuts):
            next_cut = cuts[i + 1] if i + 1 < len(cuts) else duration
            shot_dur = max(0.05, next_cut - cut)
            # Sample at 10%, 50%, 90% of shot duration so we don't catch
            # the cut transition itself (cuts often have motion blur on
            # both ends of the boundary).
            t_start = cut + shot_dur * 0.10
            t_mid = cut + shot_dur * 0.50
            t_end = cut + shot_dur * 0.90
            frames: list[str] = []
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
            })
            if (i + 1) % 5 == 0:
                bridge.progress(30 + int(20 * (i + 1) / len(cuts)), 100, f"Frames {i+1}/{len(cuts)}")

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
        plan.append({
            "index": i,
            "time": cut,
            "frame": int(cut * fps),
            "durationSeconds": max(0.0, next_cut - cut),
            "motionScore": m.get("motion"),
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

    # Add markers per cut
    bridge.progress(90, 100, "Placing markers…")
    markers_added = 0
    markers_failed = 0
    for entry in plan:
        try:
            ok = timeline.AddMarker(
                entry["frame"],   # frameId
                "Yellow",          # color
                entry["name"],     # name
                "",                # note
                1,                  # duration
                "",                # customData
            )
            if ok:
                markers_added += 1
            else:
                markers_failed += 1
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"AddMarker @ frame {entry['frame']} failed: {exc}")
            markers_failed += 1

    bridge.progress(100, 100, "Done.")

    bridge.result({
        "projectName": project.GetName(),
        "timelineName": timeline_name,
        "frameRate": fps,
        "durationSeconds": duration,
        "cutCount": len(cuts),
        "markersAdded": markers_added,
        "markersFailed": markers_failed,
        "narrated": narrate,
        "samplePlan": plan[:15],
    })


if __name__ == "__main__":
    bridge.main_guard(run)
