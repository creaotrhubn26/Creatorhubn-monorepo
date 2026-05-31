"""Claude Audio Direction — AI lyd-direktørens øre for per-chapter audio-polish.

Algoritmen i apply_audio_polish.py gjør LUFS-norm + ducking + de-essing, men
Claude bestemmer HVOR aggressivt + per chapter:
  - Ceremony: lett ducking, speech-fokus (vows hørt)
  - Speeches: tung ducking (-18dB), de-ess sterk
  - Party: minimum ducking, music-fokus
  - First dance: balansert

Pluss platform-spesifikke LUFS-targets:
  - YouTube: -14 LUFS
  - Spotify Audio: -14 LUFS
  - TikTok/Instagram Reels: -10 LUFS (louder)
  - Vimeo: -16 LUFS
  - Theatrical: -23 LUFS

Input:
  chaptersInfo: { chapter_name: { picksCount, totalDurationSec, speechLikelihood? } }
  deliveryPlatform: youtube | spotify | tiktok | instagram | vimeo | theatrical
  projectKind, culturalContext, clientWishes

Output:
  {
    perChapter: { chapter: { duckingDb, deEssLevel, highPassHz, voiceBoostDb, reasoning } },
    overallLufsTarget: float,
    overallReasoning: str,
    needsRoomTone: bool (om 200ms handles bør legges på speech-picks)
  }
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


PLATFORM_LUFS_TARGETS = {
    "youtube":    -14.0,
    "spotify":    -14.0,
    "tiktok":     -10.0,
    "instagram":  -10.0,
    "vimeo":      -16.0,
    "theatrical": -23.0,
}


PROMPT_TEMPLATE = """Du er audio post-direktør for en bryllups-/eventfilm. Du gir kreativ retning på audio-polish per chapter — apply_audio_polish gjør det tekniske arbeidet, du sier hvor aggressivt + hvilken karakter.

Prosjekt-kontekst:
{project_context}

Kulturell kontekst: {cultural_context}

Levering-plattform: {delivery_platform} (LUFS-target: {target_lufs} LUFS)

Chapters i highlighten:
{chapters_block}

For HVERT chapter — gi audio-direction som JSON:
{{
  "perChapter": {{
    "<chapter_name>": {{
      "duckingDb": float (-24 til 0, hvor mye musikken dukes under tale),
      "deEssLevel": "off" | "soft" | "medium" | "strong" (sibilance-reduksjon),
      "highPassHz": int (0-150, lavfrekvens-cutoff for rumble),
      "voiceBoostDb": float (-3 til +6, klarhetsboost på speech-frekvenser),
      "musicVolume": float (0.0-1.0, baseline volum for musikk-spor),
      "ambientVolume": float (0.0-1.0, baseline for source-audio),
      "reasoning": "1 setning på norsk om hvorfor"
    }}
  }},
  "overallLufsTarget": float (justert fra platform-default basert på prosjekt-type),
  "overallReasoning": "1-2 setninger om audio-strategien",
  "needsRoomTone": bool (true hvis speech-chapters trenger 200ms pre/post-handles),
  "needsCrossfadeUpgrade": bool (true = equal-power, false = lineær OK)
}}

DESIGN-PRINSIPPER PR CHAPTER (default):
- Ceremony / nikkah: lett ducking -3dB (ambient sakralt lyd kommer gjennom), no de-ess, music 0.7, ambient 0.6
- Vows: tung ducking -18dB (KRITISK — vows MÅ høres), soft de-ess, music 0.2, ambient 0.85
- Speeches: tung ducking -15dB, medium-strong de-ess (lavaliers er sibilante), highpass 80Hz (room-rumble), voice-boost +3dB, music 0.25, ambient 0.9
- Portrait/details: minimal ducking -3dB, music 0.75, ambient 0.5 (subtle)
- First dance: balansert -6dB ducking, music 0.85, ambient 0.6 (latter + dans-trinn høres)
- Party / reception: ingen ducking 0dB, music 1.0, ambient 0.5 (latter, jubel høres)

KULTURELLE JUSTERINGER:
- Norsk standard: dempet, dialog-først
- Sikh/Punjabi: bhangra-energy i party → music 1.0 + ambient 0.4 (cleaner dans-lyd)
- Muslim nikkah: respektfull stillhet i ceremony, music 0.5, ambient 0.7 (gjest-tale gjennom)
- Jødisk: klezmer-tradisjon, ceremony music 0.6, ambient 0.7
- Indisk hindu: traditional chants ofte mid-mid, music 0.6, ambient 0.8 (chants hørt)

PLATFORM-JUSTERINGER (anvend på overallLufsTarget):
- TikTok/Instagram Reels: kan bli +2 LUFS lasere (-8 ekvivalent) hvis upbeat
- YouTube longform: hold -14 LUFS
- Spotify Audio (uten video): -14 LUFS men mer dynamic range bevares
- Cinema/theatrical: hold -23 LUFS, mer dynamic range

VIKTIG:
- Returner KUN gyldig JSON, ingen markdown-fence
- Hver chapter MÅ ha alle felter (duckingDb, deEssLevel, highPassHz, voiceBoostDb, musicVolume, ambientVolume)
- duckingDb er hvor mye music senkes under speech — negativt tall (f.eks. -18 = music spilles 18dB lavere)
- musicVolume + ambientVolume er BASELINE før ducking (0-1)
- Reasoning skal være KORT
"""


def run(params: dict[str, Any], dry_run: bool) -> None:
    chapters_info = params.get("chaptersInfo") or {}
    project_kind = (params.get("projectKind") or "wedding").strip()
    cultural_context = (params.get("culturalContext") or "").strip() or "Ikke spesifisert"
    delivery_platform = (params.get("deliveryPlatform") or "youtube").strip().lower()
    target_lufs = PLATFORM_LUFS_TARGETS.get(delivery_platform, -14.0)
    target_duration_sec = float(params.get("targetDurationSec") or 240)
    client_wishes = (params.get("clientWishes") or "").strip()
    model = (params.get("model") or "claude-opus-4-7").strip()

    if not isinstance(chapters_info, dict) or len(chapters_info) == 0:
        bridge.error("Ingen chaptersInfo i input")
        sys.exit(1)

    bearer = os.environ.get("RR_BEARER_TOKEN", "").strip()
    if not bearer:
        bridge.error("Ikke logget inn til The Role Room — kreves for Claude")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldAsk": list(chapters_info.keys()),
            "platform": delivery_platform,
            "targetLufs": target_lufs,
        })
        return

    chapters_block = "\n".join(
        f"  - {ch}: {info.get('picksCount', 0)} picks, {info.get('totalDurationSec', 0):.0f}s"
        + (f", speech-likelihood: {info.get('speechLikelihood', 0):.1f}" if "speechLikelihood" in info else "")
        for ch, info in chapters_info.items()
    )

    project_context = (
        f"Type: {project_kind} · Highlight-lengde: {target_duration_sec/60:.1f} min"
        + (f" · Klient-ønske: {client_wishes}" if client_wishes else "")
    )

    prompt = PROMPT_TEMPLATE.format(
        project_context=project_context,
        cultural_context=cultural_context,
        delivery_platform=delivery_platform,
        target_lufs=target_lufs,
        chapters_block=chapters_block,
    )

    bridge.log(f"Spør Claude om audio-direction for {len(chapters_info)} chapters (platform: {delivery_platform})")

    from anthropic_proxy import Anthropic  # type: ignore[import-not-found]
    client = Anthropic(bearer_token=bearer)

    msg = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if hasattr(b, "text")).strip()

    # Robust JSON-extract
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
    bridge.log(f"Claude returnerte audio-direction for {len(per_chapter)} chapters")
    for ch, d in per_chapter.items():
        ducking = d.get("duckingDb", 0)
        de_ess = d.get("deEssLevel", "off")
        bridge.log(f"  · {ch}: ducking {ducking}dB · de-ess {de_ess}")

    bridge.result({
        "perChapter": per_chapter,
        "overallLufsTarget": parsed.get("overallLufsTarget", target_lufs),
        "overallReasoning": parsed.get("overallReasoning", ""),
        "needsRoomTone": parsed.get("needsRoomTone", False),
        "needsCrossfadeUpgrade": parsed.get("needsCrossfadeUpgrade", True),
        "platform": delivery_platform,
        "model": model,
        "chaptersAnalyzed": len(per_chapter),
    })


bridge.main_guard(run)
