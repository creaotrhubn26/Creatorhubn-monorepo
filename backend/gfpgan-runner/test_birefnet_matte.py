"""Enhetstester for BiRefNet-matting + subjekt-beskyttet bakgrunns-look.

Kjører UTEN onnxruntime/vekter: BiRefNetMatte tar en injiserbar session, så vi mater
et kjent logit-kart og verifiserer pre/postprosessering (normalisering, sigmoid,
reskalering) + at bakgrunns-looken beskytter motivet og demper grønn bakgrunn.
"""
import numpy as np
import pytest

from birefnet_matte import BiRefNetMatte
from subject_retouch import apply_background_look


class FakeSession:
    """Etterligner ort.InferenceSession.run — returnerer et forhåndssatt kart og
    fanger den siste feeden så vi kan sjekke input-formen."""

    def __init__(self, output: np.ndarray) -> None:
        self._output = output
        self.last_feed = None

    def run(self, _outputs, feed):
        self.last_feed = feed
        return [self._output]


def _matte(output: np.ndarray, size: int = 32) -> BiRefNetMatte:
    return BiRefNetMatte(FakeSession(output), input_name="x", size=size)


def test_preprocess_shape_and_normalization():
    sess = FakeSession(np.zeros((1, 1, 32, 32), np.float32))
    m = BiRefNetMatte(sess, "x", size=32)
    img = np.full((100, 80, 3), 128, np.uint8)
    m.matte(img)
    x = sess.last_feed["x"]
    assert x.shape == (1, 3, 32, 32)           # NCHW, resized to size²
    assert x.dtype == np.float32


def test_sigmoid_applied_to_logits_and_resized():
    # logit-kart: venstre halvdel sterkt positiv (→1), høyre sterkt negativ (→0)
    logits = np.zeros((1, 1, 32, 32), np.float32)
    logits[..., :16] = 20.0
    logits[..., 16:] = -20.0
    out = _matte(logits, size=32).matte(np.zeros((64, 48, 3), np.uint8))
    assert out.shape == (64, 48)               # tilbake til bildets oppløsning
    assert out.min() >= 0.0 and out.max() <= 1.0
    assert out[:, :20].mean() > 0.9            # venstre = forgrunn
    assert out[:, 28:].mean() < 0.1            # høyre = bakgrunn


def test_probabilities_passed_through_without_double_sigmoid():
    probs = np.full((1, 1, 8, 8), 0.7, np.float32)   # alt i [0,1] → ingen sigmoid
    out = _matte(probs, size=8).matte(np.zeros((8, 8, 3), np.uint8))
    assert np.allclose(out, 0.7, atol=1e-3)


def test_to_2d_squeezes_extra_dims():
    assert BiRefNetMatte._to_2d(np.zeros((1, 1, 4, 4))).shape == (4, 4)
    assert BiRefNetMatte._to_2d(np.zeros((1, 4, 4))).shape == (4, 4)


def test_cutout_rgba_uses_matte_as_alpha():
    logits = np.full((1, 1, 16, 16), 20.0, np.float32)   # alt forgrunn → alfa≈255
    rgba = _matte(logits, size=16).cutout_rgba(np.full((16, 16, 3), 100, np.uint8))
    assert rgba.shape == (16, 16, 4)
    assert rgba[:, :, 3].min() > 250


def test_background_look_protects_subject_desaturates_green_background():
    # grønt bilde; matte = motiv på venstre halvdel (beskyttes), bakgrunn høyre (dempes)
    img = np.zeros((20, 20, 3), np.uint8)
    img[:] = (40, 180, 60)                     # BGR grønn, mettet
    matte = np.zeros((20, 20), np.float32)
    matte[:, :10] = 1.0                        # venstre = motiv
    out = apply_background_look(img, matte, strength=1.0, green_reduction=0.5)

    def sat(px):
        import cv2
        return float(cv2.cvtColor(px[None, None], cv2.COLOR_BGR2HSV)[0, 0, 1])
    assert sat(out[5, 2]) == pytest.approx(sat(img[5, 2]), abs=2)   # motiv urørt
    assert sat(out[5, 17]) < sat(img[5, 17]) - 10                    # bakgrunn dempet


def test_background_look_noop_without_matte_or_strength():
    img = np.full((8, 8, 3), (40, 180, 60), np.uint8)
    assert np.array_equal(apply_background_look(img, None, 1.0), img)
    assert np.array_equal(apply_background_look(img, np.zeros((8, 8), np.float32), 0.0), img)
