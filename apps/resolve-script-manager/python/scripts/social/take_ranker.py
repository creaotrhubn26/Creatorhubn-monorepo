"""
Take-rangering (menneske-i-loop).

Formaliserer det vi gjorde manuelt på PetKey (stable A14/A16/A17 … og la
mennesket velge). AI stabler kandidat-takes, transkriberer, skiller barn/voksen
på grunntone (F0), skiller coaching/performance på kontekst, og RANGERER med
begrunnelse — men velger ALDRI selv. Mennesket tar siste valg.

Kilder: mappe (folder), eksplisitt liste (clip_paths), eller media-pool-bin (bin).
Skår: tekst-treff mot forventet replikk, klarhet (Whisper logprob), barn/voksen-
match (F0), signal/støy (RMS), lengde. Returnerer sortert liste + grunner.

params: { folder? | clip_paths?[] | bin?, expect_text?, expect_child?(null:bool),
          model?("small"), max?(40) }
result: { ranked:[{path,name,text,score,f0_hz,voice,clarity,snr_db,dur_s,
          text_match,reasons[],flags[]}], expect_text, expect_child }
"""
from __future__ import annotations
import os, sys, re, glob, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

_WORD = re.compile(r"[a-zæøåA-ZÆØÅ0-9]+")
AUDIO_EXT = (".wav", ".aif", ".aiff", ".flac", ".mp3", ".m4a")


def _norm(t):
    return _WORD.findall((t or "").lower().replace("é", "e"))


def _similar(a, b):
    """andel av forventede ord som finnes i take-teksten (0..1)."""
    if not a:
        return None
    bs = set(b)
    return sum(1 for w in a if w in bs) / len(a)


def _f0_hz(y, sr):
    """grov grunntone via autokorrelasjon på det mest energirike vinduet."""
    import numpy as np
    if len(y) < sr // 4:
        return None
    # velg 0.5s rundt maks-RMS
    win = int(0.5 * sr)
    if len(y) > win:
        step = max(1, win // 4)
        best_i, best_e = 0, -1
        for i in range(0, len(y) - win, step):
            e = float(np.mean(y[i:i + win] ** 2))
            if e > best_e:
                best_e, best_i = e, i
        seg = y[best_i:best_i + win]
    else:
        seg = y
    seg = seg - np.mean(seg)
    if np.max(np.abs(seg)) < 1e-4:
        return None
    corr = np.correlate(seg, seg, mode="full")[len(seg) - 1:]
    lo, hi = int(sr / 400), int(sr / 90)   # 90–400 Hz
    if hi >= len(corr):
        return None
    peak = np.argmax(corr[lo:hi]) + lo
    return round(sr / peak, 1) if peak else None


def _gather(params):
    paths = []
    if params.get("clip_paths"):
        paths = [p for p in params["clip_paths"] if os.path.exists(p)]
    elif params.get("folder"):
        for e in AUDIO_EXT:
            paths += glob.glob(os.path.join(params["folder"], f"**/*{e}"), recursive=True)
    elif params.get("bin"):
        conn = bridge.ResolveConnection()
        if conn.connect() and conn.require_project():
            mp = conn.project.GetMediaPool()
            root = mp.GetRootFolder()
            stack = [root]
            while stack:
                f = stack.pop()
                if (f.GetName() or "").lower() == params["bin"].lower() or f is root:
                    for c in f.GetClipList():
                        p = c.GetClipProperty("File Path")
                        if p and p.lower().endswith(AUDIO_EXT):
                            paths.append(p)
                stack += f.GetSubFolderList()
    return sorted(set(paths))


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np, soundfile as sf
    from faster_whisper import WhisperModel

    expect_text = params.get("expect_text")
    expect_child = params.get("expect_child")   # True/False/None
    exp_words = _norm(expect_text) if expect_text else None
    paths = _gather(params)[: int(params.get("max", 40))]
    if not paths:
        bridge.error("Fant ingen lyd-takes (oppgi folder, clip_paths eller bin)"); sys.exit(1)
    bridge.log(f"Rangerer {len(paths)} takes …")

    model = WhisperModel(params.get("model", "small"), device="cpu", compute_type="int8")
    rows = []
    for i, p in enumerate(paths):
        bridge.progress(i + 1, len(paths), os.path.basename(p))
        wav = tempfile.mktemp(suffix=".wav")
        subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", p, "-ar", "16000", "-ac", "1", wav],
                       check=False)
        if not os.path.exists(wav):
            continue
        y, sr = sf.read(wav)
        y = y if getattr(y, "ndim", 1) == 1 else y.mean(1)
        dur = len(y) / sr
        segs, _ = model.transcribe(wav, language="no", word_timestamps=False, vad_filter=False)
        segs = list(segs)
        text = " ".join(s.text.strip() for s in segs).strip()
        lp = float(np.mean([s.avg_logprob for s in segs])) if segs else -3.0
        clarity = round(max(0.0, min(1.0, (lp + 2.0) / 2.0)), 2)  # ~-2..0 → 0..1
        # SNR: tale-RMS (øvre 30-persentil energi) vs støygulv (nedre 10%)
        fr = np.array_split(y, max(1, int(dur / 0.1)))
        e = np.array([np.sqrt(np.mean(f ** 2) + 1e-12) for f in fr])
        sig = np.percentile(e, 85); noise = np.percentile(e, 10) + 1e-9
        snr = round(20 * np.log10(sig / noise), 1)
        f0 = _f0_hz(y, sr)
        voice = "barn" if (f0 and f0 >= 250) else ("voksen" if f0 else "?")
        os.remove(wav)

        tm = _similar(exp_words, _norm(text))
        reasons, flags = [], []
        score = 0.0
        if tm is not None:
            score += tm * 3.0
            reasons.append(f"tekst-treff {int(tm*100)}%")
            if tm < 0.5:
                flags.append("svakt tekst-treff")
        score += clarity * 1.5
        reasons.append(f"klarhet {clarity}")
        score += min(1.0, max(0.0, (snr - 6) / 24)) * 1.0
        reasons.append(f"SNR {snr}dB")
        if snr < 8:
            flags.append("mye støy")
        if expect_child is not None and f0:
            match = (voice == "barn") == bool(expect_child)
            score += 1.0 if match else -1.5
            reasons.append(f"{voice} ({f0}Hz){' ✓' if match else ' ✗ feil stemme'}")
            if not match:
                flags.append(f"forventet {'barn' if expect_child else 'voksen'}, hørte {voice}")
        elif f0:
            reasons.append(f"{voice} ({f0}Hz)")
        # coaching-heuristikk: forventet replikk gjentatt / veldig lang take rundt kort replikk
        if exp_words and len(_norm(text)) > len(exp_words) * 2.2:
            flags.append("mulig coaching/gjentakelse (mye ekstra tale rundt replikken)")
            score -= 0.5
        if dur < 0.5:
            flags.append("veldig kort")

        rows.append({
            "path": p, "name": os.path.basename(p), "text": text[:100],
            "score": round(score, 2), "f0_hz": f0, "voice": voice,
            "clarity": clarity, "snr_db": snr, "dur_s": round(dur, 2),
            "text_match": None if tm is None else round(tm, 2),
            "reasons": reasons, "flags": flags,
        })

    rows.sort(key=lambda r: r["score"], reverse=True)
    bridge.log(f"Ferdig — topp: {rows[0]['name'] if rows else '—'} (velg selv)")
    bridge.result({"ranked": rows, "expect_text": expect_text, "expect_child": expect_child})


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
