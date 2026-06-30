"""
revision_scan_artifacts — fast steg i revisjons-prosessen: finn lyd-artefakter.

Lærdom (Daniel, katte-SoMe 2026-06-28): demucs-vokal/leveling lager pust/bleed/whoosh
i pausene mellom replikker. Skanning MÅ være innebygd. Finner:
  • pause-artefakter: hørbar energi UTENFOR tale-segmentene (whisper ord-tider)
  • klipp-skjøt-klikk: brå sample-diskontinuiteter (seam-glitch)
Beskytter kjente ekte-tale-intervaller (`protect`) så stille ord ikke flagges.

params: { audio_path, fps?, start_tc?, thresh_db?, protect?[[t0,t1]] }
result: { artifacts:[{tc,t_s,type,level_db,severity}], speech_segments:N }
"""
from __future__ import annotations
import os, sys, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge
from revision_engine import s_to_tc

def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np, soundfile as sf
    path = params.get("audio_path")
    if not path or not os.path.exists(path):
        bridge.error("audio_path mangler/finnes ikke"); sys.exit(1)
    fps = params.get("fps", 25.0); start_tc = params.get("start_tc", "01:00:00:00")
    thresh = params.get("thresh_db", -30.0); protect = params.get("protect", [])
    a, sr = sf.read(path); a = a if a.ndim == 1 else a.mean(1)

    bridge.progress(5, 100, "Transkriberer lyd-klippet…")
    from faster_whisper import WhisperModel
    m = WhisperModel("medium", device="cpu", compute_type="int8")
    w16 = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg","-y","-v","quiet","-i",path,"-ar","16000","-ac","1",w16],check=False)
    dur = len(a)/sr if sr else 0
    segs,_ = m.transcribe(w16, language="no", vad_filter=True, word_timestamps=True)
    ivals=[]
    for s in segs:
        if dur: bridge.progress(int(5 + 70*min(1.0, s.end/dur)), 100, f"Analyserer tale @ {s.start:.0f}s…")
        for wd in (s.words or []): ivals.append((max(0,wd.start-0.18), wd.end+0.22))
    os.remove(w16)
    bridge.progress(80, 100, "Skanner for artefakter…")
    ivals.sort(); merged=[]
    for s,e in ivals:
        if merged and s<=merged[-1][1]+0.15: merged[-1]=(merged[-1][0],max(merged[-1][1],e))
        else: merged.append((s,e))

    def speech(t0,t1): return any(t0<e and t1>s for s,e in merged)
    def prot(t0,t1): return any(t0<e and t1>s for s,e in protect)

    arts=[]; win=0.4; t=0.0; N=len(a)
    while t < N/sr:
        i0,i1=int(t*sr),int(min((t+win)*sr,N))
        if i1-i0>10 and not speech(t,t+win) and not prot(t,t+win):
            seg=a[i0:i1]; rms=20*np.log10(np.sqrt(np.mean(seg**2))+1e-9)
            if rms>thresh:
                arts.append({"tc":s_to_tc(t,fps,start_tc),"t_s":round(t,2),"type":"gap_energy",
                             "level_db":round(float(rms),1),"severity":"high" if rms>thresh+10 else "med"})
        t+=win
    # klipp-skjøt-klikk: store sample-hopp
    d=np.abs(np.diff(a)); clicks=np.where(d>0.5)[0]
    for c in clicks[:20]:
        ts=c/sr
        if not speech(ts-0.05,ts+0.05):
            arts.append({"tc":s_to_tc(ts,fps,start_tc),"t_s":round(float(ts),2),"type":"click","level_db":None,"severity":"high"})
    for a_ in arts:
        bridge.log(f"  ⚠ {a_['tc']} {a_['type']} {a_.get('level_db','')} [{a_['severity']}]")
    bridge.result({"artifacts":arts,"speech_segments":len(merged),
                   "summary":{"total":len(arts),"high":len([x for x in arts if x['severity']=='high'])}})

if __name__ == "__main__":
    try: run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
