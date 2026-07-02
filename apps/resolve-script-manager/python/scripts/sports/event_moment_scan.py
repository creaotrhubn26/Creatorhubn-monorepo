"""
Sports Event — øyeblikks-skann (bevegelse + ambient), profil-drevet.

MVP (A) uten Apple Vision: finn høydepunkt-kandidater i multi-cam-materiale
fra to signaler som ffmpeg + numpy gir oss uten data/scoreboard:
  - BEVEGELSE: mean-absolute-frame-difference (ffmpeg scdet/mafd) pr sample-frame
    → fanger fall/wipeout, plask, rask action, klipp-endring.
  - AMBIENT: RMS-envelope på kamera-lyden → publikum-brøl/jubel.
Fusjon: motion+ambient sammenfaller = sterkeste høydepunkt.

Menneske-i-loop: returnerer en RANGERT kandidat-liste med thumbnails; agenten
triagerer i UI (godkjenn/forkast). AI velger aldri selv.

ALLE terskler er parametre (eksponert i UI): sample_fps, motion_sens,
ambient_sens, min_gap_s, pre_s, post_s, max_candidates, profile.

params: { source_dir? | clip_paths?[], profile?("ocr_race"),
          sample_fps?(3), motion_sens?(1.0), ambient_sens?(1.0),
          min_gap_s?(3.0), pre_s?(1.5), post_s?(2.5), max_candidates?(120),
          max_clips?(0=alle) }
result: { candidates:[{id,clip_path,clip_name,camera,t_peak,in_s,out_s,dur_s,
          type,score,motion,ambient,why[],thumb}],
          summary:{total,by_type,clips_scanned,clips_total}, profile, params }
"""
from __future__ import annotations
import os, sys, re, glob, subprocess, tempfile, hashlib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

VIDEO_EXT = (".mov", ".mp4", ".mxf", ".m4v", ".avi", ".mkv", ".braw")

# profil: vekt/etiketter pr event-type. OCR-race (hinderløp) = MVP.
PROFILES = {
    "ocr_race":  {"label": "Hinderløp (OCR)", "w_motion": 1.0, "w_ambient": 0.9,
                  "motion_label": "kraftig bevegelse (fall/plask/action)", "ambient_label": "publikum-brøl"},
    "ball_sport": {"label": "Ballsport", "w_motion": 0.7, "w_ambient": 1.0,
                   "motion_label": "rask action", "ambient_label": "publikum-jubel"},
    "generic":   {"label": "Generisk event", "w_motion": 1.0, "w_ambient": 1.0,
                  "motion_label": "bevegelse", "ambient_label": "lyd-topp"},
}


def _cache_dir():
    d = os.path.join(tempfile.gettempdir(), "sports_moment_thumbs")
    os.makedirs(d, exist_ok=True)
    return d


def _camera_of(path, root):
    """kamera-etikett: undermappe under root, ellers fil-stamme-prefiks."""
    rel = os.path.relpath(path, root) if root else os.path.basename(path)
    parts = rel.split(os.sep)
    if len(parts) > 1:
        return parts[0]
    return os.path.splitext(os.path.basename(path))[0][:16]


def _motion_series(path, fps):
    """→ (times[], mafd[]) mean-abs-frame-difference pr sample-frame via ffmpeg scdet."""
    import numpy as np
    txt = tempfile.mktemp(suffix=".txt")
    vf = f"scale=240:-2,fps={fps},scdet=threshold=0,metadata=print:file={txt}"
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", path, "-vf", vf, "-an", "-f", "null", "-"],
                   check=False)
    if not os.path.exists(txt):
        return np.array([]), np.array([])
    times, vals = [], []
    cur_t = None
    with open(txt, errors="ignore") as fh:
        for line in fh:
            m = re.search(r"pts_time:([0-9.]+)", line)
            if m:
                cur_t = float(m.group(1)); continue
            m = re.search(r"lavfi\.scd\.mafd=([0-9.]+)", line)
            if not m:
                m = re.search(r"lavfi\.scd\.score=([0-9.]+)", line)
            if m and cur_t is not None:
                times.append(cur_t); vals.append(float(m.group(1)))
    try:
        os.remove(txt)
    except OSError:
        pass
    return np.array(times), np.array(vals)


def _ambient_series(path, hop=0.5):
    """→ (times[], rms_db[]) ambient-lyd-envelope."""
    import numpy as np, soundfile as sf
    wav = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", path, "-ac", "1", "-ar", "16000", wav],
                   check=False)
    if not os.path.exists(wav):
        return np.array([]), np.array([])
    y, sr = sf.read(wav)
    y = y if getattr(y, "ndim", 1) == 1 else y.mean(1)
    os.remove(wav)
    n = max(1, int(hop * sr))
    frames = [y[i:i + n] for i in range(0, len(y), n)]
    rms = np.array([20 * np.log10(np.sqrt(np.mean(f ** 2) + 1e-12)) for f in frames])
    times = np.arange(len(rms)) * hop
    return times, rms


def _peaks(times, vals, sens):
    """robuste topper: verdi > median + k*MAD (k skaleres av sens).
    Styrke normaliseres innen klippet (sterkeste topp = 1.0) så score spres og
    rangering blir meningsfull. → liste (t, styrke 0..1)."""
    import numpy as np
    if len(vals) < 3:
        return []
    med = np.median(vals)
    mad = np.median(np.abs(vals - med)) + 1e-9
    k = 3.5 / max(0.2, sens)          # høyere sens = lavere terskel
    thr = med + k * mad
    raw = []                          # (t, råverdi) pr topp
    hi = vals > thr
    i = 0
    while i < len(vals):
        if hi[i]:
            j = i
            while j + 1 < len(vals) and hi[j + 1]:
                j += 1
            pk = i + int(np.argmax(vals[i:j + 1]))
            raw.append((float(times[pk]), float(vals[pk])))
            i = j + 1
        else:
            i += 1
    if not raw:
        return []
    hi_v = max(v for _, v in raw)
    span = (hi_v - thr) + 1e-9
    return [(t, max(0.0, min(1.0, (v - thr) / span))) for t, v in raw]


def _merge(cands, min_gap):
    """slå sammen kandidater nærmere enn min_gap (behold høyeste score)."""
    cands.sort(key=lambda c: c["t_peak"])
    merged = []
    for c in cands:
        if merged and c["t_peak"] - merged[-1]["t_peak"] < min_gap:
            if c["score"] > merged[-1]["score"]:
                merged[-1] = c
            else:
                # arv signaler
                merged[-1]["motion"] = max(merged[-1]["motion"], c["motion"])
                merged[-1]["ambient"] = max(merged[-1]["ambient"], c["ambient"])
        else:
            merged.append(c)
    return merged


def _thumb(path, t):
    import numpy as np  # noqa
    key = hashlib.md5(f"{path}:{t:.2f}".encode()).hexdigest()[:16]
    out = os.path.join(_cache_dir(), f"{key}.jpg")
    if not os.path.exists(out):
        subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-ss", f"{max(0, t):.2f}", "-i", path,
                        "-frames:v", "1", "-vf", "scale=360:-2", out], check=False)
    return out if os.path.exists(out) else None


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np  # noqa

    profile = params.get("profile", "ocr_race")
    prof = PROFILES.get(profile, PROFILES["ocr_race"])
    fps = float(params.get("sample_fps", 3))
    motion_sens = float(params.get("motion_sens", 1.0))
    ambient_sens = float(params.get("ambient_sens", 1.0))
    min_gap = float(params.get("min_gap_s", 3.0))
    pre = float(params.get("pre_s", 1.5))
    post = float(params.get("post_s", 2.5))
    max_c = int(params.get("max_candidates", 120))
    max_clips = int(params.get("max_clips", 0))

    root = params.get("source_dir")
    if params.get("clip_paths"):
        clips = [p for p in params["clip_paths"] if os.path.exists(p)]
        root = root or (os.path.dirname(clips[0]) if clips else None)
    elif root:
        clips = []
        for e in VIDEO_EXT:
            clips += glob.glob(os.path.join(root, f"**/*{e}"), recursive=True)
            clips += glob.glob(os.path.join(root, f"**/*{e.upper()}"), recursive=True)
        clips = sorted(set(clips))
    else:
        bridge.error("Oppgi source_dir (mappe med multi-cam) eller clip_paths"); sys.exit(1)

    if not clips:
        bridge.error("Fant ingen video-filer i kilden"); sys.exit(1)
    clips_total = len(clips)
    if max_clips > 0:
        clips = clips[:max_clips]
    bridge.log(f"Skanner {len(clips)}/{clips_total} klipp · profil «{prof['label']}» · "
               f"{fps:.0f} fps · bevegelse+ambient")

    all_c = []
    for ci, path in enumerate(clips):
        bridge.progress(ci + 1, len(clips), os.path.basename(path))
        cam = _camera_of(path, root)
        mt, mv = _motion_series(path, fps)
        at, av = _ambient_series(path)
        mpk = {round(t, 1): s for t, s in _peaks(mt, mv, motion_sens)} if len(mv) else {}
        apk = {round(t, 1): s for t, s in _peaks(at, av, ambient_sens)} if len(av) else {}

        raw = []
        for t, s in mpk.items():
            raw.append({"t": t, "motion": s, "ambient": 0.0})
        for t, s in apk.items():
            # slå sammen med nær motion-topp hvis finnes
            near = next((r for r in raw if abs(r["t"] - t) < 1.5), None)
            if near:
                near["ambient"] = max(near["ambient"], s)
            else:
                raw.append({"t": t, "motion": 0.0, "ambient": s})

        for r in raw:
            mo, am = r["motion"], r["ambient"]
            score = prof["w_motion"] * mo + prof["w_ambient"] * am
            score = round(min(1.0, score / (prof["w_motion"] + prof["w_ambient"]) * 1.6), 3)
            why = []
            if mo > 0.05:
                why.append(prof["motion_label"])
            if am > 0.05:
                why.append(prof["ambient_label"])
            if mo > 0.05 and am > 0.05:
                typ = "høydepunkt"
            elif am >= mo:
                typ = "jubel"
            else:
                typ = "action"
            t = r["t"]
            all_c.append({
                "clip_path": path, "clip_name": os.path.basename(path), "camera": cam,
                "t_peak": round(t, 2), "in_s": round(max(0, t - pre), 2), "out_s": round(t + post, 2),
                "dur_s": round(pre + post, 2), "type": typ, "score": score,
                "motion": round(mo, 3), "ambient": round(am, 3), "why": why,
            })

    # merge pr klipp, ranger globalt, cap, lag thumbnails for topp-N
    by_clip = {}
    for c in all_c:
        by_clip.setdefault(c["clip_path"], []).append(c)
    merged = []
    for cl, cs in by_clip.items():
        merged += _merge(cs, min_gap)
    merged.sort(key=lambda c: c["score"], reverse=True)
    merged = merged[:max_c]

    bridge.log(f"{len(merged)} kandidater · lager thumbnails …")
    by_type = {}
    for i, c in enumerate(merged):
        c["id"] = f"m{i}"
        c["thumb"] = _thumb(c["clip_path"], c["t_peak"])
        by_type[c["type"]] = by_type.get(c["type"], 0) + 1

    bridge.log(f"Ferdig: {len(merged)} kandidater ({', '.join(f'{k}:{v}' for k,v in by_type.items())})")
    bridge.result({
        "candidates": merged,
        "summary": {"total": len(merged), "by_type": by_type,
                    "clips_scanned": len(clips), "clips_total": clips_total},
        "profile": profile,
        "params": {"sample_fps": fps, "motion_sens": motion_sens, "ambient_sens": ambient_sens,
                   "min_gap_s": min_gap, "pre_s": pre, "post_s": post, "max_candidates": max_c},
    })


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
