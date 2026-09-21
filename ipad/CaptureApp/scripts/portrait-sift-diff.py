#!/usr/bin/env python3
"""Align a before/after portrait with SIFT and measure the real pixel delta.

This is an offline QA tool, not part of the iPad runtime. It removes small
scale/rotation/crop differences before calculating tonal, colour and texture
metrics, so a render is not rejected merely because its geometry moved by a
few pixels.

The repository's backend/python-services environment already pins OpenCV with
SIFT support; no additional CaptureApp dependency is required.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import cv2
import numpy as np


def load_image(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Could not read image: {path}")
    return image


def align_with_sift(
    reference: np.ndarray,
    candidate: np.ndarray,
    ratio: float,
    ransac_threshold: float,
) -> tuple[np.ndarray, np.ndarray, dict[str, float | int]]:
    sift = cv2.SIFT_create(nfeatures=8_000)
    reference_gray = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
    candidate_gray = cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY)
    reference_keys, reference_desc = sift.detectAndCompute(reference_gray, None)
    candidate_keys, candidate_desc = sift.detectAndCompute(candidate_gray, None)
    if reference_desc is None or candidate_desc is None:
        raise ValueError("SIFT could not find descriptors in both images")

    matches = cv2.BFMatcher(cv2.NORM_L2).knnMatch(
        reference_desc,
        candidate_desc,
        k=2,
    )
    good = [first for first, second in matches if first.distance < ratio * second.distance]
    if len(good) < 12:
        raise ValueError(f"Only {len(good)} reliable SIFT matches; need at least 12")

    reference_points = np.float32(
        [reference_keys[match.queryIdx].pt for match in good]
    ).reshape(-1, 1, 2)
    candidate_points = np.float32(
        [candidate_keys[match.trainIdx].pt for match in good]
    ).reshape(-1, 1, 2)
    homography, inlier_mask = cv2.findHomography(
        candidate_points,
        reference_points,
        cv2.RANSAC,
        ransac_threshold,
    )
    if homography is None or inlier_mask is None:
        raise ValueError("RANSAC could not estimate a stable homography")

    inliers = inlier_mask.ravel().astype(bool)
    if int(inliers.sum()) < 10:
        raise ValueError(f"Only {int(inliers.sum())} homography inliers; need at least 10")

    height, width = reference.shape[:2]
    aligned = cv2.warpPerspective(
        candidate,
        homography,
        (width, height),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT,
    )
    candidate_mask = np.full(candidate.shape[:2], 255, dtype=np.uint8)
    valid_mask = cv2.warpPerspective(
        candidate_mask,
        homography,
        (width, height),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
    )
    # Exclude interpolation/border pixels that otherwise look like edits.
    valid_mask = cv2.erode(valid_mask, np.ones((7, 7), np.uint8), iterations=1)

    projected = cv2.perspectiveTransform(candidate_points[inliers], homography)
    errors = np.linalg.norm(
        projected.reshape(-1, 2) - reference_points[inliers].reshape(-1, 2),
        axis=1,
    )
    registration = {
        "reference_keypoints": len(reference_keys),
        "candidate_keypoints": len(candidate_keys),
        "ratio_test_matches": len(good),
        "ransac_inliers": int(inliers.sum()),
        "inlier_ratio": float(inliers.mean()),
        "reprojection_rmse_px": float(np.sqrt(np.mean(np.square(errors)))),
        "valid_overlap_ratio": float(np.count_nonzero(valid_mask) / valid_mask.size),
    }
    return aligned, valid_mask, registration


def masked_values(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    return image[mask > 0]


def image_metrics(image: np.ndarray, mask: np.ndarray) -> dict[str, float]:
    pixels = masked_values(image, mask).astype(np.float32)
    luma_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    luma = masked_values(luma_image, mask).astype(np.float32) / 255.0
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_pixels = masked_values(lab, mask)
    chroma = np.hypot(lab_pixels[:, 1] - 128.0, lab_pixels[:, 2] - 128.0)
    return {
        "luma_mean": float(luma.mean()),
        "luma_stdev": float(luma.std()),
        "luma_p10": float(np.percentile(luma, 10)),
        "luma_p50": float(np.percentile(luma, 50)),
        "luma_p90": float(np.percentile(luma, 90)),
        "lab_chroma_mean": float(chroma.mean()),
        "red_minus_blue_mean": float(np.mean(pixels[:, 2] - pixels[:, 0]) / 255.0),
        "edge_energy": float(
            masked_values(
                np.abs(cv2.Laplacian(luma_image, cv2.CV_32F)),
                mask,
            ).mean()
            / 255.0
        ),
    }


def difference_metrics(
    reference: np.ndarray,
    aligned: np.ndarray,
    mask: np.ndarray,
) -> tuple[dict[str, float], np.ndarray]:
    absolute = cv2.absdiff(reference, aligned)
    per_pixel = absolute.astype(np.float32).mean(axis=2) / 255.0
    values = per_pixel[mask > 0]
    metrics = {
        "rgb_mae": float(values.mean()),
        "rgb_rmse": float(np.sqrt(np.mean(np.square(values)))),
        "pixel_delta_p50": float(np.percentile(values, 50)),
        "pixel_delta_p95": float(np.percentile(values, 95)),
        "changed_ratio_over_2pct": float(np.mean(values > 0.02)),
        "changed_ratio_over_5pct": float(np.mean(values > 0.05)),
        "changed_ratio_over_10pct": float(np.mean(values > 0.10)),
    }
    return metrics, absolute


def write_artifacts(
    output_dir: Path,
    reference: np.ndarray,
    aligned: np.ndarray,
    absolute: np.ndarray,
    mask: np.ndarray,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    diff_gray = cv2.cvtColor(absolute, cv2.COLOR_BGR2GRAY)
    valid_diff = diff_gray[mask > 0]
    scale = max(float(np.percentile(valid_diff, 99)), 1.0)
    normalized = np.clip(diff_gray.astype(np.float32) * 255.0 / scale, 0, 255).astype(np.uint8)
    heatmap = cv2.applyColorMap(normalized, cv2.COLORMAP_TURBO)
    heatmap[mask == 0] = 0
    overlay = cv2.addWeighted(reference, 0.5, aligned, 0.5, 0)
    overlay[mask == 0] = 0

    cv2.imwrite(str(output_dir / "aligned-after.png"), aligned)
    cv2.imwrite(str(output_dir / "absolute-difference.png"), absolute)
    cv2.imwrite(str(output_dir / "difference-heatmap.png"), heatmap)
    cv2.imwrite(str(output_dir / "alignment-overlay.png"), overlay)
    cv2.imwrite(str(output_dir / "valid-overlap-mask.png"), mask)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SIFT-align a retouched portrait and report pixel-level differences."
    )
    parser.add_argument("before", type=Path, help="Original/reference image")
    parser.add_argument("after", type=Path, help="Retouched candidate image")
    parser.add_argument("--output-dir", type=Path, help="Write aligned/difference QA images")
    parser.add_argument("--ratio", type=float, default=0.75, help="Lowe ratio-test threshold")
    parser.add_argument(
        "--ransac-threshold",
        type=float,
        default=3.0,
        help="RANSAC reprojection threshold in pixels",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        reference = load_image(args.before)
        candidate = load_image(args.after)
        aligned, mask, registration = align_with_sift(
            reference,
            candidate,
            ratio=args.ratio,
            ransac_threshold=args.ransac_threshold,
        )
        differences, absolute = difference_metrics(reference, aligned, mask)
        report = {
            "before": str(args.before.resolve()),
            "after": str(args.after.resolve()),
            "alignment": registration,
            "reference": image_metrics(reference, mask),
            "retouched": image_metrics(aligned, mask),
            "difference": differences,
        }
        if args.output_dir:
            write_artifacts(args.output_dir, reference, aligned, absolute, mask)
            report["artifacts"] = str(args.output_dir.resolve())
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (ValueError, cv2.error) as error:
        print(f"portrait-sift-diff: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
