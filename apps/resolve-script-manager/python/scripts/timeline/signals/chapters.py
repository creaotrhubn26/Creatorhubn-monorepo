"""Chapter segmentation — clusters shots into chapters (ceremony / reception /
dance / etc.) via audio MFCC + temporal-position k-means.

Returns a dict mapping shot_index -> chapter_name. The orchestrator uses
this to ensure each chapter is represented in the final highlight (per
`chapter_targets` in genre_weights).

The clustering algorithm:
  1. For each shot, sample a 5-second audio snippet from the middle.
  2. Compute 13-coeff MFCC mean + std as a 26-dim feature vector.
  3. Append normalized temporal position (start_sec / duration) as a 27th
     feature — strong temporal coherence avoids zig-zagging across chapters.
  4. K-means with k=3 (ceremony / reception / dance default).
  5. Label clusters by mean temporal position: earliest = "ceremony",
     latest = "dance", middle = "reception".

Requires librosa + scikit-learn. Falls back to time-bucket if unavailable.
"""

from __future__ import annotations

import os
import subprocess
import tempfile


def available() -> bool:
    try:
        import librosa  # noqa: F401
        from sklearn.cluster import KMeans  # noqa: F401
        return True
    except ImportError:
        return False


def _shot_feature(ffmpeg: str, video: str, start: float, end: float):
    """Return a 26-d feature vector [mfcc_mean(13), mfcc_std(13)] or None."""
    import numpy as np  # type: ignore
    import librosa  # type: ignore
    duration = max(0.5, min(end - start, 5.0))
    mid_start = max(0.0, (start + end) / 2 - duration / 2)
    fd, tmp = tempfile.mkstemp(prefix="chap_", suffix=".wav")
    os.close(fd)
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{mid_start:.3f}", "-t", f"{duration:.3f}",
             "-i", video,
             "-vn", "-acodec", "pcm_s16le", "-ar", "22050", "-ac", "1",
             tmp],
            capture_output=True, timeout=20,
        )
        if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 1000:
            return None
        y, sr = librosa.load(tmp, sr=22050, mono=True)
        if y.size < sr // 4:
            return None
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        if mfcc.shape[1] == 0:
            return None
        return np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)])
    except Exception:  # noqa: BLE001
        return None
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def compute_chapter_labels(ffmpeg: str, video: str,
                           shots: list[tuple[float, float]],
                           total_duration: float,
                           n_chapters: int = 3) -> dict[int, str]:
    """Returns {shot_index: chapter_name}. Names: ceremony / reception / dance
    (for n_chapters=3). Falls back to time-bucket when ML unavailable."""
    if not shots or total_duration <= 0:
        return {}
    # ML path
    if available():
        try:
            import numpy as np
            from sklearn.cluster import KMeans
            features = []
            keep_idx = []
            for i, (s, e) in enumerate(shots):
                f = _shot_feature(ffmpeg, video, s, e)
                if f is None:
                    continue
                # Append temporal position as a strong feature (weight ×3 to
                # encourage temporally coherent clusters)
                temp = np.array([3.0 * (s + e) / 2 / max(0.1, total_duration)])
                features.append(np.concatenate([f, temp]))
                keep_idx.append(i)
            if len(features) < n_chapters:
                return _time_bucket(shots, total_duration, n_chapters)
            X = np.array(features)
            # Normalize features
            X = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-9)
            km = KMeans(n_clusters=n_chapters, n_init=5, random_state=42).fit(X)
            labels = km.labels_
            # Rank clusters by mean temporal position
            mid_times = np.array([(shots[i][0] + shots[i][1]) / 2 for i in keep_idx])
            cluster_mean_time = []
            for c in range(n_chapters):
                mask = labels == c
                if mask.any():
                    cluster_mean_time.append((c, float(mid_times[mask].mean())))
                else:
                    cluster_mean_time.append((c, float(total_duration / 2)))
            cluster_mean_time.sort(key=lambda x: x[1])
            order_map: dict[int, str] = {}
            chapter_names = _chapter_names(n_chapters)
            for rank, (c, _t) in enumerate(cluster_mean_time):
                order_map[c] = chapter_names[rank]
            out: dict[int, str] = {}
            for shot_i, label in zip(keep_idx, labels):
                out[shot_i] = order_map[label]
            # Fill in missing shots (those that failed MFCC extraction) with
            # nearest-time bucket
            bucket = _time_bucket(shots, total_duration, n_chapters)
            for i in range(len(shots)):
                if i not in out:
                    out[i] = bucket[i]
            return out
        except Exception:  # noqa: BLE001
            pass
    return _time_bucket(shots, total_duration, n_chapters)


def _chapter_names(n: int) -> list[str]:
    if n == 3:
        return ["ceremony", "reception", "dance"]
    if n == 2:
        return ["first_half", "second_half"]
    if n == 4:
        return ["prep", "ceremony", "reception", "dance"]
    return [f"chapter_{i+1}" for i in range(n)]


def _time_bucket(shots, total_duration, n) -> dict[int, str]:
    names = _chapter_names(n)
    out: dict[int, str] = {}
    for i, (s, e) in enumerate(shots):
        mid = (s + e) / 2
        bucket = min(n - 1, int(mid / total_duration * n))
        out[i] = names[bucket]
    return out


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    """Signal API: each shot maps to a numeric score (0..1) — here we return
    1.0 for every shot since this signal's value is the LABEL, not a score.

    The orchestrator reads chapter labels via `compute_chapter_labels()`
    directly. Returning 1.0 keeps the signal "active" in the registry log
    output without contributing to weighted score.
    """
    return {i: 1.0 for i in range(len(shots))}
