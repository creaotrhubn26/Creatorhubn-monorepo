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
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from cube_lut import apply_lut as apply_cube_lut
from freq_sep_save import encode_png_16bit, parse_payload as parse_freq_sep_save_payload
from hsl_retouch import apply_hsl
from lut_library import get_builtin_lut, list_builtin_luts
from portrait_retouch import apply_portrait_retouch, apply_portrait_retouch_multi, detect_all_face_regions
from subject_retouch import apply_subject_look


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
_service_started_at = time.time()
_requests_total = 0
_errors_total = 0
_model_load_count = 0
_last_model_load_ms: int | None = None
_last_enhance_ms: int | None = None
_last_error: str | None = None


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
    # Explicit controls forwarded by the web layer — see
    # backend/server/photo-enhancer-routes.ts. Kept as an open dict so
    # new sliders don't require a runner redeploy: the portrait retouch
    # module only reads keys it knows about.
    controls: dict[str, Any] = Field(default_factory=dict)
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
    global _restorer, _restorer_key, _model_load_count, _last_model_load_ms
    with _model_lock:
        weight_path, bucket, resolved_key = _download_weight(weight_key)
        if _restorer is not None and _restorer_key == resolved_key:
            return _restorer, bucket, resolved_key

        load_started = time.time()
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
        _model_load_count += 1
        _last_model_load_ms = round((time.time() - load_started) * 1000)
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


@app.get("/luts")
def list_luts() -> dict[str, Any]:
    """Return the runner's built-in LUT registry so the Node/Express
    backend can forward it to the frontend dropdown without duplicating
    slugs in two languages. Shape mirrors lut_library.list_builtin_luts().
    """
    return {"success": True, "luts": list_builtin_luts()}


@app.get("/luts/{lut_id}/table")
def get_lut_table(lut_id: str) -> dict[str, Any]:
    """Return a LUT table as a flat float list so the browser can build
    a 2D atlas for the WebGL preview. Kept separate from /luts so the
    dropdown listing stays cheap — downloading a 17³×3 table is ~55 KB,
    fine on demand but unnecessary on every page load.
    """
    resolved = get_builtin_lut(lut_id)
    if resolved is None:
        raise HTTPException(status_code=404, detail="lut_not_found")
    # table has shape (size, size, size, 3) in b-major order. Flatten
    # preserving that — the browser re-encodes to a 2D atlas with the
    # same semantics.
    flat = resolved.table.reshape(-1).tolist()
    return {
        "success": True,
        "id": lut_id,
        "size": resolved.size,
        "domainMin": list(resolved.domain_min),
        "domainMax": list(resolved.domain_max),
        "table": flat,
    }


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
        "uptimeSeconds": round(time.time() - _service_started_at),
        "r2Configured": r2["enabled"],
        "bucketsConfigured": len(r2["buckets"]),
        "gfpganImport": import_ok,
        "gfpganImportError": import_error,
        "modelLoaded": _restorer is not None,
        "modelKey": _restorer_key,
        "lastImportError": _last_import_error,
        "requestsTotal": _requests_total,
        "errorsTotal": _errors_total,
        "modelLoadCount": _model_load_count,
        "lastModelLoadMs": _last_model_load_ms,
        "lastEnhanceMs": _last_enhance_ms,
        "lastError": _last_error,
        "maxInputEdge": int(os.getenv("GFPGAN_MAX_INPUT_EDGE", "1600")),
        "upscale": int(os.getenv("GFPGAN_UPSCALE", "1")),
    }


class FrequencySepSavePayload(BaseModel):
    """Wire format for the frequency-sep 16-bit save endpoint.

    The browser converts its Float32 [0,1] edited buffer to little-endian
    Uint16 per channel (so 16-bit = multiply by 65535, round) and sends
    the raw bytes base64-encoded. We validate length strictly server-side
    so a truncated upload fails fast instead of producing a corrupt PNG.
    """

    width: int
    height: int
    # 3 = RGB, 4 = RGBA. Alpha is preserved; the editor doesn't touch
    # coverage but some downstream consumers (export masks) expect alpha.
    channels: int
    pixelsBase64: str


@app.post("/frequency-sep/save-16bit")
@app.post("/api/frequency-sep/save-16bit")
def save_frequency_sep_16bit(payload: FrequencySepSavePayload) -> Response:
    """Encode the editor's edited buffer as a 16-bit-per-channel PNG.

    Responds with the binary PNG directly (Content-Type: image/png) so
    the frontend can turn it into a Blob without a base64 unwrap hop.
    """
    global _requests_total, _errors_total, _last_error
    _requests_total += 1
    try:
        parsed = parse_freq_sep_save_payload(
            width=payload.width,
            height=payload.height,
            channels=payload.channels,
            pixels_base64=payload.pixelsBase64,
        )
        png_bytes = encode_png_16bit(parsed)
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                "Content-Length": str(len(png_bytes)),
                # Ephemeral artefact — each save is a fresh stroke state
                # and must not be cached by proxies / browsers.
                "Cache-Control": "no-store",
            },
        )
    except ValueError as exc:
        _errors_total += 1
        _last_error = str(exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        _errors_total += 1
        _last_error = str(exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/")
@app.post("/enhance")
@app.post("/api/gfpgan/enhance")
def enhance(payload: EnhancePayload) -> dict[str, Any]:
    global _requests_total, _errors_total, _last_enhance_ms, _last_error
    _requests_total += 1
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

        # Evoto-parity portrait retouch — runs after GFPGAN so the face
        # restoration cleans up skin first, then we apply masked teeth /
        # eye / blemish tweaks on the cleaner canvas. The module silently
        # skips everything if MediaPipe is unavailable or no face was
        # detected, so the core enhance still succeeds.
        controls = payload.controls or {}
        # Web layer sends the new sliders under both ``settings`` and
        # ``controls`` today; accept either so we don't fail closed if a
        # future deploy drops one side.
        merged_controls = {
            "teethWhiteness": controls.get(
                "teethWhiteness", payload.settings.get("teethWhiteness", 0)
            ),
            "eyeBrightness": controls.get(
                "eyeBrightness", payload.settings.get("eyeBrightness", 0)
            ),
            "eyeWhiteness": controls.get(
                "eyeWhiteness", payload.settings.get("eyeWhiteness", 0)
            ),
            "blemishRemoval": controls.get(
                "blemishRemoval", payload.settings.get("blemishRemoval", 0)
            ),
        }
        # Per-face overrides arrive as a list of { faceIndex, controls }
        # from the web layer. When absent or empty the single-face path
        # (apply_portrait_retouch) is used so the cheap detector call is
        # not duplicated. With overrides we detect all faces once and
        # orchestrate the global + per-face application via
        # apply_portrait_retouch_multi.
        per_face_overrides = controls.get("perFaceOverrides") or payload.settings.get("perFaceOverrides")
        try:
            if isinstance(per_face_overrides, list) and per_face_overrides:
                restored = apply_portrait_retouch_multi(
                    restored,
                    merged_controls,
                    per_face_overrides=per_face_overrides,
                )
            else:
                restored = apply_portrait_retouch(restored, merged_controls)
        except Exception as retouch_err:  # noqa: BLE001
            # Retouch failing must never break the enhance response —
            # the user's already-restored GFPGAN output is useful on its
            # own. Log and carry the raw restore forward.
            _last_error = f"retouch: {retouch_err}"
            logger = __import__("logging").getLogger("creatorhub.gfpgan-runner")
            logger.warning("portrait retouch failed, returning raw GFPGAN: %s", retouch_err)

        # 8-band HSL colour grading. Accepts a dict keyed by band name
        # (red / orange / yellow / green / aqua / blue / purple / magenta)
        # with per-band {h, s, l} in [-100, 100]. Identity when no bands
        # are moved, so forwarded-but-empty payloads cost nothing.
        hsl_params = controls.get("hsl")
        if hsl_params is None:
            hsl_params = payload.settings.get("hsl")
        if hsl_params:
            try:
                restored = apply_hsl(restored, hsl_params)
            except Exception as hsl_err:  # noqa: BLE001
                _last_error = f"hsl: {hsl_err}"
                logger = __import__("logging").getLogger("creatorhub.gfpgan-runner")
                logger.warning("hsl retouch failed, skipping: %s", hsl_err)

        # Built-in LUT look, applied after HSL / portrait retouch and
        # before the subject pass. Accepts { name, strength } via
        # controls (preferred) or top-level settings (legacy web). Any
        # failure (unknown name, parse error, apply error) logs and
        # skips — the enhance response still returns the HSL-level result.
        lut_params = controls.get("lut") or payload.settings.get("lut")
        if isinstance(lut_params, dict):
            lut_name = str(lut_params.get("name") or "").strip()
            try:
                lut_strength = float(lut_params.get("strength") or 0)
            except (TypeError, ValueError):
                lut_strength = 0.0
            if lut_strength > 0:
                try:
                    resolved = None
                    inline_table = lut_params.get("inlineTable")
                    inline_size = lut_params.get("inlineSize")
                    # User-uploaded LUT path: backend pre-fetched the
                    # .cube, validated it, and inlined the float table.
                    # Skip the registry lookup entirely.
                    if isinstance(inline_table, list) and isinstance(inline_size, int):
                        try:
                            from cube_lut import ParsedCubeLut
                            import numpy as _np
                            arr = _np.asarray(inline_table, dtype=_np.float32)
                            expected = inline_size ** 3 * 3
                            if arr.size == expected:
                                dmin = lut_params.get("inlineDomainMin") or [0.0, 0.0, 0.0]
                                dmax = lut_params.get("inlineDomainMax") or [1.0, 1.0, 1.0]
                                resolved = ParsedCubeLut(
                                    kind="3D",
                                    size=inline_size,
                                    domain_min=(float(dmin[0]), float(dmin[1]), float(dmin[2])),
                                    domain_max=(float(dmax[0]), float(dmax[1]), float(dmax[2])),
                                    title="user",
                                    table=arr.reshape(inline_size, inline_size, inline_size, 3),
                                )
                        except Exception as inline_err:  # noqa: BLE001
                            _last_error = f"lut inline: {inline_err}"
                    if resolved is None and lut_name:
                        resolved = get_builtin_lut(lut_name)
                    if resolved is not None:
                        tonal_mix = str(lut_params.get("tonalMix") or "all").strip().lower()
                        if tonal_mix not in ("all", "highlights", "midtones", "shadows"):
                            tonal_mix = "all"
                        restored = apply_cube_lut(restored, resolved, lut_strength, tonal_mix)
                    elif lut_name:
                        _last_error = f"lut: unknown name '{lut_name}'"
                        __import__("logging").getLogger("creatorhub.gfpgan-runner").warning(
                            "LUT '%s' is not registered — skipping", lut_name,
                        )
                except Exception as lut_err:  # noqa: BLE001
                    _last_error = f"lut: {lut_err}"
                    __import__("logging").getLogger("creatorhub.gfpgan-runner").warning(
                        "LUT apply failed, skipping: name=%s err=%s",
                        lut_name,
                        lut_err,
                    )

        # Subject-aware look. Runs only when the request carried a
        # ``subject`` hint (populated by the Claude Vision suggester or
        # a future on-device classifier). Portrait and group_portrait
        # are handled above; the dispatcher silently no-ops on those
        # plus "other" and unknown labels so this block is safe to run
        # unconditionally.
        subject = (
            str(controls.get("subject") or payload.settings.get("subject") or "")
            .strip()
            .lower()
        )
        subject_strength = float(
            controls.get(
                "subjectLookStrength",
                payload.settings.get("subjectLookStrength", 0),
            )
            or 0
        ) / 100.0
        if subject and subject_strength > 0:
            try:
                restored = apply_subject_look(restored, subject, subject_strength)
            except Exception as look_err:  # noqa: BLE001
                _last_error = f"subject look: {look_err}"
                logger = __import__("logging").getLogger("creatorhub.gfpgan-runner")
                logger.warning(
                    "subject look failed, skipping: subject=%s err=%s",
                    subject,
                    look_err,
                )

        ok, encoded = cv2.imencode(
            ".jpg",
            restored,
            [int(cv2.IMWRITE_JPEG_QUALITY), int(os.getenv("GFPGAN_JPEG_QUALITY", "95"))],
        )
        if not ok:
            raise RuntimeError("Failed to encode GFPGAN output")

        processing_ms = round((time.time() - started) * 1000)
        _last_enhance_ms = processing_ms
        _last_error = None
        return {
            "success": True,
            "imageBase64": base64.b64encode(encoded.tobytes()).decode("ascii"),
            "mimeType": "image/jpeg",
            "modelUsed": "gfpgan",
            "weightsBucket": bucket,
            "weightsKey": resolved_key,
            "resizedInputScale": resize_scale,
            "processingMs": processing_ms,
        }
    except ValueError as exc:
        _errors_total += 1
        _last_enhance_ms = round((time.time() - started) * 1000)
        _last_error = str(exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        _errors_total += 1
        _last_enhance_ms = round((time.time() - started) * 1000)
        _last_error = str(exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
