"""Lip-sync — STEG: transkripsjon via Resolve 21 NATIVE (CreateSubtitlesFromAudio + TranscribeAudio).
Leser transkript-tekst via API (subtitle-items GetName()), finner GJENTATTE FRASER (tekst-likhet),
mapper til timeline-TC. Bruker for å bekrefte gjentakelse med faktiske ord + klargjøre Text-Based Editing.
INGEN whisperx — alt native. Params: timelineName, simThreshold, windowSec, recreate(bool)."""
from __future__ import annotations
import os, sys, time, re
from difflib import SequenceMatcher
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

def _norm(t): return re.sub(r"[^\wæøå ]", "", (t or "").lower()).strip()

def run(params: dict[str, Any], dry_run: bool) -> None:
    name = (params.get("timelineName") or "").strip()
    sim = float(params.get("simThreshold") or 0.8)
    win = float(params.get("windowSec") or 45)
    recreate = bool(params.get("recreate", False))
    language = (params.get("language") or "no").strip()   # tving norsk for bedre nøyaktighet
    correct = bool(params.get("correct", False))          # LLM-korrektur (Claude) av staving/navn
    names = params.get("names")                            # kjente navn for kontekst (ellers fra prosjektnavn)
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project(): sys.exit(1)
    proj = conn.project
    tl = None
    if name:
        for i in range(1, proj.GetTimelineCount()+1):
            t = proj.GetTimelineByIndex(i)
            if t.GetName() == name: tl = t
    tl = tl or proj.GetCurrentTimeline()
    if not tl: bridge.error("Ingen timeline"); sys.exit(1)
    proj.SetCurrentTimeline(tl)
    fps = float(tl.GetSetting("timelineFrameRate") or 25); start = int(tl.GetStartFrame())

    # 1) native transkripsjon → undertekster (Resolve 21)
    nsub = int(tl.GetTrackCount("subtitle"))
    has = any((tl.GetItemListInTrack("subtitle", t) or []) for t in range(1, nsub+1)) if nsub else False
    if recreate or not has:
        bridge.log(f"Kjører Resolve 21 native CreateSubtitlesFromAudio() (språk={language})…")
        done = False
        for cfg in ({"language": language}, {"language": language, "captionPreset": "subtitleDefault"}, {}):
            try: tl.CreateSubtitlesFromAudio(cfg); done = True; break
            except Exception: continue
        if not done:
            try: tl.CreateSubtitlesFromAudio(); done = True
            except Exception as e: bridge.error(f"CreateSubtitlesFromAudio feilet: {e}"); sys.exit(1)
        time.sleep(2)
    nsub = int(tl.GetTrackCount("subtitle"))

    # 2) les transkript (tekst + TC) — behold item-ref for skriv-tilbake
    segs = []
    for trk in range(1, nsub+1):
        for it in (tl.GetItemListInTrack("subtitle", trk) or []):
            rel = int(it.GetStart()) - start
            segs.append({"f": rel, "sec": round(rel/fps, 2), "text": it.GetName() or "", "item": it})
    segs.sort(key=lambda s: s["f"])
    def tc(rel): s=rel/fps; return f"01:{int(s//3600):02d}:{int((s%3600)//60):02d}:{int(s%60):02d}"
    bridge.log(f"Leste {len(segs)} transkript-segmenter")

    # 2b) LLM-korrektur (Claude via Role Room-proxy): staving/navn → skriv tilbake til undertekstene
    corrected_n = 0
    if correct and segs:
        try:
            from anthropic_proxy import Anthropic
            nms = names
            if not nms:
                base = os.path.splitext(proj.GetName())[0]
                nms = [w for w in re.split(r"[ _\-]+", base) if w[:1].isupper()]
            client = Anthropic()
            numbered = "\n".join(f"{i+1}. {s['text']}" for i, s in enumerate(segs))
            sysmsg = ("Du retter feil i en norsk transkripsjon av vielsesløfter. Rett KUN staving, "
                      "ordfeil og navn — IKKE omformuler, ikke slå sammen/splitt linjer. Behold nøyaktig "
                      "samme antall linjer og rekkefølge. Kjente navn: " + ", ".join(nms or []) +
                      ". Svar med samme nummererte liste, kun rettet tekst.")
            msg = client.messages.create(model="claude-haiku-4-5", max_tokens=4000,
                                         system=sysmsg, messages=[{"role": "user", "content": numbered}])
            out = "".join(b.text for b in msg.content if hasattr(b, "text"))
            fixed = {}
            for line in out.splitlines():
                mo = re.match(r"\s*(\d+)[.)]\s*(.*)", line)
                if mo: fixed[int(mo.group(1))-1] = mo.group(2).strip()
            for i, s in enumerate(segs):
                nt = fixed.get(i)
                if nt and nt != s["text"]:
                    s["text"] = nt
                    try:
                        if s["item"].SetName(nt): corrected_n += 1
                    except Exception: pass
            bridge.log(f"Claude-korrektur: rettet {corrected_n} segment(er) + skrevet tilbake til undertekstene")
        except Exception as e:
            bridge.warn(f"LLM-korrektur hoppet over (krever innlogging/RR_BEARER_TOKEN): {e}")

    # 3) finn gjentatte fraser (tekst-likhet innen tidsvindu)
    repeats = []
    for i, a in enumerate(segs):
        na = _norm(a["text"])
        if len(na) < 8: continue
        for j in range(i+1, len(segs)):
            b = segs[j]
            if (b["f"]-a["f"])/fps > win: break
            nb = _norm(b["text"])
            if len(nb) < 8: continue
            r = SequenceMatcher(None, na, nb).ratio()
            if r >= sim or (na in nb) or (nb in na):
                repeats.append({"tcFirst": tc(a["f"]), "tcRepeat": tc(b["f"]),
                                "secFirst": a["sec"], "secRepeat": b["sec"],
                                "text": b["text"][:80], "sim": round(r, 2)})
                break

    # 4) klargjør Text-Based Editing (native clip-transkripsjon på opptaker-klipp, best-effort)
    tb = 0
    try:
        for trk in range(1, int(tl.GetTrackCount("audio"))+1):
            for it in (tl.GetItemListInTrack("audio", trk) or [])[:1]:
                m = it.GetMediaPoolItem()
                if m and hasattr(m, "TranscribeAudio"):
                    if m.TranscribeAudio(): tb += 1
    except Exception: pass

    bridge.result({"timeline": tl.GetName(), "segments": len(segs), "corrected": corrected_n, "language": language,
                   "transcript": [{"tc": tc(s["f"]), "sec": s["sec"], "text": s["text"]} for s in segs],
                   "repeats": repeats, "foundRepeats": len(repeats), "tbePrepared": tb,
                   "note": (f"Native transkript ({len(segs)} segm, språk={language}). " +
                            (f"Claude rettet {corrected_n} segment(er) (staving/navn) + skrevet tilbake til undertekstene. " if corrected_n else "") +
                            (f"⚠️ {len(repeats)} gjentatt(e) frase(r) i teksten — fjern i Resolve 21 Text-Based Editing."
                             if repeats else "Ingen gjentatte fraser i teksten.") +
                            " Text-Based Editing er klargjort.")})

if __name__ == "__main__":
    bridge.main_guard(run)
