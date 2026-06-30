"""Lip-sync sjekk — STEG 3: VISUELL leppe-bekreftelse (cv2-proxy, ingen mediapipe-avhengighet).
Måler munn-bevegelse i bildet (ansikts-deteksjon + bevegelse i munn-region) og korrelerer mot
lyd-envelope fra master-opptaket → finner offset SELV når kamera-scratch er ubrukelig (rom-mik/profil).
Lager visuelt preview: (1) munn-bevegelse vs lyd-envelope justert ved funnet offset, (2) frames m/ munn-boks.
Params: videoPath, srcInS, durS, refAudioPath, refSrcS, searchS, sampleFps, outDir, label."""
from __future__ import annotations
import os, sys, subprocess, tempfile
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

def run(params: dict[str, Any], dry_run: bool) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np, cv2
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy.signal import correlate

    vp = (params.get("videoPath") or "").strip()
    src_in = float(params.get("srcInS") or 0)
    dur = float(params.get("durS") or 40)
    rap = (params.get("refAudioPath") or "").strip()
    ref_src = float(params.get("refSrcS") or 0)
    search = float(params.get("searchS") or 90)
    sf = float(params.get("sampleFps") or 15)
    outdir = (params.get("outDir") or os.path.expanduser("~/.claude/.../lipcheck")).strip()
    label = (params.get("label") or "lipcheck").strip()
    os.makedirs(outdir, exist_ok=True)
    if not (vp and rap): bridge.error("Mangler videoPath/refAudioPath"); sys.exit(1)

    # --- 1) munn-bevegelses-signal fra bildet ---
    cap = cv2.VideoCapture(vp)
    if not cap.isOpened(): bridge.error(f"Kan ikke åpne {vp}"); sys.exit(1)
    haar = cv2.data.haarcascades
    fdet = cv2.CascadeClassifier(haar + "haarcascade_frontalface_default.xml")
    pdet = cv2.CascadeClassifier(haar + "haarcascade_profileface.xml")
    n = int(dur * sf)
    # sekvensiell lesing (per-frame seek i MXF er for tregt) — sampler hver 'step'. frame
    nat = cap.get(cv2.CAP_PROP_FPS) or 25
    step = max(1, round(nat / sf)); sf = nat / step
    n = int(dur * sf)
    cap.set(cv2.CAP_PROP_POS_MSEC, src_in * 1000.0)
    lip = np.zeros(n, dtype=np.float32)
    prev = None; box = None; redetect = max(1, int(sf * 0.5)); frames_saved = []
    W = H = 0; i = 0; raw = -1
    while i < n:
        ok, fr = cap.read()
        if not ok: break
        raw += 1
        if raw % step != 0: continue
        H, W = fr.shape[:2]
        gray = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
        if i % redetect == 0:
            faces = fdet.detectMultiScale(gray, 1.2, 5, minSize=(80, 80))
            if len(faces) == 0:
                faces = pdet.detectMultiScale(gray, 1.2, 5, minSize=(80, 80))
            if len(faces) == 0:
                fl = cv2.flip(gray, 1)
                pf = pdet.detectMultiScale(fl, 1.2, 5, minSize=(80, 80))
                faces = [[W - (x + w), y, w, h] for (x, y, w, h) in pf] if len(pf) else []
            if len(faces):
                box = max(faces, key=lambda b: b[2] * b[3])
        if box is not None:
            x, y, w, h = box
            mx, my = int(x + 0.2 * w), int(y + 0.58 * h)
            mw, mh = int(0.6 * w), int(0.42 * h)
        else:  # fallback: nedre-senter ROI
            mx, my, mw, mh = int(W * 0.3), int(H * 0.45), int(W * 0.4), int(H * 0.4)
        mx, my = max(0, mx), max(0, my); mw, mh = max(8, min(mw, W - mx)), max(8, min(mh, H - my))
        roi = gray[my:my + mh, mx:mx + mw].astype(np.float32)
        if prev is not None and prev.shape == roi.shape:
            lip[i] = float(np.mean(np.abs(roi - prev)))
        prev = roi
        if i in (int(n * 0.15), int(n * 0.5), int(n * 0.85)):
            vis = fr.copy(); cv2.rectangle(vis, (mx, my), (mx + mw, my + mh), (0, 255, 255), 3)
            p = os.path.join(outdir, f"{label}_frame{len(frames_saved)}.jpg")
            cv2.imwrite(p, vis); frames_saved.append(p)
        i += 1
    cap.release()
    lip = lip[:max(1, i)]
    have_face = box is not None

    # --- 2) lyd-envelope fra master (sampleFps) ---
    SR = 16000; hop = int(SR / sf)
    a0 = max(0.0, ref_src - search)
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as tf: ap = tf.name
    subprocess.run(["ffmpeg","-y","-v","error","-ss",f"{a0:.3f}","-i",rap,"-t",f"{dur+2*search:.3f}",
                    "-ac","1","-ar",str(SR),"-f","f32le",ap], check=True)
    x = np.fromfile(ap, dtype=np.float32); os.unlink(ap)
    m = len(x) // hop
    env = np.log(np.sqrt((x[:m*hop].reshape(m, hop)**2).mean(1) + 1e-9) + 1e-6)

    def z(a): return (a - a.mean()) / (a.std() + 1e-9)
    L = z(lip); E = z(env)
    if len(E) <= len(L): bridge.error("For kort lyd-vindu"); sys.exit(1)
    num = correlate(E, L, mode="valid")
    ss = np.concatenate([[0], np.cumsum(E**2)]); wss = ss[len(L):len(L)+len(num)] - ss[0:len(num)]
    ncc = num / (np.sqrt(len(L)) * np.sqrt(wss) + 1e-9)
    k = int(np.argmax(ncc)); peak = float(ncc[k])
    offset = (k / sf) - search   # >0: bildet ligger foran lyden (lippene kommer før ordene)

    # --- 3) visuelt preview ---
    fig, ax = plt.subplots(2, 1, figsize=(11, 5), sharex=True)
    tL = np.arange(len(L)) / sf
    ax[0].plot(tL, z(lip), color="#a78bfa"); ax[0].set_title(f"Munn-bevegelse i bildet ({'ansikt funnet' if have_face else 'fallback-ROI'})")
    ax[0].set_ylabel("leppe-aktivitet")
    tE = np.arange(len(E)) / sf - search
    ax[1].plot(tE, z(env), color="#4ade80", label="lyd-envelope (master)")
    ax[1].plot(tL + offset, z(lip), color="#a78bfa", alpha=0.8, label="munn-bevegelse (justert)")
    ax[1].axvline(0, color="#888", ls="--", lw=0.8)
    ax[1].set_title(f"Justert ved offset {offset:+.2f}s ({offset*25:+.0f}f @25fps) — korrelasjon {peak:.2f}")
    ax[1].set_xlabel("tid (s), 0 = editor-antatt sync"); ax[1].legend(loc="upper right", fontsize=8)
    plt.tight_layout()
    plot_p = os.path.join(outdir, f"{label}_plot.png"); plt.savefig(plot_p, dpi=90); plt.close()

    bridge.result({"offsetSec": round(offset, 2), "offsetFrames": round(offset * 25, 1), "corr": round(peak, 2),
                   "faceFound": have_face, "plot": plot_p, "frames": frames_saved,
                   "note": ("Sterk leppe-match — offset er pålitelig." if peak >= 0.35
                            else "Svak match — sjekk preview manuelt (lite ansikt/bevegelse).")})

if __name__ == "__main__":
    bridge.main_guard(run)
