"""Claude Music Suggestions — Claude-driven musikk-anbefaling pr. scene.

Tar scene-kontekst (chapter-type, varighet, mood-keywords) og returnerer
3-5 sang-forslag begrunnet med scenetype. I motsetning til
scan_and_recommend_music som baserer seg på fingerprinting av eksisterende
audio, gir denne forslag basert på *hva scenen er* + tilgjengelige
royalty-free providers.

Input params:
  chapter:           str — ceremony | vows | first_dance | speeches | nikkah | ...
  durationSec:       float — total scene-varighet
  mood:              optional list[str] — additional mood-keywords
  cuesAvailable:     optional list[str] — provider-IDer (Jamendo, Soundstripe, ...)
  cutPaceHz:         optional float — kutt pr. sek (proxy for visuell pace)

Output: {
  suggestions: [
    {
      title:           str
      artistOrStyle:   str
      bpmTarget:       int
      durationSec:     int
      mood:            str
      why:             str  — hvorfor passer denne scenen
      searchQuery:     str  — hva å skrive i provider-søket
      preferredProviders: list[str]  — providers å prøve først
    },
    ...
  ],
  scenePromptUsed: str  — debug-string
}
"""

from __future__ import annotations

import json
import os
import sys

# Lokal bridge-import — samme dir som andre scripts
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
import bridge  # type: ignore[import-not-found]


CHAPTER_HINTS = {
    "ceremony":     "high-emotion + cinematic strings, sacred/spiritual feel, 60-85 BPM, build subtly toward end",
    "vows":         "intimate, warm acoustic + piano, 60-80 BPM, leave space for spoken voice underneath",
    "first_dance":  "romantic + modern, 70-100 BPM, gentle vocal lead, melodic and timeless",
    "speeches":     "subtle instrumental bed, 60-80 BPM, no vocals, leaves headroom for talking",
    "nikkah":       "South Asian / Sufi / kirtan-inspired, 70-90 BPM, devotional and reverent — avoid Western pop",
    "party":        "upbeat, danceable, 110-128 BPM, energetic and modern",
    "details":      "ambient, atmospheric, 70-90 BPM, soft pulse, instrumental",
    "preparation":  "calm + cinematic, building anticipation, 70-90 BPM, modern strings or piano",
    "highlight":    "cinematic build + emotional release, 80-110 BPM, modern + timeless",
}

PROMPT = """Du er musikalsk konsulent for en bryllups-/event-filmmaker.

Scene-kontekst:
- Chapter: {chapter}
- Varighet: {duration_sec:.0f}s
- Visual pace: {pace_note}
- Mood-keywords: {mood_keywords}
- Stil-hint for chapter: {chapter_hint}

Tilgjengelige royalty-free musikk-providers: {providers}

Gi 3-5 konkrete musikk-FORSLAG som passer scenen. Hvert forslag skal være:
- En *type* sang vi kan SØKE etter i providerne (ikke en spesifikk artist
  med opphavsrett som vi ikke kan klarere)
- Med en presis søke-query som vi kan kopiere inn i provider-søket

Returner KUN gyldig JSON i dette formatet (ingen markdown, ingen forklaring rundt):
{{
  "suggestions": [
    {{
      "title": "kort beskrivelse, f.eks. 'Cinematic strings build'",
      "artistOrStyle": "stil eller mood-beskrivelse",
      "bpmTarget": 75,
      "durationSec": 180,
      "mood": "emotional, building",
      "why": "1-2 setninger om hvorfor denne passer akkurat denne scenen",
      "searchQuery": "cinematic emotional strings build wedding",
      "preferredProviders": ["Soundstripe", "Artlist"]
    }}
  ]
}}

VIKTIG:
- searchQuery skal være KORT (3-6 ord) og brukbar direkte i provider-søk
- bpmTarget skal stemme med chapter-hint
- preferredProviders skal være SUBSET av tilgjengelige providers
- ALDRI navngitte populære artister (vi kan ikke klarere dem)
"""


def run():
    params = bridge.load_params()
    chapter = (params.get("chapter") or "details").strip().lower()
    duration_sec = float(params.get("durationSec") or 60)
    mood = params.get("mood") or []
    if isinstance(mood, str):
        mood = [m.strip() for m in mood.split(",") if m.strip()]
    providers = params.get("cuesAvailable") or [
        "Jamendo", "Pixabay", "Soundstripe", "Artlist",
    ]
    cut_pace_hz = params.get("cutPaceHz")
    model = (params.get("model") or "claude-opus-4-7").strip()

    pace_note = "ukjent"
    if isinstance(cut_pace_hz, (int, float)) and cut_pace_hz > 0:
        if cut_pace_hz >= 0.5:
            pace_note = "rask kutting (energisk)"
        elif cut_pace_hz >= 0.2:
            pace_note = "moderat kutting"
        else:
            pace_note = "rolige, lange shots"

    chapter_hint = CHAPTER_HINTS.get(chapter, CHAPTER_HINTS["details"])

    bearer = os.environ.get("RR_BEARER_TOKEN")
    if not bearer:
        bridge.error("Ikke logget inn til The Role Room (RR_BEARER_TOKEN mangler). Logg inn i Settings først.")
        sys.exit(1)

    from anthropic_proxy import Anthropic  # type: ignore[import-not-found]
    client = Anthropic(bearer_token=bearer)

    prompt = PROMPT.format(
        chapter=chapter,
        duration_sec=duration_sec,
        pace_note=pace_note,
        mood_keywords=", ".join(mood) if mood else "(ingen ekstra)",
        chapter_hint=chapter_hint,
        providers=", ".join(providers),
    )

    bridge.log(f"Spør Claude om {chapter}-musikk ({duration_sec:.0f}s, {len(providers)} providers)")

    msg = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if hasattr(b, "text")).strip()

    # Robust JSON-extract: håndter markdown-fence, prosa rundt JSON, og
    # delvis fence (start-fence uten avsluttende). Vi prøver i synkende
    # robusthet-orden:
    #   1. Strip markdown fences hvis present
    #   2. Finn første {…matchende klamme} i strengen
    #   3. Returner error med rå respons hvis alt feiler
    cleaned = text
    if cleaned.startswith("```"):
        # ```json\n{...}\n``` eller ```\n{...}\n```
        parts = cleaned.split("```")
        # parts[0]="" parts[1]="json\n{...}\n" parts[2]="" eller mer
        if len(parts) >= 2:
            inner = parts[1]
            if inner.lstrip().startswith("json"):
                inner = inner.lstrip()[4:]
            cleaned = inner.strip()

    parsed = None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: finn første { …matchende } } i strengen
        start = cleaned.find("{")
        if start >= 0:
            depth = 0
            for i in range(start, len(cleaned)):
                if cleaned[i] == "{": depth += 1
                elif cleaned[i] == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            parsed = json.loads(cleaned[start:i+1])
                        except json.JSONDecodeError:
                            pass
                        break
    if parsed is None:
        bridge.error(f"Kunne ikke parse Claude-respons som JSON.\n\nRespons:\n{text[:500]}")
        sys.exit(1)

    suggestions = parsed.get("suggestions", [])
    if not isinstance(suggestions, list) or not suggestions:
        bridge.error("Claude returnerte ingen forslag.")
        sys.exit(1)

    bridge.result({
        "suggestions": suggestions,
        "scenePromptUsed": f"{chapter} · {duration_sec:.0f}s · {pace_note}",
        "model": model,
    })


bridge.main_guard(run)
