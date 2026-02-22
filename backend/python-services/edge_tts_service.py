#!/usr/bin/env python3
"""
Edge-TTS Microservice
Free text-to-speech service using Microsoft Edge's TTS engine (edge-tts).
No API key required — runs completely free.

Provides REST API compatible with OpenAI TTS format for seamless integration.
Supports 300+ voices across 40+ languages.

Multilingual: Pass a `language` parameter (e.g. 'en', 'nb', 'de', 'es', 'fr')
to auto-select voices for that language.
"""

import asyncio
import io
import logging
import os
import tempfile
from typing import Optional

import edge_tts
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# ─────────────────────────────────────────────────────────────────────────────
# Voice mapping: Map OpenAI voice names to Edge-TTS voice identifiers
# Per-language voice maps provide best-match voices for each language.
# ─────────────────────────────────────────────────────────────────────────────

# Language-specific voice maps: OpenAI alias → best local voice for that lang
LANGUAGE_VOICES = {
    'nb': {  # Norwegian (Bokmål)
        'nova': 'nb-NO-PernilleNeural',
        'shimmer': 'nb-NO-IselinNeural',
        'echo': 'nb-NO-FinnNeural',
        'alloy': 'nb-NO-PernilleNeural',
        'fable': 'nb-NO-FinnNeural',
        'onyx': 'nb-NO-FinnNeural',
        'finn': 'nb-NO-FinnNeural',
        'pernille': 'nb-NO-PernilleNeural',
        'iselin': 'nb-NO-IselinNeural',
    },
    'no': {  # Norwegian alias
        'nova': 'nb-NO-PernilleNeural',
        'shimmer': 'nb-NO-IselinNeural',
        'echo': 'nb-NO-FinnNeural',
        'alloy': 'nb-NO-PernilleNeural',
        'fable': 'nb-NO-FinnNeural',
        'onyx': 'nb-NO-FinnNeural',
    },
    'en': {  # English
        'nova': 'en-US-JennyNeural',
        'shimmer': 'en-US-AriaNeural',
        'alloy': 'en-US-AvaNeural',
        'echo': 'en-US-GuyNeural',
        'fable': 'en-GB-RyanNeural',
        'onyx': 'en-US-SteffanNeural',
    },
    'de': {  # German
        'nova': 'de-DE-KatjaNeural',
        'shimmer': 'de-DE-AmalaNeural',
        'alloy': 'de-DE-KatjaNeural',
        'echo': 'de-DE-ConradNeural',
        'fable': 'de-DE-KillianNeural',
        'onyx': 'de-DE-ConradNeural',
    },
    'fr': {  # French
        'nova': 'fr-FR-DeniseNeural',
        'shimmer': 'fr-FR-EloiseNeural',
        'alloy': 'fr-FR-DeniseNeural',
        'echo': 'fr-FR-HenriNeural',
        'fable': 'fr-FR-HenriNeural',
        'onyx': 'fr-FR-HenriNeural',
    },
    'es': {  # Spanish
        'nova': 'es-ES-ElviraNeural',
        'shimmer': 'es-MX-DaliaNeural',
        'alloy': 'es-ES-ElviraNeural',
        'echo': 'es-ES-AlvaroNeural',
        'fable': 'es-MX-JorgeNeural',
        'onyx': 'es-ES-AlvaroNeural',
    },
    'it': {  # Italian
        'nova': 'it-IT-ElsaNeural',
        'shimmer': 'it-IT-IsabellaNeural',
        'alloy': 'it-IT-ElsaNeural',
        'echo': 'it-IT-DiegoNeural',
        'fable': 'it-IT-DiegoNeural',
        'onyx': 'it-IT-DiegoNeural',
    },
    'pt': {  # Portuguese
        'nova': 'pt-BR-FranciscaNeural',
        'shimmer': 'pt-BR-FranciscaNeural',
        'alloy': 'pt-PT-RaquelNeural',
        'echo': 'pt-BR-AntonioNeural',
        'fable': 'pt-PT-DuarteNeural',
        'onyx': 'pt-BR-AntonioNeural',
    },
    'da': {  # Danish
        'nova': 'da-DK-ChristelNeural',
        'shimmer': 'da-DK-ChristelNeural',
        'alloy': 'da-DK-ChristelNeural',
        'echo': 'da-DK-JeppeNeural',
        'fable': 'da-DK-JeppeNeural',
        'onyx': 'da-DK-JeppeNeural',
    },
    'sv': {  # Swedish
        'nova': 'sv-SE-SofieNeural',
        'shimmer': 'sv-SE-SofieNeural',
        'alloy': 'sv-SE-SofieNeural',
        'echo': 'sv-SE-MattiasNeural',
        'fable': 'sv-SE-MattiasNeural',
        'onyx': 'sv-SE-MattiasNeural',
    },
    'fi': {  # Finnish
        'nova': 'fi-FI-NooraNeural',
        'shimmer': 'fi-FI-NooraNeural',
        'alloy': 'fi-FI-NooraNeural',
        'echo': 'fi-FI-HarriNeural',
        'fable': 'fi-FI-HarriNeural',
        'onyx': 'fi-FI-HarriNeural',
    },
    'nl': {  # Dutch
        'nova': 'nl-NL-ColetteNeural',
        'shimmer': 'nl-NL-FennaNeural',
        'alloy': 'nl-NL-ColetteNeural',
        'echo': 'nl-NL-MaartenNeural',
        'fable': 'nl-NL-MaartenNeural',
        'onyx': 'nl-NL-MaartenNeural',
    },
    'pl': {  # Polish
        'nova': 'pl-PL-ZofiaNeural',
        'shimmer': 'pl-PL-AgnieszkaNeural',
        'alloy': 'pl-PL-ZofiaNeural',
        'echo': 'pl-PL-MarekNeural',
        'fable': 'pl-PL-MarekNeural',
        'onyx': 'pl-PL-MarekNeural',
    },
    'ru': {  # Russian
        'nova': 'ru-RU-SvetlanaNeural',
        'shimmer': 'ru-RU-DariyaNeural',
        'alloy': 'ru-RU-SvetlanaNeural',
        'echo': 'ru-RU-DmitryNeural',
        'fable': 'ru-RU-DmitryNeural',
        'onyx': 'ru-RU-DmitryNeural',
    },
    'ja': {  # Japanese
        'nova': 'ja-JP-NanamiNeural',
        'shimmer': 'ja-JP-NanamiNeural',
        'alloy': 'ja-JP-NanamiNeural',
        'echo': 'ja-JP-KeitaNeural',
        'fable': 'ja-JP-KeitaNeural',
        'onyx': 'ja-JP-KeitaNeural',
    },
    'ko': {  # Korean
        'nova': 'ko-KR-SunHiNeural',
        'shimmer': 'ko-KR-SunHiNeural',
        'alloy': 'ko-KR-SunHiNeural',
        'echo': 'ko-KR-InJoonNeural',
        'fable': 'ko-KR-InJoonNeural',
        'onyx': 'ko-KR-InJoonNeural',
    },
    'zh': {  # Chinese (Mandarin)
        'nova': 'zh-CN-XiaoxiaoNeural',
        'shimmer': 'zh-CN-XiaohanNeural',
        'alloy': 'zh-CN-XiaoxiaoNeural',
        'echo': 'zh-CN-YunxiNeural',
        'fable': 'zh-CN-YunjianNeural',
        'onyx': 'zh-CN-YunxiNeural',
    },
    'ar': {  # Arabic
        'nova': 'ar-SA-ZariyahNeural',
        'shimmer': 'ar-SA-ZariyahNeural',
        'alloy': 'ar-SA-ZariyahNeural',
        'echo': 'ar-SA-HamedNeural',
        'fable': 'ar-SA-HamedNeural',
        'onyx': 'ar-SA-HamedNeural',
    },
    'hi': {  # Hindi
        'nova': 'hi-IN-SwaraNeural',
        'shimmer': 'hi-IN-SwaraNeural',
        'alloy': 'hi-IN-SwaraNeural',
        'echo': 'hi-IN-MadhurNeural',
        'fable': 'hi-IN-MadhurNeural',
        'onyx': 'hi-IN-MadhurNeural',
    },
    'tr': {  # Turkish
        'nova': 'tr-TR-EmelNeural',
        'shimmer': 'tr-TR-EmelNeural',
        'alloy': 'tr-TR-EmelNeural',
        'echo': 'tr-TR-AhmetNeural',
        'fable': 'tr-TR-AhmetNeural',
        'onyx': 'tr-TR-AhmetNeural',
    },
}

# Fallback/default voice map (English-centric) when no language specified
DEFAULT_VOICE_MAP = {
    'nova': 'en-US-JennyNeural',
    'shimmer': 'en-US-AriaNeural',
    'alloy': 'en-US-AvaNeural',
    'echo': 'en-US-GuyNeural',
    'fable': 'en-GB-RyanNeural',
    'onyx': 'en-US-SteffanNeural',
    # Direct Norwegian names always map to nb-NO
    'finn': 'nb-NO-FinnNeural',
    'pernille': 'nb-NO-PernilleNeural',
    'iselin': 'nb-NO-IselinNeural',
    # Named voices
    'jenny': 'en-US-JennyNeural',
    'aria': 'en-US-AriaNeural',
    'guy': 'en-US-GuyNeural',
    'ryan': 'en-GB-RyanNeural',
    'sonia': 'en-GB-SoniaNeural',
}

DEFAULT_VOICE = os.getenv('DEFAULT_TTS_VOICE', 'en-US-JennyNeural')

# Supported languages for quick lookup
SUPPORTED_LANGUAGES = list(LANGUAGE_VOICES.keys())


def get_edge_voice(voice_name: Optional[str], language: Optional[str] = None) -> str:
    """Resolve a voice name to an Edge-TTS voice identifier.
    
    If `language` is provided (e.g. 'en', 'nb', 'de'), the voice will be
    matched against the language-specific voice map for the best result.
    """
    if not voice_name:
        # Use language default if available
        if language:
            lang_key = language.lower()[:2]
            lang_map = LANGUAGE_VOICES.get(lang_key)
            if lang_map:
                return lang_map.get('nova', DEFAULT_VOICE)
        return DEFAULT_VOICE
    
    voice_lower = voice_name.lower()
    
    # If it looks like a full Edge-TTS voice ID, use it directly
    if '-' in voice_name and 'Neural' in voice_name:
        return voice_name
    
    # Check language-specific mapping first
    if language:
        lang_key = language.lower()[:2]
        lang_map = LANGUAGE_VOICES.get(lang_key)
        if lang_map:
            mapped = lang_map.get(voice_lower)
            if mapped:
                return mapped
    
    # Fall back to default voice map
    mapped = DEFAULT_VOICE_MAP.get(voice_lower)
    if mapped:
        return mapped
    
    return DEFAULT_VOICE


async def _synthesize(text: str, voice: str, rate: str = '+0%', volume: str = '+0%') -> bytes:
    """Generate speech audio from text using edge-tts."""
    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume)
    
    audio_data = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk['type'] == 'audio':
            audio_data.write(chunk['data'])
    
    audio_data.seek(0)
    return audio_data.read()


def speed_to_rate(speed: float) -> str:
    """Convert a speed multiplier (0.25-4.0) to Edge-TTS rate string."""
    if speed <= 0:
        speed = 1.0
    percentage = int((speed - 1.0) * 100)
    return f'{percentage:+d}%'


def volume_to_str(volume: float) -> str:
    """Convert volume (0-1) to Edge-TTS volume string."""
    percentage = int((volume - 1.0) * 100)
    return f'{percentage:+d}%'


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'edge-tts',
        'provider': 'free',
        'voices': len(DEFAULT_VOICE_MAP),
    })


@app.route('/v1/audio/speech', methods=['POST'])
def text_to_speech():
    """
    Generate speech from text — OpenAI-compatible API format.
    
    Body JSON:
        input (str): Text to speak (required)
        voice (str): Voice name (default: nova)
        language (str): ISO 639-1 language code (e.g. 'en', 'nb', 'de', 'fr', 'es')
                        When set, auto-selects the best voice for that language.
        speed (float): Speed 0.25-4.0 (default: 1.0)
        response_format (str): Currently always returns mp3
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        
        text = data.get('input') or data.get('text', '')
        if not text or not text.strip():
            return jsonify({'error': 'Missing or empty text/input field'}), 400
        
        voice_name = data.get('voice', 'nova')
        language = data.get('language')  # e.g. 'en', 'nb', 'de', etc.
        speed = float(data.get('speed', 1.0))
        speed = max(0.25, min(4.0, speed))
        
        edge_voice = get_edge_voice(voice_name, language)
        rate = speed_to_rate(speed)
        
        logging.info(f"TTS: voice={edge_voice}, rate={rate}, text_len={len(text)}")
        
        # Run async synthesis in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        audio_bytes = loop.run_until_complete(_synthesize(text, edge_voice, rate))
        loop.close()
        
        if not audio_bytes or len(audio_bytes) < 100:
            return jsonify({'error': 'TTS produced no audio'}), 500
        
        logging.info(f"TTS complete: {len(audio_bytes)} bytes")
        
        return send_file(
            io.BytesIO(audio_bytes),
            mimetype='audio/mpeg',
            as_attachment=False,
            download_name='speech.mp3',
        )
        
    except Exception as e:
        logging.error(f"TTS error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/v1/voices', methods=['GET'])
def list_voices():
    """List available voice mappings, optionally filtered by language."""
    language = request.args.get('language')
    
    if language:
        lang_key = language.lower()[:2]
        lang_map = LANGUAGE_VOICES.get(lang_key, DEFAULT_VOICE_MAP)
        return jsonify({
            'language': lang_key,
            'voices': [
                {'id': k, 'edge_voice': v, 'provider': 'edge-tts'}
                for k, v in lang_map.items()
            ],
        })
    
    return jsonify({
        'voices': [
            {'id': k, 'edge_voice': v, 'provider': 'edge-tts'}
            for k, v in DEFAULT_VOICE_MAP.items()
        ],
        'supported_languages': SUPPORTED_LANGUAGES,
    })


@app.route('/v1/voices/all', methods=['GET'])
def list_all_voices():
    """List ALL available Edge-TTS voices (300+)."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        voices = loop.run_until_complete(edge_tts.list_voices())
        loop.close()
        return jsonify({'voices': voices, 'total': len(voices)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('TTS_PORT', 5100))
    logging.info(f"Starting Edge-TTS service on port {port}")
    logging.info(f"Default voice: {DEFAULT_VOICE}")
    logging.info(f"Supported languages: {', '.join(SUPPORTED_LANGUAGES)}")
    app.run(host='0.0.0.0', port=port, debug=False)
