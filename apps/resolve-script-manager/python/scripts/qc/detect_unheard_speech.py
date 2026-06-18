"""Detect Unheard Speech — flagg «noen snakker, men du hører dem ikke».

Use case: en wedding-film klipper inn et nærbilde av brudgommen som tydelig
SNAKKER (tale/løfter), men under klippet ligger det bare musikk — dialogen
hans er enten aldri lagt på, eller druknet av sangen. Resultatet er at seeren
ser noen snakke uten å høre et ord. Det føles amatørmessig.

Heuristikk (ingen dyre ML-modeller påkrevd — kun cv2 + ffmpeg + scipy):
  1. For hvert V1-klipp: ekstraher 2-3 frames fra KILDE-fila ved klippets
     kilde-tid → OpenCV Haar frontal-face-deteksjon.
     faceRatio = største ansikt-bbox-høyde / frame-høyde.
     faceRatio > faceMinRatio (default 0.12) ⇒ nærbilde ⇒ trolig noen snakker.
  2. Mål så «speech-likeness» på lyden UNDER klippet (samme tidsrom i
     timeline). Tale har en karakteristisk stavelses-rytme: amplitude-
     envelopen i 300-3000 Hz-båndet moduleres rundt 2-8 Hz (≈4 Hz =
     stavelses-rate). Musikk (jevn/akkord-basert) har svakere modulasjon i
     dette båndet. speechLikeness = energi i 2-8 Hz-bånd av envelopen,
     normalisert mot total envelope-energi.
  3. Stort nærbilde-ansikt MEN lav speech-likeness (kun musikk) ⇒ flagg
     «snakker men høres ikke».

Lyd-kilde:
  Vi rendrer IKKE timeline (for tregt). Vi måler speech-likeness på en
  master-/dialog-lyd-fil hvis params gir `masterAudioPath` (mixet leveranse-
  WAV/MP4), og leser ut tidsrommet som tilsvarer klippets timeline-posisjon.
  Mangler `masterAudioPath` ⇒ vi kan ikke vurdere lyden, og flagger da kun
  selve nærbilde-ansiktet (reason = "nærbilde-ansikt (ingen master-lyd å
  sjekke)") slik at brukeren likevel får en sjekkliste.

Input params:
  timelineName:         (valgfri) default = current timeline
  audioTrackIndex:      (valgfri, default 1) — kun informativt / fremtidig bruk;
                        speech-likeness måles på master-lyd-fila under klippet.
  faceMinRatio:         (valgfri, default 0.12) — ansikt-høyde/frame-høyde for
                        å regnes som «nærbilde».
  speechBandModThresh:  (valgfri) — terskel for speechLikeness. Under denne =
                        «ikke tale» ⇒ flagg. Default 0.18.
  masterAudioPath:      (valgfri) — sti til mixet leveranse-lyd (WAV/MP4) som
                        speech-likeness måles på. Master-lydens t=0 antas å
                        tilsvare timeline-start.

Output:
  flags: [{ timeline, timelineSec, durationSec, faceRatio, speechLikeness,
            reason }]
  summary
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

# cv2 / numpy / scipy lever i app-venv-py312 (PEP 668 blokkerer system-python).
bridge.reexec_in_venv_if_present()


# ─── ffmpeg-oppslag (samme mønster som extract_highlight_from_film.find_ffmpeg) ──

SIDECAR_FFMPEG_PATHS = (
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
)


def find_ffmpeg() -> tuple[str | None, str | None]:
    import shutil
    env = os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
    if env and os.path.isfile(env):
        probe = env.replace("ffmpeg", "ffprobe")
        if os.path.isfile(probe):
            return env, probe
    ffm = shutil.which("ffmpeg")
    ffp = shutil.which("ffprobe")
    if ffm and ffp:
        return ffm, ffp
    for c in SIDECAR_FFMPEG_PATHS:
        if os.path.isfile(c):
            p = c.replace("ffmpeg", "ffprobe")
            if os.path.isfile(p):
                return c, p
    return None, None


def _tc(seconds: float) -> str:
    s = int(round(max(0.0, seconds)))
    return f"{s // 60}:{s % 60:02d}"


# ─── 1. Frame-sampling + frontal-ansikt-deteksjon (mønster fra signals/faces.py) ──

def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    """Ekstraher én frame ved kilde-tid `ts` (sek). -ss FØR -i = rask seek."""
    fd, tmp = tempfile.mkstemp(prefix="unheard_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{max(0.0, ts):.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=1280:720",
             tmp],
            capture_output=True, timeout=12,
        )
        if not os.path.exists(tmp) or os.path.getsize(tmp) < 200:
            return None
        return tmp
    except Exception:  # noqa: BLE001
        return None


def _max_frontal_face_ratio(image_path: str) -> float:
    """Returner største frontal-ansikt-høyde / frame-høyde (0..1). 0 = ingen.

    haarcascade_frontalface_default.xml er frontal-only (matcher ikke profiler),
    så den dekker «frontalt»-kravet uten ekstra pose-sjekk.
    """
    import cv2  # type: ignore
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return 0.0
    frame_h = img.shape[0]
    if frame_h <= 0:
        return 0.0
    cascade_path = os.path.join(
        cv2.data.haarcascades, "haarcascade_frontalface_default.xml"
    )
    if not os.path.isfile(cascade_path):
        return 0.0
    cascade = cv2.CascadeClassifier(cascade_path)
    faces = cascade.detectMultiScale(
        img, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60),
    )
    if faces is None or len(faces) == 0:
        return 0.0
    return max(h / frame_h for (_x, _y, _w, h) in faces)


def _clip_face_ratio(ffmpeg: str, video: str, src_start: float,
                     src_dur: float) -> float:
    """Sampl 2-3 frames jevnt over klippets kilde-tidsrom, returner max faceRatio."""
    if src_dur <= 0:
        offsets = [0.0]
    elif src_dur < 1.5:
        offsets = [src_dur * 0.5]
    else:
        # 2-3 prøvepunkter (25 %, 50 %, 75 %) — fanger talende nærbilder selv
        # om kameraet panorerer inn/ut i kantene av klippet.
        offsets = [src_dur * 0.25, src_dur * 0.5, src_dur * 0.75]
    best = 0.0
    for off in offsets:
        tmp = _sample_frame(ffmpeg, video, src_start + off)
        if tmp is None:
            continue
        try:
            r = _max_frontal_face_ratio(tmp)
            if r > best:
                best = r
        except Exception:  # noqa: BLE001
            pass
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    return best


# ─── 2. Speech-likeness fra master-lyd under klippet ──────────────────────

def _extract_audio_window(ffmpeg: str, audio_path: str, start_sec: float,
                          dur_sec: float, sr: int = 16000) -> "Any":
    """Ekstraher [start, start+dur] av master-lyden som mono float32 @ sr Hz.

    Returnerer numpy-array (eller None ved feil). Bruker ffmpeg → rå PCM på
    stdout så vi slipper temp-fil per klipp.
    """
    import numpy as np  # type: ignore
    if dur_sec <= 0:
        return None
    try:
        proc = subprocess.run(
            [ffmpeg, "-hide_banner", "-loglevel", "error",
             "-ss", f"{max(0.0, start_sec):.3f}",
             "-t", f"{dur_sec:.3f}",
             "-i", audio_path,
             "-ac", "1", "-ar", str(sr),
             "-f", "f32le", "-acodec", "pcm_f32le", "-"],
            capture_output=True, timeout=20,
        )
        if proc.returncode != 0 or not proc.stdout:
            return None
        data = np.frombuffer(proc.stdout, dtype=np.float32)
        if data.size < sr // 4:  # < 0.25s nyttig lyd
            return None
        return data
    except Exception:  # noqa: BLE001
        return None


def _speech_likeness(samples: "Any", sr: int = 16000) -> float:
    """Mål tale-sannsynlighet via stavelses-rytme i 300-3000 Hz-båndet.

    Pipeline:
      1. Båndpass 300-3000 Hz (tale-formant-/konsonant-bånd).
      2. Amplitude-envelope = |hilbert(signal)|, glattet.
      3. FFT av envelopen. speechLikeness = andel av envelope-energien som
         ligger i 2-8 Hz (stavelses-rate ≈ 4 Hz) relativt til 0.5-20 Hz.
    Musikk har jevnere/akkord-basert energi og svakere 2-8 Hz-modulasjon i
    dette smale båndet ⇒ lavere score.
    """
    import numpy as np  # type: ignore
    from scipy.signal import butter, sosfiltfilt, hilbert  # type: ignore

    x = samples.astype(np.float64)
    # Normaliser for å gjøre terskelen uavhengig av miks-nivå.
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    if peak < 1e-6:
        return 0.0
    x = x / peak

    # 1. Båndpass 300-3000 Hz.
    nyq = sr / 2.0
    lo, hi = 300.0 / nyq, min(3000.0 / nyq, 0.99)
    try:
        sos = butter(4, [lo, hi], btype="band", output="sos")
        band = sosfiltfilt(sos, x)
    except Exception:  # noqa: BLE001
        return 0.0

    # 2. Amplitude-envelope.
    try:
        env = np.abs(hilbert(band))
    except Exception:  # noqa: BLE001
        env = np.abs(band)
    # Glatt med ~20 ms vindu og fjern DC.
    win = max(1, int(0.02 * sr))
    if win > 1:
        kernel = np.ones(win) / win
        env = np.convolve(env, kernel, mode="same")
    env = env - float(np.mean(env))
    if not np.any(env):
        return 0.0

    # 3. Envelope-spektrum.
    n = env.size
    spec = np.abs(np.fft.rfft(env))
    freqs = np.fft.rfftfreq(n, d=1.0 / sr)

    ref_band = (freqs >= 0.5) & (freqs <= 20.0)
    syl_band = (freqs >= 2.0) & (freqs <= 8.0)
    ref_energy = float(np.sum(spec[ref_band] ** 2))
    syl_energy = float(np.sum(spec[syl_band] ** 2))
    if ref_energy <= 1e-12:
        return 0.0
    return max(0.0, min(1.0, syl_energy / ref_energy))


# ─── Resolve-timeline-oppslag ─────────────────────────────────────────────

def _resolve_timeline(conn, timeline_name: str):
    if timeline_name:
        n = conn.project.GetTimelineCount() or 0
        for i in range(1, n + 1):
            t = conn.project.GetTimelineByIndex(i)
            if t and t.GetName() == timeline_name:
                return t
        bridge.error(f"Timeline '{timeline_name}' ikke funnet")
        return None
    t = conn.project.GetCurrentTimeline()
    if not t:
        bridge.error("Ingen aktiv timeline")
    return t


def _source_fps(item, mpi, fallback: float) -> float:
    """Hent kilde-FPS for et klipp (for å mappe source-frame → kilde-sekunder)."""
    try:
        if mpi is not None:
            props = mpi.GetClipProperty() or {}
            fps_str = props.get("FPS")
            if fps_str:
                return float(fps_str)
    except Exception:  # noqa: BLE001
        pass
    return fallback


def run(params: dict[str, Any], dry_run: bool) -> None:
    timeline_name = (params.get("timelineName") or "").strip()
    audio_track_index = int(params.get("audioTrackIndex") or 1)
    # 0.18: kun ekte nærbilder der lepper FAKTISK er lesbare flagges. Lavere (0.12) ga
    # false-positives på halv-/vide shots (ansikt ~13%) der lip-sync ikke er synlig.
    face_min_ratio = float(params.get("faceMinRatio") or 0.18)
    speech_thresh = float(params.get("speechBandModThresh") or 0.18)
    master_audio_path = (params.get("masterAudioPath") or "").strip()

    if dry_run:
        bridge.result({
            "wouldCheck": timeline_name or "current",
            "faceMinRatio": face_min_ratio,
            "speechBandModThresh": speech_thresh,
            "hasMasterAudio": bool(master_audio_path),
            "note": ("Vil sjekke V1-nærbilder mot speech-likeness i master-lyd"
                     if master_audio_path else
                     "Ingen masterAudioPath — vil kun flagge nærbilde-ansikter"),
        })
        return

    ffmpeg, _ffprobe = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet — sett RESOLVE_SCRIPT_MANAGER_FFMPEG "
                     "eller installer ffmpeg.")
        sys.exit(1)

    have_master = bool(master_audio_path) and os.path.isfile(master_audio_path)
    if master_audio_path and not have_master:
        bridge.warn(f"masterAudioPath finnes ikke: {master_audio_path} — "
                    "flagger kun nærbilde-ansikter.")

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)

    timeline = _resolve_timeline(conn, timeline_name)
    if not timeline:
        sys.exit(1)

    fps_str = timeline.GetSetting("timelineFrameRate")
    try:
        tl_fps = float(fps_str)
    except (TypeError, ValueError):
        tl_fps = 25.0
    start_frame = int(timeline.GetStartFrame() or 0)

    items = timeline.GetItemListInTrack("video", 1) or []
    total = len(items)
    bridge.log(f"Timeline '{timeline.GetName()}': {total} V1-klipp, "
               f"master-lyd={'JA' if have_master else 'NEI'} "
               f"(audioTrackIndex={audio_track_index})")
    bridge.progress(0, total, "Skanner V1-klipp…")

    flags: list[dict[str, Any]] = []
    for idx, item in enumerate(items):
        try:
            mpi = item.GetMediaPoolItem() if hasattr(item, "GetMediaPoolItem") else None
            src_path = ""
            if mpi is not None:
                src_path = mpi.GetClipProperty("File Path") or ""

            tl_pos_sec = (int(item.GetStart() or start_frame) - start_frame) / tl_fps
            dur_sec = (int(item.GetDuration() or 0)) / tl_fps
            if dur_sec <= 0:
                continue

            # Kilde-tid for frame-sampling.
            src_fps = _source_fps(item, mpi, tl_fps)
            try:
                src_start_sec = (int(item.GetSourceStartFrame() or 0)) / src_fps
            except Exception:  # noqa: BLE001
                src_start_sec = 0.0

            # 1. Nærbilde-ansikt?
            face_ratio = 0.0
            if src_path and os.path.isfile(src_path):
                face_ratio = _clip_face_ratio(ffmpeg, src_path, src_start_sec, dur_sec)
            elif src_path:
                bridge.warn(f"Kilde-fil mangler på disk for klipp #{idx + 1}: {src_path}")

            if face_ratio < face_min_ratio:
                continue  # ikke nærbilde — ingen «snakker»-mistanke

            # 2. Speech-likeness fra master-lyd under klippet.
            if have_master:
                samples = _extract_audio_window(ffmpeg, master_audio_path,
                                                tl_pos_sec, dur_sec)
                if samples is None:
                    speech_likeness = 0.0
                    measured = False
                else:
                    speech_likeness = _speech_likeness(samples)
                    measured = True
            else:
                speech_likeness = 0.0
                measured = False

            # 3. Flagg-beslutning.
            if measured:
                if speech_likeness < speech_thresh:
                    reason = (f"Nærbilde-ansikt (h/frame={face_ratio:.2f}) men lav "
                              f"speech-likeness ({speech_likeness:.2f} < "
                              f"{speech_thresh:.2f}) — trolig kun musikk, "
                              "dialogen høres ikke.")
                else:
                    continue  # ansikt + tale til stede ⇒ greit
            else:
                reason = (f"Nærbilde-ansikt (h/frame={face_ratio:.2f}) — ingen "
                          "master-lyd å sjekke, verifiser at dialogen høres.")

            flag = {
                "timeline": _tc(tl_pos_sec),
                "timelineSec": round(tl_pos_sec, 2),
                "durationSec": round(dur_sec, 2),
                "faceRatio": round(face_ratio, 3),
                "speechLikeness": round(speech_likeness, 3) if measured else None,
                "reason": reason,
            }
            flags.append(flag)
            bridge.log(f"FLAGG @ {flag['timeline']} — {reason}")
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Hoppet over klipp #{idx + 1}: {exc}")
            continue
        finally:
            bridge.progress(idx + 1, total, f"Skannet {idx + 1}/{total} klipp")

    if have_master:
        summary = (f"{len(flags)} klipp med snakkende nærbilde men lav "
                   f"speech-likeness (musikk dekker dialogen) av {total} V1-klipp.")
    else:
        summary = (f"{len(flags)} snakkende nærbilder funnet (ingen master-lyd "
                   f"oppgitt — speech-likeness ikke målt) av {total} V1-klipp. "
                   "Send masterAudioPath for å avgjøre om dialogen høres.")

    bridge.progress(total, total, "Ferdig.")
    bridge.result({"flags": flags, "summary": summary})


if __name__ == "__main__":
    bridge.main_guard(run)
