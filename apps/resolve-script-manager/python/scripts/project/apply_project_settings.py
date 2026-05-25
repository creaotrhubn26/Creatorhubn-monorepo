"""Apply Project Settings — sets Resolve project resolution, framerate, and
Color Space Transform on the currently-open project to match the equipment
+ detected log-curve from Role Room + ffprobe.

Input via params:
  resolution:     "3840x2160" | "1920x1080" | "WxH"
  frameRate:      25 | 29.97 | 24 | … (PAL=25/50, NTSC=29.97/59.94, Cinema=24/23.976)
  cstInputGamma:  "Canon C-Log 2" | "Sony S-Log 3" | "Panasonic V-Log" | "ARRI Log C / HLG" | "ST.2084"
  cstInputGamut:  "Canon Cinema Gamut" | "Sony S-Gamut3.Cine" | "Panasonic V-Gamut" | "Rec.2020"
  cstOutput:      defaults to "Rec.709 Gamma 2.4" (broadcast/web standard delivery)

Behavior:
  - Reads current settings first so we can report what changed vs left alone.
  - Sets timelineResolutionWidth/Height, timelineFrameRate, videoMonitorFormat.
  - If a log curve is provided, switches color science to DaVinci YRGB Color
    Managed v2 and sets colorSpaceInput + colorSpaceOutput.
  - All changes are skip-if-current-matches (idempotent).
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Map Role Room / ffprobe log-curve labels → Resolve color-space names.
# Resolve's exact strings change between versions; these are the most common ones
# for Resolve 18/19. If a project's Resolve doesn't recognize the value the
# SetSetting call will fail silently and we report it.
CST_INPUT_GAMMA_MAP = {
    "Canon C-Log 2": "Canon Log 2",
    "Sony S-Log 3": "S-Log3",
    "Panasonic V-Log": "V-Log",
    "ARRI Log C / HLG": "Arri LogC",
    "ST.2084": "ST2084 PQ",
}

CST_INPUT_GAMUT_MAP = {
    "Canon Cinema Gamut": "Canon Cinema Gamut",
    "Sony S-Gamut3.Cine": "S-Gamut3.Cine",
    "Panasonic V-Gamut": "V-Gamut",
    "Rec.2020": "Rec.2020",
}

DEFAULT_OUTPUT = "Rec.709 Gamma 2.4"


def _parse_resolution(s: str) -> tuple[int, int] | None:
    if not s or "x" not in s.lower():
        return None
    try:
        parts = s.lower().split("x")
        return int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return None


def _video_monitor_format(width: int, height: int, fps: float) -> str | None:
    """Pick the videoMonitorFormat string Resolve expects for the given res+fps."""
    fps_str = f"{fps:.2f}".rstrip("0").rstrip(".")
    if width == 3840 and height == 2160:
        return f"UHD 2160p {fps_str}"
    if width == 1920 and height == 1080:
        return f"HD 1080p {fps_str}"
    if width == 1280 and height == 720:
        return f"HD 720p {fps_str}"
    return None


def run(params: dict, dry_run: bool) -> None:
    resolution = (params.get("resolution") or "").strip()
    frame_rate = params.get("frameRate")
    cst_input_gamma = (params.get("cstInputGamma") or "").strip()
    cst_input_gamut = (params.get("cstInputGamut") or "").strip()
    cst_output = (params.get("cstOutput") or DEFAULT_OUTPUT).strip()

    wh = _parse_resolution(resolution) if resolution else None
    fps = None
    if frame_rate is not None:
        try:
            fps = float(frame_rate)
        except (TypeError, ValueError):
            bridge.warn(f"frameRate '{frame_rate}' is not a number — skipping")
            fps = None

    plan: list[str] = []
    if wh:
        plan.append(f"resolution → {wh[0]}x{wh[1]}")
    if fps is not None:
        plan.append(f"frameRate → {fps}")
    if cst_input_gamma:
        plan.append(f"CST input gamma → {cst_input_gamma}")
    if cst_input_gamut:
        plan.append(f"CST input gamut → {cst_input_gamut}")
    if cst_input_gamma or cst_input_gamut:
        plan.append(f"CST output → {cst_output}")

    if not plan:
        bridge.error("No settings provided — pass resolution, frameRate, or CST input fields")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": "Would apply " + " · ".join(plan),
            "plan": plan,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)

    project = conn.project
    applied: list[dict] = []
    skipped: list[dict] = []
    failed: list[dict] = []

    def _set(key: str, value: str, label: str) -> None:
        current = ""
        try:
            current = project.GetSetting(key) or ""
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"GetSetting('{key}') threw: {exc}")
        if str(current) == str(value):
            skipped.append({"key": key, "label": label, "value": str(value), "reason": "already_set"})
            return
        try:
            ok = project.SetSetting(key, str(value))
        except Exception as exc:  # noqa: BLE001
            failed.append({"key": key, "label": label, "value": str(value), "error": str(exc)})
            return
        if ok:
            applied.append({"key": key, "label": label, "value": str(value), "previous": str(current)})
        else:
            failed.append({"key": key, "label": label, "value": str(value), "error": "SetSetting returned False"})

    if wh:
        bridge.progress(1, 6, "Resolution")
        _set("timelineResolutionWidth", str(wh[0]), "Resolution width")
        _set("timelineResolutionHeight", str(wh[1]), "Resolution height")

    if fps is not None:
        bridge.progress(2, 6, "Frame rate")
        _set("timelineFrameRate", f"{fps}", "Timeline frame rate")
        if wh:
            fmt = _video_monitor_format(wh[0], wh[1], fps)
            if fmt:
                _set("videoMonitorFormat", fmt, "Video monitor format")

    if cst_input_gamma or cst_input_gamut:
        bridge.progress(3, 6, "Color science")
        # Switch to DaVinci YRGB Color Managed v2 so the CST applies.
        _set("colorScienceMode", "davinciYRGBColorManagedv2", "Color science mode")

        bridge.progress(4, 6, "Input gamma")
        if cst_input_gamma:
            resolve_gamma = CST_INPUT_GAMMA_MAP.get(cst_input_gamma, cst_input_gamma)
            _set("colorSpaceInputGamma", resolve_gamma, f"Input gamma ({cst_input_gamma})")

        bridge.progress(5, 6, "Input gamut")
        if cst_input_gamut:
            resolve_gamut = CST_INPUT_GAMUT_MAP.get(cst_input_gamut, cst_input_gamut)
            _set("colorSpaceInputGamut", resolve_gamut, f"Input gamut ({cst_input_gamut})")

        bridge.progress(6, 6, "Output")
        _set("colorSpaceOutput", cst_output, f"Output ({cst_output})")

    bridge.result({
        "projectName": project.GetName(),
        "applied": applied,
        "skipped": skipped,
        "failed": failed,
        "totalChanges": len(applied),
    })


if __name__ == "__main__":
    bridge.main_guard(run)
