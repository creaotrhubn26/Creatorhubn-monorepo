"""VO Repair — reparerer ÉN voice-over-fil etter valgt mode.

Hvorfor dette finnes:
  Råopptak av voice-over (intervju, narrasjon, brude/forlover-tale) varierer
  vilt i kvalitet. Mette (bruden) er ren — trenger bare lett rens. Kai sitter
  på SNR≈0 og må gjennom state-of-the-art tale-forsterkning (DeepFilterNet) +
  en blanding med originalen så han ikke høres robotisk/vassen ut. Dette
  scriptet pakker hele DSP-kjeden bak ÉN mode-parameter slik at frontend bare
  velger intensjon, ikke ffmpeg-filtre.

Modes:
  auto        — mål filen (samme logikk som vo_analyze) → velg kjede ut fra issues.
  denoise     — de-rumble (highpass ~85Hz) → DeepFilterNet → ev. afftdn (skalert
                av strength) → mål SNR. DF er primær; RNNoise/arnndn er fallback.
  level       — 2-pass loudnorm-match til referencePath (Mette) ELLER til -15.5 LUFS.
  deartifact  — blend DF-output wetDry% med original (naturlighet) + restaurer
                kropp (low-mid bell +2dB @ 250Hz). Fikser robotisk/vassen lyd.
  deess       — deesser=i=(strength/100*0.5).
  warmth      — low-shelf ~160Hz løft + air high-shelf ~11kHz.

Input params:
  inputPath:      full sti til input-WAV (påkrevd)
  outputPath:     full sti til reparert WAV (påkrevd)
  mode:           "auto"|"denoise"|"level"|"deartifact"|"deess"|"warmth" (default "auto")
  strength:       0-100, default 60 (styrer denoise/deess-intensitet)
  referencePath:  valgfri WAV å matche loudness mot (for "level"/"auto"-level)
  wetDry:         0-100, default 85 (DF-andel i deartifact; resten er original)

Output (bridge.result):
  { outputPath, mode, before: {noiseDb,snrDb,lufs}, after: {noiseDb,snrDb,lufs} }
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

# scripts/audio/vo_repair.py → tre nivåer opp = python/ (der bridge.py bor).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VALID_MODES = {"auto", "denoise", "level", "deartifact", "deess", "warmth", "dewind"}
DEFAULT_LEVEL_TARGET_LUFS = -15.5

# RNNoise-modeller for arnndn-fallback (cb = best av batchen).
RNNOISE_DIR = "/tmp/mette-kai"
RNNOISE_PRIMARY = os.path.join(RNNOISE_DIR, "cb.rnnn")
RNNOISE_FALLBACKS = [
    os.path.join(RNNOISE_DIR, name) for name in ("cb.rnnn", "sh.rnnn", "mp.rnnn", "lq.rnnn")
]


# ─── Tool discovery ────────────────────────────────────────────────────────

def find_tool(name: str, extra: list[str] | None = None) -> str | None:
    cands = [shutil.which(name), f"/opt/homebrew/bin/{name}", f"/usr/local/bin/{name}"]
    if extra:
        cands = list(extra) + cands
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None


def find_ffmpeg() -> str | None:
    return find_tool("ffmpeg")


def find_ffprobe(ffmpeg: str | None) -> str | None:
    if ffmpeg:
        cand = ffmpeg.replace("ffmpeg", "ffprobe")
        if os.path.isfile(cand):
            return cand
    return find_tool("ffprobe")


# ─── Measurement (mirrors vo_analyze) ──────────────────────────────────────

def _run(cmd: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def measure_loudness(ffmpeg: str, path: str) -> float | None:
    """Integrert loudness (LUFS) via loudnorm print_format=json (input_i)."""
    try:
        r = _run([
            ffmpeg, "-hide_banner", "-nostats", "-i", path,
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
            "-f", "null", "-",
        ], timeout=180)
        # loudnorm dumper JSON-blokken på stderr.
        text = (r.stderr or "") + (r.stdout or "")
        start = text.rfind("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            data = json.loads(text[start:end + 1])
            return float(data.get("input_i"))
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"measure_loudness feilet: {exc}")
    return None


def measure_volume(ffmpeg: str, path: str) -> dict:
    """Returnerer {meanDb, peakDb} via volumedetect."""
    out = {"meanDb": None, "peakDb": None}
    try:
        r = _run([
            ffmpeg, "-hide_banner", "-nostats", "-i", path,
            "-af", "volumedetect", "-f", "null", "-",
        ], timeout=120)
        text = (r.stderr or "")
        for line in text.splitlines():
            line = line.strip()
            if "mean_volume:" in line:
                try:
                    out["meanDb"] = float(line.split("mean_volume:")[1].replace("dB", "").strip())
                except ValueError:
                    pass
            elif "max_volume:" in line:
                try:
                    out["peakDb"] = float(line.split("max_volume:")[1].replace("dB", "").strip())
                except ValueError:
                    pass
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"measure_volume feilet: {exc}")
    return out


def measure_noise_floor_db(ffmpeg: str, path: str) -> float | None:
    """Grovt støygulv: kjør astats og les RMS-trough på det stilleste vinduet.

    astats med metadata reset gir per-vindu RMS; vi tar laveste (= antatt
    pause/støygulv). Faller tilbake til mean_volume - 20 hvis astats svikter.
    """
    try:
        r = _run([
            ffmpeg, "-hide_banner", "-nostats", "-i", path,
            "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
            "-f", "null", "-",
        ], timeout=180)
        text = (r.stderr or "") + (r.stdout or "")
        vals: list[float] = []
        for line in text.splitlines():
            if "RMS_level=" in line:
                try:
                    vals.append(float(line.split("RMS_level=")[1].strip()))
                except (ValueError, IndexError):
                    pass
        if vals:
            # Stille gulv = 10. persentil av RMS-vinduene.
            vals.sort()
            idx = max(0, int(len(vals) * 0.10) - 1)
            return round(vals[idx], 2)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"measure_noise_floor_db feilet: {exc}")
    # Fallback
    vol = measure_volume(ffmpeg, path)
    if vol.get("meanDb") is not None:
        return round(vol["meanDb"] - 20.0, 2)
    return None


def measure_metrics(ffmpeg: str, path: str) -> dict:
    """Samler {noiseDb, snrDb, lufs} for before/after-rapportering."""
    vol = measure_volume(ffmpeg, path)
    noise_db = measure_noise_floor_db(ffmpeg, path)
    lufs = measure_loudness(ffmpeg, path)
    snr_db = None
    if vol.get("meanDb") is not None and noise_db is not None:
        snr_db = round(vol["meanDb"] - noise_db, 2)
    return {
        "noiseDb": noise_db,
        "snrDb": snr_db,
        "lufs": round(lufs, 2) if lufs is not None else None,
    }


# ─── DeepFilterNet (primær tale-forsterkning) ──────────────────────────────

def run_deepfilternet(in_path: str, out_path: str) -> bool:
    """Kjør DeepFilterNet via en venv-py312 subprocess. Returnerer True ved suksess.

    DF jobber internt på 48kHz; vi lar save_audio skrive ut og resampler senere
    i ffmpeg-kjeden hvis nødvendig.
    """
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else "python3"
    snippet = (
        "import sys, json\n"
        "try:\n"
        "  import torch\n"
        "  from df.enhance import enhance, init_df, load_audio, save_audio\n"
        "except Exception as e:\n"
        "  print(json.dumps({'error': 'deepfilternet_not_installed', 'detail': str(e)})); sys.exit(0)\n"
        "in_path, out_path = sys.argv[1], sys.argv[2]\n"
        "model, df_state, _ = init_df()\n"
        "audio, _ = load_audio(in_path, sr=df_state.sr())\n"
        "enhanced = enhance(model, df_state, audio)\n"
        "save_audio(out_path, enhanced, df_state.sr())\n"
        "print(json.dumps({'ok': True, 'sr': df_state.sr()}))\n"
    )
    try:
        r = _run([python, "-c", snippet, in_path, out_path], timeout=600)
        for line in (r.stdout or "").splitlines()[::-1]:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict):
                if data.get("error"):
                    bridge.warn(f"DeepFilterNet utilgjengelig: {data.get('detail', data['error'])}")
                    return False
                if data.get("ok") and os.path.isfile(out_path):
                    return True
        bridge.warn(f"DeepFilterNet ga ingen output. Stderr: {(r.stderr or '')[:300]}")
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"DeepFilterNet subprocess feilet: {exc}")
    return False


def run_rnnoise_fallback(ffmpeg: str, in_path: str, out_path: str) -> bool:
    """arnndn-fallback når DeepFilterNet ikke er tilgjengelig."""
    model = None
    for cand in [RNNOISE_PRIMARY] + RNNOISE_FALLBACKS:
        if os.path.isfile(cand):
            model = cand
            break
    if not model:
        bridge.warn("Ingen RNNoise-modell funnet i /tmp/mette-kai — hopper over arnndn-fallback.")
        return False
    bridge.log(f"Bruker arnndn-fallback med modell {model}")
    try:
        r = _run([
            ffmpeg, "-y", "-hide_banner", "-nostats", "-i", in_path,
            "-af", f"arnndn=m={model}",
            out_path,
        ], timeout=300)
        return r.returncode == 0 and os.path.isfile(out_path)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"arnndn-fallback feilet: {exc}")
        return False


# ─── ffmpeg filter helpers ─────────────────────────────────────────────────

def apply_filter(ffmpeg: str, in_path: str, out_path: str, af: str, timeout: int = 300) -> bool:
    """Kjør ett ffmpeg -af-pass. ALLTID asetpts=PTS-STARTPTS hvis kjeden inneholder atrim."""
    cmd = [ffmpeg, "-y", "-hide_banner", "-nostats", "-i", in_path, "-af", af, out_path]
    try:
        r = _run(cmd, timeout=timeout)
        if r.returncode != 0:
            bridge.warn(f"ffmpeg-filter feilet (exit {r.returncode}): {(r.stderr or '')[:300]}")
            return False
        return os.path.isfile(out_path)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"ffmpeg-filter exception: {exc}")
        return False


def copy_audio(ffmpeg: str, in_path: str, out_path: str) -> bool:
    """Re-encode/kopier til out_path (normaliserer container/sr) uten endring."""
    return apply_filter(ffmpeg, in_path, out_path, af="anull")


# ─── Mode implementations ──────────────────────────────────────────────────

def mode_denoise(ffmpeg: str, in_path: str, out_path: str, strength: float, tmp_dir: str) -> None:
    """De-rumble → DeepFilterNet (eller arnndn-fallback) → ev. afftdn skalert av strength."""
    # 1) De-rumble: fjern lav rumling før forsterkning slik at DF ikke "lærer" rumla.
    derumble = os.path.join(tmp_dir, "derumble.wav")
    if not apply_filter(ffmpeg, in_path, derumble, af="highpass=f=85"):
        derumble = in_path  # fortsett på rå hvis highpass svikter

    bridge.progress(35, 100, "Kjører DeepFilterNet…")
    df_out = os.path.join(tmp_dir, "df.wav")
    denoised = df_out
    if not run_deepfilternet(derumble, df_out):
        bridge.warn("DeepFilterNet ikke tilgjengelig — bruker arnndn-fallback.")
        if not run_rnnoise_fallback(ffmpeg, derumble, df_out):
            bridge.warn("Ingen ML-denoise tilgjengelig — bruker kun afftdn.")
            denoised = derumble

    # 2) Valgfri afftdn-polering skalert av strength (0-100 → nr 6-30 dB).
    bridge.progress(70, 100, "Polerer med afftdn…")
    if strength > 0:
        nr = round(6.0 + (strength / 100.0) * 24.0, 1)  # 6..30 dB
        if not apply_filter(ffmpeg, denoised, out_path, af=f"afftdn=nr={nr}:nt=w"):
            copy_audio(ffmpeg, denoised, out_path)
    else:
        copy_audio(ffmpeg, denoised, out_path)


def mode_deartifact(ffmpeg: str, in_path: str, out_path: str, wet_dry: float, tmp_dir: str) -> None:
    """Blend DF-output (wetDry%) med original + low-mid bell @250Hz for kropp.

    Fikser robotisk/vassen DF-output: mindre er mer. wetDry=85 → 85% DF, 15% original.
    """
    bridge.progress(35, 100, "Kjører DeepFilterNet for blending…")
    df_out = os.path.join(tmp_dir, "df.wav")
    if not run_deepfilternet(in_path, df_out):
        bridge.warn("DeepFilterNet ikke tilgjengelig — prøver arnndn-fallback for blending.")
        if not run_rnnoise_fallback(ffmpeg, in_path, df_out):
            bridge.warn("Ingen ML-denoise — deartifact faller tilbake til kun warmth-bell.")
            apply_filter(ffmpeg, in_path, out_path, af="equalizer=f=250:width_type=q:w=1.0:g=2")
            return

    wet = max(0.0, min(1.0, wet_dry / 100.0))
    dry = round(1.0 - wet, 3)
    wet = round(wet, 3)
    bridge.progress(70, 100, f"Blander {int(wet*100)}% DF / {int(dry*100)}% original + warmth…")

    # amix av to inputs med vekter, deretter low-mid bell @250Hz for restaurert kropp.
    # weights gir relativ miks; normalize=0 for å unngå auto-attenuering.
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-nostats",
        "-i", df_out, "-i", in_path,
        "-filter_complex",
        f"[0:a]volume={wet}[w];[1:a]volume={dry}[d];"
        f"[w][d]amix=inputs=2:normalize=0[m];"
        f"[m]equalizer=f=250:width_type=q:w=1.0:g=2[out]",
        "-map", "[out]",
        out_path,
    ]
    try:
        r = _run(cmd, timeout=300)
        if r.returncode != 0 or not os.path.isfile(out_path):
            bridge.warn(f"deartifact-miks feilet: {(r.stderr or '')[:300]} — bruker ren DF-output.")
            copy_audio(ffmpeg, df_out, out_path)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"deartifact exception: {exc} — bruker ren DF-output.")
        copy_audio(ffmpeg, df_out, out_path)


def mode_level(ffmpeg: str, in_path: str, out_path: str, reference_path: str | None) -> None:
    """2-pass loudnorm-match til referencePath (Mette) ELLER til -15.5 LUFS.

    loudnorm single-pass bommer på korte klipp → vi måler input_i og kjører
    2-pass (measured_*-parametre) for presis match.
    """
    target_lufs = DEFAULT_LEVEL_TARGET_LUFS
    if reference_path and os.path.isfile(reference_path):
        ref_lufs = measure_loudness(ffmpeg, reference_path)
        if ref_lufs is not None:
            target_lufs = round(ref_lufs, 2)
            bridge.log(f"Matcher loudness mot referanse {reference_path}: {target_lufs} LUFS")
        else:
            bridge.warn("Klarte ikke måle referanse-loudness — bruker -15.5 LUFS.")

    bridge.progress(30, 100, "Pass 1: måler loudness…")
    # Pass 1 — mål input med samme loudnorm-mål som pass 2.
    measured = None
    try:
        r = _run([
            ffmpeg, "-hide_banner", "-nostats", "-i", in_path,
            "-af", f"loudnorm=I={target_lufs}:TP=-2:LRA=11:print_format=json",
            "-f", "null", "-",
        ], timeout=180)
        text = (r.stderr or "") + (r.stdout or "")
        start = text.rfind("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            measured = json.loads(text[start:end + 1])
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"loudnorm pass 1 feilet: {exc}")

    bridge.progress(65, 100, "Pass 2: korrigerer loudness…")
    if measured:
        af = (
            f"loudnorm=I={target_lufs}:TP=-2:LRA=11:"
            f"measured_I={measured.get('input_i')}:"
            f"measured_TP={measured.get('input_tp')}:"
            f"measured_LRA={measured.get('input_lra')}:"
            f"measured_thresh={measured.get('input_thresh')}:"
            f"offset={measured.get('target_offset')}:linear=true"
        )
    else:
        # Fallback: single-pass (mindre presist, men bedre enn ingenting).
        af = f"loudnorm=I={target_lufs}:TP=-2:LRA=11"

    if not apply_filter(ffmpeg, in_path, out_path, af=af):
        copy_audio(ffmpeg, in_path, out_path)


def mode_deess(ffmpeg: str, in_path: str, out_path: str, strength: float) -> None:
    """deesser med intensitet skalert av strength (0-100 → i=0..0.5)."""
    intensity = round(max(0.0, min(0.5, (strength / 100.0) * 0.5)), 3)
    bridge.progress(50, 100, f"De-essing (i={intensity})…")
    if not apply_filter(ffmpeg, in_path, out_path, af=f"deesser=i={intensity}"):
        copy_audio(ffmpeg, in_path, out_path)


def mode_warmth(ffmpeg: str, in_path: str, out_path: str) -> None:
    """Low-shelf ~160Hz løft (kropp) + air high-shelf ~11kHz (luftighet)."""
    bridge.progress(50, 100, "Legger til varme + luft…")
    af = (
        "equalizer=f=160:width_type=q:w=0.7:g=2.5,"
        "equalizer=f=11000:width_type=q:w=0.7:g=2"
    )
    if not apply_filter(ffmpeg, in_path, out_path, af=af):
        copy_audio(ffmpeg, in_path, out_path)


def mode_dewind(ffmpeg: str, in_path: str, out_path: str, strength: float) -> None:
    """De-wind for utendørs-opptak (KIRURGISK, ikke ML → ingen robot-artefakter).

    Vind-energi er konsentrert < ~200Hz (topp 60-100Hz); stemmen vinner først fra
    ~250Hz. Derfor: bratt high-pass (2× 2-pole = 24dB/okt) + bell-dip i crossover-
    sonen (150-250Hz) der vinden fortsatt ligger, så restaurer litt varme @ 320Hz
    (laveste tale-dominante bånd) + svært lett bredbånd. strength styrer HP-frekvens
    og dip-dybde (mer vind → høyere HP). Mannsstemmens overtoner/formanter (250Hz+)
    bærer klarheten selv om fundamentalen kuttes (missing-fundamental).
    """
    hp = round(110.0 + (strength / 100.0) * 70.0, 0)        # 110..180 Hz
    dip = round(-(4.0 + (strength / 100.0) * 6.0), 1)        # -4..-10 dB @ crossover
    dip_f = round(hp * 1.3, 0)                               # crossover-bell over HP
    bridge.progress(50, 100, f"De-wind (HP {hp:.0f}Hz, dip {dip}dB @ {dip_f:.0f}Hz)…")
    af = (
        f"highpass=f={hp:.0f}:poles=2,highpass=f={hp:.0f}:poles=2,"
        f"equalizer=f={dip_f:.0f}:width_type=q:w=1.0:g={dip},"
        "equalizer=f=320:width_type=q:w=1.2:g=2.5,"
        "afftdn=nr=6:nt=w"
    )
    if not apply_filter(ffmpeg, in_path, out_path, af=af):
        copy_audio(ffmpeg, in_path, out_path)


# ─── auto: mål → velg kjede ────────────────────────────────────────────────

def choose_auto_mode(metrics: dict) -> str:
    """Speiler vo_analyze: velg primær reparasjon ut fra målte issues.

    Heuristikk:
      - snrDb lav (< 12) ELLER noiseDb høyt (> -45) → denoise (mest påtrengende).
      - svært lav SNR (< 3, robotisk-risiko etter denoise) → deartifact-flagg
        håndteres etter denoise; her velger vi denoise og blander mildt.
      - ellers hvis lufs langt unna mål (> 4 LU avvik) → level.
      - default → level (trygg, ikke-destruktiv normalisering).
    """
    snr = metrics.get("snrDb")
    noise = metrics.get("noiseDb")
    lufs = metrics.get("lufs")

    noisy = (snr is not None and snr < 12) or (noise is not None and noise > -45)
    if noisy:
        # Veldig lav SNR → deartifact (DF + blend) for å unngå robotisk resultat.
        if snr is not None and snr < 3:
            return "deartifact"
        return "denoise"
    if lufs is not None and abs(lufs - DEFAULT_LEVEL_TARGET_LUFS) > 4:
        return "level"
    return "level"


# ─── Entry point ───────────────────────────────────────────────────────────

def run(params: dict, dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    output_path = (params.get("outputPath") or "").strip()
    mode = (params.get("mode") or "auto").strip().lower()
    strength = params.get("strength")
    strength = 60.0 if strength is None else float(strength)
    strength = max(0.0, min(100.0, strength))
    wet_dry = params.get("wetDry")
    wet_dry = 85.0 if wet_dry is None else float(wet_dry)
    wet_dry = max(0.0, min(100.0, wet_dry))
    reference_path = (params.get("referencePath") or "").strip() or None

    if not input_path:
        bridge.error("inputPath is required")
        sys.exit(1)
    if not output_path:
        bridge.error("outputPath is required")
        sys.exit(1)
    if mode not in VALID_MODES:
        bridge.error(f"Ugyldig mode '{mode}'. Gyldige: {', '.join(sorted(VALID_MODES))}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": (
                f"Would repair {input_path} → {output_path} "
                f"with mode={mode} strength={strength} wetDry={wet_dry}"
                + (f" ref={reference_path}" if reference_path else "")
            ),
            "outputPath": output_path,
            "mode": mode,
        })
        return

    if not os.path.isfile(input_path):
        bridge.error(f"inputPath finnes ikke: {input_path}")
        sys.exit(1)

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg er ikke installert — kreves for VO-reparasjon (brew install ffmpeg).")
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

    # ── 1) Mål BEFORE ──
    bridge.progress(5, 100, "Måler input (before)…")
    before = measure_metrics(ffmpeg, input_path)
    bridge.log(f"Before: noiseDb={before['noiseDb']} snrDb={before['snrDb']} lufs={before['lufs']}")

    # ── 2) Velg effektiv mode (auto → konkret) ──
    effective_mode = mode
    if mode == "auto":
        effective_mode = choose_auto_mode(before)
        bridge.log(f"auto → valgte kjede: {effective_mode}")

    # ── 3) Kjør kjeden i et midlertidig arbeidsområde ──
    import tempfile
    tmp_dir = tempfile.mkdtemp(prefix="vo_repair_")
    try:
        bridge.progress(20, 100, f"Reparerer (mode={effective_mode})…")
        if effective_mode == "denoise":
            mode_denoise(ffmpeg, input_path, output_path, strength, tmp_dir)
        elif effective_mode == "deartifact":
            mode_deartifact(ffmpeg, input_path, output_path, wet_dry, tmp_dir)
        elif effective_mode == "level":
            mode_level(ffmpeg, input_path, output_path, reference_path)
        elif effective_mode == "deess":
            mode_deess(ffmpeg, input_path, output_path, strength)
        elif effective_mode == "warmth":
            mode_warmth(ffmpeg, input_path, output_path)
        elif effective_mode == "dewind":
            mode_dewind(ffmpeg, input_path, output_path, strength)
        else:  # noqa: defensive — bør være dekket av VALID_MODES
            bridge.error(f"Uventet effektiv mode: {effective_mode}")
            sys.exit(1)
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass

    if not os.path.isfile(output_path):
        bridge.error(f"Reparasjon produserte ingen output ved {output_path}")
        sys.exit(1)

    # ── 4) Mål AFTER ──
    bridge.progress(90, 100, "Måler resultat (after)…")
    after = measure_metrics(ffmpeg, output_path)
    bridge.log(f"After: noiseDb={after['noiseDb']} snrDb={after['snrDb']} lufs={after['lufs']}")

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "outputPath": output_path,
        "mode": effective_mode,
        "requestedMode": mode,
        "before": before,
        "after": after,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
