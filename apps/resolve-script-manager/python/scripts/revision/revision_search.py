"""
revision_search — søk etter en replikk på tvers av ALLE indekserte lydklipp.

«search target»: skriv inn replikken du vil finne → få alle stedene den sies
(klipp + timecode + tekst + skår), rangert. Bruker indekset fra
revision_search_index. Mennesket velger riktig take (sidesteg auto-justeringen).

params: { query, index_path?, limit? }
result: { query, hits:[{file, basename, t_s, tc, text, score}] }
"""
from __future__ import annotations
import os, sys, json, re, difflib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge
DEFAULT_INDEX = os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent/revision_search_index.json")

def nz(t): return re.sub(r'\s+',' ',re.sub(r'[^a-zæøå ]',' ',t.lower())).strip()

def hms(s):
    s=int(round(s)); return f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}"

def run(params: dict) -> None:
    q = (params.get("query") or "").strip()
    if not q: bridge.error("tom søketekst"); sys.exit(1)
    index_path = params.get("index_path", DEFAULT_INDEX); limit = int(params.get("limit", 20))
    if not os.path.exists(index_path):
        bridge.error("ingen indeks — kjør «Indekser prosjekt-lyd» først"); sys.exit(1)
    idx = json.load(open(index_path, encoding="utf-8"))
    qn = nz(q); qtoks = [t for t in qn.split() if len(t) > 2]
    hits = []
    for path, data in idx.items():
        for s in data.get("segments", []):
            tn = nz(s["txt"])
            ratio = difflib.SequenceMatcher(None, qn, tn).ratio()
            contains = 1.0 if qn and qn in tn else 0.0
            tokhit = sum(1 for t in qtoks if t in tn) / max(1, len(qtoks))
            score = max(ratio, contains, 0.45*ratio + 0.55*tokhit)
            if score >= 0.45:
                hits.append({"file": path, "basename": os.path.basename(path),
                             "t_s": s["t"], "tc": hms(s["t"]), "text": s["txt"], "score": round(float(score),3)})
    hits.sort(key=lambda h: -h["score"]); hits = hits[:limit]
    for h in hits[:12]:
        bridge.log(f"  {h['score']:.2f}  {h['basename']} @ {h['tc']}  «{h['text'][:50]}»")
    bridge.result({"query": q, "hits": hits, "total": len(hits)})

if __name__ == "__main__":
    try: run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
