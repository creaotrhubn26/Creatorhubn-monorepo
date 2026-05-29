"""Export EDL from approved picks — CMX 3600 format.

Use case: Bjarne reviewer i Post Agent + approver picks, men kunden vil
ha klippene levert i Premiere/Avid/FCP. EDL er bransje-standard for
shot-list-utveksling og kan importeres direkte i alle NLE-er.

Reads the same last_highlight_picks.json cache som build_delivery_variants
+ render_instagram_vertical bruker, slik at vi kan eksportere uten å gå
gjennom Resolve.

CMX 3600 spec we follow (subset):
  - TITLE: header line
  - FCM: NON-DROP FRAME (or DROP FRAME for NTSC)
  - Per cut:
      <event#>  AX  V  C  <src-in>  <src-out>  <rec-in>  <rec-out>
      * FROM CLIP NAME: <basename>
  - All timecodes 8-digit HH:MM:SS:FF @ video fps from cache (default 24)
  - Sequential record-time accumulation so importer plays them gap-free

Output: <source-basename>_picks.edl ved siden av source-fil.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_PATH = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
)


def _frames_to_tc(frames: int, fps: float, drop_frame: bool = False) -> str:
    """Convert absolute frame count to HH:MM:SS:FF timecode string.
    Drop-frame supported for 29.97 / 59.94."""
    if frames < 0:
        frames = 0
    if drop_frame and fps > 29.0:
        # SMPTE drop-frame: 29.97 nominal-30, drop 2 frames every minute
        # except every 10th minute. 59.94 doubles the drops.
        drop = 2 if fps < 35 else 4
        frames_per_min = int(round(60 * fps)) - drop
        frames_per_10min = frames_per_min * 10 + drop
        d, m = divmod(frames, frames_per_10min)
        if m > drop:
            frames += drop * 9 * d + drop * ((m - drop) // frames_per_min)
        else:
            frames += drop * 9 * d
        nominal = int(round(fps))
        h = (frames // (nominal * 60 * 60)) % 24
        m = (frames // (nominal * 60)) % 60
        s = (frames // nominal) % 60
        f = frames % nominal
        return f"{h:02d}:{m:02d}:{s:02d};{f:02d}"
    fps_int = max(1, int(round(fps)))
    h = (frames // (fps_int * 60 * 60)) % 24
    m = (frames // (fps_int * 60)) % 60
    s = (frames // fps_int) % 60
    f = frames % fps_int
    return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"


def _build_edl(
    title: str, source_basename: str, picks: list[dict],
    fps: float, drop_frame: bool, start_record_hours: int = 1,
) -> str:
    """Produce a CMX 3600 EDL string."""
    fcm_line = "FCM: DROP FRAME" if drop_frame else "FCM: NON-DROP FRAME"
    lines = [f"TITLE: {title}", fcm_line, ""]

    # Record timeline starts at 01:00:00:00 per industry convention.
    record_pos = int(round(start_record_hours * 60 * 60 * fps))

    # Reel name "AX" is generic for "any source"; some importers accept up
    # to 8 alphanumeric chars from filename. We keep AX for portability.
    reel = "AX"

    for i, p in enumerate(picks, start=1):
        start_sec = float(p.get("startSec") or 0)
        end_sec = float(p.get("endSec") or 0)
        if end_sec <= start_sec:
            continue
        src_in_f = int(round(start_sec * fps))
        src_out_f = int(round(end_sec * fps))
        dur_f = src_out_f - src_in_f
        rec_in_f = record_pos
        rec_out_f = record_pos + dur_f
        record_pos = rec_out_f

        src_in = _frames_to_tc(src_in_f, fps, drop_frame)
        src_out = _frames_to_tc(src_out_f, fps, drop_frame)
        rec_in = _frames_to_tc(rec_in_f, fps, drop_frame)
        rec_out = _frames_to_tc(rec_out_f, fps, drop_frame)

        # Event line + clip-name comment (most NLEs surface the comment)
        # Spec field-widths kept loose since modern importers tolerate variance.
        lines.append(
            f"{i:03d}  {reel}  V  C        {src_in} {src_out} {rec_in} {rec_out}"
        )
        lines.append(f"* FROM CLIP NAME: {source_basename}")
        lines.append("")

    return "\n".join(lines)


def run(params: dict[str, Any], dry_run: bool) -> None:
    cache_path = (params.get("cachePath") or CACHE_PATH).strip() or CACHE_PATH
    output_path = (params.get("outputPath") or "").strip()
    # Frontend sender ofte "~/Desktop/foo.edl" — Python må expande tilde
    # ellers lander filen i ./~/Desktop/ relativt til cwd.
    if output_path:
        output_path = os.path.expanduser(output_path)
    drop_frame = bool(params.get("dropFrame", False))
    title_override = (params.get("title") or "").strip()

    if not os.path.isfile(cache_path):
        bridge.error(
            f"Ingen picks-cache funnet ved {cache_path}. Kjør "
            "extract_highlight_from_film (med interactiveReview=true) først."
        )
        sys.exit(1)
    try:
        with open(cache_path) as f:
            cached = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        bridge.error(f"Could not read picks cache: {exc}")
        sys.exit(1)

    picks = cached.get("picks") or []
    source_video = cached.get("sourceVideo") or ""
    fps = float(cached.get("fps") or 24.0)

    if not picks:
        bridge.error("Picks cache has no approved picks")
        sys.exit(1)

    # Apply Creative Editor state hvis sendt inline (trim/reorder/filter)
    overrides_raw = params.get("pickOverrides") or {}
    pick_order = params.get("pickOrder")
    excluded = params.get("excludedChapters") or []
    if overrides_raw or pick_order or excluded:
        # Trim-overrides
        if isinstance(overrides_raw, dict):
            ov = {}
            for k, v in overrides_raw.items():
                try: ov[int(k)] = v if isinstance(v, dict) else {}
                except (TypeError, ValueError): continue
            for p in picks:
                o = ov.get(p.get("index"))
                if not o: continue
                if "startSec" in o: p["startSec"] = float(o["startSec"])
                if "endSec"   in o: p["endSec"]   = float(o["endSec"])
                p["durationSec"] = max(0.1, p["endSec"] - p["startSec"])
        # Reorder
        if isinstance(pick_order, list) and pick_order:
            order_map = {idx: i for i, idx in enumerate(pick_order)}
            picks = [p for p in picks if p.get("index") in order_map]
            picks.sort(key=lambda p: order_map[p["index"]])
        # Exclude chapters
        if isinstance(excluded, list) and excluded:
            ex = {str(c).lower() for c in excluded}
            picks = [p for p in picks if (p.get("chapter") or "details").lower() not in ex]
        bridge.log(f"Applied editor-state to {len(picks)} picks for EDL export")

    base = os.path.splitext(os.path.basename(source_video or "Untitled"))[0]
    title = title_override or f"{base} — Post Agent picks"
    if not output_path:
        out_dir = os.path.dirname(source_video) if source_video else os.getcwd()
        output_path = os.path.join(out_dir, f"{base}_picks.edl")

    bridge.log(
        f"Exporting EDL: {len(picks)} picks · fps {fps} · "
        f"{'DROP FRAME' if drop_frame else 'NON-DROP'}"
    )

    if dry_run:
        bridge.result({
            "wouldWriteEdl": output_path,
            "pickCount": len(picks),
            "fps": fps,
            "dropFrame": drop_frame,
        })
        return

    edl = _build_edl(title, base, picks, fps, drop_frame)
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(edl)
    except OSError as exc:
        bridge.error(f"Could not write EDL: {exc}")
        sys.exit(1)

    bridge.log(f"EDL skrevet: {output_path} ({os.path.getsize(output_path)} bytes)")
    bridge.result({
        "outputPath": output_path,
        "pickCount": len(picks),
        "fps": fps,
        "dropFrame": drop_frame,
        "preview": "\n".join(edl.split("\n")[:12]),
    })


if __name__ == "__main__":
    bridge.main_guard(run)
