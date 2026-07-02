"""
Leverings-QC (AI-vakt etter render).

Filosofi: timelinen (menneskets sync + rettede undertekster) er fasit. AI rører
den ikke — AI verifiserer at den ferdige fila faktisk BEVARER håndverket:
transkriberer output og sammenligner ord-for-ord mot timeline-underteksten.

Per replikk-blokk får du:
  grønn  = talen er der og ligger på undertekst-tida (|drift| innen toleranse, tekst matcher)
  gul    = talen er der, men driver mot underteksten (nudge foreslått), eller delvis tekst-treff
  rød    = ingen tale i vinduet (manglende), eller talen er avkuttet på slutten

Fanger nøyaktig feilene fra PetKey SoMe: «Emily fullfører ikke», «subs falt ut»,
«usync» — FØR levering, ikke etter.

params: { video_path (påkr.), lead_tol_s?(0.6), lag_tol_s?(0.4),
          model?("small"), window_s?(1.2) }
result: { lines:[{t,end,sub_text,heard_text,drift_s,coverage,status,note}],
          summary:{green,yellow,red,total,median_drift_s}, video_path }
"""
from __future__ import annotations
import os, sys, re, subprocess, tempfile
from difflib import SequenceMatcher
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

_WORD = re.compile(r"[a-zæøåA-ZÆØÅ0-9]+")


def _norm(t):
    return _WORD.findall((t or "").lower().replace("é", "e"))


def _fuzzy_hit(word, heard_set):
    """toler whisper-stavefeil: eksakt, prefiks (≥4), eller ratio ≥ 0.8."""
    if word in heard_set:
        return True
    for h in heard_set:
        if len(word) >= 4 and (h.startswith(word[:4]) or word.startswith(h[:4])):
            return True
        if SequenceMatcher(None, word, h).ratio() >= 0.8:
            return True
    return False


def _coverage(sub_words, heard_words):
    """andel av undertekst-ord gjenkjent i hørt tale (fuzzy, 0..1)."""
    if not sub_words:
        return 1.0
    hs = set(heard_words)
    return sum(1 for w in sub_words if _fuzzy_hit(w, hs)) / len(sub_words)


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np  # noqa
    from faster_whisper import WhisperModel

    video_path = params.get("video_path")
    if not video_path or not os.path.exists(video_path):
        bridge.error("video_path mangler/finnes ikke"); sys.exit(1)
    lead_tol = float(params.get("lead_tol_s", 0.6))   # undertekst foran tale (naturlig)
    lag_tol = float(params.get("lag_tol_s", 0.4))     # undertekst bak tale (verre)
    win = float(params.get("window_s", 1.2))
    model_name = params.get("model", "small")

    # --- timeline-undertekst = fasit ---
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt"); sys.exit(1)
    pr = conn.project
    tl = pr.GetCurrentTimeline()
    fps = float(pr.GetSetting("timelineFrameRate") or 25)
    sfr = tl.GetStartFrame()
    subs = []
    for st in range(1, tl.GetTrackCount("subtitle") + 1):
        for it in tl.GetItemListInTrack("subtitle", st):
            subs.append([(it.GetStart() - sfr) / fps, (it.GetEnd() - sfr) / fps, it.GetName()])
    subs.sort()
    if not subs:
        bridge.error("Timelinen har ingen undertekster å verifisere mot"); sys.exit(1)
    bridge.log(f"{len(subs)} undertekst-blokker fra timeline «{tl.GetName()}»")

    # --- transkriber output ---
    wav = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", video_path,
                    "-ar", "16000", "-ac", "1", wav], check=False)
    bridge.log("Transkriberer levert fil …")
    m = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(wav, language="no", word_timestamps=True, vad_filter=False)
    words = [(w.start, w.end, w.word.strip()) for s in segs for w in (s.words or [])]
    os.remove(wav)
    bridge.log(f"{len(words)} ord transkribert")

    lines, drifts = [], []
    g = y = r = 0
    for s, e, text in subs:
        sub_words = _norm(text)
        # ord som overlapper blokk-vinduet
        w0, w1 = s - win, e + win
        inwin = [(ws, we, wt) for ws, we, wt in words if we > w0 and ws < w1]
        heard_words = _norm(" ".join(wt for _, _, wt in inwin))
        cov = _coverage(sub_words, heard_words)
        heard_text = " ".join(wt for _, _, wt in inwin)

        if not inwin or cov < 0.25:
            # kan være en on-screen-etikett (ikke tale) ELLER manglende replikk
            status, note = "red", "Ingen tale gjenkjent — sjekk om replikk mangler (eller om dette er en skjerm-tekst)"
            r += 1
            drift = None
        else:
            # drift: onset av første matchende ord vs undertekst-start (fuzzy)
            hs = set(heard_words)
            first = None
            for ws, we, wt in inwin:
                nw = _norm(wt)
                if nw and _fuzzy_hit(nw[0], set(sub_words)):
                    first = ws; break
            if first is None:
                first = inwin[0][0]
            drift = round(first - s, 2)   # +: tale kommer etter sub (sub foran) ; -: tale før sub
            drifts.append(drift)
            # avkuttet: siste undertekst-ord ikke hørt (mykt flagg — musikk kan maskere)
            last_sub = sub_words[-1] if sub_words else None
            cut = last_sub is not None and not _fuzzy_hit(last_sub, hs) and cov < 0.7
            if cut:
                status, note = "yellow", f"Siste ord «{last_sub}» ikke tydelig hørt — bekreft at replikken er hel (kan være musikk-maskering)"
                y += 1
            elif drift > lead_tol:
                status, note = "yellow", f"Undertekst {drift:.1f}s foran talen — vurder å flytte teksten senere"
                y += 1
            elif drift < -lag_tol:
                status, note = "yellow", f"Undertekst {-drift:.1f}s bak talen — vurder å flytte teksten tidligere"
                y += 1
            elif cov < 0.7:
                status, note = "yellow", f"Kun {int(cov*100)}% av teksten gjenkjent i talen"
                y += 1
            else:
                status, note = "green", "Tale og tekst i sync"
                g += 1

        lines.append({
            "t": round(s, 2), "end": round(e, 2), "sub_text": text,
            "heard_text": heard_text[:80], "drift_s": drift,
            "coverage": round(cov, 2), "status": status, "note": note,
        })

    med = round(float(sorted(drifts)[len(drifts) // 2]), 2) if drifts else None
    bridge.log(f"QC: {g} grønn · {y} gul · {r} rød · median-drift {med}s")
    bridge.result({
        "lines": lines,
        "summary": {"green": g, "yellow": y, "red": r, "total": len(subs), "median_drift_s": med},
        "video_path": video_path,
    })


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
