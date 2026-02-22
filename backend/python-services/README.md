# Python ML Services

Free on-premise audio services for Creatorhubn. No API keys required.

## Services

### 1. Faster-Whisper (STT — Speech-to-Text)
Transcription using faster-whisper. Runs locally, completely free.

### 2. Edge-TTS (TTS — Text-to-Speech)
High-quality text-to-speech using Microsoft Edge's neural voices. Completely free.
Includes Norwegian voices: Finn (male), Pernille (female), Iselin (female).

## Installation

```bash
cd python-services
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
# Start both services
python faster_whisper_service.py &   # STT on port 5000
python edge_tts_service.py &          # TTS on port 5100

# Production
gunicorn -w 2 -b 0.0.0.0:5000 faster_whisper_service:app &
gunicorn -w 2 -b 0.0.0.0:5100 edge_tts_service:app &
```

## Environment Variables

### Faster-Whisper
- `WHISPER_MODEL_SIZE`: tiny, base, small, medium, large-v2, large-v3 (default: base)
- `WHISPER_DEVICE`: cpu or cuda (default: cpu)
- `WHISPER_COMPUTE_TYPE`: int8, float16, float32 (default: int8)
- `PORT`: Service port (default: 5000)

### Edge-TTS
- `TTS_PORT`: Service port (default: 5100)

### Backend (.env)
- `USE_FASTER_WHISPER=true`: Enable free local services (prioritized over OpenAI)
- `FASTER_WHISPER_URL`: URL of faster-whisper service (default: http://localhost:5000)
- `EDGE_TTS_URL`: URL of edge-tts service (default: http://localhost:5100)

## API Endpoints

### Edge-TTS
- `POST /v1/audio/speech` — Generate speech (OpenAI-compatible format)
- `GET /v1/voices` — List mapped voices
- `GET /v1/voices/all` — List all 300+ available Edge-TTS voices
- `GET /health` — Health check

### Faster-Whisper
- `POST /v1/audio/transcriptions` — Transcribe audio (OpenAI-compatible format)
- `GET /health` — Health check

## Docker

```bash
docker build -t faster-whisper-service .
docker run -p 5000:5000 faster-whisper-service
```
