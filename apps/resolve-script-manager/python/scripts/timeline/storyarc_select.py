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
# story-arc time budget (share of total) — seremoni størst
BUDGET = {"prelude": .08, "arrival": .12, "ceremony": .20, "portraits": .12,
          "reception": .11, "firstdance": .10, "speeches": .07, "party": .16, "outro": .04}
# per-shot signal weighting per chapter "mood"
PROFILES = {
    "quiet":  {"faces":1.5,"emotional_peak":1.5,"aesthetic":1.3,"bokeh":1.2,"slowmo":1.0,
               "wedding_events":1.2,"color_grade":.8,"speech":.5,"audio":.4,"motion":.2,"action":.1,"audio_events":.3},
    "energy": {"action":1.5,"audio_events":1.3,"motion":1.2,"wedding_events":1.3,"faces":1.0,
               "aesthetic":.8,"emotional_peak":.8,"audio":1.0,"slowmo":.5,"bokeh":.6,"speech":.3,"color_grade":.6},
    "speech": {"emotional_peak":1.5,"faces":1.3,"audio_events":1.3,"aesthetic":1.0,"speech":.8,
               "audio":.8,"wedding_events":.6,"motion":.2,"action":.2,"bokeh":.5,"slowmo":.4},
}
CH_MOOD = {"prelude":"quiet","arrival":"energy","ceremony":"quiet","portraits":"quiet",
           "reception":"energy","firstdance":"quiet","speeches":"speech","party":"energy","outro":"quiet"}
# dedup spread + duration clamp per mood
SPREAD = {"quiet": 9.0, "energy": 6.0, "speech": 12.0}
LEN = {"quiet": (2.5, 7.0), "energy": (1.8, 4.0), "speech": (2.5, 5.0)}


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


def select(all_shots, target, ranges):
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
        lo_len, hi_len = LEN[mood]; gap = SPREAD[mood]
        ranked = sorted(cs, key=lambda s: -weighted(s, mood))
        chosen, used = [], 0.0
        for sh in ranked:
            if used >= budget:
                break
            st = sh["startSec"]
            if any(abs(st - c["startSec"]) < gap for c in chosen):  # temporal dedup
                continue
            dur = max(lo_len, min(hi_len, sh["durationSec"]))
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
    ap.add_argument("--outPath", default=os.path.join(CACHE, "storyarc_picks.json"))
    a = ap.parse_args()
    data = json.load(open(a.allShotsPath))
    ranges = ranges_from(a.cueMapPath)
    picks, total, per_ch = select(data, a.targetSec, ranges)
    out = {"sourceVideo": data.get("sourceVideo"), "timelineName": f"Story-arc {int(round(total/60))}min",
           "minDurationSec": a.targetSec - 30, "maxDurationSec": a.targetSec + 30, "picks": picks}
    json.dump(out, open(a.outPath, "w"), indent=1, ensure_ascii=False)
    print(f"picks {len(picks)} | total {int(total)//60}:{int(total)%60:02d} ({total}s)")
    print("per-chapter:", {k: f"{v}s" for k, v in per_ch.items()})
    print("wrote", a.outPath)


def run(params: dict, dry_run: bool) -> None:
    """Bridge/registry entry — same logic, params-driven."""
    all_path = (params.get("allShotsPath") or os.path.join(CACHE, "last_all_shots.json")).strip()
    if not os.path.isfile(all_path):
        bridge.error("Fant ikke last_all_shots.json — kjør extract_highlight_from_film "
                     "--interactiveReview --useSignals først (den scorer alle shots)."); sys.exit(1)
    target = float(params.get("targetSec") or 720)
    ranges = ranges_from((params.get("cueMapPath") or "").strip())
    data = json.load(open(all_path))
    picks, total, per_ch = select(data, target, ranges)
    out_path = (params.get("outPath") or os.path.join(CACHE, "storyarc_picks.json")).strip()
    out = {"sourceVideo": data.get("sourceVideo"),
           "timelineName": params.get("timelineName") or f"Story-arc {int(round(total/60))}min",
           "minDurationSec": target - 30, "maxDurationSec": target + 30, "picks": picks}
    json.dump(out, open(out_path, "w"), indent=1, ensure_ascii=False)
    bridge.result({"picks": len(picks), "totalSec": total, "perChapter": per_ch, "picksPath": out_path})


if __name__ == "__main__":
    if bridge is not None and any(a.startswith("--params") for a in sys.argv[1:]):
        bridge.main_guard(run)
    else:
        main()
