"""Cluster Faces From Clips — finn alle unike ansikter i material-mappa.

Brukes i Bryllups-veiviseren Steg 4: bruker pek på material-mappa, Claude
scanner alle klipp og grupperer ansiktene som dukker opp. Bruker labeler
hver klynge ("Brudens mor", "Brudens far", "Brudgom", etc.) slik at Claude
kan prioritere klipp med disse personene i highlight.

Algoritme:
  1. For hver klipp i clips-arrayet (eller scan folder)
  2. Hent 1 frame hver N sekunder (default 10s)
  3. Detect ansikter via insightface (RetinaFace-modell)
  4. For hver detektert ansikt → 512-d embedding
  5. DBSCAN-clustering på alle embeddings (eps=0.5)
  6. For hver klynge: returner representative thumbnail + antall observasjoner

Output:
  clusters: [
    {
      id: "c0",
      thumbnail: "/path/to/representative_face.jpg",
      occurrences: int,
      clips: [{ path, timeSec }],  # hvor ble ansiktet sett
    },
    ...
  ]
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
FACES_DIR = os.path.join(CACHE_DIR, "face_clusters")

VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".avi", ".mts", ".m2ts"}


def find_tool(name: str) -> str | None:
    p = shutil.which(name)
    if p: return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"):
        full = os.path.join(base, name)
        if os.path.isfile(full): return full
    return None


def extract_frame(ffmpeg: str, video: str, time_sec: float, out_path: str) -> bool:
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-ss", f"{time_sec:.2f}", "-i", video,
        "-frames:v", "1", "-q:v", "3",
        "-vf", "scale=640:-1",
        out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=15)
        return r.returncode == 0 and os.path.isfile(out_path) and os.path.getsize(out_path) > 500
    except (subprocess.TimeoutExpired, OSError):
        return False


def get_duration(ffprobe: str, video: str) -> float:
    try:
        r = subprocess.run([
            ffprobe, "-v", "error", "-show_entries", "format=duration",
            "-of", "csv=p=0", video,
        ], capture_output=True, text=True, timeout=15)
        return float(r.stdout.strip())
    except (subprocess.TimeoutExpired, OSError, ValueError):
        return 0.0


def run(params: dict[str, Any], dry_run: bool) -> None:
    clips_arg = params.get("clips")
    folder = (params.get("folder") or "").strip()
    sample_interval = float(params.get("sampleIntervalSec") or 10.0)
    max_frames_per_clip = int(params.get("maxFramesPerClip") or 12)
    eps = float(params.get("clusterEps") or 0.55)

    clip_paths: list[str] = []
    if isinstance(clips_arg, list):
        for c in clips_arg:
            if isinstance(c, dict) and isinstance(c.get("path"), str):
                clip_paths.append(c["path"])
            elif isinstance(c, str):
                clip_paths.append(c)
    if not clip_paths and folder and os.path.isdir(folder):
        for root, _, files in os.walk(folder):
            for f in files:
                if f.startswith("."): continue
                if os.path.splitext(f)[1].lower() in VIDEO_EXT:
                    clip_paths.append(os.path.join(root, f))

    if not clip_paths:
        bridge.error("Ingen klipp å analysere — gi clips-array eller folder")
        sys.exit(1)

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    if not ffmpeg or not ffprobe:
        bridge.error("ffmpeg/ffprobe mangler — installer via Dependencies modal")
        sys.exit(1)

    try:
        import numpy as np  # type: ignore
        from insightface.app import FaceAnalysis  # type: ignore
        from sklearn.cluster import DBSCAN  # type: ignore
    except ImportError as exc:
        bridge.error(f"Mangler ML-pakker: {exc}. Kjør Dependencies → Install ML deps.")
        sys.exit(1)

    if dry_run:
        bridge.result({"wouldScan": len(clip_paths)})
        return

    os.makedirs(FACES_DIR, exist_ok=True)

    bridge.progress(0, 100, "Laster insightface-modell …")
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))

    all_embeddings = []      # list[ndarray(512,)]
    all_observations = []    # parallel list[ dict{clip, timeSec, bbox, framePath} ]

    tmp_dir = tempfile.mkdtemp(prefix="face_frames_")
    try:
        for i, clip in enumerate(clip_paths):
            bridge.progress(int(70 * (i + 1) / len(clip_paths)), 100,
                            f"Skanner {os.path.basename(clip)} ({i+1}/{len(clip_paths)})")
            duration = get_duration(ffprobe, clip)
            if duration < 1: continue
            n_samples = min(max_frames_per_clip, max(1, int(duration / sample_interval)))
            for k in range(n_samples):
                t = (k + 0.5) * (duration / n_samples)
                frame_path = os.path.join(tmp_dir, f"clip{i}_t{k}.jpg")
                if not extract_frame(ffmpeg, clip, t, frame_path): continue
                try:
                    import cv2  # type: ignore
                    img = cv2.imread(frame_path)
                    if img is None: continue
                    faces = app.get(img)
                    for face in faces:
                        emb = face.normed_embedding
                        if emb is None or len(emb) != 512: continue
                        bbox = face.bbox.astype(int).tolist()
                        all_embeddings.append(emb)
                        all_observations.append({
                            "clip": clip, "timeSec": round(t, 1),
                            "bbox": bbox, "framePath": frame_path,
                        })
                except Exception:  # noqa: BLE001
                    continue

        if not all_embeddings:
            bridge.result({"clusters": [], "totalObservations": 0,
                           "message": "Ingen ansikter detektert"})
            return

        bridge.progress(75, 100, f"Clustering {len(all_embeddings)} ansikter …")
        emb_arr = np.array(all_embeddings)
        # DBSCAN i cosine-distance ≈ 1 - dot-product på normaliserte
        from sklearn.metrics.pairwise import cosine_distances  # type: ignore
        dists = cosine_distances(emb_arr)
        clustering = DBSCAN(eps=eps, min_samples=2, metric="precomputed").fit(dists)

        clusters_by_id: dict[int, list[int]] = {}
        for i, label in enumerate(clustering.labels_):
            if label == -1: continue  # støy
            clusters_by_id.setdefault(int(label), []).append(i)

        # Sortér klynger etter størrelse (flest observasjoner = viktigst)
        sorted_clusters = sorted(clusters_by_id.items(), key=lambda kv: -len(kv[1]))

        bridge.progress(85, 100, "Henter representative thumbnails …")
        clusters_out = []
        for cluster_idx, (_label, indices) in enumerate(sorted_clusters):
            if len(indices) < 2: continue
            # Bruk midten-most observasjon som representant
            rep_idx = indices[len(indices) // 2]
            rep_obs = all_observations[rep_idx]
            # Crop face-region for thumbnail
            try:
                import cv2  # type: ignore
                img = cv2.imread(rep_obs["framePath"])
                x1, y1, x2, y2 = rep_obs["bbox"]
                pad = 30
                h, w = img.shape[:2]
                x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
                x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
                crop = img[y1:y2, x1:x2]
                thumb_path = os.path.join(FACES_DIR, f"cluster_{cluster_idx}_{int(rep_obs['timeSec'])}.jpg")
                cv2.imwrite(thumb_path, crop)
            except Exception:
                thumb_path = rep_obs["framePath"]

            occurrences = [
                {"clip": all_observations[i]["clip"], "timeSec": all_observations[i]["timeSec"]}
                for i in indices
            ]
            clusters_out.append({
                "id": f"c{cluster_idx}",
                "thumbnail": thumb_path,
                "occurrences": len(indices),
                "clips": occurrences[:20],  # cap for output-size
            })

        bridge.progress(100, 100, "Ferdig")
        bridge.log(f"Fant {len(clusters_out)} unike ansikter")
        bridge.result({
            "clusters": clusters_out,
            "totalObservations": len(all_observations),
            "clipCount": len(clip_paths),
        })
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    bridge.main_guard(run)
