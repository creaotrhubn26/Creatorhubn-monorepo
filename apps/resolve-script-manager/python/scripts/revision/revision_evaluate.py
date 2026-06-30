"""
revision_evaluate — kjør registrerte evaluators mot en revision_spec.

Beviser om hvert feedback-punkt faktisk ble fulgt. Måler valgfritt en render
(integrated LUFS + true peak) hvis params.render_path er gitt, ellers bruker
params.measurements direkte.

Output (result): { "results": [{feedback, evaluator, passed, evidence}],
                   "summary": {green, amber, red, total} }
"""
from __future__ import annotations
import os, sys, json, re, subprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge
from revision_engine import RevisionSpec, evaluate

def _measure_render(path: str) -> dict:
    out = {}
    try:
        r = subprocess.run(["ffmpeg","-hide_banner","-i",path,"-af",
            "loudnorm=print_format=summary","-f","null","-"], capture_output=True, text=True)
        mi = re.search(r"Input Integrated:\s*(-?\d+\.?\d*)", r.stderr)
        mt = re.search(r"Input True Peak:\s*(-?\d+\.?\d*)", r.stderr)
        if mi: out["integrated_lufs"] = float(mi.group(1))
        if mt: out["true_peak_db"] = float(mt.group(1))
    except Exception as e:
        bridge.warn(f"Kunne ikke måle render: {e}")
    return out

def run(params: dict) -> None:
    spec_d = params.get("spec")
    if not spec_d:
        bridge.error("params.spec mangler"); sys.exit(1)
    spec = RevisionSpec.from_dict(spec_d)
    meas = dict(params.get("measurements") or {})
    rp = params.get("render_path")
    if rp and os.path.exists(rp):
        bridge.log("Måler render…"); meas.update(_measure_render(rp))
    bridge.log(f"Evaluerer {len(spec.changes)} endringer mot {len(spec.feedback)} punkter…")
    results = evaluate(spec, meas)
    green = sum(1 for r in results if r["passed"] is True)
    red   = sum(1 for r in results if r["passed"] is False)
    amber = sum(1 for r in results if r["passed"] is None)
    for r in results:
        icon = "✅" if r["passed"] is True else ("⚠️" if r["passed"] is None else "❌")
        bridge.log(f"  {icon} {r['feedback'][:48]} — {r['evidence']}")
    bridge.result({"results": results,
                   "summary": {"green": green, "amber": amber, "red": red, "total": len(results)}})

if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
