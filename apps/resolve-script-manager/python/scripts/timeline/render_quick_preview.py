"""Render Quick Preview — lo-fi MP4 preview av approved picks uten Resolve.

Use case: build_highlight_from_picks setter opp Resolve-timeline, men full
Resolve-render kan ta minutter (debayer + grade + transcoded export). Med
denne scripten produserer vi en ffmpeg-concat-preview på sekunder så
Bjarne kan begynne å se highlight-cuten umiddelbart. Bra for review-runder
før commit til final Resolve-render.

Output: 720p H.264 MP4 ved siden av source-fil. Ingen captions, ingen
reframe — bare picks limt sammen i kronologisk rekkefølge med original
audio. Ren visning-versjon, ikke leveringskandidat.

Bruker samme pick-cache som build_delivery_variants + render_instagram_vertical
så user kan kjøre dette etter review uten ekstra konfig.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_PATH = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
)


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


def _apply_editor_state(picks: list[dict], params: dict) -> list[dict]:
    """Apply pickOverrides + pickOrder + excludedChapters fra editor.
    Samme contract som build_highlight_from_picks / assemble."""
    overrides_raw = params.get("pickOverrides") or {}
    if isinstance(overrides_raw, dict):
        ov: dict[int, dict] = {}
        for k, v in overrides_raw.items():
            try: ov[int(k)] = v if isinstance(v, dict) else {}
            except (TypeError, ValueError): continue
        for p in picks:
            o = ov.get(p.get("index"))
            if not o: continue
            if "startSec" in o: p["startSec"] = float(o["startSec"])
            if "endSec"   in o: p["endSec"]   = float(o["endSec"])
            p["durationSec"] = max(0.1, p["endSec"] - p["startSec"])

    pick_order = params.get("pickOrder")
    if isinstance(pick_order, list) and pick_order:
        m = {idx: i for i, idx in enumerate(pick_order)}
        picks = [p for p in picks if p.get("index") in m]
        picks.sort(key=lambda p: m[p["index"]])

    excluded = params.get("excludedChapters") or []
    if isinstance(excluded, list) and excluded:
        ex = {str(c).lower() for c in excluded}
        picks = [p for p in picks if (p.get("chapter") or "details").lower() not in ex]

    return picks


def run(params: dict[str, Any], dry_run: bool) -> None:
    preset = (params.get("preset") or "fast").strip()  # fast | balanced | hq
    height = int(params.get("height") or 720)
    only_approved = params.get("onlyApproved", True)

    # Foretrekk payload over cache (samme pattern som assemble_highlight_with_music).
    # Editor sender picks + sourceVideo + editor-state direkte for continuous preview.
    payload_picks = params.get("picks")
    payload_source = (params.get("sourceVideo") or "").strip()

    if isinstance(payload_picks, list) and payload_picks:
        picks = list(payload_picks)
        source_video = payload_source
        bridge.log(f"Bruker {len(picks)} picks fra editor-payload")
    else:
        if not os.path.isfile(CACHE_PATH):
            bridge.error("Picks cache mangler — kjør extract_highlight_from_film (review-mode) først")
            sys.exit(1)
        try:
            with open(CACHE_PATH) as f:
                cached = json.load(f)
        except (OSError, json.JSONDecodeError) as exc:
            bridge.error(f"Could not read picks cache: {exc}")
            sys.exit(1)

        picks = cached.get("picks") or []
        if only_approved:
            picks = [p for p in picks if p.get("approved") is not False]
        source_video = cached.get("sourceVideo") or ""

    # Apply editor-state (overrides + reorder + filter)
    picks = _apply_editor_state(picks, params)

    if not picks:
        bridge.error("Ingen picks å render etter editor-filtrering")
        sys.exit(1)
    if not source_video or not os.path.isfile(source_video):
        bridge.error(f"Source video '{source_video}' missing")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH — install via Dependencies modal")
        sys.exit(1)

    # #87 — disk-space safety. Rough estimate: ~2 MB per second of 720p H.264 at preset.
    pick_total = sum((p.get("endSec") or 0) - (p.get("startSec") or 0) for p in picks)
    est_mb = pick_total * 2.0
    est_gb = max(0.5, est_mb / 1024)
    out_dir = os.path.dirname(source_video) or "."
    if not bridge.check_disk_space(out_dir, required_gb=est_gb):
        sys.exit(1)

    base = os.path.splitext(os.path.basename(source_video))[0]
    out_path = os.path.join(out_dir, f"{base}_preview.mp4")

    preset_map = {
        "fast":     ("veryfast", "26"),
        "balanced": ("medium", "23"),
        "hq":       ("slow", "20"),
    }
    x264_preset, crf = preset_map.get(preset, preset_map["fast"])

    bridge.log(
        f"Preview plan: {len(picks)} picks ({pick_total:.1f}s) @ {height}p "
        f"preset={preset} → {out_path}"
    )

    if dry_run:
        bridge.result({
            "wouldProduce": out_path,
            "pickCount": len(picks),
            "estimatedDurationSec": round(pick_total, 1),
            "estimatedSizeMb": round(est_mb, 1),
            "preset": preset,
        })
        return

    sel_parts = [f"between(t,{p['startSec']:.3f},{p['endSec']:.3f})" for p in picks]
    sel_expr = "+".join(sel_parts)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", source_video,
        "-vf",
        f"select='{sel_expr}',setpts=N/FRAME_RATE/TB,"
        f"scale=-2:{height}",
        "-af",
        f"aselect='{sel_expr}',asetpts=N/SR/TB",
        "-c:v", "libx264", "-preset", x264_preset, "-crf", crf,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
        "-movflags", "+faststart",
        out_path,
    ]
    bridge.progress(10, 100, f"Encoding {height}p preview…")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
    except subprocess.TimeoutExpired:
        bridge.error("ffmpeg preview-render timed out after 20 min")
        sys.exit(1)
    if r.returncode != 0:
        bridge.error(f"ffmpeg failed: {(r.stderr or '')[-400:]}")
        sys.exit(1)

    file_size = os.path.getsize(out_path) if os.path.isfile(out_path) else 0
    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "outputPath": out_path,
        "pickCount": len(picks),
        "durationSec": round(pick_total, 1),
        "fileSizeMb": round(file_size / (1024 ** 2), 1),
        "preset": preset,
        "height": height,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
