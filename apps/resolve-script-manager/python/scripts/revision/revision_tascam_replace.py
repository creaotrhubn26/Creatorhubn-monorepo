"""
revision_tascam_replace — orkestrator for replikk-rens-veiviseren (dual-system).

To moduser (støtter steg-veiviseren):
  mode="scan"  → finn replikken i mygg-filene (find_line_in_mics), returner
                 kandidater + konfidans-gate (0.72). Splicer IKKE.
  mode="apply" → hent UKOMPRIMERT fra valgt mygg-fil @ offset, synk til editen,
                 nivå-match, splice inn i dialog-sporet, skriv ut + returner.

params (scan):  { dialogue_path, line_t0, line_t1, mic_files[], min_corr? }
params (apply): { dialogue_path, mic_file, mic_offset_s, line_dur, edit_t0,
                  edit_t1, output_path, target_rms_db?, hp? }
"""
from __future__ import annotations
import os, sys, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import soundfile as sf
    import revision_tascam as T
    mode = params.get("mode", "scan")
    dia_path = params["dialogue_path"]

    if mode == "scan":
        t0, t1 = float(params["line_t0"]), float(params["line_t1"])
        ref = tempfile.mktemp(suffix=".wav")
        subprocess.run(["ffmpeg","-y","-v","quiet","-ss",f"{t0:.3f}","-t",f"{t1-t0:.3f}",
                        "-i",dia_path,"-ac","1","-ar","48000",ref],check=False)
        gate = params.get("min_corr", 0.72)
        n = len(params["mic_files"])
        bridge.log(f"Skanner {n} mygg-filer for replikken ({t1-t0:.1f}s)…")
        def prog(i, tot, name): bridge.progress(i, tot, f"Analyserer mygg {i}/{tot}: {name}")
        res = T.find_line_in_mics(ref, params["mic_files"], ref_dur=t1-t0, on_progress=prog)
        os.remove(ref)
        best = res["best"]
        confident = bool(best and best["corr"] >= gate)
        for c in res["all"][:6]:
            mark = "✓" if c["corr"] >= gate else "·"
            bridge.log(f"  {mark} {os.path.basename(c['file'])} @ {c['offset_s']}s  korr {c['corr']}")
        bridge.log(("✓ trygt treff" if confident else f"⚠ ingen trygt treff (beste {best['corr'] if best else 0} < {gate}) → bekreft manuelt"))
        bridge.result({"mode": "scan", "candidates": res["all"][:8], "best": best,
                       "confident": confident, "min_corr": gate, "line_dur": round(t1-t0, 3)})
        return

    # mode == apply
    mic = params["mic_file"]; off = float(params["mic_offset_s"]); dur = float(params["line_dur"])
    e0, e1 = float(params["edit_t0"]), float(params["edit_t1"])
    out = params["output_path"]; sr = 48000
    bridge.log(f"Henter ukomprimert fra {os.path.basename(mic)} @ {off:.2f}s …")
    clean = T.extract_clean(mic, max(0, off - 0.3), dur + 0.6, sr=sr, hp=params.get("hp", 80))
    dia, _ = sf.read(dia_path); dia = dia if dia.ndim == 1 else dia.mean(1)
    al = T.align_to_edit(clean, dia, sr, e0 - 1.0, e1 + 1.0)
    bridge.log(f"Synket til edit @ {al['offset_s']}s (korr {al['corr']})")
    clean = T.level_match(clean, params.get("target_rms_db", -16.5))
    spliced = T.splice(dia, clean, al["offset_s"], sr, xfade=0.12)
    sf.write(out, spliced.astype("float32"), sr)
    bridge.log(f"Spliced inn + skrevet {os.path.basename(out)}")
    bridge.result({"mode": "apply", "edit_offset_s": al["offset_s"], "align_corr": al["corr"],
                   "output_path": out, "mic_file": mic})


if __name__ == "__main__":
    try: run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
