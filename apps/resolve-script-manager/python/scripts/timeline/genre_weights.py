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
        "faces": 0.20,           # couple/family screen-time is critical
        "wedding_events": 0.15,  # ring/kiss/cake-cutting must be in
        "emotional_peak": 0.10,  # tears + crescendo
        "bokeh": 0.08,           # cinematic close-ups
        "slowmo": 0.08,          # 60p/120p slow-mo conformed
        "color_grade": 0.04,
        "speech": -0.10,         # dialog-only shots don't carry highlight
        "exposure": -0.10,
        # NEW signals from R2-batch-3:
        "audio_events": 0.15,    # applaus/latter/gråt — sterke moment-markører
        "aesthetic":    0.12,    # LAION cinematic-score
        "pose":         0.10,    # kneeling / raised-hand / praying
        "open_vocab":   0.08,    # bride/ring/cake detection (text-prompt)
        # NEW from R2-batch-4 (kun positive vekter; defer 0 for global signals):
        "action":       0.12,    # VideoMAE per-shot action-classification
        "depth":        0.08,    # Depth-cinematic (shallow-DOF signal)
        "music_features": 0.0,   # global context, not per-shot
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
        "emotional_peak": 0.15,
        "bokeh": 0.12,
        "slowmo": 0.18,
        "color_grade": 0.08,
        "speech": -0.05,
        "exposure": -0.05,
        # NEW:
        "audio_events": 0.05,   # music dominant, ikke applause
        "aesthetic":    0.18,   # cinematic-look mest viktig for MV
        "pose":         0.13,   # dance-poses + performance-gestures
        "open_vocab":   0.0,    # wedding-prompts ikke relevant
        "action":       0.15,   # dance/performance-actions
        "depth":        0.10,   # cinematic shallow-DOF
        "music_features": 0.0,  # global context for section-archetypes
    },
    "chapter_targets": None,
}

CORPORATE: GenreConfig = {
    "description": "Corporate — clarity + speakers, no slow-mo drama",
    "weights": {
        "faces": 0.20,
        "wedding_events": 0.0,
        "emotional_peak": 0.05,
        "bokeh": 0.08,
        "slowmo": 0.0,
        "color_grade": 0.12,
        "speech": 0.05,           # speech is content here, not penalty
        "exposure": -0.15,        # corporate must be clean
        # NEW:
        "audio_events": 0.0,     # ingen vekt — corporate er rolig
        "aesthetic":    0.13,    # professional-look counts
        "pose":         0.05,    # standing + sitting OK
        "open_vocab":   0.0,
        "action":       0.05,
        "depth":        0.08,
        "music_features": 0.0,
    },
    "chapter_targets": None,
}

SOUTH_ASIAN_WEDDING: GenreConfig = {
    "description": (
        "Pakistansk / indisk bryllup — multi-day event (Mehndi/Sangeet/"
        "Haldi/Nikkah/Reception/Walima). Andre cinematic-cues enn vestlig: "
        "garland-exchange, fire-ceremony, ingen kake/kiss-fokus, dhol/shehnai "
        "lydlandskap, Urdu/Hindi/Punjabi speeches."
    ),
    "weights": {
        # Faces vektes høyere — south asian wedding-shots har ofte 8-12
        # family-medlemmer per shot, og family-screen-time er kulturelt mer
        # sentralt enn vestlig couple-fokus.
        "faces": 0.22,
        # wedding_events YOLOv8-heuristikker er Western-centric (cake/kiss)
        # — reduce vekten. open_vocab tar over via prompts.
        "wedding_events": 0.05,
        "emotional_peak": 0.12,
        "bokeh": 0.08,
        "slowmo": 0.08,
        "color_grade": 0.04,
        # Speech-vekt nøytral — Urdu/Hindi-dialog er ofte sterk content
        # (vows, dua, family-messages) ikke "shot we'd cut around"
        "speech": -0.04,
        "exposure": -0.08,    # mindre streng — high-saturation red/gold normalt
        "audio_events": 0.16, # dhol/applaus/crying/dance-music sentralt
        "aesthetic": 0.13,
        "pose": 0.10,
        # open_vocab veies tungt — SA-prompts dekker garland/mandap/lehenga
        # som YOLOv8 ikke ser
        "open_vocab": 0.16,
        "action": 0.14,       # bhangra/garba/dance-actions
        "depth": 0.08,
        "music_features": 0.0,
    },
    "chapter_targets": {
        # Multi-day-pakke. Hver event er en egen Resolve-timeline om
        # build_delivery_variants kjøres med SA-aware variant-list.
        "mehndi":    0.15,  # henna-night
        "sangeet":   0.18,  # music-night, mest dance-shots
        "haldi":     0.10,  # turmeric ceremony, lekent + farger
        "nikkah":    0.22,  # selve vielsen
        "reception": 0.20,  # walima/reception
        "dance":     0.15,  # post-reception party
    },
}


DOCUMENTARY: GenreConfig = {
    "description": "Documentary — natural moments, narrative arc",
    "weights": {
        "faces": 0.15,
        "wedding_events": 0.0,
        "emotional_peak": 0.15,
        "bokeh": 0.05,
        "slowmo": 0.05,
        "color_grade": 0.05,
        "speech": 0.0,            # neutral — depends on shot context
        "exposure": -0.10,
        # NEW:
        "audio_events": 0.13,    # laughter/tears/applause = documentary gold
        "aesthetic":    0.08,
        "pose":         0.06,
        "open_vocab":   0.05,    # generic pattern-detection
        "action":       0.10,
        "depth":        0.05,
        "music_features": 0.0,
    },
    "chapter_targets": None,
}


GENRES: dict[str, GenreConfig] = {
    "wedding": WEDDING,
    "music_video": MUSIC_VIDEO,
    "corporate": CORPORATE,
    "documentary": DOCUMENTARY,
    "south_asian_wedding": SOUTH_ASIAN_WEDDING,
    # Aliases
    "pakistani_wedding": SOUTH_ASIAN_WEDDING,
    "indian_wedding": SOUTH_ASIAN_WEDDING,
    "desi_wedding": SOUTH_ASIAN_WEDDING,
}


def get(name: str | None) -> GenreConfig:
    """Return config by name, defaulting to wedding if unknown."""
    if not name:
        return WEDDING
    return GENRES.get(name.lower().replace(" ", "_"), WEDDING)
