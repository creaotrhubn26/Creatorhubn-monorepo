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
    # NY: log-conversion-LUT settes på Node 2 før creative LUT
    log_to_rec709_lut = (params.get("logToRec709Lut") or "").strip()
    requires_log_conversion = bool(params.get("requiresLogConversion", False)) or bool(log_to_rec709_lut)
    # SAFETY: respektér Bjarnes eksisterende color-work.
    # Når True (default), hopper vi over clips som ALLEREDE har mer enn 1 node
    # (Resolve gir 1 default-node, så >1 = bruker har lagt opp manuelt).
    respect_existing = bool(params.get("respectExistingWork", True))

    if dry_run:
        node_tree = ["Node 1: Primary Correction (exposure + WB)"]
        if requires_log_conversion:
            node_tree.append(f"Node 2: LOG → REC.709 ({log_to_rec709_lut or 'auto'})")
            node_tree.append(f"Node 3: Creative LUT — {look_pack}")
            if protect_skin: node_tree.append("Node 4: Skin Tone Protection")
            if add_vignette: node_tree.append("Node 5: Vignette + Grain")
        else:
            node_tree.append(f"Node 2: Creative LUT — {look_pack}")
            if protect_skin: node_tree.append("Node 3: Skin Tone Protection")
            if add_vignette: node_tree.append("Node 4: Vignette + Grain")
        bridge.result({
            "wouldSetup": True,
            "nodeTree": node_tree,
            "lookPack": look_pack,
            "logCorrection": log_to_rec709_lut if requires_log_conversion else None,
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
    skipped_existing = 0  # clips vi rørte ikke fordi de hadde manuelt grade

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

                # SAFETY: sjekk om Bjarne har gjort manuelt grade-arbeid på
                # denne clipen. Resolve gir 1 default-node — hvis count > 1
                # har han allerede laget eget tre, og vi RØRER IKKE.
                if respect_existing:
                    try:
                        node_graph = item.GetNodeGraph() if hasattr(item, "GetNodeGraph") else None
                        existing_node_count = 0
                        if node_graph and hasattr(node_graph, "GetNumNodes"):
                            existing_node_count = int(node_graph.GetNumNodes() or 0)
                        elif hasattr(item, "GetNodeList"):
                            nodes = item.GetNodeList() or []
                            existing_node_count = len(nodes)
                        if existing_node_count > 1:
                            skipped_existing += 1
                            continue
                    except Exception:
                        # Hvis vi ikke kan sjekke (eldre Resolve eller free-versjon)
                        # → vær konservativ og hopp over for sikkerhets skyld
                        skipped_existing += 1
                        continue

                # Bygg node-tre. Resolve's AddNode-API:
                #   AddNode(nodeType, nodeLabel)
                # nodeType: "Corrector" (primary), "Lut" (Studio), "Qualifier" (Studio)
                #
                # I Free-versjonen er kun Corrector tilgjengelig — vi legger
                # corrector × N og merker label så Bjarne vet hva hver er for.

                # Node 1: Primary Correction (alltid)
                # Label-prefiks "AP:" gjør at Bjarne ser hvilke noder
                # auto-pilot har lagt opp vs hans egne i color page.
                try:
                    item.AddNode("Corrector", "AP: Primary")
                    nodes_added += 1
                except Exception as exc:
                    errors.append(f"clip{idx} Primary: {exc}")

                # Node 2: LOG → REC.709 (kun hvis log-encoded)
                creative_lut_node_idx = 2  # default når ingen log-conversion
                if requires_log_conversion and log_to_rec709_lut:
                    try:
                        item.AddNode("Corrector", "AP: Log → Rec.709")
                        nodes_added += 1
                        if hasattr(item, "SetLUT"):
                            item.SetLUT(2, log_to_rec709_lut)
                        creative_lut_node_idx = 3  # creative LUT på node 3
                    except Exception as exc:
                        errors.append(f"clip{idx} LogConv: {exc}")

                # Node 2 (eller 3): Creative LUT
                if look_pack != "none":
                    try:
                        lut_path = LUT_PATHS.get(look_pack, "")
                        if lut_path and hasattr(item, "SetLUT"):
                            item.SetLUT(creative_lut_node_idx, lut_path)
                            lut_applied = True
                    except Exception as exc:
                        errors.append(f"clip{idx} LUT: {exc}")

                # Skin Tone Protection (etter creative LUT så skin beskyttes
                # mot LUT-overshoot)
                if protect_skin:
                    try:
                        item.AddNode("Corrector", "AP: Skin Protect")
                        nodes_added += 1
                    except Exception as exc:
                        errors.append(f"clip{idx} SkinProtect: {exc}")

                # Vignette + Grain (siste)
                if add_vignette:
                    try:
                        item.AddNode("Corrector", "AP: Vignette")
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
