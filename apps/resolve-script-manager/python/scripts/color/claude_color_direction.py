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


PROMPT_TEMPLATE = """Du er kinematograf for en bryllups-/eventfilm med SKIN TONES SOM ABSOLUTT PRIORITET. Du gir kreativ retning på farge per chapter — Bjarne har valgt picks, du sier hvordan de skal grades.

Prosjekt-kontekst:
{project_context}

Kulturell kontekst: {cultural_context}

Measurements per chapter (ffmpeg signalstats Y-mean = luminans, 0-255):
{measurements_block}

EKSISTERENDE LOOK-PACKS (sjekk om noen matcher før du oppretter ny):

Innebygd:
- norwedfilm: cinematic warm (sat 1.05, warmth +6, contrast +5%)
- warm: mehndi/haldi-stil (sat 1.15, warmth +12)
- cinematic: film-emulering (sat 0.95, contrast +10%, slight desat skin)
- documentary: naturlig flat (sat 1.0, warmth 0)
- none: ingen LUT

Brukerens kulturelle look-packs (lagret fra tidligere prosjekter):
{existing_cultural_looks}

SKIN-TONE-PRIORITET (#1 regel):
Skin tone er det viktigste øye fanger i hver pick. Aggressive LUTs kan
tippe skin mot oransje eller plast.

VECTORSCOPE SKIN-TONE-LINJE (kritisk):
- Skin skal LIGGE PÅ "I-line" på vectorscope: vinkel ~123° fra origo
- I YCrCb-rom: Cr/Cb-forhold der hudtone naturlig faller (NESTEN ALLTID
  i øverste-høyre kvadrant nær 11 o'clock-posisjonen)
- Hvis skin vandrer VEKK fra I-linjen → "magenta drift" eller "yellow
  drift" — begge ser plastikk-aktig ut
- Standard target på vectorscope for naturlig hudtone:
  · Avstand fra senter: 25-40% (mer = mer mettet, men ikke push-over)
  · Vinkel: 105-135° (skin-line ligger ved 123°)
- "safe range" Cr/Cb:
  · Cr (rødhet) = 140-160 (avhengig av hudtype)
  · Cb (blåhet) = 105-120 (avhengig av lys)
  · Cr-Cb-vinkel = 105-135° (ON LINE)

LOG-CORRECTION-FIRST (kritisk for camera-original-footage):
Hvis source er log-encoded (Canon Log, S-Log2, S-Log3, V-Log, Rec709-Log,
LogC4 osv.) MÅ teknisk LOG → REC.709-konvertering kjøre FØR kreativ LUT.
Vanlig misforståelse: påføre en cinematic-look-LUT direkte på log-footage
gir flat, undermettet resultat. Riktig rekkefølge:

  Node 1: Primary Correction (eksponering + WB) — ALLTID
  Node 2: LOG → REC.709 LUT (kun hvis isLog=true) — TEKNISK
  Node 3: Creative LUT (warm/cinematic/...) — KREATIV
  Node 4: Skin Tone Protection — beskytter hudtone fra creative LUT
  Node 5: Vignette + Grain (subtilt)

Returnér 'requiresLogConversion' og 'logToRec709Lut' i lookPackDecision
hvis source-detektert log. Vanlige conversion-LUTer:
- Canon C-Log → "CanonLog_to_Rec709"
- Sony S-Log3 → "SLog3_to_Rec709_BT2020"
- Panasonic V-Log → "VLog_to_Rec709"
- ARRI LogC → "LogC4_to_Rec709"

PR KULTURELL HUDTYPE — gi target-spec:
- Nordisk fair: Cr 140-145, brightness ~155, NEVER warmth > +6 på ceremony
- Sør-asiatisk medium-rik: Cr 148-158, brightness 130-145, gold underton
- Sør-asiatisk mørk: Cr 145-155, brightness 110-130, beskytt mot oransje
- Midtøsten olive: Cr 142-150, brightness 130-145, varm grunn-tone
- Afrikansk mørk: Cr 138-148, brightness 90-115, høy kontrast OK, sat 0.95
- Latinsk medium: Cr 145-152, brightness 130-145, golden glow
- Øst-asiatisk: Cr 140-148, brightness 145-160, slightly cool acceptable
- Blandet: matcher hovedperson (brud/brudgom) — default på safe-range

For HVERT chapter — gi kreativ retning som JSON:
{{
  "perChapter": {{
    "<chapter_name>": {{
      "targetY": float (0-255, ideel luminans),
      "warmth": int (-20 til +20),
      "saturation": float (0.6-1.4),
      "skinToneTarget": {{
        "cr": int (140-160, target rødhet på hud),
        "brightness": int (target Y på hud-region),
        "vectorscopeAngle": int (105-135, target på I-line),
        "vectorscopeMagnitude": float (0.25-0.40, avstand fra senter),
        "protectionLevel": "soft" | "medium" | "strong"
      }},
      "lutPreference": "<look-pack-name>",
      "reasoning": "1 setning på norsk om hvorfor"
    }}
  }},
  "lookPackDecision": {{
    "action": "useExisting" | "createNew",
    "lookPackName": "<navn på existing eller ny>",
    "requiresLogConversion": bool,
    "logToRec709Lut": "<f.eks. CanonLog_to_Rec709, SLog3_to_Rec709_BT2020, eller null>",
    "reasoning": "Hvorfor dette valget"
  }},
  "newLookPackSpec": {{
    "name": "<navn, kun hvis createNew>",
    "culturalTag": "<f.eks. 'sikh-traditional', 'norsk-standard'>",
    "warmth": int,
    "saturation": float,
    "contrast": float (0.9-1.2),
    "skinToneProtection": "soft" | "medium" | "strong",
    "description": "1 setning på norsk"
  }},
  "overallReasoning": "1-2 setninger om hovedretning, ALLTID nevne skin-tone-strategi"
}}

KULTURELLE JUSTERINGER (anvend hvis culturalContext matcher):
- Norsk standard: nordisk kjølig, hudtone holdes naturlig → max warmth +4
- Sikh/Punjabi: gold + crimson tradisjon, men beskytt hudtone fra over-orange
- Indisk/pakistansk: rik fargepallet, sat opp på tekstil men hudtone INNENFOR safe-range
- Muslim nikkah: respektfull dempet, hudtone naturlig hudte
- Jødisk: warm candle-light, hudtone +2 brightness
- Kinesisk: rødt + gull på bakgrunn, hud uendret
- Nigeriansk: hot kontrast OK, hudtone i mid-range (ikke crushe shadows)
- Latinsk: golden glow, hudtone Cr +4

DESIGNPRINSIPPER PR CHAPTER (default):
- Ceremony / nikkah: sakralt, varmt, beskyttet hudtone → Y~110, warmth +8, sat 0.85
- Vows: intim, dim, varm → Y~100, warmth +6, sat 0.9
- Portrait: hudtone perfekt eksponert, LUT subtilt → Y~135, warmth +4, sat 1.1
- First dance: filmisk, kontrastrikt → Y~115, warmth +2, sat 1.0
- Party: energisk, mettet TEKSTIL, hudtone fortsatt safe → Y~125, warmth -2, sat 1.15
- Speeches: nøytral, tale-først, klar hudtone → Y~130, warmth 0, sat 0.95

VIKTIG:
- Returner KUN gyldig JSON, ingen markdown-fence eller forklaring rundt
- ALLTID inkluder skinToneTarget per chapter — det er viktigere enn alt annet
- Hvis et chapter ikke finnes i measurements, drop det fra output
- ALWAYS prefer useExisting hvis en eksisterende look-pack passer ≥80%
- Kun foreslå createNew hvis ingen eksisterende look matcher kulturen
- Reasoning skal være KORT — Bjarne leser i UI
"""


def run(params: dict[str, Any], dry_run: bool) -> None:
    measurements = params.get("measurementsPerChapter") or {}
    project_kind = (params.get("projectKind") or "wedding").strip()
    target_duration_sec = float(params.get("targetDurationSec") or 240)
    client_wishes = (params.get("clientWishes") or "").strip()
    cultural_context = (params.get("culturalContext") or "").strip() or "Ikke spesifisert"
    # NY: liste over kulturelle look-packs lagret fra tidligere prosjekter
    existing_cultural_looks = params.get("existingCulturalLooks") or []
    # NY: log-gamma-info fra detect_log_gamma (isLog, type)
    log_info = params.get("logGammaInfo") or {}
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

    log_block = "Source er ikke detektert som log-encoded (standard rec.709)"
    if log_info.get("isLog"):
        log_type = log_info.get("type") or "ukjent log-curve"
        log_block = f"Source er LOG-ENCODED ({log_type}) — krever LOG → REC.709-konvertering FØR creative LUT"

    project_context = (
        f"Type: {project_kind} · Target highlight: {target_duration_sec/60:.1f} min · "
        f"Gamma: {log_block}"
        + (f" · Klient-ønske: {client_wishes}" if client_wishes else "")
    )

    measurements_block = "\n".join(
        f"  - {chapter}: Y={data.get('yMean', 0):.1f} (range {data.get('yMin', 0):.0f}-{data.get('yMax', 0):.0f}, {data.get('shotsCount', 0)} shots)"
        for chapter, data in measurements.items()
    )

    if existing_cultural_looks:
        existing_looks_block = "\n".join(
            f"  - \"{look.get('name')}\" ({look.get('culturalTag', 'no-tag')}): "
            f"warmth {look.get('warmth', 0)}, sat {look.get('saturation', 1.0)}, "
            f"skin {look.get('skinToneProtection', 'medium')} · {look.get('description', '')}"
            for look in existing_cultural_looks
        )
    else:
        existing_looks_block = "  (ingen tidligere kulturelle look-packs — du kan opprette ny ved behov)"

    prompt = PROMPT_TEMPLATE.format(
        project_context=project_context,
        cultural_context=cultural_context,
        measurements_block=measurements_block,
        existing_cultural_looks=existing_looks_block,
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
