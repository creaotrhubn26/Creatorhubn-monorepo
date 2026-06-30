"""Social Vertikal B-kamera — STEG 4A: YOLO subjekt-deteksjon på A-fallback-klipp → reframe_pans.json.
Params: workDir, acamDir, yoloWeights, outH, outW, preferClasses (liste). Pans brukes i bygging."""
from __future__ import annotations
import os, sys, json
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np, cv2
    from ultralytics import YOLO
    work = (params.get("workDir") or "").strip()
    acam = (params.get("acamDir") or "").strip()
    weights = (params.get("yoloWeights") or
               os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "yolov8n.pt"))
    out_h = int(params.get("outH") or 1920); out_w = int(params.get("outW") or 1080)
    prefer = params.get("preferClasses") or [0]   # COCO: 0=person, 67=cell phone, 15=cat, 16=dog
    if not (work and acam):
        bridge.error("Mangler workDir/acamDir"); sys.exit(1)
    plan = json.load(open(os.path.join(work, "plan.json")))["plan"]
    fb = [p for p in plan if not (p.get("b") and p["b"]["full"])]
    fps = json.load(open(os.path.join(work, "plan.json"))).get("fps", 25)
    model = YOLO(weights); caps: dict = {}

    def cap(path):
        if path not in caps:
            caps[path] = cv2.VideoCapture(path)
        return caps[path]

    out = {}; rows = []
    for idx, p in enumerate(fb):
        bridge.progress(idx + 1, len(fb), f"Reframe {p['a_file']}")
        path = os.path.join(acam, os.path.basename(p["a_file"]))
        if not os.path.isfile(path):
            bridge.warn(f"Fant ikke {path}"); continue
        cp = cap(path); W = int(cp.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cp.get(cv2.CAP_PROP_FRAME_HEIGHT))
        si = p["a_src_in_f"] / fps; so = si + p["dur_f"] / fps
        cxs = []
        for t in np.linspace(si + 0.1, max(si + 0.2, so - 0.1), 8):
            cp.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0); ok, fr = cp.read()
            if not ok:
                continue
            r = model(fr, verbose=False)[0]
            if r.boxes is None or len(r.boxes) == 0:
                continue
            cand = [(int(b.cls[0]), float(b.conf[0]), float((b.xyxy[0][0] + b.xyxy[0][2]) / 2),
                     float((b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1]))) for b in r.boxes]
            pick = None
            for cls in prefer:
                cc = [k for k in cand if k[0] == cls and k[1] > 0.3]
                if cc:
                    pick = max(cc, key=lambda k: k[3]); break
            if pick is None:
                pp = [k for k in cand if k[0] == 0 and k[1] > 0.35]
                if pp:
                    pick = max(pp, key=lambda k: k[3])
            if pick:
                cxs.append(pick[2])
        if cxs:
            cx = float(np.median(cxs)); spread = float(np.std(cxs)); n = len(cxs)
        else:
            cx = W / 2; spread = 0; n = 0
        scale = float(out_h) / H            # kilde->skjerm (fyll høyde)
        win = out_w / scale                 # synlig kildebredde
        cxc = cx
        if spread > 300:
            cxc = W / 2 + (cx - W / 2) * 0.5
        cxc = max(win / 2, min(W - win / 2, cxc))
        pan = round((W / 2 - cxc) * scale, 1)
        out[str(round(p["tl_in"], 2))] = pan
        rows.append({"tlIn": round(p["tl_in"], 2), "aFile": p["a_file"], "cxPct": round(cx / W * 100, 1),
                     "n": n, "spread": round(spread, 1), "pan": pan})

    json.dump(out, open(os.path.join(work, "reframe_pans.json"), "w"), indent=2)
    bridge.result({"fallbacks": len(fb), "detected": len(rows), "rows": rows,
                   "pansPath": os.path.join(work, "reframe_pans.json"),
                   "note": "Pans bakes inn ved STEG 3 (bygg). Verifiser med stills i STEG 7."})


if __name__ == "__main__":
    bridge.main_guard(run)
