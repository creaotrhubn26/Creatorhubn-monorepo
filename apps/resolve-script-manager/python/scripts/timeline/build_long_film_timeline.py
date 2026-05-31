"""Build Long-Film Timeline — ekte wedding-film m/ FULL ceremony, vows og
speeches + topp dans-shots. Bruker ALLE detekterte shots, ikke bare picks.

Forskjellig fra delivery_variants 'long_film':
  - delivery_variants leser bare PICKS-cache → samme klipp som highlight
  - dette scriptet leser ALL_SHOTS-cache → får hele dagen

Algoritme:
  1. Last last_all_shots.json med shot_scores + chapter-labels
  2. For 'preserved' chapters (ceremony, vows, speeches, first_dance):
     → inkluder ALLE shots i kronologisk rekkefølge
  3. For 'curated' chapters (reception, dance, mehndi, etc.):
     → ta topp 60-70% av shots scoret etter score
  4. For shots uten chapter (mellomklipp, b-roll):
     → ta topp 50%
  5. Sortér chronologisk → bygg timeline 30-60 min

Input:
  cachePath:       default ~/Library/.../last_all_shots.json
  sourceVideo:     fra cache hvis ikke gitt
  timelineName:    default "<source> — Long Film"
  preservedChapters: list[str], default ['ceremony','vows','speeches','first_dance','nikkah']
  curatedFraction:  float 0-1, default 0.65 (topp X% av non-preserved chapters)
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
DEFAULT_PRESERVED = ["ceremony", "vows", "speeches", "first_dance",
                      "nikkah", "pheras", "qabool"]


def run(params: dict[str, Any], dry_run: bool) -> None:
    cache_path = (params.get("cachePath") or "").strip() or os.path.join(
        CACHE_DIR, "last_all_shots.json"
    )
    timeline_name = (params.get("timelineName") or "").strip()
    preserved = params.get("preservedChapters") or DEFAULT_PRESERVED
    curated_fraction = float(params.get("curatedFraction") or 0.65)
    audio_mix = (params.get("audioMix") or "source").strip()  # behold original audio

    if not os.path.isfile(cache_path):
        bridge.error(f"All-shots cache mangler: {cache_path}. Kjør extract_highlight_from_film først.")
        sys.exit(1)

    try:
        with open(cache_path) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        bridge.error(f"Could not read cache: {exc}")
        sys.exit(1)

    source_video = data.get("sourceVideo") or params.get("sourceVideo")
    fps = float(data.get("fps") or 25.0)
    all_shots = data.get("shots") or []

    if not all_shots:
        bridge.error("No shots in cache")
        sys.exit(1)

    if not timeline_name:
        base = os.path.splitext(os.path.basename(source_video or "Untitled"))[0]
        timeline_name = f"{base} — Long Film"

    # Velg shots
    preserved_set = set(c.lower() for c in preserved)
    preserved_shots = []
    curated_candidates: dict[str, list[dict]] = {}
    no_chapter_shots = []

    for s in all_shots:
        ch = (s.get("chapter") or "").lower()
        if not ch:
            no_chapter_shots.append(s)
        elif ch in preserved_set:
            preserved_shots.append(s)
        else:
            curated_candidates.setdefault(ch, []).append(s)

    # Curated chapters: topp X% per chapter
    curated_selected = []
    for ch, shots in curated_candidates.items():
        shots_sorted = sorted(shots, key=lambda x: -(x.get("score") or 0))
        n = max(1, int(len(shots_sorted) * curated_fraction))
        curated_selected.extend(shots_sorted[:n])
        bridge.log(f"  Chapter '{ch}': beholder {n}/{len(shots)} shots")

    # B-roll: topp 50%
    no_chapter_sorted = sorted(no_chapter_shots, key=lambda x: -(x.get("score") or 0))
    no_chapter_selected = no_chapter_sorted[:max(1, len(no_chapter_sorted) // 2)]

    # Combine + sortér chronologisk
    final = preserved_shots + curated_selected + no_chapter_selected
    final.sort(key=lambda s: float(s.get("startSec") or 0))

    total_dur = sum((s.get("durationSec") or 0) for s in final)
    bridge.log(
        f"Long Film: {len(final)} shots, {total_dur:.0f}s "
        f"({total_dur/60:.1f} min) | preserved={len(preserved_shots)}, "
        f"curated={len(curated_selected)}, b-roll={len(no_chapter_selected)}"
    )

    if dry_run:
        bridge.result({
            "wouldBuild": timeline_name,
            "shotsTotal": len(final),
            "durationSec": round(total_dur, 1),
            "durationMin": round(total_dur / 60, 1),
            "breakdown": {
                "preserved": len(preserved_shots),
                "curated": len(curated_selected),
                "broll": len(no_chapter_selected),
            },
        })
        return

    # Bygg i Resolve
    bridge.progress(0, 100, "Connecting to Resolve…")
    conn = bridge.ResolveConnection()
    if not conn.connect():
        sys.exit(1)
    if not conn.project:
        bridge.error("No project open")
        sys.exit(1)

    media_pool = conn.media_pool
    if not media_pool:
        bridge.error("Could not get MediaPool")
        sys.exit(1)

    # Import source-video (eller bruk eksisterende MediaPool-item)
    bridge.progress(10, 100, "Importerer source-video …")
    source_items = media_pool.ImportMedia([source_video])
    if not source_items:
        # Sannsynligvis allerede importert — finn det
        root_folder = media_pool.GetRootFolder()
        for item in root_folder.GetClipList() or []:
            try:
                if item.GetClipProperty("File Path") == source_video:
                    source_items = [item]
                    break
            except Exception:  # noqa: BLE001
                continue
    if not source_items:
        bridge.error(f"Could not import or find source: {source_video}")
        sys.exit(1)

    source_item = source_items[0]

    # Lag tom timeline + legg til hver shot via AppendToTimeline
    bridge.progress(20, 100, f"Lager timeline '{timeline_name}' …")
    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.error("CreateEmptyTimeline returned None")
        sys.exit(1)

    clips_to_append = []
    for s in final:
        start_f = int(round(float(s["startSec"]) * fps))
        end_f = int(round(float(s["endSec"]) * fps))
        clips_to_append.append({
            "mediaPoolItem": source_item,
            "startFrame": start_f,
            "endFrame": end_f,
        })

    bridge.progress(40, 100, f"Legger til {len(clips_to_append)} klipp på timeline …")
    appended = media_pool.AppendToTimeline(clips_to_append)
    placed = len(appended) if appended else 0

    bridge.progress(100, 100, "Long Film ferdig")
    bridge.log(f"Lagt til {placed}/{len(clips_to_append)} klipp i timeline")
    bridge.result({
        "timelineName": timeline_name,
        "shotsRequested": len(clips_to_append),
        "shotsPlaced": placed,
        "totalDurationSec": round(total_dur, 1),
        "audioMix": audio_mix,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
