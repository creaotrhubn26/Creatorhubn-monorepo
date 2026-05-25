"""Per-genre weight matrix for highlight-scoring signals.

Each genre maps signal-name → multiplier. Penalty signals use negative
weights. The orchestrator multiplies signal-output by its weight and
sums.

Base motion/audio weights (already in `extract_highlight_from_film.py`)
are kept separate from these and live as their own params.

Per-chapter duration targets define how much of the total highlight
should come from each detected chapter. None = no chapter-balancing.
"""

from __future__ import annotations

from typing import TypedDict


class GenreConfig(TypedDict):
    weights: dict[str, float]
    chapter_targets: dict[str, float] | None  # chapter_name -> fraction (0..1)
    description: str


WEDDING: GenreConfig = {
    "description": "Bryllup — emotional moments, faces, cinematic shots",
    "weights": {
        "faces": 0.25,           # couple/family screen-time is critical
        "wedding_events": 0.20,  # ring/kiss/cake-cutting must be in
        "emotional_peak": 0.15,  # tears + crescendo
        "bokeh": 0.10,           # cinematic close-ups
        "slowmo": 0.10,          # 60p/120p slow-mo conformed
        "color_grade": 0.05,
        "speech": -0.12,         # dialog-only shots don't carry highlight
        "exposure": -0.10,
    },
    "chapter_targets": {
        "ceremony": 0.35,
        "reception": 0.25,
        "dance": 0.40,
    },
}

MUSIC_VIDEO: GenreConfig = {
    "description": "Music Video — energy + variety",
    "weights": {
        "wedding_events": 0.0,
        "faces": 0.05,
        "emotional_peak": 0.20,
        "bokeh": 0.15,
        "slowmo": 0.20,
        "color_grade": 0.10,
        "speech": -0.05,
        "exposure": -0.05,
    },
    "chapter_targets": None,
}

CORPORATE: GenreConfig = {
    "description": "Corporate — clarity + speakers, no slow-mo drama",
    "weights": {
        "faces": 0.20,
        "wedding_events": 0.0,
        "emotional_peak": 0.05,
        "bokeh": 0.10,
        "slowmo": 0.0,
        "color_grade": 0.15,
        "speech": 0.05,           # speech is content here, not penalty
        "exposure": -0.15,        # corporate must be clean
    },
    "chapter_targets": None,
}

DOCUMENTARY: GenreConfig = {
    "description": "Documentary — natural moments, narrative arc",
    "weights": {
        "faces": 0.15,
        "wedding_events": 0.0,
        "emotional_peak": 0.20,
        "bokeh": 0.05,
        "slowmo": 0.05,
        "color_grade": 0.05,
        "speech": 0.0,            # neutral — depends on shot context
        "exposure": -0.10,
    },
    "chapter_targets": None,
}


GENRES: dict[str, GenreConfig] = {
    "wedding": WEDDING,
    "music_video": MUSIC_VIDEO,
    "corporate": CORPORATE,
    "documentary": DOCUMENTARY,
}


def get(name: str | None) -> GenreConfig:
    """Return config by name, defaulting to wedding if unknown."""
    if not name:
        return WEDDING
    return GENRES.get(name.lower().replace(" ", "_"), WEDDING)
