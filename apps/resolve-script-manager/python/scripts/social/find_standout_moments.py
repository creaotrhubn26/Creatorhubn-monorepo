"""Find Standout Moments — analyser transkript-segmenter og foreslå
de mest social-clipable momenter for repurpose-cuts.

Heuristikker:
  - Lengre setninger (>15 ord) → mer substansielt innhold
  - Spørsmål (slutter med ?) → engaging
  - Exclamations (!) eller emfase-ord → energi
  - Sterke ord (whitelisted topics, "incredible/never/always/biggest/
    secret/truth/realized/changed")
  - Tidsmessig posisjon (mid-segment > start/slutt — som regel hvor
    de gode quotene ligger)
  - Densitet av "I"/"vi" → personlig narrativ
  - Bør være 15-60 sek lange (passende for sosial)

Output via bridge.result():
  {
    "moments": [
      {
        "startSec": 124.3,
        "endSec": 156.8,
        "durationSec": 32.5,
        "score": 0.87,
        "text": "...transcript text...",
        "reason": "Lang substansiell setning + spørsmål + 'realized'"
      },
      ...
    ],
    "method": "heuristic"
  }
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Whitelist av "social-worthy" ord/fraser (norsk + engelsk)
STRONG_WORDS = {
    # English
    "incredible", "never", "always", "biggest", "secret", "truth",
    "realized", "changed", "honest", "honestly", "actually", "imagine",
    "remember", "moment", "discovered", "learned", "experience", "story",
    "passion", "love", "hate", "fear", "amazing", "shocking", "best",
    "worst", "first", "last", "only", "real", "true", "fact",
    "different", "unique", "important", "matter", "matters",
    "actually", "literally",
    # Norsk
    "utrolig", "aldri", "alltid", "største", "hemmelig", "sannhet",
    "skjønte", "forandret", "ærlig", "ærligtalt", "faktisk", "tenk",
    "husker", "øyeblikk", "oppdaget", "lærte", "opplevelse", "historie",
    "lidenskap", "elsker", "hater", "frykt", "fantastisk", "sjokkerende",
    "beste", "verste", "første", "siste", "eneste", "ekte",
    "viktig", "betyr",
}


def _segment_score(text: str, position_pct: float) -> tuple[float, str]:
    """Heuristisk standout-score 0-1 + reason-string."""
    lower = text.lower()
    words = text.split()
    word_count = len(words)
    reasons = []
    score = 0.0

    # Lengde-score
    if 25 <= word_count <= 80:
        score += 0.35
        reasons.append(f"substansiell ({word_count} ord)")
    elif 15 <= word_count < 25:
        score += 0.20
        reasons.append(f"middels lang ({word_count} ord)")
    elif word_count > 80:
        score += 0.15
        reasons.append("veldig lang")
    else:
        score += 0.05

    # Spørsmål
    if "?" in text:
        score += 0.18
        reasons.append("spørsmål")

    # Exclamations
    exclam_count = text.count("!")
    if exclam_count > 0:
        score += min(0.15, exclam_count * 0.08)
        reasons.append(f"{'energi' if exclam_count > 1 else 'utrop'}")

    # Sterke ord
    word_tokens = set(w.strip(".,!?\"'()").lower() for w in words)
    matching_strong = word_tokens & STRONG_WORDS
    if matching_strong:
        score += min(0.25, len(matching_strong) * 0.10)
        reasons.append(f"strong-words: {', '.join(list(matching_strong)[:3])}")

    # Personlig narrativ (jeg/I/vi/we)
    personal_words = {"jeg", "vi", "i", "we", "my", "min", "vår", "our"}
    personal_count = sum(1 for w in word_tokens if w in personal_words)
    if personal_count >= 2:
        score += 0.08
        reasons.append("personlig")

    # Posisjon-boost: mid-segment hvor "best quotes" er
    if 0.2 < position_pct < 0.8:
        score += 0.08
    # Penalize veldig start/slutt
    elif position_pct < 0.05 or position_pct > 0.95:
        score -= 0.10
        reasons.append("(introduksjon/avslutning penalty)")

    score = max(0.0, min(1.0, score))
    return (round(score, 2), " · ".join(reasons))


def _group_segments_into_window(
    segments: list[dict[str, Any]],
    target_duration: float,
    min_duration: float,
    max_duration: float,
) -> list[dict[str, Any]]:
    """Gruppér konsekutive transkript-segmenter inn i 'cut-vinduer' som
    er nær target_duration. Hver gruppe representerer én potensiell cut."""
    cuts: list[dict[str, Any]] = []
    n = len(segments)
    i = 0
    while i < n:
        start = segments[i]["start"]
        cur_text_parts: list[str] = []
        end = start
        j = i
        while j < n:
            seg = segments[j]
            seg_end = seg["end"]
            new_duration = seg_end - start
            if new_duration > max_duration:
                # Stopp her hvis vi allerede passet min_duration
                if end - start >= min_duration:
                    break
                else:
                    # Tving inkludering — eller hopp framover
                    cur_text_parts.append(seg.get("text", "").strip())
                    end = seg_end
                    j += 1
                    break
            cur_text_parts.append(seg.get("text", "").strip())
            end = seg_end
            j += 1
            if new_duration >= target_duration:
                break

        duration = end - start
        if duration >= min_duration:
            cuts.append({
                "startSec": round(start, 2),
                "endSec": round(end, 2),
                "durationSec": round(duration, 2),
                "text": " ".join(cur_text_parts).strip(),
            })
        # Hopp framover — overlapp 25% for ikke å miste gode quotes
        skip = max(1, (j - i) // 2)
        i += skip
    return cuts


def run(params: dict[str, Any], dry_run: bool) -> None:
    transcript = params.get("transcript")
    if not transcript or not isinstance(transcript, dict):
        bridge.error("transcript-objekt påkrevd (Whisper-format)")
        sys.exit(1)
    segments = transcript.get("segments")
    if not isinstance(segments, list) or len(segments) == 0:
        bridge.error("transcript.segments[] er tom eller mangler")
        sys.exit(1)

    target_dur = float(params.get("targetDurationSec") or 30)
    min_dur = float(params.get("minDurationSec") or 15)
    max_dur = float(params.get("maxDurationSec") or 60)
    top_n = int(params.get("topN") or 6)

    if dry_run:
        bridge.result({
            "wouldAnalyze": len(segments),
            "targetDur": target_dur,
        })
        return

    total_duration = float(transcript.get("durationSec") or 0)
    if total_duration <= 0 and segments:
        total_duration = float(segments[-1].get("end", 0))

    bridge.log(
        f"Analyserer {len(segments)} segmenter for "
        f"{target_dur}s-target cuts (range {min_dur}-{max_dur}s)"
    )

    # Bygg potensielle cut-vinduer
    candidate_cuts = _group_segments_into_window(
        segments, target_dur, min_dur, max_dur,
    )
    bridge.log(f"{len(candidate_cuts)} candidate cuts generert")

    # Score hver cut
    scored: list[dict[str, Any]] = []
    for cut in candidate_cuts:
        position = cut["startSec"] / total_duration if total_duration > 0 else 0.5
        score, reason = _segment_score(cut["text"], position)
        scored.append({
            **cut,
            "score": score,
            "reason": reason,
        })

    # Sort by score, behold topp-N
    scored.sort(key=lambda c: c["score"], reverse=True)
    # Filtrer overlapping cuts (hvis startSec er innenfor 20% av annen valgt)
    selected: list[dict[str, Any]] = []
    for cut in scored:
        overlap_threshold = max_dur * 0.5
        if any(abs(cut["startSec"] - s["startSec"]) < overlap_threshold
               for s in selected):
            continue
        selected.append(cut)
        if len(selected) >= top_n:
            break

    bridge.log(f"Selected topp {len(selected)} non-overlapping cuts")
    bridge.result({
        "moments": selected,
        "candidateCount": len(candidate_cuts),
        "method": "heuristic",
    })


bridge.main_guard(run)
