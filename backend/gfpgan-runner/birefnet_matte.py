"""BiRefNet subjekt-matting (server-«pro»-tier).

Kjører BiRefNet (``models/rembg/birefnet/birefnet.onnx`` i R2) via onnxruntime og
gir en piksel-nøyaktig FORGRUNN-matte (subjekt/person) — server-motparten til iOS
Vision-person-segmenteringen appen bruker on-device. Matten mater den subjekt-
beskyttede retusjen (``subject_retouch.apply_background_look``) så bakgrunns-passene
(løvverk-demping, bakgrunns-dis) endelig får en EKTE maske i stedet for den globale
tilnærmingen modulen har i dag.

Rent + testbart: inferensen tar en injiserbar ONNX-session (``__init__``), så tester
kan kjøre uten onnxruntime/vekter; ``from_onnx(path)`` bygger den ekte sessionen.
BiRefNet-preprosessering: RGB → 1024² → ImageNet-normalisering → NCHW; ut = sigmoid av
siste kart → skalert tilbake til original.
"""
from __future__ import annotations

import logging
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger("creatorhub.birefnet")

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Modell-varianter — inngangsstørrelse + normalisering + hvilket utgangs-kart +
# postprosessering:
#   birefnet: 1024², /255 → ImageNet, siste utgang, sigmoid — HØY kvalitet, ~1 GB (OOM på 2 GB)
#   u2net   :  320², /max → ImageNet, første utgang, min-max — LETT (176 MB), stabil i 2 GB ✅
#   isnet   : 1024², /max → ImageNet, første utgang, min-max — DIS general-use (178 MB)
_VARIANTS: dict[str, dict[str, Any]] = {
    "birefnet": {"size": 1024, "norm": "div255", "out": -1, "post": "sigmoid"},
    "u2net": {"size": 320, "norm": "divmax", "out": 0, "post": "minmax"},
    "isnet": {"size": 1024, "norm": "divmax", "out": 0, "post": "minmax"},
}


class OnnxMatte:
    """Generisk ONNX forgrunns-matting (BiRefNet / U²-Net / ISNet). Injiser
    ``session`` i tester; bruk ``from_onnx`` i produksjon. ``variant`` styrer
    størrelse + normalisering + utgangs-kart + postprosessering."""

    def __init__(self, session: Any, input_name: str, variant: str = "birefnet",
                 size: int | None = None) -> None:
        cfg = _VARIANTS.get(variant, _VARIANTS["birefnet"])
        self._session = session
        self._input_name = input_name
        self._variant = variant
        self._cfg = cfg
        self._size = int(size or cfg["size"])

    @classmethod
    def from_onnx(cls, onnx_path: str, variant: str = "birefnet",
                  size: int | None = None) -> "OnnxMatte":
        import onnxruntime as ort  # lazy: bare produksjons-stien trenger den

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider")
                     if p in ort.get_available_providers()]
        sess = ort.InferenceSession(onnx_path, sess_options=opts, providers=providers or None)
        return cls(sess, sess.get_inputs()[0].name, variant, size)

    def _preprocess(self, image_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        r = cv2.resize(rgb, (self._size, self._size), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        if self._cfg["norm"] == "div255":
            r = r / 255.0
        else:  # divmax (U²-Net/ISNet, rembg): del på bildets maks
            r = r / max(float(r.max()), 1e-6)
        r = (r - _MEAN) / _STD
        return np.transpose(r, (2, 0, 1))[None].astype(np.float32)  # 1×3×S×S

    @staticmethod
    def _to_2d(pred: Any) -> np.ndarray:
        arr = np.asarray(pred, dtype=np.float32)
        while arr.ndim > 2:      # (1,1,H,W) / (1,H,W) → (H,W)
            arr = arr[0]
        return arr

    def matte(self, image_bgr: np.ndarray) -> np.ndarray:
        """Forgrunns-matte (H×W, float 0..1) i bildets egen oppløsning."""
        h, w = image_bgr.shape[:2]
        x = self._preprocess(image_bgr)
        outs = self._session.run(None, {self._input_name: x})
        raw = outs[self._cfg["out"]] if isinstance(outs, (list, tuple)) else outs
        pred = self._to_2d(raw)
        if self._cfg["post"] == "sigmoid":
            if pred.min() < 0.0 or pred.max() > 1.0:      # logits → sannsynlighet
                pred = 1.0 / (1.0 + np.exp(-pred))
        else:  # minmax: U²-Net/ISNet gir en saliency-map uten fast skala
            mi, ma = float(pred.min()), float(pred.max())
            pred = (pred - mi) / (ma - mi) if ma > mi else np.zeros_like(pred)
        m = cv2.resize(pred, (w, h), interpolation=cv2.INTER_LINEAR)
        return np.clip(m, 0.0, 1.0)

    def cutout_rgba(self, image_bgr: np.ndarray) -> np.ndarray:
        """BGRA-utklipp med matten som alfa."""
        m = (self.matte(image_bgr) * 255.0).astype(np.uint8)
        rgba = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = m
        return rgba


# Bakoverkompatibelt alias (default variant = birefnet).
BiRefNetMatte = OnnxMatte
