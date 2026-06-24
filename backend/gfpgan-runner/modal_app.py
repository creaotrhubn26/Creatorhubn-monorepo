"""
Modal serverless-GPU deployment of the CreatorHub GFPGAN runner.

WHY MODAL (recommended): the runner has custom logic (portrait_retouch,
hsl_retouch, cube_lut, subject_retouch) on top of GFPGAN/Real-ESRGAN, so a
stock hosted model (e.g. Replicate's tencentarc/gfpgan) won't cover it — we need
to run *this* app.py on a GPU. Modal runs the exact same FastAPI app + sibling
modules on a GPU container, **scales to zero when idle** (no cost between
shoots), and **autoscales** for a 500-image batch. GFPGANer auto-uses CUDA when
torch sees a GPU, so no model-code change is needed — only CUDA torch + a GPU.

DEPLOY (one-time, ~5 min once a Modal account + token exist):
    pip install modal && modal token new          # interactive, once
    # Weights live on Backblaze B2 (the photographer pipeline's provider) —
    # same Role Room creds + bucket as capture/gallery/editing/enhance-source.
    modal secret create gfpgan-b2 \
        B2_ROLE_ROOM_APPLICATION_KEY_ID=... B2_ROLE_ROOM_APPLICATION_KEY=... \
        B2_ROLE_ROOM_BUCKET_NAME=the-role-room-prod B2_REGION=eu-central-003
    cd backend/gfpgan-runner && modal deploy modal_app.py
  → prints a stable URL like https://<org>--creatorhub-gfpgan-runner-fastapi-app.modal.run
  Point the backend at it (Render env, no code change):
    PHOTO_ENHANCER_GFPGAN_URL = <url>/enhance
    REALESRGAN_SERVICE_URL / CODEFORMER_SERVICE_URL = <url>/... (same host)

ROLLBACK: leave the CPU Render runner (creatorhub-gfpgan-runner) deployed; flip
PHOTO_ENHANCER_GFPGAN_URL back to it. Both speak the same /enhance + /health API.
"""

import modal

app = modal.App("creatorhub-gfpgan-runner")

# CUDA image — same OS deps as the CPU Dockerfile, but CUDA torch so GFPGAN/
# Real-ESRGAN run on the GPU. add_local_dir ships app.py + the sibling modules.
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04", add_python="3.10"
    )
    .apt_install("libgl1", "libglib2.0-0", "libgomp1", "libsm6", "libxext6", "ca-certificates", "curl")
    .pip_install("torch==2.1.2", "torchvision==0.16.2", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install(
        "fastapi==0.115.6", "uvicorn[standard]==0.32.1", "pydantic==2.10.4",
        "boto3==1.35.90", "botocore==1.35.90", "numpy==1.26.4", "Pillow==10.4.0",
        "opencv-python-headless==4.10.0.84", "mediapipe==0.10.18",
        "basicsr==1.4.2", "facexlib==0.3.0", "realesrgan==0.3.0", "gfpgan==1.3.8",
    )
    .env({"GFPGAN_CACHE_DIR": "/cache/gfpgan", "GFPGAN_MAX_INPUT_EDGE": "2048", "GFPGAN_UPSCALE": "1"})
    .add_local_dir(".", remote_path="/app")
)

# Persist downloaded weights across cold starts so only the first request pays
# the R2 pull.
cache = modal.Volume.from_name("gfpgan-weights", create_if_missing=True)


@app.function(
    image=image,
    gpu="T4",                                  # ~3–8s/image vs ~40s CPU; bump to "A10G" for heavier batches
    secrets=[modal.Secret.from_name("gfpgan-b2")],
    volumes={"/cache": cache},
    scaledown_window=300,                       # scale to zero after 5 min idle → $0 between shoots
    max_containers=8,                           # autoscale for a big batch
    timeout=600,
)
@modal.concurrent(max_inputs=2)                 # a couple of images per GPU container
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/app")
    from app import app as fastapi  # the existing FastAPI runner, unchanged
    return fastapi
