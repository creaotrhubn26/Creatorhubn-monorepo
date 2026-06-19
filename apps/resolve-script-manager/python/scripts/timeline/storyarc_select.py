"""Story-arc selector — turns the AI signal dump (last_all_shots.json, every shot
scored by the 17-signal pipeline) into picks that respect WEDDING DRAMATURGY,
fixing the auto-picker's blind spot (it under-weights the quiet sacred/emotional
core and over-weights energy/speech, with no dedup).

Method:
  1. Re-chapter every shot by SOURCE-time ranges (cue_map) — robust vs the auto
     chapter-labels which mislabel milni as ceremony etc.
  2. Give each chapter a TIME BUDGET (story-arc share: ceremony biggest).
  3. Score shots with a CHAPTER-SPECIFIC signal weighting — quiet chapters reward
     faces/emotion/aesthetic/bokeh; energy chapters reward action/audio/motion.
  4. Greedily fill each chapter's budget by score with a TEMPORAL-SPREAD guard
     (dedup near-identical consecutive shots).
  5. Output chronological, build-compatible picks.json.

Input:
  allShotsPath:  path to last_all_shots.json (default: app cache)
  targetSec:     total target (default 720 = 12 min)
  cueMapPath:    optional cue_map.json (chapter source ranges); else wedding default
  outPath:       where to write picks (default: alongside, _storyarc.json)

Output: { picks, totalSec, perChapter }
"""
from __future__ import annotations
import argparse, json, os, sys

CACHE = os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent")

try:  # bridge for app/registry invocation; optional for plain CLI use
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    import bridge  # type: ignore
except Exception:  # noqa: BLE001
    bridge = None

# chapter (source seconds). Override via cue_map.json.
DEFAULT_RANGES = [
    ("prelude", 0, 285), ("arrival", 285, 1180), ("ceremony", 1180, 1700),
    ("portraits", 1700, 2090), ("reception", 2090, 2395), ("firstdance", 2395, 2610),
    ("speeches", 2610, 3000), ("party", 3000, 3954), ("outro", 3954, 10**9),
]
# story-arc time budget (share of total) — seremoni størst.
# Talene har sin EGEN video (egen timeline) → highlighten skal ikke hakke dem;
# speeches får lite budsjett og kun REAKSJONER (ikke snakkende hoder).
BUDGET = {"prelude": .08, "arrival": .12, "ceremony": .21, "portraits": .13,
          "reception": .11, "firstdance": .10, "speeches": .03, "party": .18, "outro": .04}
# per-shot signal weighting per chapter "mood"
PROFILES = {
    "quiet":  {"faces":1.5,"emotional_peak":1.5,"aesthetic":1.3,"bokeh":1.2,"slowmo":1.0,
               "wedding_events":1.2,"color_grade":.8,"speech":.5,"audio":.4,"motion":.2,"action":.1,"audio_events":.3},
    "energy": {"action":1.5,"audio_events":1.3,"motion":1.2,"wedding_events":1.3,"faces":1.0,
               "aesthetic":.8,"emotional_peak":.8,"audio":1.0,"slowmo":.5,"bokeh":.6,"speech":.3,"color_grade":.6},
    # "speech" i highlighten = REAKSJONER (applaus/latter/rørte ansikter), IKKE snakkende
    # hoder (talen lever i egen tale-video). Derfor: høy emotional/faces/audio_events,
    # LAV speech-vekt så vi unngår oppkuttede talking-head-fragmenter.
    "speech": {"emotional_peak":1.6,"faces":1.4,"audio_events":1.6,"aesthetic":1.0,"speech":.1,
               "audio":.6,"wedding_events":.6,"motion":.3,"action":.4,"bokeh":.6,"slowmo":.5},
}
CH_MOOD = {"prelude":"quiet","arrival":"energy","ceremony":"quiet","portraits":"quiet",
           "reception":"energy","firstdance":"quiet","speeches":"speech","party":"energy","outro":"quiet"}
# Pacing-presets — VELGBARE. Hver styrer mellomrom (flyt), klipp-lengde, hero-hold
# på brudeparet, og min couple-hold. «smooth» = færrest/lengst kutt (mykest flyt).
PACING = {
    "smooth": {
        "spread": {"quiet": 11.0, "energy": 7.5, "speech": 13.0},
        "len": {"quiet": (3.5, 9.0), "energy": (2.5, 5.5), "speech": (3.0, 6.0)},
        "hero_len": {"portraits": (5.0, 10.0), "firstdance": (5.0, 9.0)},
        "couple_hold": 6.5,
    },
    "balanced": {
        "spread": {"quiet": 9.0, "energy": 6.0, "speech": 12.0},
        "len": {"quiet": (2.5, 7.0), "energy": (1.8, 4.5), "speech": (2.5, 5.0)},
        "hero_len": {"portraits": (4.0, 8.0), "firstdance": (4.0, 7.0)},
        "couple_hold": 5.0,
    },
    "punchy": {
        "spread": {"quiet": 7.0, "energy": 4.5, "speech": 10.0},
        "len": {"quiet": (2.0, 5.0), "energy": (1.5, 3.5), "speech": (2.0, 4.0)},
        "hero_len": {"portraits": (3.0, 6.0), "firstdance": (3.0, 5.0)},
        "couple_hold": 3.5,
    },
}


def ranges_from(cue_path):
    if cue_path and os.path.isfile(cue_path):
        try:
            return [(c["chapter"], c["srcLo"], c["srcHi"]) for c in json.load(open(cue_path))]
        except Exception:
            pass
    return DEFAULT_RANGES


def chapter_for(s, ranges):
    for name, lo, hi in ranges:
        if lo <= s < hi:
            return name
    return "misc"


def weighted(shot, mood):
    prof = PROFILES[mood]; sig = shot.get("signals") or {}
    sc = 0.0
    for k, w in prof.items():
        v = sig.get(k, shot.get(k, 0.0)) or 0.0
        sc += w * float(v)
    # small exposure quality penalty if available (0 = ok in this pipeline)
    return sc


def select(all_shots, target, ranges, cfg=None, couple_hold=None):
    cfg = cfg or PACING["smooth"]
    SPREAD = cfg["spread"]; LEN = cfg["len"]; HERO_LEN = cfg["hero_len"]
    COUPLE_HOLD = couple_hold if couple_hold is not None else cfg["couple_hold"]
    shots = all_shots["shots"]
    by_ch = {}
    for sh in shots:
        ch = chapter_for(sh["startSec"], ranges)
        by_ch.setdefault(ch, []).append(sh)
    picks = []
    per_ch = {}
    for name, lo, hi in ranges:
        cs = by_ch.get(name, [])
        if not cs:
            continue
        mood = CH_MOOD.get(name, "energy")
        budget = BUDGET.get(name, 0.1) * target
        lo_len, hi_len = HERO_LEN.get(name, LEN[mood]); gap = SPREAD[mood]
        ranked = sorted(cs, key=lambda s: -weighted(s, mood))
        chosen, used = [], 0.0
        for sh in ranked:
            if used >= budget:
                break
            st = sh["startSec"]
            if any(abs(st - c["startSec"]) < gap for c in chosen):  # temporal dedup
                continue
            dur = max(lo_len, min(hi_len, sh["durationSec"]))
            # Lengre hold på brudeparet på location: portretter/first dance, eller et
            # rolig, estetisk shot med ansikter (par) → hold lenger for cinematisk flyt.
            sig = sh.get("signals") or {}
            couple_hero = name in HERO_LEN or (
                sig.get("faces", 0) >= 0.8 and sig.get("aesthetic", 0) >= 0.33
                and (sh.get("motion", 1.0)) <= 0.12)
            if couple_hero:
                dur = min(hi_len, max(dur, COUPLE_HOLD))
            chosen.append({"startSec": round(st, 2), "endSec": round(st + dur, 2),
                           "durationSec": round(dur, 2), "chapter": name,
                           "score": round(weighted(sh, mood), 3),
                           "signals": sh.get("signals"), "_idx": sh["index"]})
            used += dur
        chosen.sort(key=lambda c: c["startSec"])
        per_ch[name] = round(used, 1)
        picks += chosen
    picks.sort(key=lambda c: c["startSec"])
    t = 0.0
    for i, p in enumerate(picks):
        p["index"] = i; p["timelineIn"] = round(t, 1); t += p["durationSec"]
    return picks, round(t, 1), per_ch


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--allShotsPath", default=os.path.join(CACHE, "last_all_shots.json"))
    ap.add_argument("--targetSec", type=float, default=720)
    ap.add_argument("--cueMapPath", default="")
    ap.add_argument("--pacing", default="smooth", choices=list(PACING))
    ap.add_argument("--coupleHoldSec", type=float, default=None)
    ap.add_argument("--outPath", default=os.path.join(CACHE, "storyarc_picks.json"))
    a = ap.parse_args()
    data = json.load(open(a.allShotsPath))
    ranges = ranges_from(a.cueMapPath)
    picks, total, per_ch = select(data, a.targetSec, ranges, PACING[a.pacing], a.coupleHoldSec)
    out = {"sourceVideo": data.get("sourceVideo"), "timelineName": f"Story-arc {int(round(total/60))}min",
           "minDurationSec": a.targetSec - 30, "maxDurationSec": a.targetSec + 30, "picks": picks}
    json.dump(out, open(a.outPath, "w"), indent=1, ensure_ascii=False)
    print(f"picks {len(picks)} | total {int(total)//60}:{int(total)%60:02d} ({total}s)")
    print("per-chapter:", {k: f"{v}s" for k, v in per_ch.items()})
    print("wrote", a.outPath)


def build_in_resolve(source_video, picks, timeline_name, src_fps):
    """Bygg picks rett inn i en NY Resolve-timeline (ikke-destruktivt). Source-frames."""
    if bridge is None:
        return None
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return None
    mp = conn.project.GetMediaPool()
    items = mp.ImportMedia([source_video]) or []
    if not items:
        bridge.warn("Kunne ikke importere kilde for bygg"); return None
    src = items[0]; name = timeline_name
    tl = mp.CreateEmptyTimeline(name)
    if not tl:
        for n in range(2, 100):
            tl = mp.CreateEmptyTimeline(f"{name} {n}")
            if tl:
                name = f"{name} {n}"; break
    if not tl:
        bridge.warn("Kunne ikke opprette timeline"); return None
    conn.project.SetCurrentTimeline(tl)
    specs = []
    for p in picks:
        sf = int(round(p["startSec"] * src_fps)); ef = int(round(p["endSec"] * src_fps)) - 1
        if ef > sf:
            specs.append({"mediaPoolItem": src, "startFrame": sf, "endFrame": ef})
    placed = mp.AppendToTimeline(specs)
    return {"timeline": name, "placed": len(placed) if isinstance(placed, list) else 0}


def run(params: dict, dry_run: bool) -> None:
    """Bridge/registry entry — VELGBARE valg: pacing/flyt, par-hold, lengde,
    + valgfri bygg-rett-i-Resolve."""
    all_path = (params.get("allShotsPath") or os.path.join(CACHE, "last_all_shots.json")).strip()
    if not os.path.isfile(all_path):
        bridge.error("Fant ikke last_all_shots.json — kjør extract_highlight_from_film "
                     "--interactiveReview --useSignals først (den scorer alle shots)."); sys.exit(1)
    target = float(params.get("targetSec") or 720)
    pacing = (params.get("pacing") or "smooth").strip().lower()
    cfg = PACING.get(pacing, PACING["smooth"])
    couple_hold = params.get("coupleHoldSec")
    couple_hold = float(couple_hold) if couple_hold not in (None, "") else None
    ranges = ranges_from((params.get("cueMapPath") or "").strip())
    data = json.load(open(all_path))
    picks, total, per_ch = select(data, target, ranges, cfg, couple_hold)
    out_path = (params.get("outPath") or os.path.join(CACHE, "storyarc_picks.json")).strip()
    tl_name = params.get("timelineName") or f"Story-arc {pacing} {int(round(total/60))}min"
    out = {"sourceVideo": data.get("sourceVideo"), "timelineName": tl_name,
           "minDurationSec": target - 30, "maxDurationSec": target + 30, "picks": picks}
    json.dump(out, open(out_path, "w"), indent=1, ensure_ascii=False)
    result = {"picks": len(picks), "totalSec": total, "perChapter": per_ch,
              "picksPath": out_path, "pacing": pacing}
    # Valgfritt: bygg rett i Resolve (ellers bare picks-fil for review/senere build).
    if bool(params.get("buildInResolve")) and not dry_run:
        bridge.progress(85, 100, "Bygger i Resolve…")
        built = build_in_resolve(data.get("sourceVideo"), picks, tl_name,
                                 float(data.get("fps") or 25))
        if built:
            result["builtTimeline"] = built["timeline"]; result["placed"] = built["placed"]
    bridge.result(result)


if __name__ == "__main__":
    if bridge is not None and any(a.startswith("--params") for a in sys.argv[1:]):
        bridge.main_guard(run)
    else:
        main()
