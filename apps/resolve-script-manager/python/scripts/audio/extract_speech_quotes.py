"""Extract Speech Quotes — find shippable moments from speeches via WhisperX.

Use case: Bjarne har bryllups-speeches på 5-15 min stykket. Av disse er
det typisk 4-6 quote-moments som er sterke nok til å lande i en
highlight eller deles som standalone clip — resten er "uhmm, ja, og
deretter…". Dette scriptet kjører WhisperX, scorer hvert speech-segment,
og returnerer topp N quotes med timecode + tekst.

Scoring-signaler:
  - Lengde-fit       : 5-15 ord = ideelt (kort + complete tanke)
  - Emotional ord    : kjærlighet/familie/takk/første-mom-jeg-så-deg-typer
  - Punkterende      : slutter med . eller ! ikke …
  - Audio-reaction   : applaus eller latter rett etter (RMS-pike via ffmpeg)
  - Speaker-konsistens: gruppér quotes per detektert speaker så vi ikke
                       får 6 quotes fra én person + 0 fra resten
  - No-filler        : straffe "uhm", "ehh", "liksom"

Output:
  quotes: [{ startSec, endSec, text, speaker, score, signals: {...} }, ...]

Cache: skriver result til last_speech_quotes.json så build_speeches_highlight
kan plukke opp uten å re-transkribere.

Use cases for output:
  1. Marker-import til Resolve (separate script)
  2. Standalone-clip generation per quote (separate script — eg "best of
     speeches"-reel)
  3. Auto-overlay caption på highlight under tilsvarende timecode
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
QUOTES_CACHE_PATH = os.path.join(CACHE_DIR, "last_speech_quotes.json")


# Norwegian + English emotional vocabulary common in wedding speeches.
# Match either lower-case word boundary. Used for scoring, not filtering.
EMOTIONAL_KEYWORDS_NO = {
    "kjærlighet", "elsker", "elske", "elsket", "stolt", "stolte",
    "familie", "venner", "takk", "tusen", "vakker", "vakre", "vakreste",
    "lykke", "lykkelig", "lykkelige", "samme dag", "alltid", "evig",
    "perfekt", "drøm", "drømmer", "hjerte", "hjertet", "hjerter",
    "minne", "minner", "minnet", "spesielle", "ekte", "støttet", "betyr",
    "betydd", "vi to", "oss to", "sammen", "for alltid", "fra dag én",
}
EMOTIONAL_KEYWORDS_EN = {
    "love", "loved", "loving", "lovely", "proud", "family", "friends",
    "thank", "thanks", "beautiful", "happy", "happiness", "forever",
    "perfect", "dream", "dreams", "heart", "memory", "memories", "special",
    "always", "support", "supported", "together", "first time", "since",
    "future", "promise", "vow", "blessing", "blessed", "grateful",
}

FILLER_PATTERNS = (
    re.compile(r"\b(uhm+|ehh+|liksom|sort av|du vet|like|um+|uh+|er+|ah+)\b",
               re.IGNORECASE),
)


def _find_ffmpeg() -> tuple[str | None, str | None]:
    ffm = (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
        or shutil.which("ffmpeg")
        or "/opt/homebrew/bin/ffmpeg"
    )
    ffp = (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFPROBE")
        or shutil.which("ffprobe")
        or "/opt/homebrew/bin/ffprobe"
    )
    if ffm and ffp and os.path.isfile(ffm) and os.path.isfile(ffp):
        return ffm, ffp
    return None, None


def _find_whisperx_python() -> str | None:
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    candidates = []
    if os.path.isfile(venv_py):
        candidates.append(venv_py)
    candidates.append(shutil.which("python3") or "/usr/bin/python3")
    for py in candidates:
        try:
            r = subprocess.run(
                [py, "-c", "import whisperx"], capture_output=True, timeout=10,
            )
            if r.returncode == 0:
                return py
        except (subprocess.SubprocessError, OSError):
            continue
    return None


def _transcribe(python_path: str, audio_path: str, model: str,
                language: str | None, hf_token: str | None) -> list[dict]:
    import tempfile
    with tempfile.TemporaryDirectory(prefix="quotes_whisperx_") as out_dir:
        cmd = [
            python_path, "-m", "whisperx", audio_path,
            "--model", model,
            "--output_dir", out_dir,
            "--output_format", "json",
            "--compute_type", "int8",
        ]
        if language and language != "auto":
            cmd.extend(["--language", language])
        if hf_token:
            cmd.extend(["--hf_token", hf_token, "--diarize",
                        "--min_speakers", "1", "--max_speakers", "8"])
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=2400)
        except subprocess.TimeoutExpired:
            bridge.warn("WhisperX transcription timed out (40 min)")
            return []
        if r.returncode != 0:
            bridge.warn(f"WhisperX failed: {(r.stderr or '')[-400:]}")
            return []
        json_files = [f for f in os.listdir(out_dir) if f.endswith(".json")]
        if not json_files:
            return []
        with open(os.path.join(out_dir, json_files[0]), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return [
            {
                "start": float(s.get("start", 0)),
                "end": float(s.get("end", 0)),
                "text": (s.get("text") or "").strip(),
                "speaker": s.get("speaker"),
            }
            for s in (data.get("segments") or [])
        ]


def _audio_reaction_after(ffmpeg: str, audio_path: str, after_sec: float,
                          window_sec: float = 1.5) -> float:
    """Detect applause/laughter spike right after a segment ends. Returns 0..1
    where 1 = strong RMS-jump (likely reaction)."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-ss", f"{after_sec:.3f}", "-t", f"{window_sec:.3f}",
        "-i", audio_path,
        "-vn", "-af", "volumedetect",
        "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        m = re.search(r"mean_volume: ([-\d.]+) dB", r.stderr)
        if not m:
            return 0.0
        db = float(m.group(1))
        # Map -40dB → 0, -10dB → 1.0
        return max(0.0, min(1.0, (db + 40) / 30))
    except Exception:  # noqa: BLE001
        return 0.0


def _score_segment(seg: dict, lang_hint: str | None,
                   reaction_score: float) -> dict:
    text = seg.get("text") or ""
    words = re.findall(r"\b\w+\b", text)
    n_words = len(words)
    # Length-fit
    if 5 <= n_words <= 15:
        length_score = 1.0
    elif n_words < 5:
        length_score = n_words / 5.0
    elif n_words <= 25:
        length_score = 1.0 - (n_words - 15) / 10.0 * 0.5
    else:
        length_score = 0.2

    # Emotional keywords
    text_lc = text.lower()
    if lang_hint and lang_hint.startswith("no"):
        vocab = EMOTIONAL_KEYWORDS_NO
    elif lang_hint == "en":
        vocab = EMOTIONAL_KEYWORDS_EN
    else:
        vocab = EMOTIONAL_KEYWORDS_NO | EMOTIONAL_KEYWORDS_EN
    emotional_hits = sum(1 for w in vocab if w in text_lc)
    emotional_score = min(1.0, emotional_hits / 3.0)

    # Punkterende — slutter med . ! ? (sterk lukking)
    closing_score = 1.0 if text.rstrip().endswith((".", "!", "?")) else 0.5

    # Filler penalty
    filler_count = sum(len(p.findall(text)) for p in FILLER_PATTERNS)
    filler_penalty = min(0.5, filler_count * 0.15)

    # Composite
    raw_score = (
        0.30 * length_score
        + 0.30 * emotional_score
        + 0.15 * closing_score
        + 0.25 * reaction_score
        - filler_penalty
    )
    return {
        "length": round(length_score, 3),
        "emotional": round(emotional_score, 3),
        "closing": round(closing_score, 3),
        "reaction": round(reaction_score, 3),
        "fillerPenalty": round(filler_penalty, 3),
        "wordCount": n_words,
        "emotionalHits": emotional_hits,
        "fillerCount": filler_count,
        "composite": round(max(0.0, raw_score), 3),
    }


def _pick_top_quotes_per_speaker(scored_segments: list[dict],
                                 per_speaker: int = 2,
                                 overall_max: int = 8) -> list[dict]:
    """Group by speaker, take top N each, then merge + sort chronologically.
    Ensures diversity across speakers (don't take all 8 quotes from one)."""
    by_speaker: dict[str, list[dict]] = {}
    for seg in scored_segments:
        speaker = seg.get("speaker") or "UNKNOWN"
        by_speaker.setdefault(speaker, []).append(seg)
    selected: list[dict] = []
    for speaker, segs in by_speaker.items():
        segs.sort(key=lambda s: -(s["signals"]["composite"]))
        selected.extend(segs[:per_speaker])
    selected.sort(key=lambda s: -(s["signals"]["composite"]))
    selected = selected[:overall_max]
    selected.sort(key=lambda s: float(s.get("start") or 0))
    return selected


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    model = (params.get("whisperModel") or "large-v3").strip()
    language = (params.get("language") or "auto").strip()
    hf_token = params.get("hfToken") or os.environ.get("HF_TOKEN")
    per_speaker = int(params.get("perSpeaker") or 2)
    overall_max = int(params.get("maxQuotes") or 8)

    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' is not a file")
        sys.exit(1)

    ffmpeg, _ = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH — install via Dependencies modal")
        sys.exit(1)

    python_path = _find_whisperx_python()
    if not python_path:
        bridge.error(
            "WhisperX not installed. Install via Dependencies modal "
            "(opens DependenciesModal → 'whisperx (Python)' Install-knapp)."
        )
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldTranscribe": audio_path,
            "model": model,
            "language": language,
            "perSpeaker": per_speaker,
            "maxQuotes": overall_max,
        })
        return

    bridge.progress(5, 100, f"Transcribing with WhisperX ({model})…")
    segments = _transcribe(python_path, audio_path, model,
                           None if language == "auto" else language, hf_token)
    if not segments:
        bridge.error("WhisperX produced 0 segments — check ffmpeg / audio file")
        sys.exit(1)
    bridge.log(f"Got {len(segments)} transcribed segments")

    bridge.progress(60, 100, "Scoring segments…")
    scored: list[dict] = []
    for i, seg in enumerate(segments):
        # Audio-reaction lookup right AFTER the segment ends
        reaction = _audio_reaction_after(ffmpeg, audio_path,
                                         after_sec=float(seg.get("end") or 0))
        signals = _score_segment(seg, language, reaction)
        scored.append({**seg, "signals": signals})
        if (i + 1) % 50 == 0:
            bridge.progress(
                60 + int(25 * (i + 1) / max(1, len(segments))), 100,
                f"Scored {i+1}/{len(segments)}",
            )

    bridge.progress(90, 100, "Selecting top quotes…")
    quotes = _pick_top_quotes_per_speaker(scored, per_speaker, overall_max)

    # Cache for downstream tools (Resolve markers / standalone-clip generator)
    os.makedirs(CACHE_DIR, exist_ok=True)
    payload = {
        "audioPath": audio_path,
        "language": language,
        "model": model,
        "segmentCount": len(segments),
        "quoteCount": len(quotes),
        "quotes": quotes,
        "allScoredSegments": scored,
    }
    try:
        with open(QUOTES_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        bridge.log(f"Cached quotes → {QUOTES_CACHE_PATH}")
    except OSError as exc:
        bridge.warn(f"Could not cache quotes: {exc}")

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "audioPath": audio_path,
        "segmentCount": len(segments),
        "quoteCount": len(quotes),
        "topQuotes": [
            {
                "startSec": q.get("start"),
                "endSec": q.get("end"),
                "speaker": q.get("speaker"),
                "text": q.get("text"),
                "score": q["signals"]["composite"],
            }
            for q in quotes
        ],
        "cachePath": QUOTES_CACHE_PATH,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
