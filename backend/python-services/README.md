# Faster-Whisper Microservice

On-premise Whisper transcription service using faster-whisper.

## Installation

```bash
cd python-services
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
# Development
python faster_whisper_service.py

# Production
gunicorn -w 2 -b 0.0.0.0:5000 faster_whisper_service:app
```

## Environment Variables

- `WHISPER_MODEL_SIZE`: tiny, base, small, medium, large-v2, large-v3 (default: base)
- `WHISPER_DEVICE`: cpu or cuda (default: cpu)
- `WHISPER_COMPUTE_TYPE`: int8, float16, float32 (default: int8)
- `PORT`: Service port (default: 5000)

## Docker

```bash
docker build -t faster-whisper-service .
docker run -p 5000:5000 faster-whisper-service
```
