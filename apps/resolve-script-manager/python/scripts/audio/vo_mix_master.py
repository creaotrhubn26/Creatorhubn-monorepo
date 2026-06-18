"""VO Mix & Master — bygger en ferdig master-mix fra stems (VO-klipp + musikk +
ev. vignett-lyd) med tweakbare parametere, og kan plassere resultatet rett inn i
en DaVinci Resolve-timeline (Fairlight A1).

HVORFOR dette finnes:
  Et bryllups-/innholdsprosjekt har som regel flere VO-stems (f.eks. brud Mette og
  forlover Kai), en musikk-bunn og ev. vignett-lyd. Å mikse dette for hånd i
  Fairlight er tregt og lite reproduserbart. Dette scriptet koder den hardt opptjente
  audio-DSP-kunnskapen til ÉN deterministisk kjede:

    1) Bygg VO-spor: hvert klipp adelay-es til sin startSec, micro-fades (25ms inn /
       50ms ut) mot klikk, og amix normalize=0 summerer dem (ingen auto-attenuering).
    2) Lag en VO-«ducking-nøkkel»: en hardt komprimert + limited kopi av VO-summen
       som styrer sidechain-duckingen. Dette gir konstant, forutsigbar gating uavhengig
       av at VO-nivået varierer mellom stille og kraftige partier.
    3) Multiband sidechain-ducking av musikken: musikken splittes i lav (<200Hz),
       mid (200–4000Hz) og høy (>4000Hz). KUN mid-båndet duckes hardt (ratio ~7) av
       VO-nøkkelen — der talen og musikkens mest maskerende energi kolliderer.
       Lav (varme/bass) og høy (luft/cymbaler) duckes bare lett, slik at musikken
       forblir rik mens stemmen skjærer rent gjennom.
    4) Mix musikk + VO + (ev.) vignett-lyd. Vignett crossfades inn/ut.
    5) 2-pass loudnorm (linear=true) til loudnessTarget / truePeak — single-pass
       loudnorm bommer på korte/dynamiske program.

  duckDepthDb / duckReleaseMs styrer hvor hardt og hvor raskt musikken slipper
  tilbake. loudnessTarget / truePeak er web-standard som default (-16 LUFS / -2 dBTP),
  men kan overstyres (f.eks. Netflix -27 LKFS).

KRITISK ffmpeg-gotcha (kodet under): atrim NULLSTILLER IKKE PTS, så afade/adelay
refererer kilde-tid. Vi bruker derfor ALLTID asetpts=PTS-STARTPTS etter trimming
før vi fade-er eller forsinker.

Input params:
  projectId:       prosjekt-id (staging-mappe)
  voClips:         [{ path, startSec, speaker }]  — VO-stems som skal mikses inn
  musicPath:       full sti til musikk-bunn (wav)
  vignettePath:    valgfri sti til vignett-lyd (wav)
  voLevelDb:       gain på VO-summen i dB (default 0)
  duckDepthDb:     hvor mange dB mid-båndet duckes ned under VO (default 12)
  duckReleaseMs:   sidechain release i ms (default 450)
  warmthDb:        ev. low-shelf @160Hz boost på musikk (default 0)
  presenceDb:      ev. bell @2.5kHz boost på VO-summen (default 0)
  airDb:           ev. high-shelf @11kHz boost på master (default 0)
  loudnessTarget:  integrert LUFS-mål (default -16)
  truePeak:        true-peak-tak i dBTP (default -2)
  timelineName:    timeline å plassere i (valgfri; bruker current ellers)
  placeInResolve:  bool — importer master + AppendToTimeline på A1 (default false)

Output: { masterPath, lufs, truePeak, lra, placed }
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

# scripts/audio/vo_mix_master.py → tre nivåer opp = python/ (der bridge.py bor).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


STAGING_BASE = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging"
)


# ─── tool discovery ───────────────────────────────────────────────────────


def find_ffmpeg() -> str | None:
    for cand in [
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ]:
        if cand and os.path.isfile(cand):
            return cand
    return None


def find_ffprobe(ffmpeg: str) -> str | None:
    cand = ffmpeg.replace("ffmpeg", "ffprobe")
    if os.path.isfile(cand):
        return cand
    return shutil.which("ffprobe")


# ─── helpers ───────────────────────────────────────────────────────────────


def _run_ffmpeg(cmd: list[str], timeout: int = 1200) -> subprocess.CompletedProcess:
    """Kjør ffmpeg og reis bridge.error + sys.exit(1) ved feil."""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        bridge.error(f"ffmpeg timed out efter {timeout}s")
        sys.exit(1)
    if proc.returncode != 0:
        bridge.error(
            f"ffmpeg feilet (exit {proc.returncode}). "
            f"Stderr: {(proc.stderr or '')[-600:]}"
        )
        sys.exit(1)
    return proc


def _probe_duration(ffprobe: str | None, path: str) -> float:
    if not ffprobe:
        return 0.0
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nokey=1:noprint_wrappers=1", path],
            capture_output=True, text=True, timeout=20,
        )
        return float((r.stdout or "0").strip() or 0.0)
    except Exception:  # noqa: BLE001
        return 0.0


def _measure_loudness(ffmpeg: str, path: str, target: float, tp: float) -> dict:
    """Pass 1 av 2-pass loudnorm: mål inn-verdiene via print_format=json."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", path,
        "-af", (
            f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json"
        ),
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        bridge.warn("loudnorm-måling timet ut — hopper over måling")
        return {}
    # loudnorm-JSON skrives til stderr; finn siste {...}-blokk.
    text = proc.stderr or ""
    start = text.rfind("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        bridge.warn("Fant ikke loudnorm-JSON i ffmpeg-output")
        return {}
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        bridge.warn("Kunne ikke parse loudnorm-JSON")
        return {}


def _db_to_linear(db: float) -> float:
    return float(10.0 ** (db / 20.0))


# ─── filtergraf-byggere ─────────────────────────────────────────────────────


def _build_vo_track_chain(vo_clips: list[dict], vo_level_db: float,
                          presence_db: float) -> tuple[str, int]:
    """Bygg filtergraf-fragment som summerer alle VO-klipp til [vo].

    Hvert input n (i samme rekkefølge som vo_clips) trimmes/PTS-nullstilles,
    micro-fades (25ms inn / 50ms ut) og adelay-es til startSec*1000 ms.
    Returnerer (graf-streng, antall_vo_inputs).

    KRITISK: asetpts=PTS-STARTPTS rett etter atrim, ellers refererer afade/adelay
    kilde-tid og micro-fades/forsinkelser havner feil.
    """
    parts: list[str] = []
    labels: list[str] = []
    for i, clip in enumerate(vo_clips):
        start_ms = max(0, int(round(float(clip.get("startSec") or 0) * 1000)))
        lbl = f"vo{i}"
        # atrim=start=0 er en no-op men gjør PTS-nullstillingen eksplisitt;
        # asetpts gjør at afade st/d og adelay refererer 0 = klipp-start.
        parts.append(
            f"[{i}:a]"
            f"atrim=start=0,asetpts=PTS-STARTPTS,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000,"
            f"afade=t=in:st=0:d=0.025,"
            f"areverse,afade=t=in:st=0:d=0.050,areverse,"  # ut-fade via reverse-trick
            f"adelay={start_ms}|{start_ms}"
            f"[{lbl}]"
        )
        labels.append(f"[{lbl}]")

    n = len(vo_clips)
    if n == 1:
        mix = f"{labels[0]}anull[vosum]"
    else:
        mix = f"{''.join(labels)}amix=inputs={n}:normalize=0:dropout_transition=0[vosum]"
    parts.append(mix)

    # Nivå + ev. presence-bell på VO-summen.
    chain = "[vosum]"
    chain += f"volume={_db_to_linear(vo_level_db):.5f}"
    if abs(presence_db) > 0.01:
        chain += (
            f",anequalizer=c0 f=2500 w=900 g={presence_db:.2f} t=0|"
            f"c1 f=2500 w=900 g={presence_db:.2f} t=0"
        )
    chain += "[vo]"
    parts.append(chain)
    return ";".join(parts), n


def _build_master_filtergraph(vo_clips: list[dict], music_path: str,
                              vignette_path: str | None, vo_level_db: float,
                              duck_depth_db: float, duck_release_ms: int,
                              warmth_db: float, presence_db: float,
                              air_db: float) -> tuple[str, list[str], str]:
    """Bygg hele master-filtergrafen.

    Returnerer (filter_complex, input_args, out_label).
    Input-rekkefølge: alle VO-klipp (0..n-1), så musikk (n), så ev. vignett (n+1).
    """
    inputs: list[str] = []
    for clip in vo_clips:
        inputs.extend(["-i", clip["path"]])
    music_idx = len(vo_clips)
    inputs.extend(["-i", music_path])
    vignette_idx = None
    if vignette_path:
        vignette_idx = music_idx + 1
        inputs.extend(["-i", vignette_path])

    vo_graph, _ = _build_vo_track_chain(vo_clips, vo_level_db, presence_db)
    graph_parts = [vo_graph]

    # VO-ducking-nøkkel: hardt komprimert + limited kopi av VO-summen.
    # Konstant nøkkel ⇒ forutsigbar gating uavhengig av VO-dynamikk.
    graph_parts.append(
        "[vo]asplit=2[vo_main][vo_key_src];"
        "[vo_key_src]"
        "acompressor=threshold=-30dB:ratio=12:attack=5:release=120:makeup=8,"
        "alimiter=limit=0.95"
        "[vo_key]"
    )

    # Splitt musikk i lav (<200), mid (200-4000), høy (>4000).
    music_pre = f"[{music_idx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000"
    if abs(warmth_db) > 0.01:
        music_pre += (
            f",anequalizer=c0 f=160 w=120 g={warmth_db:.2f} t=1|"
            f"c1 f=160 w=120 g={warmth_db:.2f} t=1"
        )
    graph_parts.append(f"{music_pre},asplit=3[m_lo_src][m_mid_src][m_hi_src]")
    graph_parts.append("[m_lo_src]lowpass=f=200[m_lo_band]")
    graph_parts.append("[m_mid_src]highpass=f=200,lowpass=f=4000[m_mid_band]")
    graph_parts.append("[m_hi_src]highpass=f=4000[m_hi_band]")

    # Nøkkelen må deles til hvert bånd som duckes.
    graph_parts.append("[vo_key]asplit=3[key_lo][key_mid][key_hi]")

    # duckDepthDb → makeup-kompensasjon slik at ratio gir ønsket reduksjon.
    # Mid-båndet duckes HARDT (ratio 7). Lav/høy duckes LETT (ratio 2).
    release = max(50, int(duck_release_ms))
    mid_ratio = 7
    side_ratio = 2
    # acompressor's faktiske reduksjon styres av threshold + ratio; vi setter
    # en lav threshold og lar duckDepthDb skalere makeup ned (negativt makeup
    # finnes ikke, så vi etterjusterer nivå via volume på det duckede båndet).
    mid_drop = _db_to_linear(-abs(duck_depth_db))
    side_drop = _db_to_linear(-abs(duck_depth_db) * 0.3)

    graph_parts.append(
        "[m_mid_band][key_mid]"
        f"sidechaincompress=threshold=0.03:ratio={mid_ratio}:attack=8:release={release}:makeup=1,"
        f"volume={mid_drop:.5f}"
        "[m_mid_ducked]"
    )
    graph_parts.append(
        "[m_lo_band][key_lo]"
        f"sidechaincompress=threshold=0.08:ratio={side_ratio}:attack=15:release={release}:makeup=1,"
        f"volume={side_drop:.5f}"
        "[m_lo_ducked]"
    )
    graph_parts.append(
        "[m_hi_band][key_hi]"
        f"sidechaincompress=threshold=0.08:ratio={side_ratio}:attack=10:release={release}:makeup=1,"
        f"volume={side_drop:.5f}"
        "[m_hi_ducked]"
    )

    # Sett musikk-båndene sammen igjen.
    graph_parts.append(
        "[m_lo_ducked][m_mid_ducked][m_hi_ducked]"
        "amix=inputs=3:normalize=0[music_ducked]"
    )

    # Vignett-lyd: crossfade inn/ut (250ms hver vei via afade) hvis tilstede.
    mix_inputs = ["[vo_main]", "[music_ducked]"]
    if vignette_idx is not None:
        graph_parts.append(
            f"[{vignette_idx}:a]"
            "aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000,"
            "atrim=start=0,asetpts=PTS-STARTPTS,"
            "afade=t=in:st=0:d=0.25,areverse,afade=t=in:st=0:d=0.25,areverse"
            "[vignette]"
        )
        mix_inputs.append("[vignette]")

    n_mix = len(mix_inputs)
    graph_parts.append(
        f"{''.join(mix_inputs)}amix=inputs={n_mix}:normalize=0:dropout_transition=0[premaster]"
    )

    # Air high-shelf på master + sikkerhets-limiter mot inter-sample clipping.
    master_chain = "[premaster]"
    if abs(air_db) > 0.01:
        master_chain += (
            f"anequalizer=c0 f=11000 w=4000 g={air_db:.2f} t=1|"
            f"c1 f=11000 w=4000 g={air_db:.2f} t=1,"
        )
    master_chain += "alimiter=limit=0.97[master]"
    graph_parts.append(master_chain)

    return ";".join(graph_parts), inputs, "[master]"


# ─── Resolve-plassering ─────────────────────────────────────────────────────


def _place_in_resolve(master_path: str, timeline_name: str | None,
                      total_dur: float) -> bool:
    """Importer master til media pool og legg den på A1 (mediaType=2, trackIndex=1).

    Sletter gamle audio-klipp på A1 før append slik at re-kjøring ikke stabler.
    Returnerer True ved suksess.
    """
    conn = bridge.ResolveConnection()
    if not conn.connect():
        return False
    if not conn.require_project():
        return False

    project = conn.project
    media_pool = conn.media_pool

    # Velg/bekreft timeline.
    timeline = None
    if timeline_name:
        count = project.GetTimelineCount()
        for i in range(1, int(count) + 1):
            tl = project.GetTimelineByIndex(i)
            if tl and (tl.GetName() or "") == timeline_name:
                timeline = tl
                break
        if timeline:
            project.SetCurrentTimeline(timeline)
        else:
            bridge.warn(
                f"Fant ikke timeline '{timeline_name}' — bruker current timeline."
            )
    if timeline is None:
        timeline = project.GetCurrentTimeline()
    if timeline is None:
        bridge.error("Ingen timeline åpen i Resolve å plassere masteren på.")
        return False

    fps = 24.0
    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 24.0)
    except Exception:  # noqa: BLE001
        pass
    if fps <= 0:
        fps = 24.0

    start_frame = 0
    try:
        start_frame = int(timeline.GetStartFrame() or 0)
    except Exception:  # noqa: BLE001
        pass

    # Importer master-wav til media pool.
    bridge.progress(90, 100, "Importerer master til Resolve media pool…")
    items = media_pool.ImportMedia([master_path])
    if not items:
        bridge.error("Resolve ImportMedia returnerte ingen klipp for masteren.")
        return False
    master_item = items[0]

    # Slett eksisterende audio-klipp på A1 så re-kjøring ikke stabler oppå.
    try:
        existing = timeline.GetItemListInTrack("audio", 1) or []
        if existing:
            timeline.DeleteClips(list(existing), False)
            bridge.log(f"Slettet {len(existing)} gammelt audio-klipp på A1.")
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Kunne ikke rydde A1 før append: {exc}")

    end_frame = max(1, int(round(total_dur * fps))) - 1
    clip_info = [{
        "mediaPoolItem": master_item,
        "startFrame": 0,
        "endFrame": end_frame,
        "recordFrame": start_frame,
        "mediaType": 2,       # 2 = audio only
        "trackIndex": 1,      # A1
    }]
    appended = media_pool.AppendToTimeline(clip_info)
    if not appended:
        bridge.error("AppendToTimeline feilet for masteren.")
        return False
    bridge.log("Master plassert på A1 i Resolve.")
    return True


# ─── run ────────────────────────────────────────────────────────────────────


def run(params: dict, dry_run: bool) -> None:
    project_id = (params.get("projectId") or "").strip() or "_unscoped"
    vo_clips_raw = params.get("voClips") or []
    music_path = (params.get("musicPath") or "").strip()
    vignette_path = (params.get("vignettePath") or "").strip() or None

    vo_level_db = float(params.get("voLevelDb") or 0)
    duck_depth_db = float(params.get("duckDepthDb") if params.get("duckDepthDb") is not None else 12)
    duck_release_ms = int(params.get("duckReleaseMs") or 450)
    warmth_db = float(params.get("warmthDb") or 0)
    presence_db = float(params.get("presenceDb") or 0)
    air_db = float(params.get("airDb") or 0)
    loudness_target = float(params.get("loudnessTarget") if params.get("loudnessTarget") is not None else -16)
    true_peak = float(params.get("truePeak") if params.get("truePeak") is not None else -2)
    timeline_name = (params.get("timelineName") or "").strip() or None
    place_in_resolve = bool(params.get("placeInResolve") or False)

    # Valider VO-klipp.
    vo_clips: list[dict] = []
    for c in vo_clips_raw:
        if not isinstance(c, dict):
            continue
        path = (c.get("path") or "").strip()
        if not path:
            continue
        vo_clips.append({
            "path": path,
            "startSec": float(c.get("startSec") or 0),
            "speaker": (c.get("speaker") or "").strip(),
        })

    if not vo_clips:
        bridge.error("voClips er påkrevd (minst ett klipp med 'path').")
        sys.exit(1)
    if not music_path:
        bridge.error("musicPath er påkrevd.")
        sys.exit(1)

    dest_dir = os.path.join(STAGING_BASE, project_id, "masters")
    master_path = os.path.join(dest_dir, "master_mix.wav")

    if dry_run:
        bridge.result({
            "summary": (
                f"Ville mikset {len(vo_clips)} VO-klipp + musikk"
                + (" + vignett" if vignette_path else "")
                + f" → {master_path} @ {loudness_target} LUFS / {true_peak} dBTP "
                + f"(duck {duck_depth_db}dB / {duck_release_ms}ms)"
                + (", og plassert på A1 i Resolve" if place_in_resolve else "")
            ),
            "masterPath": master_path,
            "voClipCount": len(vo_clips),
            "placeInResolve": place_in_resolve,
        })
        return

    # Sjekk at filene faktisk finnes.
    for c in vo_clips:
        if not os.path.isfile(c["path"]):
            bridge.error(f"VO-klipp finnes ikke: {c['path']}")
            sys.exit(1)
    if not os.path.isfile(music_path):
        bridge.error(f"Musikk finnes ikke: {music_path}")
        sys.exit(1)
    if vignette_path and not os.path.isfile(vignette_path):
        bridge.warn(f"Vignett-fil finnes ikke ({vignette_path}) — ignorerer.")
        vignette_path = None

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg er ikke installert — kreves for mixing.")
        sys.exit(1)
    ffprobe = find_ffprobe(ffmpeg)

    os.makedirs(dest_dir, exist_ok=True)
    bridge.check_disk_space(dest_dir, required_gb=1.0, warn_only=True)

    # ── Steg 1: bygg multiband-duckede premaster (uten loudnorm) ──
    bridge.progress(5, 100, "Bygger VO-spor + multiband ducking…")
    filter_complex, input_args, out_label = _build_master_filtergraph(
        vo_clips, music_path, vignette_path, vo_level_db, duck_depth_db,
        duck_release_ms, warmth_db, presence_db, air_db,
    )

    premaster_path = os.path.join(dest_dir, "_premaster.wav")
    cmd_mix = (
        [ffmpeg, "-hide_banner", "-y"]
        + input_args
        + [
            "-filter_complex", filter_complex,
            "-map", out_label,
            "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le",
            premaster_path,
        ]
    )
    bridge.log("Kjører multiband-ducking-mix…")
    _run_ffmpeg(cmd_mix)

    # ── Steg 2: 2-pass loudnorm (linear=true) ──
    bridge.progress(55, 100, "Måler loudness (pass 1/2)…")
    measured = _measure_loudness(ffmpeg, premaster_path, loudness_target, true_peak)

    bridge.progress(70, 100, "Normaliserer (pass 2/2)…")
    loudnorm_af = (
        f"loudnorm=I={loudness_target}:TP={true_peak}:LRA=11:linear=true:print_format=summary"
    )
    if measured:
        try:
            loudnorm_af = (
                f"loudnorm=I={loudness_target}:TP={true_peak}:LRA=11:linear=true:"
                f"measured_I={measured['input_i']}:"
                f"measured_TP={measured['input_tp']}:"
                f"measured_LRA={measured['input_lra']}:"
                f"measured_thresh={measured['input_thresh']}:"
                f"offset={measured.get('target_offset', 0)}:"
                f"print_format=summary"
            )
        except KeyError:
            bridge.warn("Mangler målte verdier — faller tilbake til single-pass loudnorm.")

    cmd_norm = [
        ffmpeg, "-hide_banner", "-y",
        "-i", premaster_path,
        "-af", loudnorm_af,
        "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le",
        master_path,
    ]
    norm_proc = _run_ffmpeg(cmd_norm)

    # Hent verifiserte ut-verdier fra loudnorm-summary (stderr).
    out_lufs = loudness_target
    out_tp = true_peak
    out_lra = None
    summary = norm_proc.stderr or ""
    for line in summary.splitlines():
        s = line.strip()
        if s.startswith("Output Integrated:"):
            try:
                out_lufs = float(s.split(":")[1].strip().split()[0])
            except (ValueError, IndexError):
                pass
        elif s.startswith("Output True Peak:"):
            try:
                out_tp = float(s.split(":")[1].strip().split()[0])
            except (ValueError, IndexError):
                pass
        elif s.startswith("Output LRA:"):
            try:
                out_lra = float(s.split(":")[1].strip().split()[0])
            except (ValueError, IndexError):
                pass

    # Rydd premaster.
    try:
        os.unlink(premaster_path)
    except OSError:
        pass

    if not os.path.isfile(master_path):
        bridge.error("loudnorm kjørte men ingen master-fil ble produsert.")
        sys.exit(1)

    total_dur = _probe_duration(ffprobe, master_path)

    # ── Steg 3: ev. plassering i Resolve ──
    placed = False
    if place_in_resolve:
        bridge.progress(85, 100, "Plasserer master i Resolve…")
        placed = _place_in_resolve(master_path, timeline_name, total_dur)

    bridge.progress(100, 100, "Ferdig.")

    bridge.result({
        "masterPath": master_path,
        "lufs": out_lufs,
        "truePeak": out_tp,
        "lra": out_lra,
        "placed": placed,
        "durationSeconds": total_dur,
        "voClipCount": len(vo_clips),
    })


if __name__ == "__main__":
    bridge.main_guard(run)
