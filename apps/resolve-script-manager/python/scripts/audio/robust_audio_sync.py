"""Robust dual-system / multicam sync — der Resolves waveform-auto-sync feiler stille
('Auto Sync Failed', bare en brøkdel synket) og TC-sync drifter noen frames over et take.
Bygger envelope-KRYSS-KORRELASJON (log-RMS @ ~100Hz, IKKE rå bølgeform) mellom et kamera-klipps
scratch-lyd og en ekstern opptaker-fil. Samme metode som social/lipsync_scan.py.
mode="scan" (read-only): finn beste offset + korr-score per par, OG test DRIFT (head vs tail) →
frames-drift over klippet. mode="apply" (best-effort): Resolve API kan ikke ripple-edite — vi
anbefaler manuell nudge på offsetSec, ev. rebuild. Krever ffmpeg/ffprobe (degrader + noter hvis mangler).
Params: mode, searchRoots[] (ELLER eksplisitt cameraPath+audioPath), corrMin, driftFrames, searchS, windowS."""
from __future__ import annotations
import os, sys, subprocess, tempfile
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

CAM_EXT = (".mov", ".mp4", ".mxf", ".braw", ".mts", ".m4v", ".avi")
REC_EXT = (".wav", ".mp3", ".aif", ".aiff", ".m4a", ".flac")
SR = 16000      # mono-downsample for envelope-ekstraksjon
HOP = 160       # → ~100 Hz envelope (16000/160)


def _have(tool: str) -> bool:
    try:
        subprocess.run([tool, "-version"], capture_output=True, timeout=10)
        return True
    except Exception:
        return False


def _ffprobe_dur(path: str) -> float:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path], text=True, timeout=20)
        return float(out.strip())
    except Exception:
        return 0.0


def _mdfind_media(roots, want_ext, limit=400):
    """Finn media-filer. Hvis roots gitt → grunne find under DEM (caller-kontrollert);
    ALDRI rekursiv glob over /Volumes blindt. Uten roots → Spotlight på vanlige mapper."""
    hits = []
    if roots:
        for r in roots:
            if not os.path.isdir(r):
                continue
            try:
                out = subprocess.run(["find", r, "-type", "f"],
                                     capture_output=True, text=True, timeout=60).stdout
                for line in out.splitlines():
                    if os.path.splitext(line)[1].lower() in want_ext and os.path.isfile(line):
                        hits.append(line)
                        if len(hits) >= limit:
                            return hits
            except Exception:
                continue
    return hits


def run(params: dict[str, Any], dry_run: bool) -> None:
    bridge.reexec_in_venv_if_present()
    mode = (params.get("mode") or "scan").lower()
    corr_min = float(params.get("corrMin") or 0.45)
    drift_thr = float(params.get("driftFrames") or 1.5)   # frames-drift som regnes som "drift"
    search = float(params.get("searchS") or 90)           # ± søkevindu for offset (sek)
    window = float(params.get("windowS") or 25)           # analyse-vindu-lengde (sek)
    fps = float(params.get("fps") or 25)
    roots = params.get("searchRoots") or []
    cam_path = (params.get("cameraPath") or "").strip()
    aud_path = (params.get("audioPath") or "").strip()

    # --- avhengighets-sjekk: degrader pent hvis ffmpeg/ffprobe mangler ---
    if not (_have("ffmpeg") and _have("ffprobe")):
        bridge.error("ffmpeg/ffprobe ikke funnet — kreves for envelope-sync. "
                     "Installer via Homebrew (brew install ffmpeg) og kjør på nytt.")
        bridge.result({"mode": mode, "pairs": [], "ffmpegAvailable": False,
                       "note": "⚠️ Mangler ffmpeg/ffprobe. Kan ikke ekstrahere lyd-envelope. "
                               "Installer ffmpeg, så fungerer sync der Resolve feiler."})
        return

    import numpy as np
    from scipy.signal import correlate

    # ── envelope-ekstraksjon: log-RMS @ ~100Hz, normalisert (z-score). IKKE rå waveform. ──
    def env(args):
        with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as tf:
            o = tf.name
        try:
            r = subprocess.run(["ffmpeg", "-y", "-v", "error"] + args +
                               ["-ac", "1", "-ar", str(SR), "-f", "f32le", o],
                               capture_output=True, text=True)
            if r.returncode != 0:
                return None
            x = np.fromfile(o, dtype=np.float32)
        finally:
            try: os.unlink(o)
            except OSError: pass
        if len(x) < HOP * 5:
            return None
        n = len(x) // HOP
        e = np.log(np.sqrt((x[:n * HOP].reshape(n, HOP) ** 2).mean(1) + 1e-9) + 1e-6)
        return (e - e.mean()) / (e.std() + 1e-9)

    def best_offset(cam_env, rec_env):
        """Normalisert kryss-korr: glir cam_env over rec_env, returnerer (offsetSamples, peakCorr).
        offsetSamples i envelope-hop (1 hop = HOP/SR = 0.01s). >0: rec ligger foran cam."""
        if cam_env is None or rec_env is None:
            return None
        L = len(cam_env)
        if len(rec_env) <= L:
            return None
        num = correlate(rec_env, cam_env, mode="valid")
        ss = np.concatenate([[0], np.cumsum(rec_env ** 2)])
        wss = ss[L:L + len(num)] - ss[0:len(num)]
        ncc = num / (np.sqrt(L) * np.sqrt(wss) + 1e-9)
        k = int(np.argmax(ncc))
        return k, float(ncc[k])

    def sync_pair(cam, rec):
        """Mål global offset + drift mellom et kamera-klipp (scratch) og en opptaker-fil."""
        cdur = _ffprobe_dur(cam)
        rdur = _ffprobe_dur(rec)
        if cdur < 6 or rdur < 6:
            return {"camera": cam, "recorder": rec, "offsetSec": None, "corr": 0.0,
                    "driftFrames": None, "confident": False,
                    "reason": "for kort kilde (< 6s) for pålitelig korr"}

        # full-klipp offset: kamera-scratch hele klippet, opptaker bredt vindu rundt
        win = min(window, cdur - 0.5)
        cam_env = env(["-i", cam, "-t", f"{win:.3f}"])
        # opptaker bredt: hele fila opp til et tak (begrens minne), korrelér mot første cam-vindu
        rec_take = min(rdur, win + 2 * search)
        rec_env = env(["-i", rec, "-t", f"{rec_take:.3f}"])
        bo = best_offset(cam_env, rec_env)
        if bo is None:
            return {"camera": cam, "recorder": rec, "offsetSec": None, "corr": 0.0,
                    "driftFrames": None, "confident": False,
                    "reason": "envelope-ekstraksjon feilet"}
        k0, peak0 = bo
        off0 = k0 * (HOP / SR)   # sek rec ligger foran cam-start

        # ── DRIFT: korrelér HEAD-vindu vs TAIL-vindu hver for seg.
        #    Hvis offset endrer seg over klippet → TC/klokke-drift. driftFrames = (tail-head) i frames.
        drift_frames = None
        head_off = tail_off = None
        analyse = min(window, 12.0)           # kortere vindu for stabil lokal korr
        margin = 1.0
        head_ss = margin
        tail_ss = max(margin, cdur - analyse - margin)
        if tail_ss - head_ss > analyse + 1.0:  # nok avstand til å måle drift
            for (ss_cam, store) in ((head_ss, "head"), (tail_ss, "tail")):
                ce = env(["-ss", f"{ss_cam:.3f}", "-i", cam, "-t", f"{analyse:.3f}"])
                # opptaker-vindu sentrert rundt forventet posisjon (off0 + cam-posisjon)
                r_center = off0 + ss_cam
                r_ss = max(0.0, r_center - search)
                re = env(["-ss", f"{r_ss:.3f}", "-i", rec, "-t", f"{analyse + 2 * search:.3f}"])
                lb = best_offset(ce, re)
                if lb is None:
                    continue
                lk, lpeak = lb
                # lokal offset (sek) relativt cam-vindu-start
                local_off = (r_ss + lk * (HOP / SR)) - r_center
                if lpeak >= corr_min * 0.8:
                    if store == "head":
                        head_off = local_off
                    else:
                        tail_off = local_off
            if head_off is not None and tail_off is not None:
                drift_frames = round((tail_off - head_off) * fps, 1)

        confident = bool(peak0 >= corr_min)
        offset_frames = round(off0 * fps, 1)
        return {
            "camera": cam, "recorder": rec,
            "offsetSec": round(off0, 3), "offsetFrames": offset_frames,
            "corr": round(peak0, 2),
            "driftFrames": drift_frames,
            "confident": confident,
            "reason": "" if confident else "lav korr (akustisk mismatch / stille scratch) — bekreft manuelt",
        }

    # ── bygg liste av (kamera, opptaker)-par å teste ──
    if cam_path and aud_path:
        if not os.path.isfile(cam_path):
            bridge.error(f"cameraPath finnes ikke: {cam_path}"); sys.exit(1)
        if not os.path.isfile(aud_path):
            bridge.error(f"audioPath finnes ikke: {aud_path}"); sys.exit(1)
        cams, recs = [cam_path], [aud_path]
    else:
        cams = _mdfind_media(roots, CAM_EXT)
        recs = _mdfind_media(roots, REC_EXT)
        if not cams or not recs:
            bridge.result({"mode": mode, "pairs": [], "cameras": len(cams), "recorders": len(recs),
                           "note": ("Fant ikke både kamera- og opptaker-filer. Oppgi searchRoots[] "
                                    "(mapper å søke i), ELLER eksplisitt cameraPath + audioPath. "
                                    "Unngå hele /Volumes som rot (treigt på store disker).")})
            return

    if mode == "apply":
        # Resolve scripting kan IKKE ripple/insert/trim → vi kan ikke flytte klipp i timelinen via API.
        # Best-effort: kjør scan og returner anbefalt manuell nudge, eller pek på rebuild-tilnærmingen.
        bridge.warn("apply: Resolve API kan ikke ripple-edite — returnerer anbefalt manuell nudge "
                    "(offsetSec) per par i stedet for å mutere timelinen.")

    pairs = []
    # par opp: med eksplisitt path → ett par. Med roots → kryss alle kameraer mot alle opptakere
    # men begrens til beste opptaker per kamera (unngå N×M-eksplosjon ved mange filer).
    if cam_path and aud_path:
        combos = [(cams[0], recs[0])]
    else:
        combos = []
        for c in cams:
            for r in recs:
                combos.append((c, r))
        if len(combos) > 60:
            bridge.warn(f"{len(combos)} kombinasjoner — begrenser til 60 (oppgi færre filer / smalere searchRoots).")
            combos = combos[:60]

    best_per_cam: dict[str, dict] = {}
    for i, (c, r) in enumerate(combos):
        bridge.progress(i + 1, len(combos), f"Synker {os.path.basename(c)} ↔ {os.path.basename(r)}")
        res = sync_pair(c, r)
        if res.get("offsetSec") is None:
            # behold som siste utvei hvis ingen treff for dette kameraet
            best_per_cam.setdefault(c, res)
            continue
        prev = best_per_cam.get(c)
        if prev is None or res["corr"] > (prev.get("corr") or 0):
            best_per_cam[c] = res

    pairs = list(best_per_cam.values())
    pairs.sort(key=lambda p: -(p.get("corr") or 0))

    confident = [p for p in pairs if p.get("confident")]
    drifting = [p for p in pairs if (p.get("driftFrames") is not None and abs(p["driftFrames"]) >= drift_thr)]

    if pairs:
        note = (f"Synket {len(pairs)} par via envelope-korr (ikke rå waveform). "
                f"{len(confident)} sikre (corr ≥ {corr_min:.2f}). ")
        if drifting:
            note += (f"⚠️ {len(drifting)} par drifter ≥ {drift_thr:.0f} frames over klippet (TC/klokke-drift) "
                     f"— ikke fiksbart med ett offset; vurder å splitte eller re-synke i to deler. ")
        weak = [p for p in pairs if not p.get("confident")]
        if weak:
            note += (f"{len(weak)} par har lav korr (akustisk mismatch / stille scratch) — "
                     f"bekreft manuelt før bruk. ")
        if mode == "apply":
            note += ("Resolve kan ikke ripple-edite via script: nudge kamera-klippet manuelt med offsetSec "
                     "(positiv = flytt bildet senere), eller bruk rebuild-flyten (bygg ny timeline med korrigert sync).")
        else:
            note += "Bruk offsetSec til manuell nudge i Resolve (Resolve auto-sync feilet her)."
    else:
        note = "Ingen par kunne måles. Sjekk at kamera-scratch har lyd og at opptaker-fila overlapper i tid."

    bridge.result({
        "mode": mode,
        "ffmpegAvailable": True,
        "fps": fps,
        "corrMin": corr_min,
        "driftThresholdFrames": drift_thr,
        "pairs": pairs,
        "confidentCount": len(confident),
        "driftingCount": len(drifting),
        "note": note,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
