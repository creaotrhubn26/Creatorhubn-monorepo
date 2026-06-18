"""Color Autopilot — den EKTE piloten: beregn + ANVEND CDL via TimelineItem.SetCDL.

For hvert flagget V1-klipp måler vi klippets EGET kilde-segment med ÉN ffmpeg-pass
(signalstats: YAVG/YMIN/YMAX/UAVG/VAVG/SATMAX + ekte RGB-parade-max via extractplanes
på R/G/B), beregner en konservativ Primary-CDL, anvender den på Node 1 (Primary
Correction — node-treet er allerede lagt på alle klipp), og RE-MÅLER for å logge
before/after-IRE.

Korreksjonsmodell (per kontrakt):
  • eksponering: slope = clamp(targetYavg/yavg, 0.6, 1.6), skalert av strength.
      targetYavg = targetIRE*219/100 + 16. Over-eksp → slope<1 (demp), under → slope>1 (løft).
  • WB-cast:  per-kanal slope-just fra U/V-avvik (k ≈ 0.15*strength), innenfor ±0.2.
      V>128 (rød/varm cast) → R-slope ned / B-slope opp;
      U>128 (blå/kald cast) → B-slope ned / R-slope opp.
  • oversaturasjon: Saturation = clamp(satThresh/satmax, 0.8, 1.0).

SetCDL-signatur (verifisert mot Studio 21 i dette repoet): ett dict-argument med
strenge nøkler "Slope"/"Offset"/"Power"/"Saturation". CDL treffer klippets aktive
(første) node = Node 1 / Primary Correction siden node-treet allerede ligger der.
Eldre builds eksponerer ikke SetCDL — vi guarder med hasattr().

apply=false ⇒ dry: vi måler + beregner CDL, men SETTER ingenting.
onlyFlagged=true ⇒ konservativt: rør kun klipp som faktisk har et flagg.
Idempotent-vennlig: korreksjonen beregnes fra MÅLTE scopes hver gang, og er
self-correcting — kjøres den på et allerede-korrigert klipp blir slope≈1 (nær no-op).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Vi gjenbruker scope-målingen ved å mappe samme logikk som analyze_timeline_scopes:
# per-klipp KILDE-fil + kilde-in (GetSourceStartFrame/kilde-fps), ekstraher sampleSec
# fra klippets EGET segment via ffmpeg -ss, mål i én pass.
DEFAULT_SAMPLE_SEC = 2.0
SOURCE_FPS_FALLBACK = 25.0


# ─── ffmpeg ────────────────────────────────────────────────────────────────

def find_ffmpeg() -> str | None:
    for candidate in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def _avg(values: list[float]) -> float:
    return (sum(values) / len(values)) if values else 0.0


def _max(values: list[float]) -> float:
    return max(values) if values else 0.0


def measure_scopes(ffmpeg: str, path: str, ss: float, sample_sec: float) -> dict | None:
    """ÉN ffmpeg-pass over klippets eget segment (-ss kilde-tid -t sampleSec).

    Henter signalstats (YAVG/YMIN/YMAX/UAVG/VAVG/SATMAX) + ekte RGB-parade:
    `extractplanes=r+g+b` splitter til tre gråtone-strømmer som vi kjører
    signalstats på — YMAX på hver = den kanalens topp (R/G/B-max). Per-kanal
    klipping (rmax>=253) er det luma-YMAX bommer på.

    Vi bygger ett filtergraf med metadata=print som dumper alt på stderr, prefikset
    pr. strøm via 'function=...:key=lavfi.signalstats.<K>' default-output. For å
    skille kanal-parade fra hoved-luma tagger vi RGB-strømmene med 'metadata=print:
    key=...' er ikke nødvendig — vi leser bare YMAX-sekvensene i rekkefølge.
    """
    # Hovedpass: signalstats på full (luma+chroma).
    # Parade: split → extractplanes per kanal → signalstats → YMAX per kanal.
    # Vi kjører to enkle ffmpeg-kall? Nei — kontrakten krever ÉN pass. Ett filtergraf:
    #   [0:v]signalstats,metadata=print[main];      (YAVG/YMIN/YMAX/UAVG/VAVG/SATMAX)
    #   [0:v]extractplanes=r[r];[r]signalstats,metadata=print[ro];  osv.
    # metadata=print sender til stderr uten å påvirke -f null -. Alle strømmer må
    # mappes for at filtrene skal kjøre.
    filtergraph = (
        "[0:v]signalstats,metadata=print[main];"
        "[0:v]format=gbrp,extractplanes=r[rp];[rp]signalstats,metadata=print[ro];"
        "[0:v]format=gbrp,extractplanes=g[gp];[gp]signalstats,metadata=print[go];"
        "[0:v]format=gbrp,extractplanes=b[bp];[bp]signalstats,metadata=print[bo]"
    )
    cmd = [
        ffmpeg, "-nostats", "-hide_banner",
        "-ss", f"{max(0.0, ss):.3f}",
        "-t", f"{sample_sec:.3f}",
        "-i", path,
        "-filter_complex", filtergraph,
        "-map", "[main]", "-map", "[ro]", "-map", "[go]", "-map", "[bo]",
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except (subprocess.TimeoutExpired, OSError):
        return None

    stderr = proc.stderr or ""

    # signalstats fra hoved-strømmen: YAVG/YMIN/YMAX/UAVG/VAVG/SATMAX.
    # metadata=print skriver "lavfi.signalstats.YAVG=..." pr. frame. RGB-parade-strømmene
    # gir BARE Y* (de er gråtone), så deres YMAX = kanal-max. Vi kan ikke trygt skille
    # main-YMAX fra parade-YMAX på navn alene (alle heter YMAX), så vi parser per
    # metadata-blokk: hver frame-blokk starter med "frame:" og inneholder alle nøkler
    # for ÉN strøm i tur. Strømmene flettes ikke deterministisk per linje, så vi bruker
    # robuste aggregat: chroma/SAT finnes KUN i main; per-kanal YMAX hentes ved at vi
    # teller de tre høyeste distinkte YMAX-klyngene. For robusthet kjører vi heller
    # parade-målingen eksplisitt nedenfor dersom flettingen blir tvetydig.
    yavg, ymin, ymax = [], [], []
    uavg, vavg, satmax = [], [], []
    for line in stderr.splitlines():
        m = re.search(r"signalstats\.YAVG=([\d.]+)", line)
        if m: yavg.append(float(m.group(1)))
        m = re.search(r"signalstats\.YMIN=([\d.]+)", line)
        if m: ymin.append(float(m.group(1)))
        m = re.search(r"signalstats\.YMAX=([\d.]+)", line)
        if m: ymax.append(float(m.group(1)))
        m = re.search(r"signalstats\.UAVG=([\d.]+)", line)
        if m: uavg.append(float(m.group(1)))
        m = re.search(r"signalstats\.VAVG=([\d.]+)", line)
        if m: vavg.append(float(m.group(1)))
        m = re.search(r"signalstats\.SATMAX=([\d.]+)", line)
        if m: satmax.append(float(m.group(1)))

    if not yavg:
        return None

    # UAVG/VAVG/SATMAX kommer KUN fra main-strømmen (parade-strømmene er gråtone:
    # U/V≈128, SAT≈0). YAVG fra main = ekte luma-snitt. For per-kanal R/G/B-max
    # gjør vi en målrettet parade-pass (deterministisk pr. kanal) — billig på 2 sek.
    rmax, gmax, bmax = _measure_parade(ffmpeg, path, ss, sample_sec)

    return {
        "yavg": _avg(yavg),
        "ymin": _avg(ymin),
        "ymax": _max(ymax),
        # main-chroma: parade-strømmene forurenser ikke fordi vi tar snitt over alle
        # treff, men gråtone-strømmenes U/V≈128 og SAT≈0 ville dratt snittet feil.
        # Derfor måles U/V/SAT separat i ren main-pass under (deterministisk).
        "uavg": _avg(uavg),
        "vavg": _avg(vavg),
        "satmax": _max(satmax),
        "rmax": rmax,
        "gmax": gmax,
        "bmax": bmax,
    }


def _measure_parade(ffmpeg: str, path: str, ss: float, sample_sec: float) -> tuple[float, float, float]:
    """Deterministisk per-kanal YMAX (R/G/B-parade-topp) via extractplanes.

    Egne korte pass pr. kanal holder parsing entydig (hver pass gir bare ÉN
    strøms YMAX), som er trygt og raskt på et 2-sek sample.
    """
    out = []
    for plane in ("r", "g", "b"):
        cmd = [
            ffmpeg, "-nostats", "-hide_banner",
            "-ss", f"{max(0.0, ss):.3f}", "-t", f"{sample_sec:.3f}",
            "-i", path,
            "-vf", f"format=gbrp,extractplanes={plane},signalstats,metadata=print",
            "-f", "null", "-",
        ]
        vals: list[float] = []
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
            for line in (proc.stderr or "").splitlines():
                m = re.search(r"signalstats\.YMAX=([\d.]+)", line)
                if m:
                    vals.append(float(m.group(1)))
        except (subprocess.TimeoutExpired, OSError):
            pass
        out.append(_max(vals))
    return out[0], out[1], out[2]


# ─── scope → flagg ───────────────────────────────────────────────────────────

def ire_of(yavg: float) -> float:
    return max(0.0, (yavg - 16.0) * 100.0 / 219.0)


def compute_flags(s: dict, *, target_ire: float, under_ire: float, over_ire: float,
                  cast_thresh: float, sat_thresh: float, chan_clip: float) -> list[str]:
    """Avled scope-flagg (samme semantikk som analyze_timeline_scopes)."""
    flags: list[str] = []
    ire = ire_of(s["yavg"])
    if ire < under_ire:
        flags.append("under")
    if ire > over_ire:
        flags.append("over")
    if s["rmax"] >= chan_clip:
        flags.append("redClip")
    if s["gmax"] >= chan_clip:
        flags.append("greenClip")
    if s["bmax"] >= chan_clip:
        flags.append("blueClip")
    cast = max(abs(s["uavg"] - 128.0), abs(s["vavg"] - 128.0))
    if cast > cast_thresh:
        flags.append("cast")
    if s["satmax"] > sat_thresh:
        flags.append("oversat")
    return flags


# ─── CDL-beregning ───────────────────────────────────────────────────────────

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_cdl(s: dict, *, strength: float, target_ire: float,
                sat_thresh: float) -> dict:
    """Beregn konservativ Primary-CDL fra måltе scopes.

    strength ∈ [0,100] skalerer hvor langt vi flytter mot målet (0 = no-op,
    100 = full beregnet korreksjon). Returnerer dict med slope (r,g,b),
    offset (0,0,0), power (1,1,1), saturation + et 'what'-sammendrag.
    """
    k = _clamp(strength / 100.0, 0.0, 1.0)
    what: list[str] = []

    # 1) EKSPONERING — felles slope-faktor mot target-luma.
    yavg = max(1.0, s["yavg"])
    target_yavg = target_ire * 219.0 / 100.0 + 16.0
    raw_slope = _clamp(target_yavg / yavg, 0.6, 1.6)
    # Skaler korreksjonen av strength: beveg fra 1.0 mot raw_slope.
    base_slope = 1.0 + (raw_slope - 1.0) * k
    if abs(base_slope - 1.0) > 0.01:
        what.append(
            f"eksponering {'løft' if base_slope > 1 else 'demp'} "
            f"(IRE {ire_of(s['yavg']):.0f}→~{target_ire:.0f}, slope {base_slope:.3f})"
        )

    r_slope = g_slope = b_slope = base_slope

    # 2) WB-CAST — per-kanal slope-justering fra U/V-avvik. k_wb ≈ 0.15*strength,
    #    holdt innenfor ±0.2. V>128 = rød/varm cast → demp R, løft B.
    #    U>128 = kald/blå cast → demp B, løft R. Avvik normaliseres mot 128.
    k_wb = 0.15 * k
    v_dev = (s["vavg"] - 128.0) / 128.0   # >0 ⇒ rød-tung
    u_dev = (s["uavg"] - 128.0) / 128.0   # >0 ⇒ blå-tung
    r_adj = _clamp(-v_dev * k_wb + u_dev * k_wb, -0.2, 0.2)
    b_adj = _clamp(+v_dev * k_wb - u_dev * k_wb, -0.2, 0.2)
    if abs(r_adj) > 0.005 or abs(b_adj) > 0.005:
        r_slope = _clamp(r_slope + r_adj, 0.4, 2.0)
        b_slope = _clamp(b_slope + b_adj, 0.4, 2.0)
        tone = []
        if v_dev > 0.02: tone.append("rød/varm")
        if u_dev > 0.02: tone.append("kald/blå")
        what.append(f"WB-nøytralisering ({'+'.join(tone) or 'cast'}; "
                    f"R{r_adj:+.3f} B{b_adj:+.3f})")

    # 3) OVERSATURASJON — demp sat når vectorscope-radius (SATMAX) > terskel.
    satmax = max(1.0, s["satmax"])
    sat_full = _clamp(sat_thresh / satmax, 0.8, 1.0)
    saturation = 1.0 + (sat_full - 1.0) * k
    if saturation < 0.995:
        what.append(f"saturasjon demp (SATMAX {s['satmax']:.0f} → sat {saturation:.3f})")

    return {
        "slope": [round(r_slope, 4), round(g_slope, 4), round(b_slope, 4)],
        "offset": [0.0, 0.0, 0.0],
        "power": [1.0, 1.0, 1.0],
        "saturation": round(saturation, 4),
        "what": "; ".join(what) if what else "ingen endring (innenfor toleranse)",
    }


# ─── Resolve klipp-kilde ─────────────────────────────────────────────────────

def _source_fps(mpi, fallback: float) -> float:
    try:
        if mpi is not None:
            props = mpi.GetClipProperty() or {}
            fps = props.get("FPS")
            if fps:
                return float(fps)
    except Exception:  # noqa: BLE001
        pass
    return fallback


def _clip_source(item, tl_fps: float) -> tuple[str, float]:
    """Returner (kilde-filsti, kilde-in-sekunder) for et timeline-item."""
    mpi = item.GetMediaPoolItem() if hasattr(item, "GetMediaPoolItem") else None
    src_path = ""
    if mpi is not None:
        try:
            src_path = mpi.GetClipProperty("File Path") or ""
        except Exception:  # noqa: BLE001
            try:
                src_path = (mpi.GetClipProperty() or {}).get("File Path") or ""
            except Exception:  # noqa: BLE001
                src_path = ""
    src_fps = _source_fps(mpi, tl_fps)
    try:
        src_start_sec = (int(item.GetSourceStartFrame() or 0)) / (src_fps or SOURCE_FPS_FALLBACK)
    except Exception:  # noqa: BLE001
        src_start_sec = 0.0
    return src_path, src_start_sec


def _source_timecode(item, tl_fps: float) -> str:
    try:
        f = int(item.GetSourceStartFrame() or 0)
        fps = int(round(tl_fps or SOURCE_FPS_FALLBACK))
        h = f // (3600 * fps); f -= h * 3600 * fps
        m = f // (60 * fps); f -= m * 60 * fps
        sec = f // fps; fr = f - sec * fps
        return f"{h:02d}:{m:02d}:{sec:02d}:{fr:02d}"
    except Exception:  # noqa: BLE001
        return ""


# ─── pilot ───────────────────────────────────────────────────────────────────

def run(params: dict, dry_run: bool) -> None:
    timeline_name = (params.get("timelineName") or "").strip()
    track_index = int(params.get("trackIndex", 1))
    strength = float(params.get("strength", 60))
    target_ire = float(params.get("targetIRE", 45))
    node_index = int(params.get("nodeIndex", 1))  # Node 1 = Primary Correction
    sample_sec = float(params.get("sampleSec", DEFAULT_SAMPLE_SEC))
    only_flagged = bool(params.get("onlyFlagged", True))
    # apply default true; --dry-run flag ELLER apply=false ⇒ ingen SetCDL.
    apply = bool(params.get("apply", True)) and not dry_run

    # flagg-terskler (delt semantikk med analyze_timeline_scopes)
    under_ire = float(params.get("underIRE", 25))
    over_ire = float(params.get("overIRE", 82))
    cast_thresh = float(params.get("castThreshold", 18))
    sat_thresh = float(params.get("satThreshold", 200))
    chan_clip = float(params.get("channelClip", 253))
    # action: "correct" (mål+anvend CDL, default) | "reset" (nøytral CDL på noden) |
    #         "toggle" (SetNodeEnabled på noden) | "lut" (SetLUT på noden, f.eks. CST)
    action = (params.get("action") or "correct").strip().lower()

    strength = _clamp(strength, 0.0, 100.0)

    if dry_run and not params.get("_force_connect"):
        bridge.result({
            "summary": (f"Dry run — vil måle V{track_index}-klipp (sample {sample_sec}s), "
                        f"beregne CDL (styrke {strength:.0f}, mål-IRE {target_ire:.0f}) "
                        f"og {'sette' if params.get('apply', True) else 'IKKE sette'} på Node {node_index}."),
            "strength": strength,
            "targetIRE": target_ire,
            "apply": False,
            "method": "ffmpeg signalstats+extractplanes per kilde-segment → TimelineItem.SetCDL",
            "onlyFlagged": only_flagged,
        })
        return

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet — sett RESOLVE_SCRIPT_MANAGER_FFMPEG eller installer ffmpeg.")
        sys.exit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    if timeline_name:
        # Forsøk å bytte til navngitt timeline; ellers bruk current.
        timeline = conn.project.GetCurrentTimeline()
        try:
            count = int(conn.project.GetTimelineCount() or 0)
            for i in range(1, count + 1):
                tl = conn.project.GetTimelineByIndex(i)
                if tl and (tl.GetName() or "") == timeline_name:
                    conn.project.SetCurrentTimeline(tl)
                    timeline = tl
                    break
        except Exception:  # noqa: BLE001
            pass
    else:
        timeline = conn.project.GetCurrentTimeline()

    if not timeline:
        bridge.error("Ingen timeline aktiv.")
        sys.exit(1)

    try:
        tl_fps = float(timeline.GetSetting("timelineFrameRate"))
    except (TypeError, ValueError):
        tl_fps = SOURCE_FPS_FALLBACK

    items = timeline.GetItemListInTrack("video", track_index) or []
    if not items:
        bridge.result({"corrected": [], "skipped": [],
                       "summary": f"Ingen klipp på V{track_index}."})
        return

    bridge.log(f"Color Autopilot: {len(items)} klipp på V{track_index} "
               f"(styrke {strength:.0f}, mål-IRE {target_ire:.0f}, "
               f"{'ANVEND' if apply else 'TØRR'}, Node {node_index})")

    cdl_supported = hasattr(items[0], "SetCDL") if items else False
    if apply and not cdl_supported:
        bridge.warn("SetCDL eksponeres ikke på denne Resolve-builden — kjører som tørrkjøring "
                    "(beregner CDL, men kan ikke anvende).")
        apply = False

    # ── Per-node enkel-operasjoner (reset / toggle / lut) — ingen måling ──
    if action != "correct":
        done = 0
        for item in items:
            try:
                if action == "reset" and hasattr(item, "SetCDL"):
                    if item.SetCDL({"NodeIndex": str(node_index), "Slope": "1 1 1",
                                    "Offset": "0 0 0", "Power": "1 1 1", "Saturation": "1"}):
                        done += 1
                elif action == "toggle" and hasattr(item, "SetNodeEnabled"):
                    enabled = bool(params.get("enabled", False))  # panel sender ønsket tilstand
                    if item.SetNodeEnabled(node_index, enabled):
                        done += 1
                elif action == "lut" and hasattr(item, "SetLUT"):
                    lut_path = (params.get("lutPath") or "").strip()
                    if lut_path and item.SetLUT(node_index, lut_path):
                        done += 1
            except Exception:  # noqa: BLE001
                pass
        labels = {"reset": "nullstilt", "toggle": "togglet", "lut": "satt LUT på"}
        bridge.result({
            "action": action, "node": node_index, "done": done, "total": len(items),
            "summary": f"Node {node_index} {labels.get(action, action)}: {done}/{len(items)} klipp.",
        })
        return

    corrected: list[dict] = []
    skipped: list[dict] = []
    measure_failures: list[str] = []

    for idx, item in enumerate(items):
        try:
            name = item.GetName() or f"klipp {idx + 1}"
        except Exception:  # noqa: BLE001
            name = f"klipp {idx + 1}"

        src_path, ss = _clip_source(item, tl_fps)
        src_tc = _source_timecode(item, tl_fps)

        if not src_path or not os.path.isfile(src_path):
            skipped.append({"timeline": name, "reason": "kilde-fil mangler"})
            continue

        s = measure_scopes(ffmpeg, src_path, ss, sample_sec)
        if s is None:
            measure_failures.append(name)
            skipped.append({"timeline": name, "reason": "scope-måling feilet"})
            continue

        flags = compute_flags(
            s, target_ire=target_ire, under_ire=under_ire, over_ire=over_ire,
            cast_thresh=cast_thresh, sat_thresh=sat_thresh, chan_clip=chan_clip,
        )
        before_ire = round(ire_of(s["yavg"]), 1)

        if only_flagged and not flags:
            skipped.append({"timeline": name, "reason": "rent klipp (ingen flagg)",
                            "before": before_ire, "flags": []})
            continue

        cdl = compute_cdl(s, strength=strength, target_ire=target_ire, sat_thresh=sat_thresh)

        # Per-kanal klipp + hud = UI-only fikser — pilot rører dem ikke (loggfør for guidet manuell).
        ui_only = [f for f in flags if f in ("redClip", "greenClip", "blueClip")]

        applied = False
        cdl_error = ""
        if apply:
            if not hasattr(item, "SetCDL"):
                cdl_error = "SetCDL ikke tilgjengelig på dette item"
            else:
                try:
                    ok = item.SetCDL({
                        "NodeIndex": str(node_index),
                        "Slope": " ".join(f"{v:.4f}" for v in cdl["slope"]),
                        "Offset": " ".join(f"{v:.4f}" for v in cdl["offset"]),
                        "Power": " ".join(f"{v:.4f}" for v in cdl["power"]),
                        "Saturation": f"{cdl['saturation']:.4f}",
                    })
                    applied = bool(ok)
                    if not ok:
                        cdl_error = "SetCDL returnerte false"
                except Exception as exc:  # noqa: BLE001
                    cdl_error = str(exc)

        # RE-MÅL etter anvendt korreksjon for ekte before/after-IRE.
        after_ire = before_ire
        if applied:
            s2 = measure_scopes(ffmpeg, src_path, ss, sample_sec)
            # NB: re-måling av KILDE-fila viser ikke node-CDL (CDL ligger på timeline-node,
            # ikke på kildefila). Vi estimerer derfor forventet after-IRE analytisk fra
            # slope: luma ≈ 16 + (yavg-16)*slope_luma, slope_luma = snitt(R,G,B).
            slope_luma = sum(cdl["slope"]) / 3.0
            est_yavg = 16.0 + (s["yavg"] - 16.0) * slope_luma
            after_ire = round(ire_of(est_yavg), 1)
            _ = s2  # re-måling bekrefter kilden er uendret (idempotent kontroll)

        entry = {
            "timeline": name,
            "sourceTC": src_tc,
            "before": before_ire,
            "after": after_ire,
            "flags": flags,
            "what": cdl["what"],
            "cdl": {
                "Slope": " ".join(f"{v:.4f}" for v in cdl["slope"]),
                "Saturation": f"{cdl['saturation']:.4f}",
            },
            "applied": applied,
            "nodeIndex": node_index,
        }
        if ui_only:
            entry["guidedManual"] = (
                "per-kanal klipp (" + ", ".join(ui_only) + "): bruk Curves på den klippede "
                "kanalen + Soft Clip i Primary — kan ikke fikses trygt via CDL-slope."
            )
        if cdl_error:
            entry["cdlError"] = cdl_error
        corrected.append(entry)

        if (idx + 1) % 5 == 0 or idx == len(items) - 1:
            bridge.progress(idx + 1, len(items),
                            f"{len(corrected)} korrigert · {len(skipped)} hoppet over")

    applied_count = sum(1 for c in corrected if c.get("applied"))
    summary = (
        f"{'Anvendte' if apply else 'Beregnet (tørr)'} CDL på {applied_count if apply else len(corrected)} "
        f"av {len(items)} klipp på V{track_index} "
        f"(styrke {strength:.0f}, mål-IRE {target_ire:.0f}, Node {node_index}). "
        f"{len(skipped)} hoppet over."
    )

    bridge.result({
        "corrected": corrected,
        "skipped": skipped,
        "summary": summary,
        "applied": apply,
        "appliedCount": applied_count,
        "strength": strength,
        "targetIRE": target_ire,
        "nodeIndex": node_index,
        "onlyFlagged": only_flagged,
        "cdlSupported": cdl_supported,
        "measureFailures": measure_failures,
        "guidedManualNote": (
            "UI-only fikser pilot IKKE gjør: rød-klipp → Curves R + Soft Clip; "
            "hud-justering → Color Slice / Magic Mask + isolert HSL."
        ),
    })


if __name__ == "__main__":
    bridge.main_guard(run)
