"""Find Quotes — search a WhisperX transcription for specific words/phrases.

Params:
  transcription: full result from transcribe_audio.py (with segments[])
  searchTerms:   list of words/phrases (case-insensitive)
  contextSeconds: include N seconds before+after match (default 2)

Output:
  matches: [{start, end, text, matchedTerm, surroundingText}]
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    transcription = params.get("transcription") or {}
    search_terms = params.get("searchTerms") or []
    context_seconds = float(params.get("contextSeconds", 2))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would search {len(search_terms)} terms in transcription with {len(transcription.get('segments', []))} segments",
            "outputShape": {
                "matches": [{"start": "float", "end": "float", "text": "str", "matchedTerm": "str"}],
            },
        })
        return

    if not transcription.get("segments"):
        bridge.error("transcription with segments[] is required")
        sys.exit(1)
    if not search_terms:
        bridge.error("searchTerms list cannot be empty")
        sys.exit(1)

    segments = transcription["segments"]
    patterns = [(term, re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)) for term in search_terms]

    matches: list[dict] = []
    for idx, seg in enumerate(segments):
        text = seg.get("text", "")
        for term, pattern in patterns:
            if pattern.search(text):
                # Build surrounding context: nearby segments within context_seconds
                context_lines: list[str] = []
                for nearby in segments:
                    if abs(nearby["start"] - seg["start"]) <= context_seconds + 5:
                        context_lines.append(nearby["text"])
                matches.append({
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": text,
                    "matchedTerm": term,
                    "speaker": seg.get("speaker"),
                    "segmentIndex": idx,
                    "surroundingText": " ".join(context_lines[:5]),
                })

    bridge.result({
        "queryTerms": search_terms,
        "totalSegments": len(segments),
        "matchCount": len(matches),
        "matches": matches,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
