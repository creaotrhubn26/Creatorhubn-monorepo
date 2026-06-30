"""Frittstående selvtest av revisjons-motoren — ingen Resolve/UI nødvendig."""
import os, sys, json, subprocess
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))  # python/
PY=sys.executable

FB=("Musikk og stemme går veldig opp og ned. Kan du jevne dette bedre ut?\n"
    "Bytt ut første sang med Did You Try Your Best.\n"
    "Etter at hun har vasket av skoene, bytt musikk til Impossible Theory.\n"
    "Bygg opp stemningen gradvis slik vi gjorde i forrige video.\n"
    "Lydnivået når Benik sier trodde du gjorde det er altfor høyt og skurrer. Dette må justeres ned.\n"
    "Når PetKey-appen vises, bytt musikk til Natalie.")

def run_script(rel, params):
    p=subprocess.run([PY, os.path.join(HERE, rel), f"--params={json.dumps(params)}"],
                     capture_output=True, text=True)
    res=None
    for line in p.stdout.splitlines():
        try:
            o=json.loads(line)
            if o.get("type")=="result": res=o["value"]
            elif o.get("type") in ("warn","error"): print("   ·", o.get("message"))
        except Exception: pass
    return res

print("=== 1) INGEST ===")
ing=run_script("revision_ingest.py", {"feedback": FB})
print("source:", ing["source"])
for it in ing["items"]:
    print(f"  [{it['target']}/{it['intent']}] anchor={it['anchor']!r}  {it['text'][:46]!r}")

print("\n=== 2) EVALUATE (PetKey-resultat) ===")
# bygg en liten spec som speiler PetKey-jobben + de målte tallene
spec={"job":"PetKey SoMe","timeline":"Pet Key SoMe (R5) v2","fps":25,"start_tc":"01:00:00:00","duration_s":90,
 "feedback":[
   {"id":"f1","text":"Jevn ut musikk/stemme","target":"audio","intent":"level"},
   {"id":"f2","text":"Bytt første sang -> Did You Try Your Best","target":"audio","intent":"replace"},
   {"id":"f3","text":"Bendik trodde du gjorde det for høyt","target":"audio","intent":"level"},
   {"id":"f4","text":"Når appen vises -> Natalie","target":"audio","intent":"timing"},
   {"id":"f5","text":"Bygg stemningen gradvis","target":"audio","intent":"transition"},
   {"id":"f6","text":"Levering -14 LUFS","target":"audio","intent":"level"}],
 "changes":[
   {"id":"c1","feedback_id":"f1","fixer":"dialogue_normalize","evaluator":"dialogue_evenness","expect":{"max_spread_db":4.0}},
   {"id":"c2","feedback_id":"f2","fixer":"music_replace","evaluator":"music_at","expect":{"song":"Did You Try Your Best","at_tc":"01:00:00:00"}},
   {"id":"c3","feedback_id":"f3","fixer":"clip_level","evaluator":"peak_ceiling","expect":{"max_peak_db":-3.0}},
   {"id":"c4","feedback_id":"f4","fixer":"music_replace","evaluator":"music_at","expect":{"song":"Natalie","at_tc":"01:01:23:00"}},
   {"id":"c5","feedback_id":"f5","fixer":"build_curve","evaluator":"manual","expect":{}},
   {"id":"c6","feedback_id":"f6","fixer":"loudness","evaluator":"loudness_target","expect":{"target_lufs":-14.0,"tol":1.0}}]}
meas={"dialogue_rms_spread_db":1.5,"peak_db":-3.0,"integrated_lufs":-14.0,
      "music_segments":[{"song":"Did You Try Your Best - Alec Slayne","tl_in_tc":"01:00:00:00"},
                        {"song":"Impossible Theory - Rachel Sandy","tl_in_tc":"01:00:15:13"},
                        {"song":"Natalie (Instrumental Version) - Particle House","tl_in_tc":"01:01:18:12"}]}
ev=run_script("revision_evaluate.py", {"spec":spec,"measurements":meas})
for r in ev["results"]:
    icon="✅" if r["passed"] is True else ("⚠️" if r["passed"] is None else "❌")
    print(f"  {icon} {r['feedback'][:40]:40} {r['evidence']}")
print("  summary:", ev["summary"])
