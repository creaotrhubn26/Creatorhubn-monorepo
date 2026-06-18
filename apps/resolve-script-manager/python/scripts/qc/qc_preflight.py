"""QC Preflight — orkestrator som kjører ALLE QC-sjekker og samler til én rapport.

Use case: før Bjarne rendrer + leverer filmen til brudeparet vil han ha ett
enkelt «grønt lys». Denne scripten kjører hver eksisterende QC-sjekk, fanger
hver enkelt feil isolert (en sjekk som krasjer skal IKKE rive ned hele
rapporten — den blir «warn» med feilmeldingen), og aggregerer til:

  { checks: [{ name, status: pass|warn|fail, detail, items: [{timeline, note}] }],
    overall }                                  # overall = verste status

Sjekker som kjøres (i rekkefølge):
  1. Audio-hull        — RMS-sveip (librosa) av master-lyd-fila (params.masterAudioPath).
                         Mangler fila → status «warn» (kan ikke sjekke). Flagger
                         segmenter < -45 dB i > 0.8 s.
  2. Loudness / TP     — ffmpeg loudnorm-måling av master-lyd-fila vs
                         loudnessTarget (default -16 LUFS) + truePeak (default -2 dBTP).
  3. Stille seksjoner  — scripts/qc/detect_silent_sections_in_timeline.py
  4. Timeline-gaps     — scripts/qc/detect_timeline_gaps.py
  5. Jump/flash cuts   — scripts/timeline/find_jump_cuts.py
  6. Unheard speech    — scripts/qc/detect_unheard_speech.py («snakker men høres ikke»)
  7. Lengde+kapittel   — timeline-varighet + kapittel-dekning (V1-klipp med navn)
  8. (valgfritt)       — scripts/audio/verify_audio_sync.py hvis runSyncNet=true (tregt)

Sub-script-strategi: hver Resolve-bundet sjekk kjøres som SUBPROCESS (samme
python-interpreter som oss, env arves) og vi parser den siste
`{"type":"result"}`-linjen. Det matcher den eksisterende event-protokollen
nøyaktig og holder sub-scriptenes stdout-events isolert fra VÅR rapport — vi
emitter kun ÉN result-event til slutt.

Input params:
  timelineName?    — (sendes videre til sub-scripts som støtter det). Default = current.
  loudnessTarget?  — integrated LUFS-mål (default -16).
  truePeak?        — true-peak-tak i dBTP (default -2).
  runSyncNet?      — bool (default false). Kjør også SyncNet lip-sync (tregt).
  masterAudioPath? — sti til ferdig master-lyd-fil for audio-hull + loudness.
                     Mangler → de to lyd-fil-sjekkene gir «warn» m/ hopp-melding.
  renderPath?      — sti til ferdig render brukt av SyncNet (faller tilbake på
                     masterAudioPath hvis ikke satt).

Output:
  { checks: [...], overall }
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# ─── Statushierarki ───────────────────────────────────────────────────────
_STATUS_RANK = {"pass": 0, "warn": 1, "fail": 2}


def _worst(*statuses: str) -> str:
    """Returnér den «verste» statusen (fail > warn > pass)."""
    worst = "pass"
    for s in statuses:
        if _STATUS_RANK.get(s, 1) > _STATUS_RANK.get(worst, 0):
            worst = s
    return worst


def _tc(seconds: float) -> str:
    """m:ss tidskode — matcher find_jump_cuts-formatet."""
    try:
        s = int(round(float(seconds)))
    except (TypeError, ValueError):
        return "0:00"
    return f"{s // 60}:{s % 60:02d}"


# ─── Sub-script-subprocess ────────────────────────────────────────────────
_PY_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _run_subscript(rel_path: str, params: dict[str, Any], timeout: int = 600) -> dict[str, Any]:
    """Kjør et registry-script som subprocess og returnér dets `result`-payload.

    rel_path er relativt til python-roten, f.eks. "scripts/qc/detect_timeline_gaps.py".
    Bruker SAMME python-interpreter som oss (sys.executable) så ML-venv + Resolve-
    moduler er tilgjengelige; env arves automatisk (R2_*, RESOLVE_*, ANTHROPIC_*).

    Returnerer dict:
      { ok: True, value: <result-payload> }              ved suksess
      { ok: False, error: "<melding>" }                  ved feil / ingen result
    """
    script_abs = os.path.join(_PY_ROOT, rel_path)
    if not os.path.isfile(script_abs):
        return {"ok": False, "error": f"Script ikke funnet: {rel_path}"}

    cmd = [
        sys.executable,
        script_abs,
        f"--params={json.dumps(params, ensure_ascii=False)}",
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=_PY_ROOT,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Tidsavbrudd etter {timeout}s"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"Kunne ikke starte sub-script: {exc}"}

    # Finn SISTE result-event i den newline-delimitede JSON-strømmen.
    # (Vi tar også vare på siste error-event som diagnostikk hvis result mangler.)
    result_value: Any = None
    last_error: str | None = None
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(ev, dict):
            continue
        if ev.get("type") == "result":
            result_value = ev.get("value")
        elif ev.get("type") == "error":
            last_error = ev.get("message") or last_error

    if result_value is not None:
        return {"ok": True, "value": result_value}

    if proc.returncode != 0:
        msg = last_error or (proc.stderr or "").strip().splitlines()[-1:] or ["ukjent feil"]
        if isinstance(msg, list):
            msg = msg[0] if msg else "ukjent feil"
        return {"ok": False, "error": f"exit {proc.returncode}: {msg}"}

    return {"ok": False, "error": last_error or "Ingen result-event fra sub-script"}


# ─── Sjekk: audio-hull (RMS-sveip av master-lyd-fila) ─────────────────────
def _check_audio_dropouts(master_audio: str) -> dict[str, Any]:
    """RMS-sveip (librosa) av master-lyd-fila; flagg < -45 dB i > 0.8 s."""
    name = "Audio-hull (dropouts)"
    if not master_audio:
        return {
            "name": name, "status": "warn",
            "detail": "Hoppet over — ingen masterAudioPath oppgitt. Eksporter master-lyden "
                      "og send stien for å sjekke for hull i lydsporet.",
            "items": [],
        }
    if not os.path.isfile(master_audio):
        return {
            "name": name, "status": "warn",
            "detail": f"Hoppet over — finner ikke fila: {master_audio}",
            "items": [],
        }
    try:
        import numpy as np  # noqa: F401
        import librosa
    except ImportError as exc:
        return {
            "name": name, "status": "warn",
            "detail": f"Hoppet over — librosa/numpy ikke installert ({exc}). "
                      "pip install librosa for å aktivere hull-deteksjon.",
            "items": [],
        }

    try:
        import numpy as np
        y, sr = librosa.load(master_audio, sr=None, mono=True)
        if y.size == 0:
            return {"name": name, "status": "warn",
                    "detail": "Tom lydfil — ingenting å sjekke.", "items": []}

        hop = 512
        frame = 2048
        rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=hop)[0]
        # dBFS relativt til full-scale (1.0). +eps for å unngå log(0).
        db = 20.0 * np.log10(np.maximum(rms, 1e-10))
        times = librosa.frames_to_time(np.arange(len(db)), sr=sr, hop_length=hop)

        thresh_db = -45.0
        min_dur = 0.8
        total_dur = float(times[-1]) if len(times) else 0.0
        edge_margin = 2.5  # intro fade-in / outro fade-out er forventet stillhet — ignorer

        items: list[dict[str, Any]] = []
        in_gap = False
        gap_start = 0.0
        for i, level in enumerate(db):
            t = float(times[i])
            if level < thresh_db and not in_gap:
                in_gap = True
                gap_start = t
            elif level >= thresh_db and in_gap:
                in_gap = False
                dur = t - gap_start
                # Hopp over fade-in i starten (forventet < edge_margin).
                if dur >= min_dur and gap_start >= edge_margin:
                    items.append({
                        "timeline": _tc(gap_start),
                        "note": f"stille {dur:.1f}s (< -45 dB)",
                    })
        # Avsluttende stillhet som når helt til slutten = outro fade-out → ignorer.
        # (En ekte hull-feil midt i sporet lukkes alltid av et høyere nivå etterpå
        #  og fanges av løkka over.)

        if not items:
            return {"name": name, "status": "pass",
                    "detail": "Ingen lyd-hull > 0.8s under -45 dB i master-lyden.",
                    "items": []}
        return {
            "name": name, "status": "fail",
            "detail": f"{len(items)} mulig(e) lyd-hull (> 0.8s under -45 dB) — "
                      "kan høres som plutselig stillhet under filmen.",
            "items": items[:30],
        }
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "warn",
                "detail": f"Hull-sjekk feilet: {exc}", "items": []}


# ─── Sjekk: loudness / true-peak (ffmpeg loudnorm) ────────────────────────
def _check_loudness(master_audio: str, target_lufs: float, true_peak: float) -> dict[str, Any]:
    """ffmpeg loudnorm-måling av master-lyd-fila vs mål."""
    name = "Loudness / true-peak"
    if not master_audio:
        return {
            "name": name, "status": "warn",
            "detail": "Hoppet over — ingen masterAudioPath oppgitt. Trengs for å måle "
                      f"integrated LUFS (mål {target_lufs}) + true-peak (tak {true_peak} dBTP).",
            "items": [],
        }
    if not os.path.isfile(master_audio):
        return {"name": name, "status": "warn",
                "detail": f"Hoppet over — finner ikke fila: {master_audio}", "items": []}

    import shutil
    ffmpeg = (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
        or shutil.which("ffmpeg")
        or ("/opt/homebrew/bin/ffmpeg" if os.path.isfile("/opt/homebrew/bin/ffmpeg") else None)
    )
    if not ffmpeg:
        return {"name": name, "status": "warn",
                "detail": "Hoppet over — ffmpeg ikke funnet (brew install ffmpeg).",
                "items": []}

    cmd = [
        ffmpeg, "-nostats", "-hide_banner", "-i", master_audio,
        "-af", f"loudnorm=I={target_lufs}:LRA=11:TP={true_peak}:print_format=json",
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "warn",
                "detail": f"Loudness-måling feilet: {exc}", "items": []}

    text = proc.stderr or ""
    start = text.rfind("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return {"name": name, "status": "warn",
                "detail": "Kunne ikke lese loudnorm-måling (ingen lyd i fila?).",
                "items": []}
    try:
        m = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return {"name": name, "status": "warn",
                "detail": "Kunne ikke parse loudnorm-JSON.", "items": []}

    try:
        measured_i = float(m.get("input_i", 0) or 0)
        measured_tp = float(m.get("input_tp", 0) or 0)
    except (TypeError, ValueError):
        return {"name": name, "status": "warn",
                "detail": "Ugyldige loudnorm-verdier.", "items": []}

    items: list[dict[str, Any]] = []
    status = "pass"
    lufs_off = measured_i - target_lufs

    # LUFS: > 3 LU unna mål = fail, 1-3 LU = warn
    if abs(lufs_off) > 3.0:
        status = _worst(status, "fail")
        items.append({"timeline": "LUFS",
                      "note": f"{measured_i:.1f} LUFS vs mål {target_lufs} ({lufs_off:+.1f} LU)"})
    elif abs(lufs_off) > 1.0:
        status = _worst(status, "warn")
        items.append({"timeline": "LUFS",
                      "note": f"{measured_i:.1f} LUFS vs mål {target_lufs} ({lufs_off:+.1f} LU)"})

    # True peak over tak = fail (klipping/risiko). 0.3 dB toleranse for avrunding/måle-jitter
    # (en master på -1.97 dBTP mot -2.0-tak er reelt på mål, ikke en feil).
    if measured_tp > true_peak + 0.3:
        status = _worst(status, "fail")
        items.append({"timeline": "True peak",
                      "note": f"{measured_tp:.1f} dBTP over tak {true_peak} dBTP — risiko for klipping"})

    if status == "pass":
        detail = (f"Integrated {measured_i:.1f} LUFS (mål {target_lufs}), "
                  f"true-peak {measured_tp:.1f} dBTP (tak {true_peak}). Innenfor mål.")
    else:
        detail = (f"Integrated {measured_i:.1f} LUFS (mål {target_lufs}), "
                  f"true-peak {measured_tp:.1f} dBTP (tak {true_peak}).")
    return {"name": name, "status": status, "detail": detail, "items": items}


# ─── Sjekk: stille seksjoner (sub-script) ─────────────────────────────────
def _check_silent_sections(timeline_name: str) -> dict[str, Any]:
    name = "Stille seksjoner (ingen lyd)"
    params = {"timelineName": timeline_name} if timeline_name else {}
    r = _run_subscript("scripts/qc/detect_silent_sections_in_timeline.py", params)
    if not r["ok"]:
        return {"name": name, "status": "warn",
                "detail": f"Sjekk feilet: {r['error']}", "items": []}
    val = r["value"] or {}
    sections = val.get("silentSections") or []
    items = []
    for s in sections[:30]:
        ch = s.get("chapterAtTime")
        note = f"stille {s.get('durationSec')}s"
        if ch:
            note += f" — {ch}"
        items.append({"timeline": _tc(s.get("startSec") or 0), "note": note})

    if not sections:
        return {"name": name, "status": "pass",
                "detail": f"Ingen lange stille seksjoner ({val.get('silentPercent', 0)}% stille totalt).",
                "items": []}
    pct = val.get("silentPercent") or 0
    status = "fail" if (pct and pct >= 10) else "warn"
    return {"name": name, "status": status,
            "detail": f"{len(sections)} stille seksjon(er), {val.get('totalSilentSec', 0)}s "
                      f"({pct}% av timeline) uten kameralyd, ekstern lyd eller musikk.",
            "items": items}


# ─── Sjekk: timeline-gaps (sub-script) ────────────────────────────────────
def _check_timeline_gaps(timeline_name: str) -> dict[str, Any]:
    name = "Timeline-gaps (sorte mellomrom)"
    params = {"timelineName": timeline_name} if timeline_name else {}
    r = _run_subscript("scripts/qc/detect_timeline_gaps.py", params)
    if not r["ok"]:
        return {"name": name, "status": "warn",
                "detail": f"Sjekk feilet: {r['error']}", "items": []}
    val = r["value"] or {}
    gaps = val.get("gaps") or []
    verdict = val.get("verdict") or "clean"
    items = [{"timeline": _tc(g.get("startSec") or 0),
              "note": f"gap {round(float(g.get('durationSec') or 0), 2)}s — {g.get('position', '')}".strip()}
             for g in gaps[:30]]

    if verdict == "clean" or not gaps:
        return {"name": name, "status": "pass",
                "detail": "Ingen sorte mellomrom mellom klippene på V1.", "items": []}
    status = "fail" if verdict == "major_gaps" else "warn"
    return {"name": name, "status": status,
            "detail": f"{val.get('gapCount', len(gaps))} gap(s), total {val.get('totalGapSec', 0)}s "
                      f"(verdict: {verdict}).",
            "items": items}


# ─── Sjekk: jump/flash cuts (sub-script) ──────────────────────────────────
def _check_jump_cuts() -> dict[str, Any]:
    name = "Jump-/flash-cuts"
    # find_jump_cuts bruker alltid current timeline (ingen timelineName-param).
    r = _run_subscript("scripts/timeline/find_jump_cuts.py", {})
    if not r["ok"]:
        return {"name": name, "status": "warn",
                "detail": f"Sjekk feilet: {r['error']}", "items": []}
    val = r["value"] or {}
    flash = val.get("flashCuts") or []
    jumps = val.get("jumpCuts") or []
    items: list[dict[str, Any]] = []
    for f in flash[:20]:
        items.append({"timeline": f.get("timeline") or _tc(f.get("timelineSec") or 0),
                      "note": f"flash cut {f.get('durationSec')}s — {f.get('name', '')}".strip()})
    for j in jumps[:20]:
        items.append({"timeline": j.get("timeline") or _tc(j.get("timelineSec") or 0),
                      "note": f"jump-cut-risiko (kilde-gap {j.get('sourceGapSec')}s)"})

    if not flash and not jumps:
        return {"name": name, "status": "pass",
                "detail": "Ingen flash cuts eller jump-cut-risiko oppdaget.", "items": []}
    # Jump-cut-risiko er en proxy-heuristikk → warn, ikke fail.
    return {"name": name, "status": "warn",
            "detail": f"{len(flash)} flash cut(s) + {len(jumps)} mulig(e) jump cut(s). "
                      "Se over — kan gi hakkete følelse.",
            "items": items}


# ─── Sjekk: unheard speech (sub-script) ───────────────────────────────────
def _check_unheard_speech(timeline_name: str, master_audio: str = "") -> dict[str, Any]:
    name = "Snakker men høres ikke (unheard speech)"
    params: dict[str, Any] = {}
    if timeline_name:
        params["timelineName"] = timeline_name
    if master_audio:
        params["masterAudioPath"] = master_audio
    r = _run_subscript("scripts/qc/detect_unheard_speech.py", params)
    if not r["ok"]:
        return {"name": name, "status": "warn",
                "detail": f"Sjekk feilet eller utilgjengelig: {r['error']}", "items": []}
    val = r["value"] or {}
    flags = val.get("flags") or []
    items = []
    for fl in flags[:30]:
        note = fl.get("reason") or "nærbilde-ansikt uten hørbar tale"
        items.append({"timeline": _tc(fl.get("timelineSec") or 0), "note": note})

    if not flags:
        return {"name": name, "status": "pass",
                "detail": val.get("summary") or "Ingen klipp der noen tydelig snakker uten hørbar tale.",
                "items": []}
    return {"name": name, "status": "warn",
            "detail": val.get("summary")
                      or f"{len(flags)} klipp m/ nærbilde-ansikt men lav tale-lyd — "
                         "noen kan snakke uten å høres.",
            "items": items}


# ─── Sjekk: lengde + kapittel-dekning (in-process Resolve) ────────────────
def _check_length_chapters(timeline_name: str) -> dict[str, Any]:
    name = "Lengde + kapittel-dekning"
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.project:
            return {"name": name, "status": "warn",
                    "detail": "Hoppet over — ingen åpen Resolve/prosjekt.", "items": []}

        timeline = None
        if timeline_name:
            n = conn.project.GetTimelineCount() or 0
            for i in range(1, n + 1):
                t = conn.project.GetTimelineByIndex(i)
                if t and t.GetName() == timeline_name:
                    timeline = t
                    break
        if timeline is None:
            timeline = conn.project.GetCurrentTimeline()
        if timeline is None:
            return {"name": name, "status": "warn",
                    "detail": "Ingen aktiv timeline.", "items": []}

        try:
            fps = float(timeline.GetSetting("timelineFrameRate"))
        except (TypeError, ValueError):
            fps = 25.0
        start_f = timeline.GetStartFrame() or 0
        end_f = timeline.GetEndFrame() or 0
        dur_sec = max(0.0, (end_f - start_f) / fps)

        v_items = timeline.GetItemListInTrack("video", 1) or []
        total_clips = len(v_items)
        named = 0
        for it in v_items:
            try:
                media = it.GetMediaPoolItem()
                if media and (media.GetName() or "").strip():
                    named += 1
            except Exception:  # noqa: BLE001
                pass
        coverage = (named / total_clips * 100.0) if total_clips else 0.0

        items: list[dict[str, Any]] = []
        status = "pass"

        if dur_sec < 1.0:
            status = _worst(status, "fail")
            items.append({"timeline": _tc(0), "note": f"timeline kun {dur_sec:.1f}s lang"})
        if total_clips == 0:
            status = _worst(status, "fail")
            items.append({"timeline": _tc(0), "note": "ingen klipp på V1"})
        elif coverage < 50.0:
            status = _worst(status, "warn")
            items.append({"timeline": _tc(0),
                          "note": f"kun {named}/{total_clips} klipp har media-navn (kapittel-proxy)"})

        detail = (f"Varighet {_tc(dur_sec)} ({dur_sec:.0f}s), {total_clips} klipp på V1, "
                  f"kapittel-dekning {coverage:.0f}%.")
        return {"name": name, "status": status, "detail": detail, "items": items}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "warn",
                "detail": f"Lengde/kapittel-sjekk feilet: {exc}", "items": []}


# ─── Sjekk: SyncNet lip-sync (valgfri, treg) ──────────────────────────────
def _check_syncnet(render_path: str) -> dict[str, Any]:
    name = "Lip-sync (SyncNet)"
    if not render_path or not os.path.isfile(render_path):
        return {"name": name, "status": "warn",
                "detail": "Hoppet over — ingen render-/master-fil (renderPath eller "
                          "masterAudioPath) å verifisere lip-sync mot.",
                "items": []}
    r = _run_subscript("scripts/audio/verify_audio_sync.py",
                       {"inputPath": render_path}, timeout=900)
    if not r["ok"]:
        return {"name": name, "status": "warn",
                "detail": f"SyncNet hoppet over / feilet: {r['error']}", "items": []}
    val = r["value"] or {}
    in_sync = bool(val.get("inSync"))
    off = val.get("offsetFrames")
    conf = val.get("syncConfidence")
    if in_sync:
        return {"name": name, "status": "pass",
                "detail": f"Lip-sync OK (offset {off} frames, confidence {conf}).",
                "items": []}
    return {"name": name, "status": "fail",
            "detail": val.get("verdict")
                      or f"Lip-sync-drift: offset {off} frames (confidence {conf}). Re-align før levering.",
            "items": [{"timeline": "A/V", "note": f"offset {off} frames, confidence {conf}"}]}


# ─── Sjekk: Norwedfilm vignett-bokstøtter (intro+outro på V2 + Screen) ─────
def _check_vignette(timeline_name: str) -> dict[str, Any]:
    """Regel (Daniel): Norwedfilm-vignetten SKAL alltid være med — intro + outro
    på et over-spor (V2) med composite mode = Screen (5), så svart bakgrunn faller ut."""
    name = "Vignett-bokstøtter (Norwedfilm)"
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.project:
            return {"name": name, "status": "warn", "detail": "Hoppet over — ingen åpen Resolve.", "items": []}
        tl = None
        if timeline_name:
            for i in range(1, (conn.project.GetTimelineCount() or 0) + 1):
                t = conn.project.GetTimelineByIndex(i)
                if t and t.GetName() == timeline_name:
                    tl = t; break
        tl = tl or conn.project.GetCurrentTimeline()
        if tl is None:
            return {"name": name, "status": "warn", "detail": "Ingen aktiv timeline.", "items": []}
        try:
            fps = float(tl.GetSetting("timelineFrameRate"))
        except (TypeError, ValueError):
            fps = 25.0
        sf = tl.GetStartFrame() or 0
        ef = tl.GetEndFrame() or 0
        tot = max(0.0, (ef - sf) / fps)
        v2 = tl.GetItemListInTrack("video", 2) or []
        if not v2:
            return {"name": name, "status": "fail",
                    "detail": "Ingen klipp på V2 — Norwedfilm intro/outro-vignett mangler helt.",
                    "items": [{"timeline": "V2", "note": "legg vignett som intro + outro på V2 (Screen)"}]}
        items: list[dict[str, Any]] = []
        has_intro = any((it.GetStart() - sf) / fps < 8.0 for it in v2)
        has_outro = any((it.GetEnd() - sf) / fps > tot - 9.0 for it in v2)
        non_screen = []
        for it in v2:
            try:
                if it.GetProperty("CompositeMode") != 5:
                    non_screen.append((it.GetStart() - sf) / fps)
            except Exception:  # noqa: BLE001
                pass
        status = "pass"
        if not has_intro:
            status = _worst(status, "fail"); items.append({"timeline": "0:00", "note": "intro-vignett mangler"})
        if not has_outro:
            status = _worst(status, "fail"); items.append({"timeline": _tc(tot), "note": "outro-vignett mangler"})
        for pos in non_screen:
            status = _worst(status, "warn")
            items.append({"timeline": _tc(pos), "note": "vignett-klipp er IKKE Screen (composite ≠ 5) → svart bakgrunn synlig"})
        detail = (f"{len(v2)} vignett-klipp på V2 (intro={'✓' if has_intro else '✗'}, "
                  f"outro={'✓' if has_outro else '✗'}, Screen={'✓' if not non_screen else '✗'}).")
        return {"name": name, "status": status, "detail": detail, "items": items}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "warn", "detail": f"Vignett-sjekk feilet: {exc}", "items": []}


# ─── Sjekk: master-lyd faktisk plassert på timeline ───────────────────────
def _check_audio_present(timeline_name: str) -> dict[str, Any]:
    """Fang «glemte å legge på lyd» — A1 skal ha klipp som dekker ~hele timelinen."""
    name = "Lyd plassert (A1)"
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.project:
            return {"name": name, "status": "warn", "detail": "Hoppet over — ingen åpen Resolve.", "items": []}
        tl = None
        if timeline_name:
            for i in range(1, (conn.project.GetTimelineCount() or 0) + 1):
                t = conn.project.GetTimelineByIndex(i)
                if t and t.GetName() == timeline_name:
                    tl = t; break
        tl = tl or conn.project.GetCurrentTimeline()
        if tl is None:
            return {"name": name, "status": "warn", "detail": "Ingen aktiv timeline.", "items": []}
        try:
            fps = float(tl.GetSetting("timelineFrameRate"))
        except (TypeError, ValueError):
            fps = 25.0
        sf = tl.GetStartFrame() or 0; ef = tl.GetEndFrame() or 0
        tot = max(0.0, (ef - sf) / fps)
        a1 = tl.GetItemListInTrack("audio", 1) or []
        if not a1:
            return {"name": name, "status": "fail",
                    "detail": "Ingen lyd-klipp på A1 — filmen er stum. Plasser master-lyden.",
                    "items": [{"timeline": "A1", "note": "tomt lydspor"}]}
        covered = sum((it.GetEnd() - it.GetStart()) / fps for it in a1)
        pct = (covered / tot * 100.0) if tot else 0.0
        if pct < 90.0:
            return {"name": name, "status": "warn",
                    "detail": f"A1 dekker kun {pct:.0f}% av timelinen — mulig manglende lyd mot slutten.",
                    "items": [{"timeline": "A1", "note": f"{covered:.0f}s / {tot:.0f}s dekket"}]}
        return {"name": name, "status": "pass",
                "detail": f"A1 dekker {pct:.0f}% av timelinen ({len(a1)} klipp).", "items": []}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "warn", "detail": f"Lyd-sjekk feilet: {exc}", "items": []}


# ─── Sjekk: Farge / eksponering (gradet-tilstand + justerbare klipp) ──────
def _check_color(timeline_name: str, source_video: str = "") -> dict[str, Any]:
    """Bekreft grade-tilstand (Rec709 vs log → CST) + flagg justerbare klipp
    (under-eksponerte via IRE, mixed white balance). For en allerede-gradet
    film: kun korrektiv Primary (Node 1) på de flaggede klippene — ingen look."""
    name = "Farge / eksponering"
    items: list[dict[str, Any]] = []
    status = "pass"
    notes: list[str] = []

    # 1) log vs gradet → avgjør om CST trengs (krever en kilde-videofil)
    if source_video and os.path.isfile(source_video):
        rlog = _run_subscript("scripts/color/detect_log_gamma.py", {"videoPath": source_video})
        if rlog["ok"]:
            v = rlog["value"] or {}
            if v.get("isLog"):
                status = _worst(status, "warn")
                notes.append(f"LOG oppdaget ({v.get('gamma')}) → trenger CST/log→Rec709 (Node 2) før justering")
                items.append({"timeline": "Grade", "note": f"log: {v.get('gamma')} — sett opp CST-node"})
            else:
                notes.append(f"Gradet ({v.get('gamma', 'rec.709')}) → kun korrektiv Primary, ingen look")
    else:
        notes.append("antar gradet Rec709 (ingen sourceVideoPath for log-sjekk)")

    # 2) under-eksponerte klipp (justerbare) — IRE via ffmpeg signalstats.
    #    Ekskluder svarte kort/vignett (IRE < 5 = bevisst svart, ikke footage).
    rue = _run_subscript("scripts/color/flag_underexposed_clips.py",
                         {"timelineName": timeline_name} if timeline_name else {}, timeout=900)
    if rue["ok"]:
        v = rue["value"] or {}
        def _real(lst):  # ekskluder svarte kort (IRE<5) + audio-filer
            return [f for f in (lst or [])
                    if (f.get("ire") is None or float(f.get("ire", 0)) >= 5.0)
                    and not str(f.get("name", "")).lower().endswith((".wav", ".mp3"))]
        under = _real(v.get("flagged"))         # histogram/waveform lavt
        over = _real(v.get("flaggedOver"))      # waveform/YMAX-klipp
        color = _real(v.get("flaggedColor"))    # parade/vectorscope
        if under:
            status = _worst(status, "warn"); notes.append(f"{len(under)} under-eksponert")
            for f in under[:8]: items.append({"timeline": f.get("name", "?"), "note": f"{f.get('ire')} IRE — løft eksponering (Node 1)"})
        if over:
            status = _worst(status, "warn"); notes.append(f"{len(over)} over-eksponert (utbrente høylys)")
            for f in over[:8]: items.append({"timeline": f.get("name", "?"), "note": f"{f.get('reason','for lyst')} (YMAX {f.get('ymax')}) — demp høylys"})
        if color:
            status = _worst(status, "warn"); notes.append(f"{len(color)} m/ cast/oversaturasjon")
            for f in color[:8]: items.append({"timeline": f.get("name", "?"), "note": f"{f.get('reason','farge-avvik')} — juster WB/metning"})
        if not (under or over or color):
            notes.append("eksponering + farge OK (histogram/waveform/parade/vectorscope innenfor)")
    else:
        notes.append(f"scope-sjekk hoppet over ({rue['error']})")

    # 3) mixed white balance (valgfri info)
    rwb = _run_subscript("scripts/color/flag_mixed_white_balance.py",
                         {"timelineName": timeline_name} if timeline_name else {})
    if rwb["ok"]:
        v = rwb["value"] or {}
        wb_flagged = v.get("flagged") or v.get("outliers") or []
        if wb_flagged:
            status = _worst(status, "warn")
            notes.append(f"{len(wb_flagged)} klipp m/ avvikende hvitbalanse")
            for w in wb_flagged[:10]:
                items.append({"timeline": w.get("name", "WB"), "note": "hvitbalanse-avvik — juster WB (Node 1)"})

    detail = " · ".join(notes) if notes else "Farge-sjekk fullført."
    return {"name": name, "status": status, "detail": detail, "items": items}


def run(params: dict[str, Any], dry_run: bool) -> None:
    timeline_name = (params.get("timelineName") or "").strip()
    loudness_target = float(params.get("loudnessTarget") if params.get("loudnessTarget") is not None else -16)
    true_peak = float(params.get("truePeak") if params.get("truePeak") is not None else -2)
    run_syncnet = bool(params.get("runSyncNet", False))
    master_audio = (params.get("masterAudioPath") or "").strip()
    render_path = (params.get("renderPath") or master_audio or "").strip()

    if dry_run:
        planned = [
            "Audio-hull (RMS-sveip)", "Loudness / true-peak", "Stille seksjoner",
            "Timeline-gaps", "Jump-/flash-cuts", "Snakker men høres ikke",
            "Lyd plassert (A1)", "Vignett-bokstøtter (Norwedfilm)",
            "Lengde + kapittel-dekning",
        ]
        if run_syncnet:
            planned.append("Lip-sync (SyncNet)")
        bridge.result({
            "wouldCheck": timeline_name or "current",
            "checks": planned,
            "loudnessTarget": loudness_target,
            "truePeak": true_peak,
            "runSyncNet": run_syncnet,
        })
        return

    # Hver sjekk er pakket i sin egen feil-isolering: en sjekk som kaster skal
    # bli «warn» med feilmeldingen, ikke rive ned hele rapporten.
    plan: list[tuple[str, Any]] = [
        ("Audio-hull", lambda: _check_audio_dropouts(master_audio)),
        ("Loudness", lambda: _check_loudness(master_audio, loudness_target, true_peak)),
        ("Stille seksjoner", lambda: _check_silent_sections(timeline_name)),
        ("Timeline-gaps", lambda: _check_timeline_gaps(timeline_name)),
        ("Jump-/flash-cuts", lambda: _check_jump_cuts()),
        ("Unheard speech", lambda: _check_unheard_speech(timeline_name, master_audio)),
        ("Lyd plassert (A1)", lambda: _check_audio_present(timeline_name)),
        ("Vignett-bokstøtter", lambda: _check_vignette(timeline_name)),
        ("Lengde + kapittel", lambda: _check_length_chapters(timeline_name)),
    ]
    if bool(params.get("runColor", True)):
        _src_video = (params.get("sourceVideoPath") or "").strip()
        plan.append(("Farge / eksponering", lambda: _check_color(timeline_name, _src_video)))
    if run_syncnet:
        plan.append(("Lip-sync (SyncNet)", lambda: _check_syncnet(render_path)))

    total = len(plan)
    checks: list[dict[str, Any]] = []
    for idx, (label, fn) in enumerate(plan):
        bridge.progress(idx, total, f"QC: {label} …")
        try:
            check = fn()
        except Exception as exc:  # noqa: BLE001 — én sjekk skal aldri krasje hele rapporten
            check = {"name": label, "status": "warn",
                     "detail": f"Sjekken krasjet: {exc}", "items": []}
        # Defensiv normalisering så frontend-kontrakten alltid holder.
        if not isinstance(check, dict):
            check = {"name": label, "status": "warn",
                     "detail": "Ugyldig sjekk-resultat", "items": []}
        check.setdefault("name", label)
        if check.get("status") not in _STATUS_RANK:
            check["status"] = "warn"
        check.setdefault("detail", "")
        check.setdefault("items", [])
        bridge.log(f"[{check['status'].upper()}] {check['name']} — {check.get('detail', '')}")
        checks.append(check)

    overall = _worst(*[c["status"] for c in checks]) if checks else "pass"
    bridge.progress(total, total, "QC ferdig.")
    bridge.result({"checks": checks, "overall": overall})


if __name__ == "__main__":
    bridge.main_guard(run)
