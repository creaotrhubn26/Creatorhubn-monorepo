import base64
import hashlib
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any

import boto3
import cv2
import numpy as np
from botocore.config import Config
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


DEFAULT_GFPGAN_KEYS = [
    "models/gfpgan/weights/GFPGANv1.4.pth",
    "models/gfpgan/weights/GFPGANv1.3.pth",
    "models/gfpgan/weights/GFPGANv1.2.pth",
]

app = FastAPI(title="CreatorHub GFPGAN Runner", version="1.0.0")

_model_lock = threading.Lock()
_restorer = None
_restorer_key = None
_last_import_error: str | None = None


class ModelPayload(BaseModel):
    id: str | None = None
    r2Key: str | None = None
    storageType: str | None = None
    r2Bucket: str | None = None
    weightsKey: str | None = None


class EnhancePayload(BaseModel):
    filename: str | None = None
    mimeType: str | None = None
    preset: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    model: ModelPayload = Field(default_factory=ModelPayload)
    imageBase64: str


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _first_non_empty(*values: str | None) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _r2_config() -> dict[str, Any]:
    account_id = _first_non_empty(
        os.getenv("CLOUDFLARE_R2_ACCOUNT_ID"),
        os.getenv("R2_ACCOUNT_ID"),
    )
    endpoint = _first_non_empty(
        os.getenv("CLOUDFLARE_R2_ENDPOINT"),
        f"https://{account_id}.r2.cloudflarestorage.com" if account_id else None,
    )
    buckets = []
    for value in [
        os.getenv("CLOUDFLARE_R2_MODELS_BUCKETS"),
        os.getenv("CLOUDFLARE_R2_MODELS_BUCKET"),
        os.getenv("PHOTO_ENHANCER_R2_MODELS_BUCKET"),
        os.getenv("CLOUDFLARE_R2_BUCKET"),
        os.getenv("R2_BUCKET"),
    ]:
        for bucket in _split_csv(value):
            if bucket not in buckets:
                buckets.append(bucket)

    access_key_id = _first_non_empty(
        os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
        os.getenv("R2_ACCESS_KEY_ID"),
    )
    secret_access_key = _first_non_empty(
        os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
        os.getenv("R2_SECRET_ACCESS_KEY"),
    )
    return {
        "enabled": bool(endpoint and buckets and access_key_id and secret_access_key),
        "endpoint": endpoint,
        "buckets": buckets,
        "access_key_id": access_key_id,
        "secret_access_key": secret_access_key,
    }


def _candidate_keys(requested_key: str | None) -> list[str]:
    keys: list[str] = []
    if requested_key and requested_key.startswith("models/gfpgan/"):
        keys.append(requested_key)
    for key in DEFAULT_GFPGAN_KEYS:
        if key not in keys:
            keys.append(key)
    return keys


def _cache_path_for_key(key: str) -> Path:
    cache_dir = Path(os.getenv("GFPGAN_CACHE_DIR", "/tmp/creatorhub-gfpgan"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
    return cache_dir / f"{digest}-{Path(key).name}"


def _download_weight(requested_key: str | None) -> tuple[Path, str, str]:
    config = _r2_config()
    if not config["enabled"]:
        raise RuntimeError("R2 model credentials are not configured")

    client = boto3.client(
        "s3",
        endpoint_url=config["endpoint"],
        aws_access_key_id=config["access_key_id"],
        aws_secret_access_key=config["secret_access_key"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )

    last_error: Exception | None = None
    for key in _candidate_keys(requested_key):
        cache_path = _cache_path_for_key(key)
        if cache_path.exists() and cache_path.stat().st_size > 1_000_000:
            return cache_path, "cache", key

        tmp_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
        for bucket in config["buckets"]:
            try:
                client.download_file(bucket, key, str(tmp_path))
                tmp_path.replace(cache_path)
                return cache_path, bucket, key
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                try:
                    tmp_path.unlink(missing_ok=True)
                except Exception:
                    pass

    if last_error:
        raise RuntimeError(f"GFPGAN weights were not found in R2: {last_error.__class__.__name__}")
    raise RuntimeError("GFPGAN weights were not found in R2")


def _patch_torchvision_functional_tensor() -> None:
    try:
        import torchvision.transforms.functional as tv_functional

        sys.modules.setdefault("torchvision.transforms.functional_tensor", tv_functional)
    except Exception:
        pass


def _import_gfpgan():
    global _last_import_error
    try:
        _patch_torchvision_functional_tensor()
        from gfpgan import GFPGANer

        _last_import_error = None
        return GFPGANer
    except Exception as exc:  # noqa: BLE001
        _last_import_error = str(exc)
        raise


def _get_restorer(weight_key: str | None):
    global _restorer, _restorer_key
    with _model_lock:
        weight_path, bucket, resolved_key = _download_weight(weight_key)
        if _restorer is not None and _restorer_key == resolved_key:
            return _restorer, bucket, resolved_key

        GFPGANer = _import_gfpgan()
        upscale = max(1, int(os.getenv("GFPGAN_UPSCALE", "1")))
        _restorer = GFPGANer(
            model_path=str(weight_path),
            upscale=upscale,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=None,
        )
        _restorer_key = resolved_key
        return _restorer, bucket, resolved_key


def _decode_image(image_base64: str) -> np.ndarray:
    try:
        image_bytes = base64.b64decode(image_base64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("imageBase64 is not valid base64") from exc

    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("imageBase64 did not decode to a supported image")
    return image


def _resize_for_budget(image: np.ndarray) -> tuple[np.ndarray, float]:
    max_edge = max(512, int(os.getenv("GFPGAN_MAX_INPUT_EDGE", "1600")))
    height, width = image.shape[:2]
    current_max = max(height, width)
    if current_max <= max_edge:
        return image, 1.0

    scale = max_edge / float(current_max)
    resized = cv2.resize(
        image,
        (max(1, int(width * scale)), max(1, int(height * scale))),
        interpolation=cv2.INTER_AREA,
    )
    return resized, scale


@app.get("/")
@app.get("/health")
def health() -> dict[str, Any]:
    r2 = _r2_config()
    import_ok = True
    import_error = None
    try:
        _import_gfpgan()
    except Exception as exc:  # noqa: BLE001
        import_ok = False
        import_error = str(exc)

    healthy = bool(r2["enabled"] and import_ok)
    return {
        "service": "creatorhub-gfpgan-runner",
        "status": "healthy" if healthy else "unavailable",
        "r2Configured": r2["enabled"],
        "bucketsConfigured": len(r2["buckets"]),
        "gfpganImport": import_ok,
        "gfpganImportError": import_error,
        "modelLoaded": _restorer is not None,
        "modelKey": _restorer_key,
        "lastImportError": _last_import_error,
        "maxInputEdge": int(os.getenv("GFPGAN_MAX_INPUT_EDGE", "1600")),
        "upscale": int(os.getenv("GFPGAN_UPSCALE", "1")),
    }


@app.post("/")
@app.post("/enhance")
@app.post("/api/gfpgan/enhance")
def enhance(payload: EnhancePayload) -> dict[str, Any]:
    started = time.time()
    try:
        image = _decode_image(payload.imageBase64)
        process_image, resize_scale = _resize_for_budget(image)
        weight_key = payload.model.weightsKey or payload.model.r2Key
        restorer, bucket, resolved_key = _get_restorer(weight_key)

        weight = float(payload.settings.get("faceEnhancement", 75)) / 100.0
        weight = min(1.0, max(0.15, weight))
        _, _, restored = restorer.enhance(
            process_image,
            has_aligned=False,
            only_center_face=False,
            paste_back=True,
            weight=weight,
        )

        ok, encoded = cv2.imencode(
            ".jpg",
            restored,
            [int(cv2.IMWRITE_JPEG_QUALITY), int(os.getenv("GFPGAN_JPEG_QUALITY", "95"))],
        )
        if not ok:
            raise RuntimeError("Failed to encode GFPGAN output")

        return {
            "success": True,
            "imageBase64": base64.b64encode(encoded.tobytes()).decode("ascii"),
            "mimeType": "image/jpeg",
            "modelUsed": "gfpgan",
            "weightsBucket": bucket,
            "weightsKey": resolved_key,
            "resizedInputScale": resize_scale,
            "processingMs": round((time.time() - started) * 1000),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc)) from exc
