"""Finn person — «de vil ha mer av X i filmen»: søk i klipp OG bilder.

Referansebilder (fotografens stillbilder er perfekte) → ansikts-embedding
(OpenCV YuNet-deteksjon + SFace-gjenkjenning, lokalt og gratis) → søk
gjennom videoklipp (samplede frames) og fotomappen. Embeddings caches i
prosjektindeksen per klipp (fingerprint-voktet) — andre søk er øyeblikkelige.

Modi:
  register  personName= + imagePaths=<kommaseparert> → største ansikt per
            bilde lagres som referanse (flere bilder = mer robust).
  people    List registrerte personer.
  search    personName= → treff i klipp (m/ tidspunkt + brukt/ubrukt-status
            + skjermtid-estimat fra timelinen) og bilder. Svarer direkte på
            «mer av X»: hvor mye X har nå + hvilke UBRUKTE klipp/bilder
            som har X.
            scope=both|clips|photos, maxClips=120 (0=alle — full skanning
            av 1100+ klipp tar timevis første gang), sampleStep=5 (sek),
            photosDir=<sti> (default: <prosjektrot>/Bilder fiks)

Terskel: SFace cosine ≥ 0.36 (standard). Ærlig: profil/motlys/små ansikter
kan glippe — treff er bevis, fravær er ikke motbevis.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402
from project_index import ProjectIndex, clip_identity, fingerprint  # noqa: E402

MODELS = os.path.expanduser("~/.config/postagent/models")
COS_THRESHOLD = 0.36


def _engines():
    import cv2
    det = cv2.FaceDetectorYN_create(os.path.join(MODELS, "yunet.onnx"), "", (320, 320), 0.7)
    rec = cv2.FaceRecognizerSF_create(os.path.join(MODELS, "sface.onnx"), "")
    return cv2, det, rec


def _faces_in_image(cv2, det, rec, img, max_side=1280):
    """[(embedding(list), areal-andel)] for alle ansikter i bildet."""
    if img is None:
        return []
    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    det.setInputSize((img.shape[1], img.shape[0]))
    _n, faces = det.detect(img)
    out = []
    if faces is None:
        return out
    for f in faces:
        try:
            aligned = rec.alignCrop(img, f)
            emb = rec.feature(aligned).flatten().tolist()
            area = (f[2] * f[3]) / (img.shape[0] * img.shape[1])
            out.append((emb, float(area)))
        except Exception:
            continue
    return out


def _cos(a, b) -> float:
    import math
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def _clip_faces(cv2, det, rec, path: str, step_sec: float, cap_frames: int = 24):
    """Samplede ansikts-embeddings fra et videoklipp: [{t, emb}]."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return []
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total = (cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) / fps
    out = []
    t = 0.5
    while t < max(1.0, total) and len(out) < cap_frames * 4:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if ok:
            for emb, _area in _faces_in_image(cv2, det, rec, frame, max_side=960):
                out.append({"t": round(t, 1), "emb": emb})
        t += step_sec
    cap.release()
    return out


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    mode = (params.get("mode") or "people").strip().lower()
    idx = ProjectIndex(project, resolve=conn.resolve)

    if mode == "people":
        rows = idx.db.execute(
            "SELECT subject_uid, COUNT(*), MAX(created_ts) FROM analyses "
            "WHERE kind='person_ref' GROUP BY subject_uid").fetchall()
        bridge.result({"mode": mode,
                       "people": [{"name": r[0], "references": r[1]} for r in rows],
                       "dryRun": dry_run})
        idx.close()
        return

    if mode == "register":
        name = (params.get("personName") or "").strip()
        paths = [p.strip() for p in (params.get("imagePaths") or "").split(",") if p.strip()]
        if not name or not paths:
            bridge.error("register krever personName= og imagePaths=<kommaseparert>.")
            return
        cv2, det, rec = _engines()
        stored, skipped = 0, []
        for p in paths:
            p = os.path.expanduser(p)
            faces = _faces_in_image(cv2, det, rec, cv2.imread(p))
            if not faces:
                skipped.append({"image": p, "why": "ingen ansikter funnet"})
                continue
            emb, _area = max(faces, key=lambda fa: fa[1])  # største ansikt
            if not dry_run:
                idx.record_analysis("person_ref", name, {"embedding": emb, "source": p})
            stored += 1
        idx.commit()
        idx.close()
        bridge.result({"mode": mode, "person": name, "referencesStored": stored,
                       "skipped": skipped,
                       "note": "Største ansikt per bilde brukes — send bilder der "
                               "personen er hovedmotivet.", "dryRun": dry_run})
        return

    if mode == "search":
        name = (params.get("personName") or "").strip()
        refs = [json.loads(r[0])["embedding"] for r in idx.db.execute(
            "SELECT payload FROM analyses WHERE kind='person_ref' AND subject_uid=?",
            (name,)).fetchall()]
        if not refs:
            bridge.error(f"Ingen referanser for «{name}» — kjør register først.")
            return
        scope = (params.get("scope") or "both").strip().lower()
        max_clips = int(params.get("maxClips") or 120)
        step = float(params.get("sampleStep") or 5)
        cv2, det, rec = _engines()

        def best_score(embs):
            return max((_cos(e, r) for e in embs for r in refs), default=0.0)

        # ── klipp ──
        clip_hits, scanned = [], 0
        used_uids = set()
        screen_time = 0.0
        timeline = project.GetCurrentTimeline()
        fps = float(timeline.GetSetting("timelineFrameRate") or 25.0) if timeline else 25.0
        tl_items = []
        if timeline:
            for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
                for it in timeline.GetItemListInTrack("video", t) or []:
                    try:
                        mpi = it.GetMediaPoolItem()
                        if mpi:
                            uid = clip_identity(mpi)["uid"]
                            used_uids.add(uid)
                            tl_items.append((uid, (int(it.GetEnd() or 0)
                                                   - int(it.GetStart() or 0)) / fps))
                    except Exception:
                        continue
        if scope in ("both", "clips"):
            clips = []

            def walk(folder):
                for c in folder.GetClipList() or []:
                    clips.append(c)
                for s in folder.GetSubFolderList() or []:
                    walk(s)
            walk(conn.media_pool.GetRootFolder())
            # prioriter: brukte først (skjermtid-svar), så UBRUKT
            def prio(c):
                return 0 if clip_identity(c)["uid"] in used_uids else 1
            clips.sort(key=prio)
            for c in clips:
                if max_clips and scanned >= max_clips:
                    break
                ident = clip_identity(c)
                fpath = ident["path"]
                if not fpath or not os.path.isfile(fpath) or \
                        not fpath.lower().endswith((".mp4", ".mov", ".mxf", ".mts")):
                    continue
                scanned += 1
                fp_now = fingerprint(fpath)
                cached = idx.get_analysis("face_sig", ident["uid"], fp_now)
                if cached is None:
                    sig = _clip_faces(cv2, det, rec, fpath, step)
                    idx.record_analysis("face_sig", ident["uid"], sig, fp_now)
                    if scanned % 20 == 0:
                        idx.commit()
                    bridge.progress(scanned, max_clips or len(clips),
                                    f"skanner {ident['name'][:30]}")
                else:
                    sig = cached
                matches = [{"timeSec": s["t"],
                            "score": round(max(_cos(s["emb"], r) for r in refs), 3)}
                           for s in sig
                           if max(_cos(s["emb"], r) for r in refs) >= COS_THRESHOLD]
                if matches:
                    used = ident["uid"] in used_uids
                    if used:
                        screen_time += sum(d for u, d in tl_items if u == ident["uid"])
                    clip_hits.append({"clip": ident["name"], "uid": ident["uid"],
                                      "used": used,
                                      "bestScore": max(m["score"] for m in matches),
                                      "hits": matches[:6]})
            idx.commit()

        # ── bilder ──
        photo_hits = []
        if scope in ("both", "photos"):
            pdir = os.path.expanduser(params.get("photosDir") or "")
            if not pdir:
                cand = glob.glob("/Volumes/*/*/Bilder*") + glob.glob("/Volumes/*/*/Photo*")
                pdir = cand[0] if cand else ""
            photos = sorted(glob.glob(os.path.join(pdir, "*.jpg"))
                            + glob.glob(os.path.join(pdir, "*.jpeg")))[:int(params.get("maxPhotos") or 150)]
            for p in photos:
                fp_now = fingerprint(p)
                key = "photo:" + os.path.basename(p)
                cached = idx.get_analysis("face_sig", key, fp_now)
                if cached is None:
                    faces = _faces_in_image(cv2, det, rec, cv2.imread(p))
                    cached = [{"t": 0, "emb": e} for e, _a in faces]
                    idx.record_analysis("face_sig", key, cached, fp_now)
                score = max((max(_cos(s["emb"], r) for r in refs) for s in cached),
                            default=0.0)
                if score >= COS_THRESHOLD:
                    photo_hits.append({"photo": p, "score": round(score, 3)})
            idx.commit()

        used_hits = [h for h in clip_hits if h["used"]]
        unused_hits = [h for h in clip_hits if not h["used"]]
        bridge.result({
            "mode": mode, "person": name, "references": len(refs),
            "clipsScanned": scanned,
            "usedClipsWithPerson": len(used_hits),
            "estScreenTimeSec": round(screen_time, 1),
            "unusedClipsWithPerson": sorted(unused_hits,
                                            key=lambda h: -h["bestScore"])[:25],
            "usedClips": sorted(used_hits, key=lambda h: -h["bestScore"])[:25],
            "photoHits": sorted(photo_hits, key=lambda h: -h["score"])[:25],
            "answer": f"«Mer av {name}»: {len(unused_hits)} UBRUKTE klipp + "
                      f"{len(photo_hits)} bilder har personen (levende foto-kandidater). "
                      f"I dag: ~{round(screen_time)}s skjermtid over {len(used_hits)} brukte klipp.",
            "note": "Treff er bevis, fravær er ikke motbevis (profil/motlys kan glippe). "
                    "Embeddings caches — neste søk er raskt.",
            "dryRun": dry_run})
        idx.close()
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
