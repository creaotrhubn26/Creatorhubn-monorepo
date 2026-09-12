"""Arkiv-lært foto-stil (panel-bro): lær fra RAW↔ferdig-par / rediger råfiler.

Bro-innpakning rundt arkiv_laert_redigering.py for Bryllupsveiviseren-panelet.
Trenger IKKE Resolve-tilkobling — jobber rent på filsystemet.

Params:
  mode=laer      raaDirs=<kommaseparert> leveringDirs=<kommaseparert>
                 modellPath=<.npz> [maksPar=250]
  mode=modeller  List lagrede stilmodeller i ~/.config/postagent/stilmodeller/
  mode=rediger   modellPath=<.npz> innDir=<mappe m/ råfiler> utDir=<mappe> [k=5]
"""
from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bridge  # noqa: E402
import arkiv_laert_redigering as ark  # noqa: E402

STILDIR = os.path.expanduser("~/.config/postagent/stilmodeller")


def run(params: dict, dry_run: bool) -> None:
    mode = (params.get("mode") or "modeller").strip().lower()

    if mode == "modeller":
        os.makedirs(STILDIR, exist_ok=True)
        models = []
        for p in sorted(glob.glob(os.path.join(STILDIR, "*.npz"))):
            try:
                import numpy as np
                m = np.load(p, allow_pickle=True)
                models.append({"path": p, "name": os.path.basename(p),
                               "scenes": int(len(m["feats"]))})
            except Exception:
                models.append({"path": p, "name": os.path.basename(p), "scenes": None})
        bridge.result({"mode": mode, "models": models, "dryRun": dry_run})
        return

    if mode == "laer":
        raa = [d.strip() for d in (params.get("raaDirs") or "").split(",") if d.strip()]
        lev = [d.strip() for d in (params.get("leveringDirs") or "").split(",") if d.strip()]
        model_path = os.path.expanduser((params.get("modellPath") or "").strip())
        if not raa or not lev or not model_path:
            bridge.error("laer krever raaDirs=, leveringDirs= og modellPath=.")
            return
        if dry_run:
            bridge.result({"mode": mode, "dryRun": True,
                           "note": f"Ville lært fra {len(raa)} rå-mapper + {len(lev)} leverings-mapper → {model_path}"})
            return
        bridge.progress(0, 100, "Lærer stil fra arkivet (kan ta 10-20 min) …")
        ark.learn(raa, lev, model_path, int(params.get("maksPar") or 250))
        import numpy as np
        m = np.load(os.path.expanduser(model_path), allow_pickle=True)
        bridge.result({"mode": mode, "modellPath": model_path,
                       "scenes": int(len(m["feats"])), "dryRun": False})
        return

    if mode == "rediger":
        model_path = os.path.expanduser((params.get("modellPath") or "").strip())
        inn = os.path.expanduser((params.get("innDir") or "").strip())
        ut = os.path.expanduser((params.get("utDir") or "").strip())
        if not model_path or not os.path.isfile(model_path):
            bridge.error(f"Fant ikke modell «{model_path}» — kjør mode=laer først.")
            return
        if not inn or not os.path.isdir(inn):
            bridge.error(f"innDir «{inn}» finnes ikke.")
            return
        raws = sorted({p for ext in ark.RAW_EXT for p in glob.glob(os.path.join(inn, f"*{ext}"))})
        if not raws:
            bridge.error(f"Ingen råfiler ({'/'.join(e.strip('.') for e in ark.RAW_EXT[:4])}…) i «{inn}».")
            return
        if dry_run:
            bridge.result({"mode": mode, "dryRun": True, "files": len(raws),
                           "note": f"Ville redigert {len(raws)} råfiler → {ut}"})
            return
        import numpy as np
        model = dict(np.load(model_path, allow_pickle=True))
        os.makedirs(ut, exist_ok=True)
        results = []
        for i, rp in enumerate(raws):
            base, note = ark.apply_model(rp, model, ut, int(params.get("k") or 5))
            results.append({"file": base, "note": note})
            bridge.progress(i + 1, len(raws), f"redigerer {base[:28]}")
        bridge.result({"mode": mode, "edited": len(results), "outDir": ut,
                       "results": results[:60], "dryRun": False})
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
