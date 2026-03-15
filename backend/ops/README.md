# Story Arc Ops

## PM2 Process Manager

```bash
cd /Users/usmanqazi/github/creatorhub/backend
npm run ops:pm2:start
pm2 status
```

Config file:
- `backend/ecosystem.storyarc.config.cjs`

Managed processes:
- `creatorhub-backend`
- `storyarc-pyannote`
- `storyarc-whisperx`

## Nightly Golden Benchmark

Manual:

```bash
cd /Users/usmanqazi/github/creatorhub/backend
bash scripts/storyarc-v2-nightly-benchmark.sh
```

Cron template:
- `backend/ops/storyarc-v2-nightly.cron`

## Required Environment

- `STORYARC_BASE_URL` (if benchmark should target non-local backend)
- `HUGGINGFACE_TOKEN` (pyannote model access)
- `PYANNOTE_DIARIZATION_URL` (backend -> pyannote URL, default `http://localhost:5502`)
- `WHISPERX_TRANSCRIPTION_URL` (backend -> whisperx URL, default `http://localhost:5003`)
