"""Identify Key Faces — uses face_recognition to score thumbnails against bride/groom references.

Phase 1 (one-time per wedding):
  - User provides {bride: '/path/to/bride.jpg', groom: '/path/to/groom.jpg', ...}
  - Script computes 128-d face embeddings and stores reference vectors

Phase 2 (per cull session):
  - For each thumbnail in the session, detect faces and compare against references
  - Patch each CullDecision with keyFacesPresent + coverage + confidence
  - Boost highlight_score for clips with key faces (caller may apply this)

Returns the enriched session.

Requires: pip install face_recognition Pillow
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    reference_photos: dict[str, str] = params.get("referencePhotos") or {}
    session = params.get("session") or {}
    threshold = float(params.get("threshold", 0.6))
    boost_when_both = int(params.get("boostBoth", 25))
    boost_when_one = int(params.get("boostOne", 10))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would embed {len(reference_photos)} reference faces and score session thumbnails",
            "references": list(reference_photos.keys()),
            "threshold": threshold,
            "scoringImpact": {
                "has_both_key_faces": f"+{boost_when_both} highlightScore",
                "has_one_key_face": f"+{boost_when_one} highlightScore",
            },
        })
        return

    if not reference_photos:
        bridge.error("referencePhotos is required (e.g. { bride: '/path/to/bride.jpg', groom: '/path/to/groom.jpg' })")
        sys.exit(1)
    if not session or not isinstance(session, dict) or not session.get("decisions"):
        bridge.error("session with decisions[] is required (pass output from cull_folder.py)")
        sys.exit(1)

    try:
        import face_recognition  # type: ignore[import-not-found]
    except ImportError:
        bridge.error(
            "face_recognition not installed. Run: pip3 install face_recognition Pillow "
            "(needs dlib + cmake — see https://github.com/ageitgey/face_recognition for setup)"
        )
        sys.exit(1)

    # Phase 1: embed references
    references: dict[str, list] = {}
    for label, path in reference_photos.items():
        if not os.path.isfile(path):
            bridge.warn(f"Reference photo missing: {label} → {path}")
            continue
        image = face_recognition.load_image_file(path)
        encodings = face_recognition.face_encodings(image)
        if not encodings:
            bridge.warn(f"No face found in reference for {label}")
            continue
        references[label] = encodings[0]
        bridge.log(f"Embedded reference: {label}")

    if not references:
        bridge.error("No valid reference faces — cannot proceed")
        sys.exit(1)

    # Phase 2: score thumbnails
    enriched: list[dict] = []
    no_face_count = 0
    matched_count = 0
    for decision in session.get("decisions", []):
        thumbs = decision.get("thumbnails") or []
        if not thumbs:
            enriched.append({**decision, "keyFacesPresent": [], "keyFaceCoverage": 0, "keyFaceConfidence": 0})
            continue
        # Use first thumbnail; could improve by averaging across all
        try:
            image = face_recognition.load_image_file(thumbs[0])
            face_locations = face_recognition.face_locations(image)
            face_encodings = face_recognition.face_encodings(image, face_locations)
        except Exception as exc:
            bridge.warn(f"face_recognition failed on {decision.get('clipName')}: {exc}")
            enriched.append({**decision, "keyFacesPresent": [], "keyFaceCoverage": 0, "keyFaceConfidence": 0})
            continue

        if not face_encodings:
            no_face_count += 1
            enriched.append({**decision, "keyFacesPresent": [], "keyFaceCoverage": 0, "keyFaceConfidence": 0})
            continue

        present: list[str] = []
        best_confidence = 0.0
        coverage = 0.0
        image_h = image.shape[0]
        image_w = image.shape[1]
        total_pixels = image_h * image_w

        for (top, right, bottom, left), encoding in zip(face_locations, face_encodings):
            for label, ref_encoding in references.items():
                distance = float(face_recognition.face_distance([ref_encoding], encoding)[0])
                if distance < threshold:
                    confidence = 1.0 - distance
                    if label not in present:
                        present.append(label)
                    if confidence > best_confidence:
                        best_confidence = confidence
                    face_pixels = (bottom - top) * (right - left)
                    coverage += face_pixels / total_pixels

        if present:
            matched_count += 1

        boost = 0
        if len(present) >= 2:
            boost = boost_when_both
        elif len(present) == 1:
            boost = boost_when_one

        current_highlight = decision.get("highlightScore") or 0
        enriched.append({
            **decision,
            "keyFacesPresent": present,
            "keyFaceCoverage": round(coverage * 100, 1),
            "keyFaceConfidence": round(best_confidence, 2),
            "highlightScore": min(100, current_highlight + boost) if current_highlight else current_highlight,
            "keyFaceBoostApplied": boost,
        })

    session_out = {**session, "decisions": enriched}

    bridge.result({
        "references": list(references.keys()),
        "totalClips": len(enriched),
        "clipsMatchedKeyFace": matched_count,
        "clipsWithNoFace": no_face_count,
        "session": session_out,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
