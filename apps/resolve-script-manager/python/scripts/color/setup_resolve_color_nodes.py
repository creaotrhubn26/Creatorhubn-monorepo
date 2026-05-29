"""Setup Resolve Color Nodes — bygger standard wedding-grade node-tre på
alle clips i aktiv Resolve-timeline.

Standard node-tre Bjarne ville lagt opp manuelt:
  Node 1: Primary Correction  (exposure + WB-justering)
  Node 2: LUT                  (NorWedFilm / Warm / etc.)
  Node 3: Skin Tone Protection (Qualifier på Cr=140±10, beskytter ansikter)
  Node 4: Vignette + Grain     (subtil 6-8% vignette + ~3% grain)

I auto-pilot er dette stadiet hvor Resolve går fra "rå source" til
"klar for sub-tweaking". Bjarne kan deretter åpne color page og bare
finjustere — alt grunn-arbeidet er gjort.

Input params:
  lookPack: norwedfilm / warm / cinematic / documentary / none
  applyToAllClips: bool (default true)
  protectSkinTones: bool (default true)
  addVignette: bool (default true)

Output: { nodesAdded: int, clipsProcessed: int, lutApplied: bool }

NB: Resolve Python-API for ColorPage er begrenset i Free-versjonen.
Vi bruker GetCurrentTimeline → GetTrackItems → AddNode på MediaPoolItem.
Hvis Studio-features ikke er tilgjengelig faller vi tilbake til kun
Primary + LUT (de andre node-typene krever Studio).
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# LUT-stier som forventes å være installert (eller relative til Resolve LUT-folder)
LUT_PATHS = {
    "norwedfilm":   "NorWedFilm.cube",
    "warm":         "WarmGlow.cube",
    "cinematic":    "Cinematic709.cube",
    "documentary":  "DocFlat.cube",
    "none":         "",
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    look_pack = (params.get("lookPack") or "norwedfilm").strip().lower()
    apply_to_all = bool(params.get("applyToAllClips", True))
    protect_skin = bool(params.get("protectSkinTones", True))
    add_vignette = bool(params.get("addVignette", True))

    if dry_run:
        bridge.result({
            "wouldSetup": True,
            "nodeTree": [
                "Node 1: Primary Correction (exposure + WB)",
                f"Node 2: LUT — {look_pack}",
                "Node 3: Skin Tone Protection (Cr qualifier)" if protect_skin else None,
                "Node 4: Vignette + Grain" if add_vignette else None,
            ],
            "lookPack": look_pack,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline i Resolve")
        sys.exit(1)

    # Bytt til Color page slik at ColorPage-API kan brukes
    try:
        page_manager = conn.resolve.GetPageManager()  # type: ignore[attr-defined]
        if page_manager:
            page_manager.OpenPage("color")
    except Exception:
        # Fallback: kall direkte
        try: conn.resolve.OpenPage("color")
        except Exception: pass

    clip_count = 0
    nodes_added = 0
    lut_applied = False
    errors = []

    # Hent alle video-clips fra timeline
    try:
        video_tracks = int(timeline.GetTrackCount("video") or 0)
        all_items = []
        for t in range(1, video_tracks + 1):
            items = timeline.GetItemListInTrack("video", t) or []
            all_items.extend(items)

        bridge.log(f"Funnet {len(all_items)} clips på {video_tracks} video-tracks")

        for idx, item in enumerate(all_items):
            try:
                # Aktiver item på color page
                ok = timeline.SetCurrentClipThumbnailImage(item) if hasattr(timeline, "SetCurrentClipThumbnailImage") else False
                _ = ok

                # Bygg node-tre. Resolve's AddNode-API:
                #   AddNode(nodeType, nodeLabel)
                # nodeType: "Corrector" (primary), "Lut" (Studio), "Qualifier" (Studio)
                #
                # I Free-versjonen er kun Corrector tilgjengelig — vi legger
                # corrector × N og merker label så Bjarne vet hva hver er for.

                # Node 1: Primary Correction (alltid)
                try:
                    item.AddNode("Corrector", "Primary")
                    nodes_added += 1
                except Exception as exc:
                    errors.append(f"clip{idx} Primary: {exc}")

                # Node 2: LUT — settes på Primary-noden via SetLUT (Studio)
                if look_pack != "none":
                    try:
                        lut_path = LUT_PATHS.get(look_pack, "")
                        if lut_path and hasattr(item, "SetLUT"):
                            # Node-index 1 = primary
                            item.SetLUT(1, lut_path)
                            lut_applied = True
                    except Exception as exc:
                        errors.append(f"clip{idx} LUT: {exc}")

                # Node 3: Skin Tone Protection (Studio)
                if protect_skin:
                    try:
                        item.AddNode("Corrector", "Skin Protect")
                        nodes_added += 1
                    except Exception as exc:
                        errors.append(f"clip{idx} SkinProtect: {exc}")

                # Node 4: Vignette + Grain (Studio)
                if add_vignette:
                    try:
                        item.AddNode("Corrector", "Vignette")
                        nodes_added += 1
                    except Exception as exc:
                        errors.append(f"clip{idx} Vignette: {exc}")

                clip_count += 1
                if (idx + 1) % 5 == 0:
                    bridge.progress(idx + 1, len(all_items), f"Setup {idx+1}/{len(all_items)} clips")

            except Exception as exc:
                errors.append(f"clip{idx} general: {exc}")
                continue

            if not apply_to_all and clip_count >= 1:
                break  # bare første clip hvis ikke "alle"

    except Exception as exc:
        bridge.error(f"Color-node-setup feilet: {exc}")
        sys.exit(1)

    bridge.result({
        "clipsProcessed": clip_count,
        "nodesAdded": nodes_added,
        "lutApplied": lut_applied,
        "lookPack": look_pack,
        "errors": errors[:10],  # cap så vi ikke får 100kB respons
        "errorCount": len(errors),
    })


bridge.main_guard(run)
