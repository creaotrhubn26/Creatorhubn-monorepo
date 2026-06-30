"""
revision_dualsystem_sources — hvor finner systemet ekstern-opptaker-lyden?

Daniel-prinsipp 2026-06-28: opptaker-filene ligger ofte ALLEREDE i Resolve-
prosjektet (bins som «Audio/Barn», «Malene», «Bendik»). Da skal systemet IKKE
spørre brukeren om en mappe i blinde — det skal sjekke media-poolen FØRST.

Reaksjon (kilde-oppløsning, i rekkefølge):
  1. SCAN media pool → ekstern-opptaker-kandidater (recorder-agnostisk: .wav/.bwf,
     ikke musikk/genererte mastere, helst i mygg-aktige bins).
  2. Hvis funnet → bruk dem direkte (ingen mappe-prompt).
  3. Hvis ingen → UI spør «har du ekstern opptaker?» → bruker peker på mappe.

result: { in_project:[{bin,file,path,dur}], source: "mediapool"|"ask_folder" }
"""
from __future__ import annotations
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

AUDIO_EXT = (".wav", ".bwf", ".aif", ".aiff", ".flac")
MIC_HINT = ("barn", "malene", "bendik", "emily", "mic", "mygg", "tascam", "zoom",
            "recorder", "opptak", "lav", "dr-10", "mixpre", "audio")

def _is_recorder(path: str, bin_name: str) -> bool:
    low = path.lower()
    if not low.endswith(AUDIO_EXT): return False
    if "musikk" in low or "music" in low: return False        # musikk-bed
    if low.endswith((".mp3",)): return False
    if os.sep + "es_" in low or "watermark" in low: return False  # lisensiert musikk
    if "dog_some" in low or "cat_master" in low or "_master_audio" in low \
       or "music_ducked" in low or "dialogue_" in low or "_bed.wav" in low:
        return False                                          # genererte mastere/stems
    if "speechgen" in low: return False                       # TTS
    return True                                               # gjenstår = sannsynlig opptaker-lyd

def run(params: dict) -> None:
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    mp = conn.project.GetMediaPool(); root = mp.GetRootFolder()
    found = []
    def walk(f, path=""):
        name = f.GetName(); p = f"{path}/{name}"
        mic_bin = any(h in name.lower() for h in MIC_HINT)
        for c in (f.GetClipList() or []):
            fp = c.GetClipProperty("File Path") or ""
            if _is_recorder(fp, name):
                found.append({"bin": p, "file": os.path.basename(fp), "path": fp,
                              "dur": c.GetClipProperty("Duration") or "", "mic_bin": mic_bin})
        for sub in (f.GetSubFolderList() or []): walk(sub, p)
    walk(root)
    bins = sorted({r["bin"] for r in found})
    for b in bins:
        n = len([r for r in found if r["bin"] == b])
        bridge.log(f"  📁 {b}: {n} opptaker-filer")
    src = "mediapool" if found else "ask_folder"
    bridge.log(f"→ {len(found)} ekstern-opptaker-filer i prosjektet ({len(bins)} bins). Kilde: {src}")
    bridge.result({"in_project": found, "bins": bins, "source": src,
                   "count": len(found)})

if __name__ == "__main__":
    try: run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
