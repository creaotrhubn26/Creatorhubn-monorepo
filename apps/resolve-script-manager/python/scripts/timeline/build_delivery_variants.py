"""Build Delivery Variants — produce multiple Resolve timelines from one set
of approved picks, each tuned to a different deliverable.

Wedding leveranser kommer typisk i 5-7 versjoner per prosjekt:
  teaser     — 30s for sosial-share-teaser
  instagram  — 60s, fokus på climax (9:16 reframe + captions kommer senere)
  gjestebok  — 3-4 min, reception+dance-fokus, ingen lange speeches
  highlight  — 4-6 min, standardlevering (allerede produsert av
               build_highlight_from_picks)
  couple     — 8-10 min, full dekning, par-fokus
  family     — 12-15 min, ekstra ceremony + portrait-dekning
  ceremony   — kun ceremony-chapter

For hver variant lager vi en separat Resolve-timeline. Bruker velger
hvilke variantene som er aktive via `variants` parameter (default: alle).

Pre-requisite: build_highlight_from_picks må ha kjørt slik at
last_highlight_picks.json finnes på disk med chapter-labeled picks.

Param shapes:
  variants:        list[str] — undersett av ['teaser','instagram','gjestebok',
                    'couple','family','ceremony']. Default = alle.
  timelinePrefix:  prefix på timeline-navnene (default: source-basename)
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


# Per-variant configuration. Each variant produces ONE Resolve timeline.
# `target_sec` is target duration. `chapter_mix` overrides the per-chapter
# fraction (None = use whatever is in the picks). `score_floor` filters
# out low-scoring picks (used by teaser to keep only the best).
VARIANTS: dict[str, dict[str, Any]] = {
    "teaser": {
        "label": "Teaser",
        "target_sec": 30.0,
        "max_sec": 35.0,
        "score_floor": 0.65,
        "chapter_mix": None,
        "description": "30s short, only top-scored shots",
    },
    "instagram": {
        "label": "Instagram",
        "target_sec": 60.0,
        "max_sec": 75.0,
        "score_floor": 0.50,
        "chapter_mix": None,
        "description": "60s, IG-feed length (vertical reframe + captions in v2)",
    },
    "gjestebok": {
        "label": "Gjestebok",
        "target_sec": 210.0,  # 3.5 min
        "max_sec": 240.0,
        "score_floor": 0.30,
        "chapter_mix": {"ceremony": 0.20, "reception": 0.40, "dance": 0.40},
        "description": "3-4 min, reception+dance fokus, ingen long-form speeches",
    },
    "couple": {
        "target_sec": 540.0,  # 9 min
        "max_sec": 600.0,
        "label": "Couple",
        "score_floor": 0.0,
        "chapter_mix": {"ceremony": 0.35, "reception": 0.30, "dance": 0.35},
        "description": "8-10 min, full coverage med par-fokus",
    },
    "family": {
        "label": "Family",
        "target_sec": 780.0,  # 13 min
        "max_sec": 900.0,
        "score_floor": 0.0,
        "chapter_mix": {"ceremony": 0.45, "reception": 0.30, "dance": 0.25},
        "description": "12-15 min, ceremony-tung, ekstra family-coverage",
    },
    "ceremony": {
        "label": "Ceremony",
        "target_sec": 240.0,  # 4 min
        "max_sec": 360.0,
        "score_floor": 0.0,
        "chapter_mix": {"ceremony": 1.0},  # ONLY ceremony chapter
        "description": "Kun ceremony-chapter, vow-fokus",
    },
    # ── South Asian multi-event variants ────────────────────────────────
    # Hver event = en egen Resolve-timeline. Forutsetter at picks-cache
    # har chapter-labels matching disse navnene (extract_highlight_from_film
    # med genre=south_asian_wedding genererer disse via signals/chapters.py).
    "mehndi": {
        "label": "Mehndi (Henna)",
        "target_sec": 240.0,
        "max_sec": 360.0,
        "score_floor": 0.30,
        "chapter_mix": {"mehndi": 1.0},
        "description": "Henna-natt — kvinner, latter, henna-designs",
    },
    "sangeet": {
        "label": "Sangeet",
        "target_sec": 300.0,
        "max_sec": 420.0,
        "score_floor": 0.30,
        "chapter_mix": {"sangeet": 1.0},
        "description": "Music-night — choreografierte dance-performances",
    },
    "haldi": {
        "label": "Haldi",
        "target_sec": 180.0,
        "max_sec": 240.0,
        "score_floor": 0.30,
        "chapter_mix": {"haldi": 1.0},
        "description": "Turmeric-ceremony — lekent, gult/oransje, familiær",
    },
    "nikkah": {
        "label": "Nikkah / Pheras",
        "target_sec": 360.0,
        "max_sec": 480.0,
        "score_floor": 0.20,
        "chapter_mix": {"nikkah": 1.0},
        "description": "Selve vielsen — Arabic qabool / saat phere / mandap",
    },
    "walima": {
        "label": "Walima / Reception",
        "target_sec": 360.0,
        "max_sec": 480.0,
        "score_floor": 0.30,
        "chapter_mix": {"reception": 1.0},
        "description": "Walima — reception, food, family-meet-greet",
    },
    "south_asian_full": {
        "label": "South Asian — Full Story",
        "target_sec": 900.0,  # 15 min
        "max_sec": 1080.0,    # 18 min
        "score_floor": 0.0,
        "chapter_mix": {
            "mehndi": 0.13, "sangeet": 0.17, "haldi": 0.10,
            "nikkah": 0.25, "reception": 0.20, "dance": 0.15,
        },
        "description": "Full multi-day pakke (15-18 min) — alle 6 events",
    },
}


def _load_picks() -> dict:
    if not os.path.isfile(CACHE_PATH):
        return {}
    try:
        with open(CACHE_PATH) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _select_picks_for_variant(all_picks: list[dict], cfg: dict) -> list[dict]:
    """Greedy selection respecting variant's target duration + score floor +
    chapter-mix proportions. Returns picks in chronological order."""
    target = cfg["target_sec"]
    cap = cfg["max_sec"]
    floor = cfg.get("score_floor", 0.0)
    chapter_mix = cfg.get("chapter_mix")

    # Filter on score floor
    candidates = [p for p in all_picks if (p.get("score") or 0) >= floor]
    if not candidates:
        # Fall back: relax floor if filter killed everything
        candidates = list(all_picks)

    selected: list[dict] = []
    total = 0.0

    if chapter_mix:
        # Per-chapter quota
        for chap, fraction in chapter_mix.items():
            chap_target = target * fraction
            chap_cap = cap * fraction
            chap_picks = sorted(
                [p for p in candidates if p.get("chapter") == chap],
                key=lambda p: -(p.get("score") or 0),
            )
            chap_total = 0.0
            for p in chap_picks:
                dur = (p.get("endSec") or 0) - (p.get("startSec") or 0)
                if chap_total + dur > chap_cap:
                    continue
                selected.append(p)
                chap_total += dur
                if chap_total >= chap_target:
                    break
            total += chap_total
    else:
        # Plain score-sorted greedy
        scored = sorted(candidates, key=lambda p: -(p.get("score") or 0))
        for p in scored:
            dur = (p.get("endSec") or 0) - (p.get("startSec") or 0)
            if total >= target and total + dur > cap:
                continue
            selected.append(p)
            total += dur
            if total >= cap:
                break

    selected.sort(key=lambda p: float(p.get("startSec") or 0))
    return selected


def _build_timeline_for_variant(
    media_pool, source_item, timeline_name: str, picks: list[dict],
    fps: float,
) -> tuple[bool, int]:
    """Create + populate a Resolve timeline for one variant. Returns
    (success, shotsPlaced)."""
    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.warn(f"CreateEmptyTimeline('{timeline_name}') returned None — name may exist")
        return (False, 0)

    append_specs = []
    for p in picks:
        start_sec = float(p.get("startSec") or 0)
        end_sec = float(p.get("endSec") or 0)
        if end_sec <= start_sec:
            continue
        start_f = int(round(start_sec * fps))
        end_f = int(round(end_sec * fps)) - 1
        if end_f <= start_f:
            continue
        append_specs.append({
            "mediaPoolItem": source_item,
            "startFrame": start_f,
            "endFrame": end_f,
        })

    if not append_specs:
        bridge.warn(f"'{timeline_name}': no valid picks to append")
        return (False, 0)

    placed = media_pool.AppendToTimeline(append_specs)
    count = len(placed) if isinstance(placed, list) else 0
    return (count > 0, count)


def run(params: dict[str, Any], dry_run: bool) -> None:
    variants_requested = params.get("variants") or list(VARIANTS.keys())
    if isinstance(variants_requested, str):
        variants_requested = [v.strip() for v in variants_requested.split(",") if v.strip()]

    invalid = [v for v in variants_requested if v not in VARIANTS]
    if invalid:
        bridge.error(
            f"Unknown variant(s): {invalid}. "
            f"Available: {sorted(VARIANTS.keys())}"
        )
        sys.exit(1)

    cached = _load_picks()
    all_picks = cached.get("picks") or []
    source_video = cached.get("sourceVideo") or ""
    name_prefix = (params.get("timelinePrefix") or "").strip() or (
        os.path.splitext(os.path.basename(source_video))[0] if source_video else "Highlight"
    )

    if not all_picks:
        bridge.error(
            "Ingen approved picks i cache. Kjør extract_highlight_from_film "
            "(med interactiveReview=true) først og approve klipp i UI-en."
        )
        sys.exit(1)
    if not source_video or not os.path.isfile(source_video):
        bridge.error(f"Source video '{source_video}' missing — re-run extract_highlight_from_film")
        sys.exit(1)

    bridge.log(
        f"Building {len(variants_requested)} variants from {len(all_picks)} "
        f"picks of '{os.path.basename(source_video)}'"
    )

    # Pre-compute variant→picks mapping so dry-run can show selection too
    plan: list[dict] = []
    for vname in variants_requested:
        cfg = VARIANTS[vname]
        picks = _select_picks_for_variant(all_picks, cfg)
        plan.append({
            "variant": vname,
            "label": cfg["label"],
            "timelineName": f"{name_prefix} — {cfg['label']}",
            "shotsSelected": len(picks),
            "durationSec": round(
                sum((p.get("endSec") or 0) - (p.get("startSec") or 0) for p in picks), 1
            ),
            "targetSec": cfg["target_sec"],
            "picks": picks,
        })

    if dry_run:
        bridge.result({
            "wouldBuildVariants": [
                {k: v for k, v in p.items() if k != "picks"} for p in plan
            ],
            "totalSourcePicks": len(all_picks),
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)
    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool")
        sys.exit(1)

    bridge.progress(10, 100, "Importing source video…")
    items = media_pool.ImportMedia([source_video]) or []
    if not items:
        bridge.error(f"Could not import {source_video}")
        sys.exit(1)
    source_item = items[0]

    results: list[dict] = []
    for i, entry in enumerate(plan):
        bridge.progress(
            10 + int(85 * (i + 1) / max(1, len(plan))),
            100,
            f"Building '{entry['label']}'…",
        )
        # Resolve timeline-fps comes from project settings — fall back to picks-source fps.
        fps = float(cached.get("fps") or 25)
        bridge.log(
            f"  {entry['variant']}: {entry['shotsSelected']} shots, "
            f"{entry['durationSec']:.0f}s (target {entry['targetSec']:.0f}s)"
        )
        if entry["shotsSelected"] == 0:
            results.append({**{k: v for k, v in entry.items() if k != "picks"},
                            "built": False, "reason": "no_picks_match_criteria"})
            continue
        ok, placed = _build_timeline_for_variant(
            media_pool, source_item, entry["timelineName"], entry["picks"], fps,
        )
        results.append({
            **{k: v for k, v in entry.items() if k != "picks"},
            "built": ok,
            "shotsPlaced": placed,
        })

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "sourceVideo": source_video,
        "totalSourcePicks": len(all_picks),
        "variantsAttempted": len(plan),
        "variantsBuilt": sum(1 for r in results if r.get("built")),
        "variants": results,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
