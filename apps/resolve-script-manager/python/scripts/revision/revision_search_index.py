"""
revision_search_index — bygg et SØKE-INDEKS over ALLE lydklipp i prosjektet.

Daniel-prinsipp 2026-06-28: «du har et søke-system som analyserer alle lydklipp du
har lagt inn i prosjektet». Dette transkriberer hvert opptaker-klipp (recorder-
agnostisk) og lagrer et søkbart indeks {fil → [{t, e, txt}]}, med caching pr fil
(mtime) så det ikke re-transkriberer. Live progress pr fil + pr segment.

params: { audio_paths?[] (ellers brukes media-pool dual-system-kilder), index_path?,
          max_files? }
result: { index_path, files_indexed, total_segments }
"""
from __future__ import annotations
import os, sys, json, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

DEFAULT_INDEX = os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent/revision_search_index.json")

def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    index_path = params.get("index_path", DEFAULT_INDEX)
    paths = params.get("audio_paths")
    if not paths:
        # hent recorder-filene fra media-poolen (dual-system-kilder)
        conn = bridge.ResolveConnection()
        if conn.connect() and conn.require_project():
            import importlib.util
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from revision import revision_dualsystem_sources as src  # type: ignore
        paths = params.get("audio_paths", [])
    paths = [p for p in (paths or []) if os.path.exists(p)]
    if not paths:
        bridge.error("ingen lyd-filer å indeksere (gi audio_paths)"); sys.exit(1)

    idx = {}
    if os.path.exists(index_path):
        try: idx = json.load(open(index_path, encoding="utf-8"))
        except Exception: idx = {}

    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    n = len(paths); total = 0
    for i, p in enumerate(paths, 1):
        mt = os.path.getmtime(p)
        if p in idx and idx[p].get("mtime") == mt:
            total += len(idx[p]["segments"]); bridge.progress(int(100*i/n), 100, f"Cachet {i}/{n}: {os.path.basename(p)}"); continue
        bridge.progress(int(100*i/n), 100, f"Analyserer {i}/{n}: {os.path.basename(p)}")
        w = tempfile.mktemp(suffix=".wav")
        subprocess.run(["ffmpeg","-y","-v","quiet","-i",p,"-ar","16000","-ac","1",w],check=False)
        segs,_ = model.transcribe(w, language="no", vad_filter=True)
        rows = [{"t": round(s.start,2), "e": round(s.end,2), "txt": s.text.strip()} for s in segs]
        os.remove(w)
        idx[p] = {"mtime": mt, "segments": rows}; total += len(rows)
        bridge.log(f"  {os.path.basename(p)}: {len(rows)} segmenter")
    json.dump(idx, open(index_path, "w"), ensure_ascii=False)
    bridge.result({"index_path": index_path, "files_indexed": len(paths), "total_segments": total})

if __name__ == "__main__":
    try: run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
