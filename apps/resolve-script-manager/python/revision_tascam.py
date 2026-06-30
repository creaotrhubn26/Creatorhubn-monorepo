"""
revision_tascam — gjenbrukbar dual-system / ekstern-opptaker-synk (recorder-agnostisk).

UX-flyt (Daniel-prinsipp 2026-06-28): når video ligger i timeline, SPØR systemet
«har du en ekstern opptaker som også tok opp lyden?». Hvis ja → pek på opptaker-
filene (mappe/bin) → systemet skanner gjennom dem, finner samme take, synker og
legger den rene lyden i timelinen. MÅ støtte ENHVER opptaker (Tascam, Zoom, Sound
Devices MixPre, Tascam DR-10L, Rode, …) — alt er bare .wav-filer; `find_line_in_mics`
matcher på audio-envelope, ikke filnavn/merke, så det er merke-uavhengig av design.

`list_recorder_files(folder)` glob-er ALLE lyd-filer i en valgt opptaker-mappe.

Mønster (bygget på PetKey katte-SoMe 2026-06-28): en replikk i editen høres dårlig
ut (scratch-mygg / demucs-artefakt). Fiksen: finn SAMME take i mygg-opptakene
(Tascam «mic-bin»), hent den UKOMPRIMERT, synk frame-presist til editen, splice inn.

Steg (alle her som gjenbrukbare funksjoner):
  1. find_line_in_mics  — envelope-korr referanse mot hver mygg-fil → beste fil+offset
  2. extract_clean      — ffmpeg-hent ukomprimert mono-segment + high-pass
  3. align_to_edit      — envelope-korr mot dialogen → frame-presis offset
  4. level_match        — sett RMS til omgivelsene
  5. splice             — crossfade-erstatt i dialog-sporet

Krever numpy/scipy/soundfile/ffmpeg (lastes kun når denne modulen brukes).
"""
from __future__ import annotations
import os, subprocess, tempfile


def _load(path, ar, dur=None, hp=None):
    import soundfile as sf
    w = tempfile.mktemp(suffix=".wav")
    af = []
    if hp: af += [f"highpass=f={hp}"]
    cmd = ["ffmpeg", "-y", "-v", "quiet"] + (["-t", str(dur)] if dur else []) + ["-i", path]
    if af: cmd += ["-af", ",".join(af)]
    cmd += ["-ac", "1", "-ar", str(ar), w]
    subprocess.run(cmd, check=False)
    a, _ = sf.read(w); os.remove(w)
    import numpy as np
    return a if a.ndim == 1 else a.mean(1)


def list_recorder_files(folder: str, exts=(".wav", ".bwf", ".aif", ".aiff", ".flac")) -> list:
    """Recorder-agnostisk: alle lyd-filer i en valgt opptaker-mappe (rekursivt).
    Filtrerer bort AppleDouble (._) + dublett-backups (_D før ext) prioriteres bort."""
    out = []
    for root, _, files in os.walk(folder):
        for f in files:
            if f.startswith("._"): continue
            if f.lower().endswith(exts): out.append(os.path.join(root, f))
    # primær-filer før _D-backups
    return sorted(out, key=lambda p: (os.path.basename(p).replace("_D.", "."), "_D." in p))


def log_rms_env(a, hop):
    import numpy as np
    n = len(a) // hop
    e = np.array([20*np.log10(np.sqrt(np.mean(a[i*hop:(i+1)*hop]**2))+1e-9) for i in range(n)])
    return e - e.mean()


def find_line_in_mics(ref_path: str, mic_files: list, ref_dur: float = 12.5, ar: int = 1000,
                      on_progress=None) -> dict:
    """Envelope-korr en referanse-replikk mot hver mygg-fil → beste {file, offset_s, corr}.
    Lavrate (1kHz) → rask selv over 15-min-opptak. ref_path kan være en kort
    referanse-klipp (f.eks. en grov extract av replikken). `on_progress(i, n, navn)`
    kalles pr fil så UI kan vise live framdrift («skanner mygg 3/9 …»)."""
    import numpy as np
    from scipy.signal import fftconvolve
    hop = max(1, ar // 100)
    ref = log_rms_env(_load(ref_path, ar, dur=ref_dur), hop)
    best = None; rows = []
    n = len(mic_files)
    for i, p in enumerate(mic_files, 1):
        if on_progress: on_progress(i, n, os.path.basename(p))
        if not os.path.exists(p): continue
        raw = _load(p, ar)
        if len(raw)//hop <= len(ref): continue
        ra = log_rms_env(raw, hop)
        cc = fftconvolve(ra, ref[::-1], mode="valid")
        loc = np.sqrt(fftconvolve(ra**2, np.ones(len(ref)), mode="valid")) * np.sqrt(np.sum(ref**2)) + 1e-9
        ncc = cc / loc[:len(cc)]; k = int(np.argmax(ncc)); c = float(ncc[k]); t = k*hop/ar
        rows.append({"file": p, "offset_s": round(t, 2), "corr": round(c, 3)})
        if best is None or c > best["corr"]: best = rows[-1]
    return {"best": best, "all": sorted(rows, key=lambda r: -r["corr"])}


def extract_clean(src: str, start_s: float, dur_s: float, sr: int = 48000, hp: int = 80):
    """Hent UKOMPRIMERT mono-segment (high-passet) fra mygg-fila."""
    return _load(src, sr, dur=None, hp=hp)[int(start_s*sr):int((start_s+dur_s)*sr)] \
        if False else _extract(src, start_s, dur_s, sr, hp)


def _extract(src, start_s, dur_s, sr, hp):
    import soundfile as sf, numpy as np
    w = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg","-y","-v","quiet","-ss",f"{start_s:.3f}","-t",f"{dur_s:.3f}","-i",src,
                    "-af",f"highpass=f={hp}","-ac","1","-ar",str(sr),w],check=False)
    a,_=sf.read(w); os.remove(w); return a if a.ndim==1 else a.mean(1)


def align_to_edit(clean, dialogue, sr: int, search_t0: float, search_t1: float, hop: int = 480) -> dict:
    """Envelope-korr ren replikk mot dialog-vindu → {offset_s, corr} (frame-presis)."""
    import numpy as np
    from scipy.signal import fftconvolve
    seg = dialogue[int(search_t0*sr):int(search_t1*sr)]
    ee, se = log_rms_env(clean, hop), log_rms_env(seg, hop)
    cc = fftconvolve(se, ee[::-1], mode="full")
    lag = int(np.argmax(cc)) - (len(ee)-1)
    corr = float(cc.max() / (np.sqrt(np.sum(ee**2)*np.sum(se**2)) + 1e-9))
    return {"offset_s": round(search_t0 + lag*hop/sr, 3), "corr": round(corr, 3)}


def level_match(clean, target_rms_db: float = -16.5, floor_db: float = -45.0):
    import numpy as np
    v = clean[np.abs(clean) > 10**(floor_db/20)]
    cur = 20*np.log10(np.sqrt(np.mean(v**2))+1e-9) if len(v) else -99
    return clean * 10**((target_rms_db - cur)/20)


def splice(dialogue, clean, offset_s: float, sr: int, xfade: float = 0.12):
    """Crossfade-erstatt replikken i dialog-sporet (in-place på en kopi)."""
    import numpy as np
    a = dialogue.copy(); i0 = int(offset_s*sr); n = len(clean); xf = int(xfade*sr)
    if i0+n > len(a): n = len(a)-i0; clean = clean[:n]
    a[i0:i0+xf] = a[i0:i0+xf]*np.linspace(1,0,xf) + clean[:xf]*np.linspace(0,1,xf)
    a[i0+xf:i0+n-xf] = clean[xf:n-xf]
    a[i0+n-xf:i0+n] = clean[n-xf:n]*np.linspace(1,0,xf) + a[i0+n-xf:i0+n]*np.linspace(0,1,xf)
    return a
