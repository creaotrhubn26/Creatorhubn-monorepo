"""Social Vertikal B-kamera — STEG 5: Frame-presis lip-sync via envelope-korr (B-scratch vs A-scratch).
Params: workDir, acamDir, bcamDir, fps, corrMin, padS, searchS. Output lipsync_offsets.json.
Korreksjon brukt i bygging: B_src_in_korrigert = B_src_in - off_s."""
from __future__ import annotations
import os, sys, json, subprocess, tempfile
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np
    work = (params.get("workDir") or "").strip()
    acam = (params.get("acamDir") or "").strip()
    bcam = (params.get("bcamDir") or "").strip()
    fps = float(params.get("fps") or 25)
    corr_min = float(params.get("corrMin") or 0.6)
    PAD = float(params.get("padS") or 0.8); SEARCH = float(params.get("searchS") or 0.6)
    SR = 16000; HOP = 160
    if not (work and acam and bcam):
        bridge.error("Mangler workDir/acamDir/bcamDir"); sys.exit(1)
    plan = json.load(open(os.path.join(work, "plan.json")))["plan"]
    full = [p for p in plan if p.get("b") and p["b"]["full"]]

    def env(path, start, dur):
        start = max(0.0, start)
        with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as tf:
            out = tf.name
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", path, "-t", f"{dur:.3f}",
                        "-ac", "1", "-ar", str(SR), "-f", "f32le", out], check=True)
        x = np.fromfile(out, dtype=np.float32); os.unlink(out)
        if len(x) < HOP:
            return None
        n = len(x) // HOP
        rms = np.sqrt((x[:n * HOP].reshape(n, HOP) ** 2).mean(1) + 1e-9)
        e = np.log(rms + 1e-6); return (e - e.mean()) / (e.std() + 1e-9)

    def xcorr(a, b, maxlag):
        best = (-2.0, 0); n = min(len(a), len(b))
        for k in range(-maxlag, maxlag + 1):
            if k >= 0:
                aa, bb = a[k:k + n - maxlag], b[:n - maxlag]
            else:
                aa, bb = a[:n - maxlag], b[-k:-k + n - maxlag]
            m = min(len(aa), len(bb))
            if m < 20:
                continue
            aa = aa[:m] - aa[:m].mean(); bb = bb[:m] - bb[:m].mean()
            d = float(np.linalg.norm(aa) * np.linalg.norm(bb))
            if d < 1e-6:
                continue
            c = float((aa * bb).sum() / d)
            if c > best[0]:
                best = (c, k)
        return best

    groups: dict = {}
    for p in full:
        groups.setdefault((p["a_file"], p["b"]["file"]), []).append(p)

    res = {}; rows = []; i = 0
    for (af, bf), ps in sorted(groups.items(), key=lambda kv: -max(x["dur_f"] for x in kv[1])):
        i += 1; bridge.progress(i, len(groups), f"Lip-sync {bf}")
        lg = max(ps, key=lambda x: x["dur_f"])
        cin = lg["a_src_in_f"] / fps; bin_ = lg["b"]["src_in"]; dur = lg["dur_f"] / fps
        ea = env(os.path.join(acam, af), cin - PAD, dur + 2 * PAD)
        eb = env(os.path.join(bcam, bf), bin_ - PAD, dur + 2 * PAD)
        if ea is None or eb is None:
            continue
        corr, lag = xcorr(ea, eb, int(SEARCH * 100))
        off_s = lag / 100.0
        res[f"{af}|{bf}"] = {"corr": round(corr, 2), "off_s": round(off_s, 3), "off_f": round(off_s * fps, 1)}
        rows.append({"a": af, "b": bf, "corr": round(corr, 2), "offS": round(off_s, 3),
                     "offF": round(off_s * fps, 1), "apply": corr >= corr_min})

    json.dump(res, open(os.path.join(work, "lipsync_offsets.json"), "w"), indent=2)
    bridge.result({
        "pairs": len(res), "applied": sum(1 for r in rows if r["apply"]), "corrMin": corr_min,
        "rows": sorted(rows, key=lambda r: -r["corr"]),
        "offsetsPath": os.path.join(work, "lipsync_offsets.json"),
        "note": "B_src_in_korrigert = B_src_in - off_s. Lave-corr (cutaways) lar vi stå. Kjør STEG 3 (bygg) på nytt for å bake inn.",
    })


if __name__ == "__main__":
    bridge.main_guard(run)
