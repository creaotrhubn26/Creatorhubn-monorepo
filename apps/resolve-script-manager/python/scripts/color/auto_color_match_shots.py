"""Auto Color Match Shots — beregner per-shot eksponerings-justering så
hele highlighten lander på samme target Y-mean. Tidligere kunne shot #3
være 1.5 stop mørkere enn #2 → synlig flicker i xfade.

Output: { adjustments: [{pickIndex, brightness, contrast, gamma}],
          targetY: float, baselineSpread: float }

Editor / assemble_highlight kan bruke disse via filter_complex eq=
brightness=... per pick før concat.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import json
import tempfile
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


def measure_y_mean(ffmpeg: str, video_path: str, start_sec: float, end_sec: float) -> float:
    """Måler Y-mean ved 3 sample-frames i pick-en."""
    mid_sec = (start_sec + end_sec) / 2
    samples = [start_sec + 0.1, mid_sec, end_sec - 0.1]
    y_vals = []
    for ts in samples:
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                tmp_path = f.name
            cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                   "-ss", str(ts), "-i", video_path,
                   "-vframes", "1", "-vf", "signalstats,format=yuv420p",
                   "-f", "null", "-"]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            # signalstats output i stderr — parse YAVG
            for line in (r.stderr or "").splitlines():
                if "YAVG:" in line:
                    try:
                        val = line.split("YAVG:")[1].strip().split()[0]
                        y_vals.append(float(val))
                        break
                    except (IndexError, ValueError):
                        pass
            try: os.unlink(tmp_path)
            except OSError: pass
        except subprocess.TimeoutExpired:
            continue
    if not y_vals:
        return 128.0  # midt-grå default
    return sum(y_vals) / len(y_vals)


def run(params: dict[str, Any], dry_run: bool) -> None:
    picks = params.get("picks") or []
    source_video = (params.get("sourceVideo") or "").strip()
    # NY: Claude's per-chapter direction (fra claude_color_direction.py).
    # Hvis tilgjengelig, bruker vi chapter-spesifikke targets i stedet for
    # global median — det gjør at ceremony, portrait og dance får ulik look.
    per_chapter_direction = params.get("perChapterDirection") or {}

    if not isinstance(picks, list) or len(picks) == 0:
        bridge.error("Ingen picks i input")
        sys.exit(1)
    if not source_video or not os.path.isfile(source_video):
        bridge.error(f"sourceVideo '{source_video}' mangler")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldMatch": len(picks),
            "method": "Claude-guided per-chapter Y-targeting" if per_chapter_direction else "global median Y-targeting",
        })
        return

    # Mål Y-mean per pick + tagg med chapter
    bridge.log(f"Måler Y-mean per pick ({len(picks)} stk) …")
    measurements = []
    for i, p in enumerate(picks):
        start = float(p.get("startSec", 0))
        end = float(p.get("endSec", start + 1))
        chapter = (p.get("chapter") or "details").lower()
        y_mean = measure_y_mean(ffmpeg, source_video, start, end)
        measurements.append({
            "pickIndex": p.get("index", i),
            "y": y_mean,
            "chapter": chapter,
        })
        if (i + 1) % 5 == 0:
            bridge.progress(i + 1, len(picks), f"Målt {i+1}/{len(picks)}")

    # Bestem target Y per pick:
    #   - Hvis Claude har gitt direction for pick's chapter → bruk Claude's target
    #   - Ellers fall tilbake til global median (gamle algoritmen)
    sorted_y = sorted(m["y"] for m in measurements)
    global_median_y = sorted_y[len(sorted_y) // 2]
    spread = max(sorted_y) - min(sorted_y)

    using_claude = bool(per_chapter_direction)
    if using_claude:
        chapters_with_direction = list(per_chapter_direction.keys())
        bridge.log(f"Claude-guidet: targets fra {len(chapters_with_direction)} chapters " +
                   f"({', '.join(chapters_with_direction)})")
    else:
        bridge.log(f"Global median Y={global_median_y:.1f}, spread={spread:.1f}")

    # Beregn justeringer per pick (per-chapter target hvis tilgjengelig)
    adjustments = []
    for m in measurements:
        ch = m["chapter"]
        direction = per_chapter_direction.get(ch, {}) if using_claude else {}

        target_y = float(direction.get("targetY", global_median_y))
        warmth = int(direction.get("warmth", 0))
        saturation = float(direction.get("saturation", 1.0))

        delta_y = target_y - m["y"]
        # 1 Y-enhet ≈ 0.004 brightness-units i ffmpeg eq
        brightness = max(-0.4, min(0.4, delta_y / 255.0 * 1.6))

        # Gamma-korrigering for ekstreme tilfeller
        gamma = 1.0
        if delta_y > 30: gamma = 1.15
        elif delta_y < -30: gamma = 0.88

        # Warmth → colorbalance midtones (rødt/blått-skift)
        # ffmpeg colorbalance midshadows/midmidtones/midhighlights: -1.0 til +1.0
        # 20 warmth → ~0.10 rs (+rødt), -0.10 bs (-blått) på midtones
        cb_red = warmth / 200.0   # -0.10 til +0.10
        cb_blue = -warmth / 200.0

        adjustments.append({
            "pickIndex": m["pickIndex"],
            "chapter": ch,
            "brightness": round(brightness, 3),
            "contrast": 1.0,
            "gamma": gamma,
            "saturation": round(saturation, 2),
            "colorBalanceRed": round(cb_red, 3),
            "colorBalanceBlue": round(cb_blue, 3),
            "warmth": warmth,
            "originalY": round(m["y"], 1),
            "targetY": round(target_y, 1),
            "deltaY": round(delta_y, 1),
            "reasoning": direction.get("reasoning", "") if using_claude else "",
        })

    bridge.result({
        "targetY": round(global_median_y, 1),
        "baselineSpread": round(spread, 1),
        "adjustments": adjustments,
        "shotsCount": len(measurements),
        "method": "Claude-guided per-chapter targeting" if using_claude else "global median Y-targeting",
        "claudeGuided": using_claude,
    })


bridge.main_guard(run)
