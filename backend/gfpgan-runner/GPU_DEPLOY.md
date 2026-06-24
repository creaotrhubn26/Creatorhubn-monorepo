# GFPGAN runner — GPU deployment plan

_The photo-enhancer AI models (GFPGAN face restore, Real-ESRGAN upscale) run today on a **CPU** Render service (~40 s/image, single worker). The async B2 job queue (#889/#892) removed the UI block, but throughput is still CPU-gated. This is the plan to move the runner to GPU for real batch speed. No code change to the model path is needed — GFPGANer auto-selects CUDA when a GPU is present; only CUDA torch + a GPU host are required._

## Workload shape
Bursty + batch: a shoot produces 100–500 RAW at once, then the runner is idle for hours/days. → **serverless GPU with scale-to-zero** is the right model (pay per second of work, $0 idle), not a 24/7 dedicated GPU.

## Provider comparison
| Provider | Model | GPU | ~Cost | Scale-to-zero | Fit |
|---|---|---|---|---|---|
| **Modal** ⭐ | serverless, runs our app.py | T4 / A10G | ~$0.000164/s (T4) ≈ **$0.59/hr** of actual work | ✅ yes | **Best** — runs the exact runner (custom retouch + LUT), autoscale, $0 idle. `modal_app.py` ready. |
| RunPod Serverless | serverless container | T4 / A4000 | ~$0.0002–0.0004/s | ✅ yes | Good, cheap; needs their handler wrapper. `Dockerfile.gpu` works. |
| Render GPU | always-on service | T4 | ~$0.50–1+/hr **24/7** (no scale-to-zero) | ❌ no | Simplest (swap Dockerfile) but pays idle — wasteful for bursty use. |
| Replicate | hosted public models | varies | ~$0.001–0.01/prediction | ✅ yes | ❌ stock GFPGAN only — **loses our custom retouch/LUT**. Skip. |
| Fly.io GPU | machines | A10 | hourly | partial | Viable; more ops. |

## Recommendation — **Modal (T4, scale-to-zero)**
- Runs `app.py` + all custom modules unchanged on GPU; `modal_app.py` is committed and ready.
- ~3–8 s/image on T4 (vs ~40 s CPU) → a **500-image shoot ≈ 25–65 min**, autoscaling across up to 8 containers brings it to **~5–10 min wall-clock**.
- **$0 when idle.** A typical shoot's compute ≈ **$0.30–0.60**. Even heavy months are a few dollars.

## Exact changes
1. **Artifacts (committed):** `modal_app.py` (Modal serverless), `Dockerfile.gpu` + `requirements-gpu.txt` (RunPod/Render/Fly fallback). CUDA 12.1 torch; **weights live on Backblaze B2** (the photographer pipeline's provider — same Role Room creds/bucket as capture/gallery/editing/enhance-source). The runner is **B2-first with R2 fallback**, and self-seeds the weights into B2 on first boot (downloads the official releases if missing). Cached on a Modal Volume after the first pull.
2. **Deploy (one-time):** `modal token new` → `modal secret create gfpgan-b2 …` (B2 Role Room creds + bucket) → `modal deploy modal_app.py` → stable URL.
3. **Wire backend (Render env, no code change):** point `PHOTO_ENHANCER_GFPGAN_URL` (+ `REALESRGAN_SERVICE_URL`, `CODEFORMER_SERVICE_URL`) at the Modal URL. The backend already calls the runner via these env URLs.
4. **Verify:** `/health` (modelLoaded), then `/enhance` on a portrait → `modelUsed=gfpgan` in ≤10 s.

## RunPod recipe (key on file; needs credits + an image)
Verified: API key valid (`user_3418kNZafba92NCjx60tMjruJPD`), but **balance $0** — fund first (RunPod → Billing). GPU pick: **RTX A4000 ($0.17–0.25/hr)** or **A5000 ($0.16–0.27/hr)** — ample for GFPGAN/Real-ESRGAN; L4 ($0.39/hr) if you want newer.

Two shapes:
- **Pod (simplest, reuses app.py unchanged):** build+push `Dockerfile.gpu` to a registry → create a GPU Pod from it (exposes :10000) → point `PHOTO_ENHANCER_GFPGAN_URL` at the Pod URL. Same `/enhance` + `/health` API as today; **no handler/adapter change**. Not scale-to-zero (stop the pod when idle, or keep a cheap A4000 running).
- **Serverless (scale-to-zero, "recommended"):** needs (a) a `handler(event)` wrapper around the enhance core, (b) the image, (c) a backend adapter to call `POST https://api.runpod.ai/v2/<endpointId>/runsync` (payload `{input:{imageBase64,preset,settings}}`). More work; truest cost ($0 idle).

Steps once funded + image pushed (`<IMG>`):
```
# Pod via API:
curl -s https://rest.runpod.io/v1/pods -H "Authorization: Bearer $RUNPOD_KEY" -H "Content-Type: application/json" \
  -d '{"name":"gfpgan","imageName":"<IMG>","gpuTypeIds":["NVIDIA RTX A4000"],"containerDiskInGb":20,"ports":["10000/http"],"env":[{"key":"B2_ROLE_ROOM_APPLICATION_KEY_ID","value":"…"}, …B2 creds…]}'
# → point PHOTO_ENHANCER_GFPGAN_URL at the pod's :10000 proxy URL.
```
Image build can't run from the dev sandbox (multi-GB cross-arch + registry creds) — build in CI / locally with Docker, or connect the GitHub repo in the RunPod console's build feature.

## Migration & rollback
- Keep the CPU Render runner (`creatorhub-gfpgan-runner`) deployed as fallback — identical `/enhance` + `/health` API.
- Cutover = change one env var; rollback = change it back. Zero client/app change (the iPad async client (#892) is provider-agnostic — it talks to the backend, not the runner).

## Follow-up gap (separate from GPU)
`app.py:_get_restorer` sets `bg_upsampler=None` → Real-ESRGAN **upscale isn't actually wired** in the runner yet (face restore is). Add a `RealESRGANer` bg_upsampler (GPU) to honour the `realesrganScale` setting once on GPU.

## What this needs from you
A provider + cost approval (recommended: Modal). Then deploy is ~5 min with the committed artifacts; I can run it once a Modal token/account exists.
