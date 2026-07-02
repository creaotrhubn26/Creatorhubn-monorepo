"""
«Fullfører replikken?»-vakt.

Lærdom (PetKey): Emily_06 var trimmet midt i «…låne den?» — klippet sluttet
før setningen var ferdig. Denne vakta går gjennom hvert dialog-klipp på
timelinen og sjekker om KILDEN har mer tale rett etter klippets ut-punkt
(dvs. at en replikk er kuttet på slutten).

Metode: for hvert dialog-klipp med kilde-materiale igjen etter ut-punktet
(GetRightOffset), trekk ut kilde-lyden i vinduet [ut .. ut+look_s] og
transkriber. Finnes det tale-ord der → replikken kan være avkuttet.
(Fallback uten kilde-timecode: heuristikk — tale løper helt til klippgrensa
og kilden har mer materiale.)

params: { look_s?(1.5), tail_min_s?(0.25), model?("small"),
          dialogue_tracks?([auto]), music_track? }
result: { clips:[{track,name,end_s,right_room_s,continues,heard_after,status,note}],
          summary:{flagged,checked}, timeline }
"""
from __future__ import annotations
import os, sys, re, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

_WORD = re.compile(r"[a-zæøåA-ZÆØÅ0-9]+")


def _music_track_index(tl):
    for t in range(1, tl.GetTrackCount("audio") + 1):
        nm = (tl.GetTrackName("audio", t) or "")
        if "MASTER" in nm or "music" in nm.lower() or "musikk" in nm.lower():
            return t
    return None


def _source_out_sec(it, srcfps):
    """kilde-ut i sekunder — prøv API, ellers None."""
    for meth in ("GetSourceEndFrame", "GetRightSourceFrame"):
        try:
            f = getattr(it, meth)()
            if f and srcfps:
                return f / srcfps
        except Exception:
            pass
    return None


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    from faster_whisper import WhisperModel

    look = float(params.get("look_s", 1.5))
    tail_min = float(params.get("tail_min_s", 0.25))
    model_name = params.get("model", "small")

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt"); sys.exit(1)
    pr = conn.project
    tl = pr.GetCurrentTimeline()
    fps = float(pr.GetSetting("timelineFrameRate") or 25)
    sfr = tl.GetStartFrame()

    music_t = params.get("music_track") or _music_track_index(tl)
    dtracks = params.get("dialogue_tracks")
    if not dtracks:
        dtracks = [t for t in range(1, tl.GetTrackCount("audio") + 1) if t != music_t]

    # samle dialog-klipp med kilde-materiale igjen etter ut-punktet
    cands = []
    for t in dtracks:
        for it in tl.GetItemListInTrack("audio", t):
            try:
                right = it.GetRightOffset()  # kilde-frames tilgjengelig etter ut
            except Exception:
                right = 0
            mpi = it.GetMediaPoolItem()
            if not mpi:
                continue
            try:
                srcfps = float(mpi.GetClipProperty("FPS") or fps)
            except Exception:
                srcfps = fps
            room = (right or 0) / (srcfps or fps)
            cands.append((t, it, mpi, srcfps, room))

    checkable = [c for c in cands if c[4] > tail_min]
    bridge.log(f"{len(cands)} dialog-klipp · {len(checkable)} har kilde-materiale etter ut-punktet")

    model = None
    clips, flagged = [], 0
    for t, it, mpi, srcfps, room in cands:
        end_s = (it.GetEnd() - sfr) / fps
        name = it.GetName()
        if room <= tail_min:
            clips.append({"track": t, "name": name, "end_s": round(end_s, 2),
                          "right_room_s": round(room, 2), "continues": False,
                          "heard_after": "", "status": "green",
                          "note": "Ingen kilde-materiale etter klippet — hel replikk"})
            continue
        path = mpi.GetClipProperty("File Path")
        out_sec = _source_out_sec(it, srcfps)
        heard = ""
        continues = False
        if path and os.path.exists(path) and out_sec is not None:
            if model is None:
                model = WhisperModel(model_name, device="cpu", compute_type="int8")
            snip = tempfile.mktemp(suffix=".wav")
            subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-ss", f"{out_sec:.3f}",
                            "-t", f"{look:.2f}", "-i", path, "-ar", "16000", "-ac", "1", snip],
                           check=False)
            if os.path.exists(snip):
                segs, _ = model.transcribe(snip, language="no", word_timestamps=False, vad_filter=True)
                heard = " ".join(s.text.strip() for s in segs).strip()
                os.remove(snip)
            continues = len(_WORD.findall(heard)) >= 1
            if continues:
                flagged += 1
                status = "red"
                note = f"Kilden fortsetter: «{heard[:50]}» — replikken kan være avkuttet"
            else:
                status = "green"
                note = f"{room:.1f}s materiale igjen, men ingen tale — hel replikk"
        else:
            # heuristikk uten kilde-timecode: har materiale igjen → mulig kutt
            status = "yellow"
            note = (f"{room:.1f}s kilde-materiale etter ut-punktet "
                    f"(kan ikke lese kilde-tekst — sjekk manuelt at replikken er hel)")
        clips.append({"track": t, "name": name, "end_s": round(end_s, 2),
                      "right_room_s": round(room, 2), "continues": continues,
                      "heard_after": heard[:60], "status": status, "note": note})

    clips.sort(key=lambda c: c["end_s"])
    bridge.log(f"{flagged} klipp kan være avkuttet")
    bridge.result({"clips": clips,
                   "summary": {"flagged": flagged, "checked": len(checkable)},
                   "timeline": tl.GetName()})


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
