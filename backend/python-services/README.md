# Python ML Services

Free on-premise audio services for Creatorhubn. No API keys required.

## Services

### 1. Faster-Whisper (STT — Speech-to-Text)
Transcription using faster-whisper. Runs locally, completely free.

### 2. Edge-TTS (TTS — Text-to-Speech)
High-quality text-to-speech using Microsoft Edge's neural voices. Completely free.
Includes Norwegian voices: Finn (male), Pernille (female), Iselin (female).

### 3. Pyannote diarization (speaker segmentation)
Speaker diarization via `pyannote/speaker-diarization-3.1` with optional confidence scoring from `pyannote/segmentation-3.0`.
Service path: `backend/python-services/pyannote_diarization_service.py`.

### 4. Demucs + Wiener Denoise (offline script)
For Story Arc Studio audio cleanup in `/api/audio/mix` when `mixContext.noiseReductionEngine = "demucs"`.
Script path: `backend/scripts/audio_demucs_denoise.py`.

### 5. Story Arc Vision Stack (wedding visual analysis)
- Shot detection: `PySceneDetect`
- Pose: `MediaPipe Pose`
- Face: `insightface` + `retina-face`
- Object: `ultralytics` (YOLOv8/YOLOv9 runtime)
- Action recognition: `pytorchvideo` (SlowFast/X3D model support)

## Installation

```bash
cd python-services
python3.10 -m venv venv_py310
source venv_py310/bin/activate
pip install -r requirements.txt
```

Quick verify package versions:

```bash
backend/python-services/venv_py310/bin/pip show scenedetect mediapipe ultralytics insightface retina-face pytorchvideo torch torchaudio torchvision
backend/python-services/venv_py310/bin/pip check
```

### Story Arc Full Stack (transcription + diarization + alignment + denoise)

```bash
cd ../backend
npm run ml:install
npm run upload-models-r2:dry
# real upload (requires R2 env vars + optional HUGGINGFACE_TOKEN)
npm run upload-models-r2
```

Model manifest:
- `backend/scripts/storyarc-models.manifest.json`

## Run

```bash
# Start both services
python faster_whisper_service.py &   # STT on port 5000
python edge_tts_service.py &          # TTS on port 5100
python pyannote_diarization_service.py &  # Diarization on port 5502

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

### Pyannote diarization
- `HUGGINGFACE_TOKEN`: Required for gated pyannote models
- `PYANNOTE_DIARIZATION_MODEL`: default `pyannote/speaker-diarization-3.1`
- `PYANNOTE_SEGMENTATION_MODEL`: default `pyannote/segmentation-3.0`
- `PYANNOTE_ENABLE_SEGMENTATION_CONFIDENCE`: `true|false` (default `true`)
- `PYANNOTE_WARMUP_ON_STARTUP`: Run one startup warmup pass (`true` by default)
- `PYANNOTE_PYTHON_BIN`: Optional override for interpreter used by `backend/scripts/start-pyannote-service.sh`
- `PORT`: Service port (default: 5502)

### Backend (.env)
- `USE_FASTER_WHISPER=true`: Enable free local services (prioritized over OpenAI)
- `FASTER_WHISPER_URL`: URL of faster-whisper service (default: http://localhost:5000)
- `EDGE_TTS_URL`: URL of edge-tts service (default: http://localhost:5100)
- `PYANNOTE_DIARIZATION_URL`: URL of pyannote diarization service (default: http://localhost:5502)
- `WHISPERX_TRANSCRIPTION_URL`: URL of whisperx transcription service (default: http://localhost:5003)
- `AUDIO_MIX_DEMUCS_SCRIPT_PATH`: Optional override for Demucs script path
- `AUDIO_MIX_DEMUCS_PYTHON_BIN`: Python binary used to run Demucs script (default: `backend/python-services/venv_py310/bin/python` if present, otherwise `backend/python-services/venv/bin/python`, otherwise `python3`)
- `AUDIO_MIX_DEMUCS_MODEL`: Default Demucs model (default: `htdemucs`)
- `AUDIO_MIX_DEMUCS_DEVICE`: `auto|cpu|cuda` (default: `auto`)
- `AUDIO_MIX_DEMUCS_TIMEOUT_MS`: Timeout for Demucs preprocessing calls (default: `180000`)
- `HUGGINGFACE_TOKEN`: Required for gated HuggingFace models (for example pyannote)
- `CLOUDFLARE_R2_*` / `R2_*`: Required for `npm run upload-models-r2`

## Benchmark / Autotune (50-500 clips)

```bash
cd ../backend

# FFmpeg-only chain tuning
npm run audio:benchmark:example

# Demucs-first chain tuning (A/B candidate search)
npm run audio:benchmark:demucs:example
```

Use `--scan-dir /path/to/dataset` for larger real datasets and increase:
- `--limit 500`
- `--sample-size 80`
- `--iterations 120`

## API Endpoints

### Edge-TTS
- `POST /v1/audio/speech` — Generate speech (OpenAI-compatible format)
- `GET /v1/voices` — List mapped voices
- `GET /v1/voices/all` — List all 300+ available Edge-TTS voices
- `GET /health` — Health check

### Faster-Whisper
- `POST /v1/audio/transcriptions` — Transcribe audio (OpenAI-compatible format)
- `GET /health` — Health check

### Pyannote diarization
- `POST /v1/audio/diarization` — Speaker diarization
- `GET /health` — Health + warmup state
- `POST /warmup` — Force/cache warmup to reduce first-request latency

## Docker

```bash
docker build -t faster-whisper-service .
docker run -p 5000:5000 faster-whisper-service
```
