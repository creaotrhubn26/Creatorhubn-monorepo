"""Apply Brand Vignette — legg en ferdig merkevare-vignett (intro/outro) på et
over-spor i en Resolve-timeline og sett blend-modus (Screen=5 som default).

To bruksmønstre:
  1) Som registry-/bridge-script (run(params, dry_run) + main_guard): kobler til
     Resolve, finner current/navngitt timeline og legger vignetten som intro
     (helt i starten) og outro (helt på slutten). Hvis verken `vignettePath`-param
     eller env BRAND_VIGNETTE_PATH er satt → bridge.result({"skipped": true, ...})
     (det er IKKE en feil — brand-vignett er valgfritt).
  2) Som gjenbrukbar funksjon: build-scriptene importerer
     `apply_vignette_to_timeline(conn, timeline, vignette_path, ...)` og kaller den
     ETTER at video-klippene er lagt på, hvis env BRAND_VIGNETTE_PATH er satt.

Vignetten legges på et eget video-over-spor (V2 om nødvendig, opprettet via
tl.AddTrack("video")) slik at den ligger OVER highlighten og kan blendes inn med
Screen/Overlay. Intro plasseres på recordFrame = timeline-start; outro plasseres
slik at vignettens SLUTT lander på timeline-slutt (recordFrame = end - vignette_len).

Params (script-modus):
  vignettePath:   sti til ferdig vignett-MP4. Default = os.environ["BRAND_VIGNETTE_PATH"].
  timelineName:   navn på timeline å bruke (default: current timeline).
  compositeMode:  Resolve TimelineItem composite-enum (default 5 = Screen).
  intro:          bool (default true) — legg vignett i starten.
  outro:          bool (default true) — legg vignett på slutten.

Result: { "applied": ["intro","outro"], "track": 2 }  (eller skipped).
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge  # type: ignore


def _probe_duration_frames(vignette_path: str, fps: float) -> int:
    """Best-effort lengde på vignetten i frames. Bruker ffprobe hvis tilgjengelig,
    ellers en fornuftig fallback (7s) — vi bruker den KUN for å plassere outro
    riktig (end - len). Hvis estimatet er litt feil, lander outroen marginalt
    forskjøvet, men aldri utenfor timelinen (vi clamper)."""
    try:
        import shutil
        import subprocess

        ffprobe = shutil.which("ffprobe")
        if ffprobe:
            out = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", vignette_path],
                capture_output=True, text=True, timeout=20,
            )
            dur = float((out.stdout or "0").strip() or 0)
            if dur > 0:
                return max(1, int(round(dur * fps)))
    except Exception:  # noqa: BLE001
        pass
    return max(1, int(round(7.0 * fps)))  # fallback: 7s (= generate-default)


def apply_vignette_to_timeline(
    conn,
    timeline,
    vignette_path: str,
    composite: int = 5,
    intro: bool = True,
    outro: bool = True,
):
    """Legg merkevare-vignetten på et eget video-over-spor i `timeline`, som intro
    og/eller outro, og sett CompositeMode. Gjenbrukbar fra build-scriptene.

    Args:
        conn:          en tilkoblet bridge.ResolveConnection (conn.project gyldig).
        timeline:      mål-timeline (current timeline i build-scriptene).
        vignette_path: sti til ferdig vignett-MP4.
        composite:     Resolve composite-enum (5 = Screen).
        intro/outro:   hvor vignetten skal plasseres.

    Returns:
        dict { "applied": [...], "track": <int> } eller
        { "applied": [], "skipped": True, "reason": "..." } hvis ingenting ble lagt.
        Reiser ALDRI — build-scriptene skal aldri knekke pga. vignett.
    """
    if not vignette_path:
        return {"applied": [], "skipped": True, "reason": "no vignettePath"}
    if not os.path.isfile(vignette_path):
        bridge.warn(f"Brand-vignett ikke funnet på disk: {vignette_path}")
        return {"applied": [], "skipped": True, "reason": "vignette file missing"}
    if timeline is None or conn is None or getattr(conn, "project", None) is None:
        return {"applied": [], "skipped": True, "reason": "no timeline/project"}

    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.warn("Kunne ikke nå Media Pool for brand-vignett")
        return {"applied": [], "skipped": True, "reason": "no media pool"}

    # 1) Importer vignett-asset
    v_items = media_pool.ImportMedia([vignette_path]) or []
    if not v_items:
        bridge.warn("Kunne ikke importere brand-vignett")
        return {"applied": [], "skipped": True, "reason": "import failed"}
    vignette = v_items[0]

    # 2) Timeline-geometri (fps, start, slutt)
    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except Exception:  # noqa: BLE001
        fps = 25.0
    try:
        tl_start = int(timeline.GetStartFrame() or 0)
    except Exception:  # noqa: BLE001
        tl_start = 0
    try:
        tl_end = int(timeline.GetEndFrame() or tl_start)
    except Exception:  # noqa: BLE001
        tl_end = tl_start

    vignette_len = _probe_duration_frames(vignette_path, fps)

    # 3) Nytt video-over-spor (V2+) for vignetten
    try:
        base_video_tracks = int(timeline.GetTrackCount("video") or 1)
    except Exception:  # noqa: BLE001
        base_video_tracks = 1
    vignette_track = base_video_tracks + 1
    try:
        timeline.AddTrack("video")
        bridge.log(f"La til V{vignette_track} for brand-vignett")
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Kunne ikke legge til vignett-spor: {exc}")
        return {"applied": [], "skipped": True, "reason": f"AddTrack failed: {exc}"}

    applied: list[str] = []
    specs = []
    if intro:
        specs.append(("intro", tl_start))
    if outro:
        # outro: vignettens SLUTT skal lande på timeline-slutt → start = end - len.
        outro_frame = max(tl_start, tl_end - vignette_len)
        # Unngå at outro legges oppå intro hvis timelinen er kortere enn 2 vignetter.
        if not intro or outro_frame > tl_start:
            specs.append(("outro", outro_frame))

    for label, record_frame in specs:
        spec = [{
            "mediaPoolItem": vignette,
            "mediaType": 1,                 # 1 = video only
            "trackIndex": vignette_track,
            "recordFrame": int(record_frame),
        }]
        placed = media_pool.AppendToTimeline(spec)
        if isinstance(placed, list) and placed:
            applied.append(label)
        else:
            bridge.warn(f"Brand-vignett ({label}) ikke plassert")

    # 4) Sett blend-modus på alle vignett-klipp i over-sporet
    try:
        items_in_track = timeline.GetItemListInTrack("video", vignette_track) or []
        for itm in items_in_track:
            try:
                itm.SetProperty("CompositeMode", composite)
            except Exception:  # noqa: BLE001
                pass
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Kunne ikke sette CompositeMode på vignett: {exc}")

    if applied:
        bridge.log(
            f"Brand-vignett lagt på V{vignette_track} "
            f"({'+'.join(applied)}, CompositeMode={composite})"
        )
        return {"applied": applied, "track": vignette_track}
    return {"applied": [], "skipped": True, "reason": "nothing placed"}


def run(params: dict, dry_run: bool) -> None:
    """Bridge/registry entry — legg brand-vignetten på current/navngitt timeline."""
    vignette_path = (params.get("vignettePath") or os.environ.get("BRAND_VIGNETTE_PATH") or "").strip()
    if not vignette_path:
        bridge.result({
            "skipped": True,
            "reason": "Ingen brand-vignett konfigurert (sett BRAND_VIGNETTE_PATH i "
                      "Settings eller send vignettePath). Hopper over — ikke en feil.",
        })
        return
    if not os.path.isfile(vignette_path):
        bridge.result({
            "skipped": True,
            "reason": f"Brand-vignett '{vignette_path}' finnes ikke på disk. Hopper over.",
        })
        return

    composite = params.get("compositeMode")
    try:
        composite = int(composite) if composite not in (None, "") else 5
    except (TypeError, ValueError):
        composite = 5
    intro = str(params.get("intro", True)).lower() not in ("false", "0", "no")
    outro = str(params.get("outro", True)).lower() not in ("false", "0", "no")
    timeline_name = (params.get("timelineName") or "").strip()

    if dry_run:
        bridge.result({
            "summary": f"Ville lagt brand-vignett ({vignette_path}) som "
                       f"{'intro' if intro else ''}{'+' if intro and outro else ''}"
                       f"{'outro' if outro else ''} på et over-spor (Composite={composite}).",
            "vignettePath": vignette_path,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    bridge.progress(20, 100, "Finner timeline…")
    timeline = None
    if timeline_name:
        try:
            count = int(conn.project.GetTimelineCount() or 0)
            for i in range(1, count + 1):
                tl = conn.project.GetTimelineByIndex(i)
                if tl and (tl.GetName() or "") == timeline_name:
                    timeline = tl
                    break
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Kunne ikke slå opp timeline '{timeline_name}': {exc}")
        if timeline is not None:
            try:
                conn.project.SetCurrentTimeline(timeline)
            except Exception:  # noqa: BLE001
                pass
    if timeline is None:
        timeline = conn.project.GetCurrentTimeline()
    if timeline is None:
        bridge.error("Ingen aktiv timeline — åpne en timeline i Resolve og prøv igjen.")
        sys.exit(1)

    bridge.progress(60, 100, "Legger brand-vignett…")
    res = apply_vignette_to_timeline(
        conn, timeline, vignette_path, composite=composite, intro=intro, outro=outro
    )
    bridge.progress(100, 100, "Ferdig.")
    bridge.result(res)


if __name__ == "__main__":
    bridge.main_guard(run)
