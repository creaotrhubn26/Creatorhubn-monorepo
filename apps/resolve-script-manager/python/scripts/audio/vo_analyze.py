"""VO Analyze — diagnostiserer voice-over-klipp før reparasjon/miks.

Hva og hvorfor:
  Voice-over fra ulike kilder (regissør, brud, gjester) varierer enormt i
  kvalitet: noen er rene (lett rens), andre har SNR ≈ 0 (rom-støy like høyt som
  stemmen). For å velge RIKTIG reparasjonskjede per klipp må vi først MÅLE hvert
  klipp objektivt: støygulv, tale-topp, SNR, integrert loudness (LUFS) og peak.
  Ut fra målingene utledes konkrete "issues" og en anbefalt rekkefølge av
  reparasjons-modes (level/denoise/deartifact/deess/warmth) som vo_repair og
  vo_mix_master deretter kan bruke.

Måle-metode (per klipp):
  - Last signalet (librosa hvis tilgjengelig, ellers ffmpeg→raw float).
  - Støygulv  = median av de 10% laveste 0.3s-RMS-vinduene (robust mot enkelt-
    glitcher; ren stillhet i klippet).
  - Tale-topp = 95-persentilen av 0.3s-RMS-vinduer (robust mot transient-spiker).
  - SNR (dB)  = tale-topp_dB − støygulv_dB.
  - LUFS      = ffmpeg loudnorm print_format=json (input_i, integrert).
  - peakDb    = ffmpeg astats / volumedetect max-peak.
  - Spektral-heuristikk: high/low energi-ratio for metallisk/skarphet,
    sibilance-bånd (5-9kHz) relativt til tale-bånd for deess-behov.

Input params:
  inputs:        string[] — fulle stier til wav-klipp som skal analyseres
  referencePath: valgfri sti til ren referanse (f.eks. Mette/brud) for å avgjøre
                 om et klipp er "lav" relativt til ønsket integrert loudness

Output: { clips: [ {
            path, noiseDb, snrDb, lufs, peakDb,
            issues: string[],
            recommended: string[]   # av: "level","denoise","deartifact","deess","warmth"
          } ] }
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

# scripts/audio/vo_analyze.py → tre nivåer opp = python/ (der bridge.py bor).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VENV_PYTHON = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
)

# Terskler (dB / LUFS) for heuristikk → issues/recommended.
SNR_NOISY = 15.0          # snr under dette → "støy" → denoise
SNR_VERY_NOISY = 6.0      # nær 0 → tung sak, denoise + ev. deartifact-blend etterpå
LUFS_LOW_ABS = -23.0      # uten referanse: under dette regnes som "lav"
LUFS_LOW_GAP = 3.0        # med referanse: mer enn dette under ref → "lav"
PEAK_CLIP_DB = -0.5       # peak over dette → potensiell clipping → forsiktig level
BRIGHT_RATIO_DB = 4.0     # high/low-energi-ratio over dette → metallisk/skarp
SIBILANCE_RATIO_DB = 2.0  # sibilance-bånd over tale-bånd → "skarp s/sibilance" → deess


# ─── Verktøy-discovery (samme mønster som fetch_source_song) ──────────────

def find_ffmpeg() -> str | None:
    for cand in [
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ]:
        if cand and os.path.isfile(cand):
            return cand
    return None


def find_ffprobe(ffmpeg: str | None) -> str | None:
    for cand in [
        shutil.which("ffprobe"),
        ffmpeg.replace("ffmpeg", "ffprobe") if ffmpeg else None,
        "/opt/homebrew/bin/ffprobe",
        "/usr/local/bin/ffprobe",
    ]:
        if cand and os.path.isfile(cand):
            return cand
    return None


def pick_python() -> str:
    return VENV_PYTHON if os.path.isfile(VENV_PYTHON) else "python3"


# ─── LUFS + peak via ffmpeg ────────────────────────────────────────────────

def measure_lufs_peak(ffmpeg: str, path: str) -> dict:
    """Integrert LUFS + true/sample-peak via loudnorm print_format=json.

    loudnorm gir input_i (integrert LUFS), input_tp (true peak dBTP) i ett kall.
    Returnerer {} ved feil slik at kalleren kan falle tilbake.
    """
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", path,
        "-af", "loudnorm=print_format=json",
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"loudnorm-måling feilet for {os.path.basename(path)}: {exc}")
        return {}
    # loudnorm skriver JSON til stderr, ofte som siste blokk.
    text = (proc.stderr or "") + "\n" + (proc.stdout or "")
    start = text.rfind("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    blob = text[start:end + 1]
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        # Fall tilbake: finn den siste komplette {...}-blokken linje for linje.
        return {}
    out: dict = {}
    try:
        lufs = float(data.get("input_i"))
        # loudnorm setter -inf-ish til "-70.0" eller liknende for stillhet.
        out["lufs"] = lufs if lufs > -120 else None
    except (TypeError, ValueError):
        out["lufs"] = None
    try:
        out["peakDb"] = float(data.get("input_tp"))
    except (TypeError, ValueError):
        out["peakDb"] = None
    return out


def measure_peak_fallback(ffmpeg: str, path: str) -> float | None:
    """Sample-peak via astats hvis loudnorm ikke ga true-peak."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", path,
        "-af", "astats=metadata=1:reset=0",
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception:  # noqa: BLE001
        return None
    peak = None
    for line in (proc.stderr or "").splitlines():
        s = line.strip()
        if "Peak level dB" in s:
            try:
                peak = max(peak if peak is not None else -999.0,
                           float(s.split(":")[-1].strip()))
            except ValueError:
                continue
    return peak


# ─── RMS-sveip + SNR + spektral-heuristikk (librosa i venv) ────────────────

_ANALYZE_SNIPPET = r"""
import sys, json
try:
    import numpy as np
    import librosa
except Exception as exc:
    print(json.dumps({'error': 'librosa_not_installed', 'detail': str(exc)}))
    sys.exit(0)

path = sys.argv[1]
try:
    y, sr = librosa.load(path, sr=None, mono=True)
except Exception as exc:
    print(json.dumps({'error': 'load_failed', 'detail': str(exc)}))
    sys.exit(0)

if y is None or len(y) == 0:
    print(json.dumps({'error': 'empty_signal'}))
    sys.exit(0)

duration = float(len(y) / sr)

# 0.3s-RMS-sveip (hop 0.1s) for støygulv (lav-percentil) og tale-topp (høy-percentil).
win = max(1, int(0.3 * sr))
hop = max(1, int(0.1 * sr))
frames = []
i = 0
while i + win <= len(y):
    seg = y[i:i + win]
    frames.append(float(np.sqrt(np.mean(seg * seg)) + 1e-12))
    i += hop
if not frames:
    frames = [float(np.sqrt(np.mean(y * y)) + 1e-12)]
frames = np.array(frames)

def to_db(x):
    return float(20.0 * np.log10(max(float(x), 1e-12)))

# Støygulv: median av de 10% laveste vinduene (robust mot enkelt-glitcher).
sorted_rms = np.sort(frames)
n_low = max(1, int(len(sorted_rms) * 0.10))
noise_rms = float(np.median(sorted_rms[:n_low]))
# Tale-topp: 95-persentil (robust mot transient-spiker).
speech_rms = float(np.percentile(frames, 95))

noise_db = to_db(noise_rms)
speech_db = to_db(speech_rms)
snr_db = speech_db - noise_db

# ── Spektral-heuristikk (på tale-aktive segmenter) ──
# Velg vinduer over støygulv+6dB som "tale", konkatener for spektrum-analyse.
thresh = noise_rms * (10 ** (6.0 / 20.0))
speech_mask = frames > thresh
# Kjør STFT på hele signalet; vekt mot tale-rammer.
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)) ** 2
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)

def band_energy(f_lo, f_hi):
    idx = np.where((freqs >= f_lo) & (freqs < f_hi))[0]
    if len(idx) == 0:
        return 1e-12
    return float(np.mean(S[idx, :]) + 1e-12)

low_e = band_energy(120, 2000)      # kropp/tale-fundament
high_e = band_energy(6000, 12000)   # luft/skarphet/metallisk
speech_e = band_energy(300, 4000)   # konsonant/tale-kjerne
sib_e = band_energy(5000, 9000)     # sibilance-bånd (s/sj)
rumble_e = band_energy(20, 80)      # lavfrekvent rumling/handling

bright_ratio_db = to_db(high_e) - to_db(low_e)
sibilance_ratio_db = to_db(sib_e) - to_db(speech_e)
rumble_ratio_db = to_db(rumble_e) - to_db(speech_e)

print(json.dumps({
    'duration': duration,
    'sampleRate': int(sr),
    'noiseDb': round(noise_db, 2),
    'speechDb': round(speech_db, 2),
    'snrDb': round(snr_db, 2),
    'brightRatioDb': round(bright_ratio_db, 2),
    'sibilanceRatioDb': round(sibilance_ratio_db, 2),
    'rumbleRatioDb': round(rumble_ratio_db, 2),
    'speechFrameFraction': round(float(np.mean(speech_mask)), 3),
}))
"""


def measure_signal(path: str) -> dict:
    """Kjør RMS/SNR/spektral-analyse via librosa i venv. {} ved feil/manglende lib."""
    cache_path = bridge.cache_path_for("vo-analyze", path, extra_key="v1")
    if cache_path and os.path.isfile(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if isinstance(cached, dict) and "snrDb" in cached:
                bridge.log(f"Analyse-cache treff ({os.path.basename(path)})")
                return cached
        except (OSError, json.JSONDecodeError):
            pass

    python = pick_python()
    try:
        r = subprocess.run(
            [python, "-c", _ANALYZE_SNIPPET, path],
            capture_output=True, text=True, timeout=240,
        )
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"librosa-analyse feilet for {os.path.basename(path)}: {exc}")
        return {}
    for line in (r.stdout or "").splitlines()[::-1]:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            if "error" in data:
                bridge.warn(
                    f"Signal-analyse utilgjengelig for {os.path.basename(path)}: "
                    f"{data.get('error')} {data.get('detail', '')}"
                )
                return {}
            if cache_path:
                try:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(data, f)
                except OSError:
                    pass
            return data
    return {}


def measure_signal_ffmpeg_fallback(ffmpeg: str, path: str) -> dict:
    """Grov SNR-fallback uten librosa: bruk astats RMS + peak.

    Mindre presis (ingen tidsvindu-sveip), men gir et brukbart estimat slik at
    analysen ikke kollapser helt når venv/librosa mangler.
    """
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", path,
        "-af", "astats=metadata=1:reset=0",
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception:  # noqa: BLE001
        return {}
    rms = None
    peak = None
    noise = None
    for line in (proc.stderr or "").splitlines():
        s = line.strip()
        if "RMS level dB" in s:
            try:
                rms = float(s.split(":")[-1].strip())
            except ValueError:
                pass
        elif "Peak level dB" in s:
            try:
                peak = float(s.split(":")[-1].strip())
            except ValueError:
                pass
        elif "Min level" in s or "Noise floor" in s:
            # ikke alltid tilstede; ignorer
            pass
    if rms is None:
        return {}
    # Anta støygulv ~ RMS − en konservativ margin når vi ikke kan måle stillhet.
    noise = rms - 18.0
    return {
        "noiseDb": round(noise, 2),
        "speechDb": round(rms, 2),
        "snrDb": round(rms - noise, 2),
        "peakDb": round(peak, 2) if peak is not None else None,
        "_fallback": True,
    }


# ─── Issues/recommended-utledning ──────────────────────────────────────────

def derive_issues(metrics: dict, ref_lufs: float | None) -> tuple[list[str], list[str]]:
    """Oversett rå målinger til menneskelige issues + anbefalte repair-modes.

    recommended-rekkefølge speiler en fornuftig signalkjede:
      denoise → deartifact → deess → warmth → level (level sist så loudness
      matcher ETTER spektral-behandling).
    """
    issues: list[str] = []
    rec: list[str] = []

    snr = metrics.get("snrDb")
    lufs = metrics.get("lufs")
    peak = metrics.get("peakDb")
    bright = metrics.get("brightRatioDb")
    sib = metrics.get("sibilanceRatioDb")
    rumble = metrics.get("rumbleRatioDb")

    # 1) Støy / SNR
    very_noisy = False
    if snr is not None:
        if snr < SNR_VERY_NOISY:
            issues.append(f"svært høy støy (SNR {snr:.1f} dB)")
            rec.append("denoise")
            very_noisy = True
        elif snr < SNR_NOISY:
            issues.append(f"hørbar støy (SNR {snr:.1f} dB)")
            rec.append("denoise")

    # 2) Rumling/lavfrekvent (handling/aircon) → også denoise (de-rumble inngår)
    if rumble is not None and rumble > 0.0:
        issues.append("lavfrekvent rumling")
        if "denoise" not in rec:
            rec.append("denoise")

    # 3) Metallisk/robotisk lyd (typisk etter aggressiv denoise) → deartifact.
    #    Sterk høy-bånd-overvekt på ellers lav-SNR-klipp = sannsynlig vassen.
    if bright is not None and bright > BRIGHT_RATIO_DB:
        if very_noisy:
            issues.append("metallisk/vassen karakter")
            rec.append("deartifact")
        else:
            issues.append("noe skarp/lys tonebalanse")

    # 4) Sibilance → deess
    if sib is not None and sib > SIBILANCE_RATIO_DB:
        issues.append("skarp sibilance (s/sj)")
        rec.append("deess")

    # 5) Tynn/mangler kropp → warmth (lav-bånd svakt relativt til tale)
    if bright is not None and bright < -8.0:
        # mye mer lav enn høy = mørk/dempet, ikke tynn — hopp warmth
        pass
    elif metrics.get("speechDb") is not None and (bright is not None and bright > 1.0):
        # lys og tynn → warmth gir kropp
        if "warmth" not in rec:
            issues.append("tynn/lite kropp")
            rec.append("warmth")

    # 6) Loudness / nivå
    if peak is not None and peak > PEAK_CLIP_DB:
        issues.append(f"nær clipping (peak {peak:.1f} dBTP)")
        rec.append("level")
    if lufs is not None:
        if ref_lufs is not None:
            if lufs < ref_lufs - LUFS_LOW_GAP:
                issues.append(f"lav ift. referanse ({lufs:.1f} vs {ref_lufs:.1f} LUFS)")
                rec.append("level")
        elif lufs < LUFS_LOW_ABS:
            issues.append(f"lavt nivå ({lufs:.1f} LUFS)")
            rec.append("level")

    if not issues:
        issues.append("ingen vesentlige problemer — ren tale")

    # Dedup men bevar kjede-rekkefølge: denoise→deartifact→deess→warmth→level
    order = ["denoise", "deartifact", "deess", "warmth", "level"]
    rec = [m for m in order if m in rec]
    return issues, rec


def analyze_one(path: str, ffmpeg: str, ref_lufs: float | None) -> dict:
    """Analyser ett klipp. Robust: feil gir et klipp-objekt med issue-melding."""
    if not os.path.isfile(path):
        return {
            "path": path,
            "noiseDb": None, "snrDb": None, "lufs": None, "peakDb": None,
            "issues": ["fil ikke funnet"],
            "recommended": [],
        }

    metrics: dict = {}
    sig = measure_signal(path)
    if not sig:
        sig = measure_signal_ffmpeg_fallback(ffmpeg, path)
    metrics.update(sig or {})

    loud = measure_lufs_peak(ffmpeg, path)
    if loud:
        if loud.get("lufs") is not None:
            metrics["lufs"] = loud["lufs"]
        if loud.get("peakDb") is not None:
            metrics["peakDb"] = loud["peakDb"]
    if metrics.get("peakDb") is None:
        pk = measure_peak_fallback(ffmpeg, path)
        if pk is not None:
            metrics["peakDb"] = pk

    issues, recommended = derive_issues(metrics, ref_lufs)

    return {
        "path": path,
        "noiseDb": metrics.get("noiseDb"),
        "snrDb": metrics.get("snrDb"),
        "lufs": metrics.get("lufs"),
        "peakDb": metrics.get("peakDb"),
        "speechDb": metrics.get("speechDb"),
        "durationSeconds": metrics.get("duration"),
        "issues": issues,
        "recommended": recommended,
        "fallback": bool(metrics.get("_fallback")),
    }


def run(params: dict, dry_run: bool) -> None:
    # 1) Les + valider params
    inputs = params.get("inputs") or []
    if isinstance(inputs, str):
        inputs = [inputs]
    inputs = [str(p).strip() for p in inputs if str(p).strip()]
    reference_path = (params.get("referencePath") or "").strip()

    if not inputs:
        bridge.error("inputs (array av wav-stier) er påkrevd")
        sys.exit(1)

    # 2) Dry-run: beskriv hva som ville skjedd.
    if dry_run:
        bridge.result({
            "summary": (
                f"Ville analysert {len(inputs)} klipp "
                f"(referanse: {reference_path or 'ingen'}) — måler støygulv, SNR, "
                "LUFS, peak og spektral-balanse, og foreslår repair-modes."
            ),
            "clips": [
                {"path": p, "issues": ["(dry-run — ikke målt)"], "recommended": []}
                for p in inputs
            ],
        })
        return

    # 3) Verktøy
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg er ikke installert — kreves for LUFS/peak-måling")
        sys.exit(1)
    if find_ffprobe(ffmpeg) is None:
        bridge.warn("ffprobe ikke funnet — varighet kan mangle på enkelte klipp")

    # 4) Referanse-loudness (valgfri) — måles én gang som sammenligningsgrunnlag.
    ref_lufs: float | None = None
    if reference_path:
        if os.path.isfile(reference_path):
            bridge.progress(0, len(inputs) + 1, "Måler referanse-loudness…")
            ref = measure_lufs_peak(ffmpeg, reference_path)
            ref_lufs = ref.get("lufs")
            if ref_lufs is not None:
                bridge.log(f"Referanse-loudness: {ref_lufs:.1f} LUFS ({os.path.basename(reference_path)})")
            else:
                bridge.warn("Kunne ikke måle referanse-loudness — bruker absolutt-terskel for 'lav'")
        else:
            bridge.warn(f"referencePath finnes ikke: {reference_path} — ignoreres")

    # 5) Analyser hvert klipp (try/except per klipp → ett dårlig klipp stopper ikke resten)
    total = len(inputs)
    clips: list[dict] = []
    for idx, path in enumerate(inputs):
        label = f"Analyserer {os.path.basename(path)} ({idx + 1}/{total})…"
        bridge.progress(idx, total, label)
        bridge.log(label)
        try:
            clip = analyze_one(path, ffmpeg, ref_lufs)
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Analyse av {os.path.basename(path)} feilet: {exc}")
            clip = {
                "path": path,
                "noiseDb": None, "snrDb": None, "lufs": None, "peakDb": None,
                "issues": [f"analyse-feil: {exc}"],
                "recommended": [],
            }
        # Kort, lesbar oppsummering i loggen.
        snr = clip.get("snrDb")
        lufs = clip.get("lufs")
        bridge.log(
            f"  → SNR={snr if snr is None else f'{snr:.1f}'} dB  "
            f"LUFS={lufs if lufs is None else f'{lufs:.1f}'}  "
            f"issues={clip.get('issues')}  rec={clip.get('recommended')}"
        )
        clips.append(clip)

    bridge.progress(total, total, "Ferdig.")

    # 6) Ett samlet result med {clips:[...]}.
    bridge.result({
        "clips": clips,
        "referencePath": reference_path or None,
        "referenceLufs": ref_lufs,
        "count": len(clips),
    })


if __name__ == "__main__":
    bridge.main_guard(run)
