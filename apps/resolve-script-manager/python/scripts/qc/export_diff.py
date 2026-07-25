"""Eksport-diff — er den eksporterte videoen i synk med timelinen NÅ?

Use case: brudeparet ga tilbakemeldinger, du endret i timelinen — men er
alt faktisk med i fila du er i ferd med å sende? Tre bevislag:

  1. HANDLINGSLOGG (prosjektindeksen): mutasjoner utført ETTER eksport-
     filas tidsstempel — «satt inn b-roll 14:32, slettet flash-frames
     14:55» = eksporten er utdatert, med kvittering på hvorfor.
  2. VARIGHET/FORMAT: eksportens lengde/fps vs timelinen (±0.5s).
  3. KUTT-SAMMENLIGNING (visuell, heuristisk): ffmpeg scene-deteksjon på
     eksporten vs timelinens synlige kutt (øverste-klipp-skifter) →
     avvikssoner med tidskode. Ærlig begrensning: myke overganger og
     vinkelskift i samme scene kan unnslippe deteksjonen — sonene er
     bevis, ikke fasit; dommen bygger primært på lag 1+2.

  4. TILBAKEMELDINGS-SJEKK (mode=feedback): brudeparets punkter (feedback=
     én per linje) vurderes mot BEVISENE — handlingsloggen (hva som faktisk
     er utført, med klokkeslett før/etter eksporten), markører og timeline-
     tilstand. Claude klassifiserer hvert punkt:
       ✅ forbedret-og-med-i-eksporten (utført FØR eksport-tidspunktet)
       ⚠ forbedret-men-IKKE-i-eksporten (utført ETTER → re-eksport trengs)
       ❌ mangler (ingen spor av tiltak)
     — alltid med bevis, aldri synsing.

Params:
  file=<sti>            eksportert video (default: nyeste i Leveranser-dir)
  scanSeconds=<n>       begrens scene-deteksjonen (default 600; 0 = hele —
                        2.5t video tar da mange minutter)
  sceneThreshold=0.3    ffmpeg scene-score-terskel
  offsetSec=0           hvis eksporten starter et annet sted enn timeline-start
  mode=diff|feedback    feedback krever feedback=<punkter, én per linje>
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402
from project_index import ProjectIndex, clip_identity  # noqa: E402


def _tc(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def _visible_cuts(timeline, fps) -> list[float]:
    """Timelinens synlige kutt (sek fra start): der ØVERSTE klipp skifter."""
    items = []
    for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
        for it in timeline.GetItemListInTrack("video", t) or []:
            try:
                mpi = it.GetMediaPoolItem()
            except Exception:
                mpi = None
            if mpi:
                items.append({"s": int(it.GetStart() or 0), "e": int(it.GetEnd() or 0),
                              "t": t, "uid": clip_identity(mpi)["uid"],
                              "off": int(it.GetLeftOffset() or 0)})
    if not items:
        return []
    tl_start = int(timeline.GetStartFrame() or 0)
    bounds = sorted({i["s"] for i in items} | {i["e"] for i in items})

    def top_at(f):
        at = [i for i in items if i["s"] <= f < i["e"]]
        if not at:
            return None
        top = max(at, key=lambda i: i["t"])
        # identitet + kilde-kontinuitet: samme klipp splittet uten hopp = ikke kutt
        return (top["uid"], top["off"] + (f - top["s"]) - f)
    cuts = []
    prev = top_at(bounds[0])
    for b in bounds[1:]:
        cur = top_at(b)
        if cur != prev:
            cuts.append((b - tl_start) / fps)
        prev = cur
    return cuts


def _export_cuts(ff: str, path: str, limit_sec: float, threshold: float) -> list[float]:
    cmd = [ff, "-v", "info"]
    if limit_sec > 0:
        cmd += ["-t", str(limit_sec)]
    cmd += ["-i", path, "-vf",
            f"scale=160:-2,select='gt(scene,{threshold})',showinfo", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=3600)
    return [float(m) for m in re.findall(r"pts_time:([\d.]+)", r.stderr)]


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline.")
        return
    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    tl_start = int(timeline.GetStartFrame() or 0)
    tl_dur = (int(timeline.GetEndFrame() or 0) - tl_start) / fps

    f = os.path.expanduser((params.get("file") or "").strip())
    if not f:
        base = os.path.expanduser("~/Movies/Leveranser/"
                                  + re.sub(r"[^A-Za-z0-9_-]+", "_", project.GetName() or "p"))
        cands = ([os.path.join(base, x) for x in os.listdir(base)
                  if x.lower().endswith((".mp4", ".mov", ".mxf"))]
                 if os.path.isdir(base) else [])
        if not cands:
            bridge.error("Ingen eksport funnet — oppgi file=<sti til eksportert video>.")
            return
        f = max(cands, key=os.path.getmtime)
    if not os.path.isfile(f):
        bridge.error(f"Fila finnes ikke: {f}")
        return
    export_mtime = os.path.getmtime(f)

    # ── lag 1: handlinger etter eksporten (indeks + audit) ──
    actions_after = []
    try:
        idx = ProjectIndex(project, resolve=conn.resolve)
        for ts, via, sid, ok in idx.db.execute(
                "SELECT ts, via, script_id, ok FROM actions WHERE ts > ? ORDER BY ts",
                (export_mtime,)).fetchall():
            import datetime as _dt
            actions_after.append({"time": _dt.datetime.fromtimestamp(ts).strftime("%H:%M:%S"),
                                  "via": via, "action": sid, "ok": bool(ok)})
        idx.close()
    except Exception:
        pass
    audit_after = 0
    try:
        import datetime as _dt
        ap = os.path.expanduser("~/.config/postagent/audit.jsonl")
        if os.path.isfile(ap):
            iso = _dt.datetime.fromtimestamp(export_mtime).astimezone().isoformat()
            with open(ap, encoding="utf-8") as fh:
                for line in fh:
                    try:
                        e = json.loads(line)
                        if e.get("ts", "") > iso and not e.get("dryRun", True):
                            audit_after += 1
                    except Exception:
                        continue
    except Exception:
        pass

    # ── mode=feedback: brudeparets punkter vs bevisene ──
    if (params.get("mode") or "diff").strip().lower() == "feedback":
        fb_raw = (params.get("feedback") or "").strip()
        points = [ln.strip() for ln in fb_raw.split("\n") if ln.strip()]
        if not points:
            bridge.error("feedback-modus krever feedback=<punkter, én per linje>.")
            return
        # bevis-pakke: ALLE handlinger m/ tidsstempel relativt til eksporten
        evidence_actions = []
        try:
            idx = ProjectIndex(project, resolve=conn.resolve)
            import datetime as _dt
            for ts, via, sid, pjson, ok in idx.db.execute(
                    "SELECT ts, via, script_id, params, ok FROM actions "
                    "ORDER BY ts DESC LIMIT 60").fetchall():
                evidence_actions.append({
                    "time": _dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M"),
                    "afterExport": ts > export_mtime,
                    "action": sid, "params": (pjson or "")[:180], "ok": bool(ok)})
            idx.close()
        except Exception:
            pass
        markers_ev = []
        try:
            for frame, m in (timeline.GetMarkers() or {}).items():
                markers_ev.append(f"{_tc(int(frame) + tl_start, fps)} [{m.get('color')}] "
                                  f"{m.get('name')}: {(m.get('note') or '')[:80]}")
        except Exception:
            pass
        import datetime as _dt
        prompt = (
            "Du er kvalitetskontrollør for en bryllupsfilm-leveranse. Brudeparet ga "
            "tilbakemeldingspunktene under. Vurder HVERT punkt KUN mot bevisene "
            "(handlingslogg + markører) — aldri synsing. Eksporten kunden har er fra "
            f"{_dt.datetime.fromtimestamp(export_mtime).strftime('%Y-%m-%d %H:%M')}; "
            "handlinger med afterExport=true er IKKE med i den fila.\n\n"
            "TILBAKEMELDINGER:\n" + "\n".join(f"{i}: {p}" for i, p in enumerate(points))
            + "\n\nHANDLINGSLOGG:\n" + json.dumps(evidence_actions, ensure_ascii=False)
            + "\n\nMARKØRER I TIMELINEN:\n" + "\n".join(markers_ev[:40])
            + '\n\nSvar KUN med JSON: {"vurderinger": [{"punkt": <index>, '
            '"status": "forbedret_i_eksporten" | "forbedret_ikke_i_eksporten" | '
            '"mangler" | "usikkert", "bevis": "<konkret: hvilken handling/markør, '
            'når>", "anbefaling": "<hva som må gjøres, eller null>"}]}')
        try:
            bearer = params.get("bearer")
            if bearer:
                from anthropic_proxy import Anthropic  # type: ignore
                client = Anthropic(bearer_token=bearer)
            else:
                import anthropic  # type: ignore
                client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            msg = client.messages.create(model=params.get("model") or "claude-sonnet-4-6",
                                         max_tokens=1500,
                                         messages=[{"role": "user", "content": prompt}])
            text = msg.content[0].text
            data = json.loads(text[text.find("{"):text.rfind("}") + 1])
        except Exception as e:
            bridge.error(f"Feedback-vurdering feilet: {str(e)[:200]}")
            return
        out = []
        for v in data.get("vurderinger", []):
            i = int(v.get("punkt", -1))
            if 0 <= i < len(points):
                out.append({"feedback": points[i], "status": v.get("status"),
                            "bevis": v.get("bevis"), "anbefaling": v.get("anbefaling")})
        needs_reexport = any(v["status"] == "forbedret_ikke_i_eksporten" for v in out)
        missing = [v["feedback"] for v in out if v["status"] == "mangler"]
        bridge.result({"mode": "feedback", "file": f,
                       "exportModified": _dt.datetime.fromtimestamp(export_mtime)
                       .strftime("%Y-%m-%d %H:%M"),
                       "vurderinger": out, "needsReexport": needs_reexport,
                       "missingPoints": missing, "dryRun": dry_run})
        return

    # ── lag 2: varighet/format ──
    ffprobe = shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"
    meta = {}
    try:
        r = subprocess.run([ffprobe, "-v", "error", "-print_format", "json",
                            "-show_format", "-show_streams", f],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=60)
        meta = json.loads(r.stdout)
    except Exception:
        pass
    exp_dur = float(meta.get("format", {}).get("duration") or 0)
    dur_diff = round(exp_dur - tl_dur, 2)
    duration_mismatch = abs(dur_diff) > 0.5

    # ── lag 3: kutt-sammenligning (heuristisk) ──
    limit = float(params.get("scanSeconds") or 600)
    threshold = float(params.get("sceneThreshold") or 0.3)
    offset = float(params.get("offsetSec") or 0)
    ff = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    tl_cuts = [c - offset for c in _visible_cuts(timeline, fps)
               if 0 <= c - offset <= (limit if limit > 0 else 1e9)]
    exp_cuts = [] if dry_run else _export_cuts(ff, f, limit, threshold)
    TOL = 0.35
    matched = 0
    missing_in_export = []  # timeline-kutt uten motstykke i eksporten
    for c in tl_cuts:
        if any(abs(c - e) <= TOL for e in exp_cuts):
            matched += 1
        else:
            missing_in_export.append(c)
    extra_in_export = [e for e in exp_cuts
                       if not any(abs(e - c) <= TOL for c in tl_cuts)]
    # avvikssoner: klyng manglende kutt (< 10s mellomrom = samme sone)
    zones = []
    for c in sorted(missing_in_export):
        if zones and c - zones[-1]["toSec"] < 10:
            zones[-1]["toSec"] = c
            zones[-1]["cuts"] += 1
        else:
            zones.append({"fromSec": c, "toSec": c, "cuts": 1})
    for z in zones:
        z["fromTc"] = _tc(int(z.pop("fromSec") * fps) + tl_start, fps)
        z["toTc"] = _tc(int(z.pop("toSec") * fps) + tl_start, fps)

    stale = bool(actions_after) or duration_mismatch
    verdict = ("UTDATERT — eksporten mangler endringer" if stale else
               ("trolig i synk (kutt-avvik kan være deteksjons-støy)"
                if len(missing_in_export) <= max(3, len(tl_cuts) * 0.15)
                else "MULIG utdatert — mange kutt-avvik, sjekk sonene"))

    bridge.result({
        "file": f, "exportModified": __import__("datetime").datetime
        .fromtimestamp(export_mtime).strftime("%Y-%m-%d %H:%M"),
        "timeline": timeline.GetName(),
        "durations": {"exportSec": round(exp_dur, 1), "timelineSec": round(tl_dur, 1),
                      "diffSec": dur_diff, "mismatch": duration_mismatch},
        "actionsAfterExport": actions_after[:30],
        "auditEntriesAfterExport": audit_after,
        "cutComparison": {"scannedSec": limit if limit > 0 else round(exp_dur, 0),
                          "timelineCuts": len(tl_cuts), "exportCuts": len(exp_cuts),
                          "matched": matched,
                          "missingInExport": len(missing_in_export),
                          "extraInExport": len(extra_in_export),
                          "divergenceZones": zones[:20],
                          "note": "Heuristisk: myke overganger/vinkelskift i samme "
                                  "scene kan unnslippe scene-deteksjonen."},
        "verdict": verdict, "stale": stale, "dryRun": dry_run,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
