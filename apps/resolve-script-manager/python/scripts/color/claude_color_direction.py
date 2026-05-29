"""Claude Color Direction — AI cinematographer's eye for per-chapter
color-grade-direction.

Algoritmen i auto_color_match_shots.py beregner median target-Y for ALLE
picks. Det er teknisk korrekt (eliminer flicker) men kreativt naivt:
ceremony, portrait, og dance burde ha forskjellig look.

Denne scripten:
  1. Tar shot-measurements (Y-mean per chapter)
  2. Spør Claude om kreativ retning per chapter
  3. Returnerer { perChapter: {chapter: {targetY, warmth, saturation,
     lutPreference, reasoning}} }

Output brukes som input til auto_color_match_shots (per-chapter targets
i stedet for global median) + setup_resolve_color_nodes (LUT-anbefaling).

Bruker samme anthropic_proxy som resten av Post Agent — token-bruk telles
per innlogget Role Room-bruker.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


PROMPT_TEMPLATE = """Du er kinematograf for en bryllups-/eventfilm. Du gir kreativ retning på farge per chapter — Bjarne har valgt picks, du sier hvordan de skal grades.

Prosjekt-kontekst:
{project_context}

Kulturell kontekst: {cultural_context}

Measurements per chapter (ffmpeg signalstats Y-mean = luminans, 0-255):
{measurements_block}

Tilgjengelige LUT-presets: norwedfilm (cinematic warm), warm (mehndi/haldi-stil), cinematic (film-emulering), documentary (naturlig flat), none (ingen LUT).

For HVERT chapter — gi kreativ retning som JSON:
{{
  "perChapter": {{
    "<chapter_name>": {{
      "targetY": float (0-255, ideel luminans),
      "warmth": int (-20 til +20, negativ = kjøligere, positiv = varmere),
      "saturation": float (0.6-1.4, 1.0 = nøytral),
      "lutPreference": "norwedfilm" | "warm" | "cinematic" | "documentary" | "none",
      "reasoning": "1 setning på norsk om hvorfor"
    }}
  }},
  "overallLutChoice": "<best LUT for hele highlighten>",
  "overallReasoning": "1-2 setninger om hovedretning"
}}

Designprinsipper PR CHAPTER (default):
- Ceremony / nikkah: sakralt, varmt, slightly desaturated → Y~110, warmth +8, sat 0.85
- Vows: intim, dim, varm → Y~100, warmth +6, sat 0.9
- Portrait / details: optimalt eksponert + LUT på → Y~135, warmth +4, sat 1.1
- First dance: filmisk, kontrastrikt → Y~115, warmth +2, sat 1.0
- Party / reception: energisk, mettet, kjøligere highlights → Y~125, warmth -2, sat 1.15
- Speeches: nøytral, tale-først → Y~130, warmth 0, sat 0.95

KULTURELLE JUSTERINGER (anvend hvis culturalContext matcher):
- Norsk standard: nordisk lys, kjøligere grunntone → -3 warmth alle chapters
- Sikh/Punjabi: gold + crimson tradisjon, mehndi/haldi-warmth + 6, mer mettet (sat +0.1)
- Indisk/pakistansk: rik fargepallet, nikkah/seremoni 2x mer mettet enn norsk
- Muslim nikkah: respektfull dempet i seremoni, sat 0.75-0.85
- Jødisk: warm candle-light estetikk på ceremony, +5 warmth
- Kinesisk: rødt + gull dominant, ceremony saturation 1.3+
- Nigeriansk / vestafrikansk: hot kontrast, party meget mettet
- Latinsk/spansk: golden hour-emulering på portraits

Hvis chapter ikke matcher noen kultur-spesifikk regel, bruk default.

VIKTIG:
- Returner KUN gyldig JSON, ingen markdown-fence eller forklaring rundt
- Hvis et chapter ikke finnes i measurements, drop det fra output
- Reasoning skal være KORT (max 1 setning) — Bjarne leser dette i UI
"""


def run(params: dict[str, Any], dry_run: bool) -> None:
    measurements = params.get("measurementsPerChapter") or {}
    project_kind = (params.get("projectKind") or "wedding").strip()
    target_duration_sec = float(params.get("targetDurationSec") or 240)
    client_wishes = (params.get("clientWishes") or "").strip()
    model = (params.get("model") or "claude-opus-4-7").strip()

    if not isinstance(measurements, dict) or len(measurements) == 0:
        bridge.error("Ingen measurementsPerChapter i input")
        sys.exit(1)

    bearer = os.environ.get("RR_BEARER_TOKEN", "").strip()
    if not bearer:
        bridge.error("Ikke logget inn til The Role Room — kreves for Claude")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldAsk": list(measurements.keys()),
            "model": model,
        })
        return

    project_context = (
        f"Type: {project_kind} · Target highlight: {target_duration_sec/60:.1f} min"
        + (f" · Klient-ønske: {client_wishes}" if client_wishes else "")
    )

    measurements_block = "\n".join(
        f"  - {chapter}: Y={data.get('yMean', 0):.1f} (range {data.get('yMin', 0):.0f}-{data.get('yMax', 0):.0f}, {data.get('shotsCount', 0)} shots)"
        for chapter, data in measurements.items()
    )

    prompt = PROMPT_TEMPLATE.format(
        project_context=project_context,
        measurements_block=measurements_block,
    )

    bridge.log(f"Spør Claude om color-direction for {len(measurements)} chapters")

    from anthropic_proxy import Anthropic  # type: ignore[import-not-found]
    client = Anthropic(bearer_token=bearer)

    msg = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if hasattr(b, "text")).strip()

    # Robust JSON-extract (samme mønster som claude_music_suggestions)
    cleaned = text
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 2:
            inner = parts[1]
            if inner.lstrip().startswith("json"):
                inner = inner.lstrip()[4:]
            cleaned = inner.strip()

    parsed = None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        if start >= 0:
            depth = 0
            for i in range(start, len(cleaned)):
                if cleaned[i] == "{": depth += 1
                elif cleaned[i] == "}":
                    depth -= 1
                    if depth == 0:
                        try: parsed = json.loads(cleaned[start:i+1])
                        except json.JSONDecodeError: pass
                        break
    if parsed is None:
        bridge.error(f"Kunne ikke parse Claude-respons.\n\nRespons:\n{text[:500]}")
        sys.exit(1)

    per_chapter = parsed.get("perChapter") or {}
    bridge.log(f"Claude returnerte direction for {len(per_chapter)} chapters")
    for ch, d in per_chapter.items():
        bridge.log(f"  · {ch}: target Y={d.get('targetY')} · {d.get('reasoning', '')[:80]}")

    bridge.result({
        "perChapter": per_chapter,
        "overallLutChoice": parsed.get("overallLutChoice", "norwedfilm"),
        "overallReasoning": parsed.get("overallReasoning", ""),
        "model": model,
        "chaptersAnalyzed": len(per_chapter),
    })


bridge.main_guard(run)
