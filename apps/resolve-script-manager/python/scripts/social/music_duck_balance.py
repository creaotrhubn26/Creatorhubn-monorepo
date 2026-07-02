"""
Musikk-ducking / balanse — legg en musikk-bed under dialogen med stabil,
myk blokk-basert ducking (ingen pumping). Bruker undertekst-sporet som
dialog-indikator (dukk pr HELE dialog-blokk, ikke pr ord).

Justerbart: duck-dybde (dB), overgangs-hastighet (S-kurve sek), musikk-nivå
(RMS), pre-roll. Presets settes fra UI som konkrete verdier.

Ekstra (2026-07-02):
  - spectral=true  → i tillegg til (mildere) volum-duck dippes musikken i
    stemme-frekvensene (2–5 kHz) under dialog, så musikken beholder bass/kropp
    men stemmen skjærer gjennom.
  - with_preview=true → rendrer dialog-stem (muter musikk-sporet), regner
    dialog-vs-musikk margin, og lager en kort forhåndslytt (mix rundt de
    første dialog-overgangene) for A/B i panelet.
  - returnerer envelope (nedsamplet duck-gain) for visuell duck-kurve.

params: { music_path (påkr.), duck_db?(-13), ramp_s?(2.0), gap_fill_s?(3.5),
          pre_roll_s?(0.9), tail_s?(0.8), music_rms_db?(-18), even?(true),
          spectral?(false), with_preview?(false), music_track?,
          out_path?, place_on_track?, render_after?(false) }
result: { out_path, blocks, params, placed_on_track?, timeline_dur_s,
          envelope, margin_db?, preview_path? }
"""
from __future__ import annotations
import os, sys, json, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _subtitle_blocks(tl, fps, sfr, gap_fill):
    subs = []
    for st in range(1, tl.GetTrackCount("subtitle") + 1):
        for it in tl.GetItemListInTrack("subtitle", st):
            subs.append([(it.GetStart() - sfr) / fps, (it.GetEnd() - sfr) / fps])
    subs.sort()
    blocks = []
    for s, e in subs:
        if blocks and s - blocks[-1][1] <= gap_fill:
            blocks[-1][1] = max(blocks[-1][1], e)
        else:
            blocks.append([s, e])
    return blocks


def _music_track_index(tl):
    for t in range(1, tl.GetTrackCount("audio") + 1):
        nm = (tl.GetTrackName("audio", t) or "")
        if "MASTER" in nm or "music" in nm.lower() or "musikk" in nm.lower():
            return t
    return tl.GetTrackCount("audio")


def _render_dialogue_stem(pr, tl, music_track):
    """render Audio Only med musikk-sporet mutet → dialog-stem-sti."""
    import glob, time
    tmpd = tempfile.mkdtemp()
    tl.SetTrackEnable("audio", music_track, False)
    pr.SetCurrentTimeline(tl); pr.LoadRenderPreset("Audio Only")
    pr.SetRenderSettings({"TargetDir": tmpd, "CustomName": "duckdia", "SelectAllFrames": True})
    pr.DeleteAllRenderJobs(); jid = pr.AddRenderJob(); pr.StartRendering(jid)
    t0 = time.time()
    while pr.IsRenderingInProgress() and time.time() - t0 < 180:
        time.sleep(2)
    time.sleep(1); tl.SetTrackEnable("audio", music_track, True)
    fs = glob.glob(f"{tmpd}/duckdia*")
    return fs[0] if fs else None


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np, soundfile as sf

    music_path = params.get("music_path")
    if not music_path or not os.path.exists(music_path):
        bridge.error("music_path mangler/finnes ikke"); sys.exit(1)
    duck_db = float(params.get("duck_db", -13))
    ramp_s = float(params.get("ramp_s", 2.0))
    gap_fill = float(params.get("gap_fill_s", 3.5))
    pre = float(params.get("pre_roll_s", 0.9))
    tail = float(params.get("tail_s", 0.8))
    rms_db = float(params.get("music_rms_db", -18))
    even = params.get("even", True)
    spectral = bool(params.get("spectral", False))
    with_preview = bool(params.get("with_preview", False))
    SR = 48000
    out_path = params.get("out_path") or os.path.splitext(music_path)[0] + "_ducked.wav"

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt"); sys.exit(1)
    pr = conn.project
    tl = pr.GetCurrentTimeline()
    fps = float(pr.GetSetting("timelineFrameRate") or 25)
    sfr = tl.GetStartFrame()
    tl_dur = (tl.GetEndFrame() - sfr) / fps
    music_track = int(params.get("music_track") or _music_track_index(tl))

    blocks = _subtitle_blocks(tl, fps, sfr, gap_fill)
    if not blocks:
        bridge.warn("Ingen undertekster — musikk legges uten ducking")
    blocks = [[max(0, s - pre), e + tail] for s, e in blocks]
    bridge.log(f"{len(blocks)} blokker · duck {duck_db:.0f}dB · overgang {ramp_s:.1f}s · {'spektral' if spectral else 'volum'}")

    def load_mono(p, af=None):
        w = tempfile.mktemp(suffix=".wav")
        cmd = ["ffmpeg", "-y", "-v", "quiet", "-i", p]
        if af: cmd += ["-af", af]
        cmd += ["-ac", "1", "-ar", str(SR), w]
        subprocess.run(cmd, check=False)
        a, _ = sf.read(w); os.remove(w)
        return a if a.ndim == 1 else a.mean(1)

    full = load_mono(music_path, "dynaudnorm=f=200:g=9:p=0.9:m=10:r=0.6" if even else None)
    N = int(tl_dur * SR)
    full = full[:N] if len(full) >= N else np.pad(full, (0, N - len(full)))
    cur = 20 * np.log10(np.sqrt(np.mean(full ** 2)) + 1e-9)
    full = full * 10 ** ((rms_db - cur) / 20)

    # blokk-envelope 0..1 (1 = under dialog), Hann-glattet
    env = np.zeros(N)
    for s, e in blocks:
        env[int(s * SR):min(N, int(e * SR))] = 1.0
    k = max(2, int(ramp_s * SR)); win = np.hanning(k); win = win / win.sum()
    env = np.convolve(env, win, mode="same")
    env = np.clip(env, 0, 1)

    if spectral:
        # frekvens-carvet variant: dipp 2–5 kHz -12 dB; blend inn under dialog
        carved = load_mono(music_path, ("dynaudnorm=f=200:g=9:p=0.9:m=10:r=0.6," if even else "") +
                           "equalizer=f=3200:width_type=o:width=1.6:g=-12")
        carved = carved[:N] if len(carved) >= N else np.pad(carved, (0, N - len(carved)))
        cc = 20 * np.log10(np.sqrt(np.mean(carved ** 2)) + 1e-9)
        carved = carved * 10 ** ((rms_db - cc) / 20)
        # mildere volum-duck (halvparten) + spektral carving via blend
        vol = 1.0 + (10 ** ((duck_db * 0.5) / 20) - 1.0) * env
        blend = full * (1 - env) + carved * env
        out = (blend * vol).astype("float32")
    else:
        vol = 1.0 + (10 ** (duck_db / 20) - 1.0) * env
        out = (full * vol).astype("float32")

    sf.write(out_path, out, SR)
    bridge.log(f"Skrev {os.path.basename(out_path)} ({tl_dur:.1f}s)")

    # nedsamplet envelope for visualisering (~300 punkter, dB under 0)
    step = max(1, N // 300)
    gain_lin = out.copy()
    # bruk vol-kurven (dB) i stedet for signal for ren kurve
    voldb = 20 * np.log10(np.maximum(1e-4, (10 ** (duck_db / 20) - 1.0) * env + 1.0))
    envelope = [round(float(voldb[i]), 1) for i in range(0, N, step)]

    margin_db = None
    preview_path = None
    if with_preview and blocks:
        dia_path = _render_dialogue_stem(pr, tl, music_track)
        if dia_path:
            dia = load_mono(dia_path)
            dia = dia[:N] if len(dia) >= N else np.pad(dia, (0, N - len(dia)))
            # margin: median (dialog − musikk) i tale-vinduer
            def rms_db_at(a, s, e):
                seg = a[int(s * SR):int(e * SR)]; return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) > 10 else -99
            margs = []
            for s, e in blocks:
                dm = rms_db_at(dia, s + pre, e - tail) if (e - tail) > (s + pre) else rms_db_at(dia, s, e)
                mm = rms_db_at(out, s + pre, e - tail) if (e - tail) > (s + pre) else rms_db_at(out, s, e)
                if dm > -50: margs.append(dm - mm)
            margin_db = round(float(np.median(margs)), 1) if margs else None
            # forhåndslytt: 3s rundt de 3 første blokk-startene, mix dialog+musikk
            mix = (dia + out).astype("float32")
            snips = []
            for s, e in blocks[:3]:
                a = max(0, int((s - 1.2) * SR)); b = min(N, int((s + 2.2) * SR))
                snips.append(mix[a:b]); snips.append(np.zeros(int(0.4 * SR), dtype="float32"))
            if snips:
                prev = np.concatenate(snips)
                preview_path = os.path.splitext(out_path)[0] + "_preview.wav"
                # normaliser forhåndslytt til -14ish for hørbarhet
                pc = 20 * np.log10(np.sqrt(np.mean(prev ** 2)) + 1e-9)
                prev = np.clip(prev * 10 ** ((-16 - pc) / 20), -1, 1)
                sf.write(preview_path, prev.astype("float32"), SR)
            bridge.log(f"Margin stemme→musikk: {margin_db} dB · forhåndslytt klar")

    placed = None
    trk = params.get("place_on_track")
    if trk:
        trk = int(trk)
        mp = pr.GetMediaPool(); mp.SetCurrentFolder(mp.GetRootFolder())
        it = mp.ImportMedia([out_path])[0]
        frames = int(round(tl_dur * fps))
        ex = tl.GetItemListInTrack("audio", trk)
        rec = ex[0].GetStart() if ex else sfr
        if ex: tl.DeleteClips(ex)
        mp.AppendToTimeline([{"mediaPoolItem": it, "startFrame": 0, "endFrame": frames - 1,
                              "trackIndex": trk, "recordFrame": rec, "mediaType": 2}])
        tl.SetTrackEnable("audio", trk, True)
        placed = trk
        bridge.log(f"Lagt på lyd-spor A{trk}")

    bridge.result({
        "out_path": out_path, "blocks": [[round(s, 2), round(e, 2)] for s, e in blocks],
        "params": {"duck_db": duck_db, "ramp_s": ramp_s, "gap_fill_s": gap_fill, "pre_roll_s": pre,
                   "tail_s": tail, "music_rms_db": rms_db, "spectral": spectral},
        "placed_on_track": placed, "timeline_dur_s": round(tl_dur, 1),
        "envelope": envelope, "margin_db": margin_db, "preview_path": preview_path,
    })


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
