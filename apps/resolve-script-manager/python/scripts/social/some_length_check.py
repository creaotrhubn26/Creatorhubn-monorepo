"""
SoMe Lengde-sjekk — skann timelinen og vurder om den passer SoMe-formatene,
og flagg for lang B-roll (partier uten dialog som kan kortes).

Prinsipp (bygget på PetKey katte-SoMe 2026-07-01): en SoMe-cut har mål-lengder
(15/30/60/90s). B-roll = partier UTEN dialog. Bruker undertekst-sporet som
dialog-indikator (prosjekt-uavhengig; faller tilbake på lyd-klipp på ikke-musikk-
spor hvis ingen undertekster). Gap mellom dialog = B-roll-kandidater; gap over
terskel flagges som «for lang».

params: { targets? (sek-liste, default [15,30,60,90]), gap_warn_s? (default 4.0),
          music_track_hint? (navn-substreng, default 'music'/'musikk') }
result: {
  duration_s, fps,
  targets: [{sec, label, ok, over_by_s}],
  nearest_target, over_nearest_s,
  broll_gaps: [{start_s, end_s, dur_s, too_long}],
  total_broll_s, total_dialogue_s,
  trim_candidates: [{start_s, end_s, dur_s, suggest_trim_s}],
  headroom_to_next_shorter_s,
  status  # 'green' | 'amber' | 'red' mot nærmeste mål
}
"""
from __future__ import annotations
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

TARGET_LABELS = {15: "Bumper 15s", 30: "Kort 30s", 60: "Stories 60s", 90: "Reels/TikTok 90s"}


def _merge(intervals, gap=0.4):
    """slå sammen overlappende/nære intervaller."""
    if not intervals:
        return []
    intervals = sorted(intervals)
    out = [list(intervals[0])]
    for s, e in intervals[1:]:
        if s <= out[-1][1] + gap:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out


def run(params: dict) -> None:
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt åpent"); sys.exit(1)
    pr = conn.project
    tl = pr.GetCurrentTimeline()
    if not tl:
        bridge.error("Ingen timeline åpen"); sys.exit(1)
    fps = float(pr.GetSetting("timelineFrameRate") or 25)
    sfr = tl.GetStartFrame()
    dur = (tl.GetEndFrame() - sfr) / fps

    targets = params.get("targets") or [15, 30, 60, 90]
    gap_warn = float(params.get("gap_warn_s", 4.0))
    music_hint = [h.lower() for h in (params.get("music_track_hint") or ["music", "musikk", "bed", "score"])]

    # 1) dialog-regioner: primært undertekst-spor, fallback lyd-klipp på ikke-musikk-spor
    dia = []
    nsub = tl.GetTrackCount("subtitle")
    for st in range(1, nsub + 1):
        for it in tl.GetItemListInTrack("subtitle", st):
            dia.append((round((it.GetStart() - sfr) / fps, 3), round((it.GetEnd() - sfr) / fps, 3)))
    used = "undertekst-spor"
    if not dia:
        used = "lyd-klipp (ikke-musikk-spor)"
        for a in range(1, tl.GetTrackCount("audio") + 1):
            nm = (tl.GetTrackName("audio", a) or "").lower()
            if any(h in nm for h in music_hint):
                continue
            for it in tl.GetItemListInTrack("audio", a):
                dia.append((round((it.GetStart() - sfr) / fps, 3), round((it.GetEnd() - sfr) / fps, 3)))

    dia = _merge(dia)
    total_dia = round(sum(e - s for s, e in dia), 1)

    # 2) B-roll-gap = hull mellom dialog (inkl. før første / etter siste)
    gaps = []
    prev = 0.0
    for s, e in dia:
        if s - prev > 0.4:
            gaps.append((round(prev, 2), round(s, 2)))
        prev = max(prev, e)
    if dur - prev > 0.4:
        gaps.append((round(prev, 2), round(dur, 2)))
    broll = [{"start_s": s, "end_s": e, "dur_s": round(e - s, 1), "too_long": (e - s) >= gap_warn} for s, e in gaps]
    total_broll = round(sum(g["dur_s"] for g in broll), 1)

    # 3) mål-status
    tgt = []
    for sec in sorted(targets):
        over = round(dur - sec, 1)
        tgt.append({"sec": sec, "label": TARGET_LABELS.get(sec, f"{sec}s"), "ok": dur <= sec + 0.05, "over_by_s": max(0.0, over)})
    # nærmeste mål der vi er UNDER (eller minste over)
    fits = [t for t in tgt if t["ok"]]
    nearest = (fits[0]["sec"] if fits else tgt[-1]["sec"])
    over_nearest = round(max(0.0, dur - nearest), 1)
    # nærmeste KORTERE mål (det man typisk sikter mot)
    shorter = [t for t in tgt if t["sec"] < dur]
    next_shorter = shorter[-1]["sec"] if shorter else None
    headroom = round(dur - next_shorter, 1) if next_shorter else 0.0

    # 4) trim-forslag: fordel nødvendig kutt på de lengste B-roll-hullene
    trim = []
    need = headroom if headroom > 0 else 0.0
    if need > 0:
        for g in sorted(broll, key=lambda x: -x["dur_s"]):
            if need <= 0:
                break
            # la stå minst ~2s av hvert hull
            avail = max(0.0, g["dur_s"] - 2.0)
            take = round(min(avail, need), 1)
            if take >= 0.5:
                trim.append({"start_s": g["start_s"], "end_s": g["end_s"], "dur_s": g["dur_s"], "suggest_trim_s": take})
                need = round(need - take, 1)

    status = "green" if (next_shorter is None or headroom <= 0.05) else ("amber" if headroom <= 8 else "red")

    bridge.log(f"Timeline {dur:.1f}s · dialog {total_dia:.1f}s · B-roll {total_broll:.1f}s (via {used})")
    for t in tgt:
        mark = "✓" if t["ok"] else f"+{t['over_by_s']:.0f}s"
        bridge.log(f"  {t['label']:16} {mark}")
    if trim:
        bridge.log(f"⚠ For å nå {next_shorter}s: kort {headroom:.1f}s — forslag:")
        for c in trim:
            bridge.log(f"    B-roll {c['start_s']:.0f}-{c['end_s']:.0f}s ({c['dur_s']:.0f}s) → kort ~{c['suggest_trim_s']:.0f}s")

    bridge.result({
        "duration_s": round(dur, 2), "fps": fps,
        "targets": tgt, "nearest_target": nearest, "over_nearest_s": over_nearest,
        "broll_gaps": broll, "total_broll_s": total_broll, "total_dialogue_s": total_dia,
        "trim_candidates": trim, "next_shorter_target": next_shorter,
        "headroom_to_next_shorter_s": headroom, "dialogue_source": used, "status": status,
    })


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
