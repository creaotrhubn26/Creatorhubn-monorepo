"""Enhetstester for Del D (blits-bevisst v3-profil) i arkiv_laert_redigering.

Kjøres uten RAW-filer: eksport-veiene leser kun .npz-modellen, ikke bilder.
    python3 test_arkiv_laert_redigering.py
"""
import json
import os
import tempfile
import unittest

import numpy as np

import arkiv_laert_redigering as A


def _fake_model(tmpdir, n=80, flash="mixed"):
    """Skriv en syntetisk .npz-stilmodell. `flash`: 'mixed' (halvt fyrt, litt
    ukjent) | 'none' (kolonne mangler) | 'allnan' (kolonne finnes, alt ukjent)."""
    rng = np.random.default_rng(7)
    feats = rng.random((n, 12), dtype=np.float32)
    luts = rng.integers(0, 256, size=(n, 3, 256)).astype(np.float32)
    ab = rng.standard_normal((n, 2)).astype(np.float32)
    lab_std = (0.8 + 0.4 * rng.random((n, 3))).astype(np.float32)
    names = np.array([f"IMG_{i}.jpg" for i in range(n)])
    kw = dict(feats=feats, luts=luts, ab=ab, lab_std=lab_std, names=names)
    if flash == "mixed":
        fl = np.where(np.arange(n) % 2 == 0, 1.0, 0.0).astype(np.float32)
        fl[:4] = np.nan                       # noen ukjente
        kw["flash"] = fl
    elif flash == "allnan":
        kw["flash"] = np.full(n, np.nan, dtype=np.float32)
    path = os.path.join(tmpdir, "m.npz")
    np.savez_compressed(path, **kw)
    return path


class FlashDimTests(unittest.TestCase):

    def test_flash_dim_averages_known_only(self):
        fl = np.array([1.0, 0.0, np.nan, 1.0], dtype=np.float32)
        # Utvalg {0,2,3}: kjente = [1, 1] → snitt 1.0 (nan ignorert).
        self.assertEqual(A._flash_dim(fl, [0, 2, 3]), 1.0)
        # Utvalg {1,2}: kjente = [0] → 0.0.
        self.assertEqual(A._flash_dim(fl, [1, 2]), 0.0)
        # Bare ukjent → None (behold 12-dim).
        self.assertIsNone(A._flash_dim(fl, [2]))
        # flash=None → None.
        self.assertIsNone(A._flash_dim(None, [0, 1]))

    def test_flash_value_absent_or_allnan_is_none(self):
        self.assertIsNone(A._flash_value({}))                     # ingen kolonne
        self.assertIsNone(A._flash_value({"flash": np.full(3, np.nan)}))
        self.assertIsNotNone(A._flash_value({"flash": np.array([1.0, np.nan])}))


class ExportProfileTests(unittest.TestCase):

    def test_v3_profile_appends_flash_dim(self):
        with tempfile.TemporaryDirectory() as d:
            mp = _fake_model(d, flash="mixed")
            out = os.path.join(d, "p.json")
            A.export_profile(mp, out, clusters=8)
            prof = json.load(open(out))
            self.assertEqual(prof["version"], 3)
            dims = {len(s["feat"]) for s in prof["scenes"]}
            self.assertIn(13, dims, "minst én klynge skal ha blits-dim")
            for s in prof["scenes"]:
                if len(s["feat"]) == 13:
                    self.assertGreaterEqual(s["feat"][12], 0.0)
                    self.assertLessEqual(s["feat"][12], 1.0)

    def test_allnan_flash_stays_v1_and_12dim(self):
        with tempfile.TemporaryDirectory() as d:
            mp = _fake_model(d, flash="allnan")
            out = os.path.join(d, "p.json")
            A.export_profile(mp, out, clusters=8)
            prof = json.load(open(out))
            self.assertEqual(prof["version"], 1)
            self.assertTrue(all(len(s["feat"]) == 12 for s in prof["scenes"]))

    def test_legacy_model_without_flash_stays_v1(self):
        with tempfile.TemporaryDirectory() as d:
            mp = _fake_model(d, flash="none")
            out = os.path.join(d, "p.json")
            A.export_profile(mp, out, clusters=8)
            prof = json.load(open(out))
            self.assertEqual(prof["version"], 1)
            self.assertTrue(all(len(s["feat"]) == 12 for s in prof["scenes"]))


class ExportStylesTests(unittest.TestCase):

    def test_v3_multistyle_appends_flash_dim(self):
        with tempfile.TemporaryDirectory() as d:
            mp = _fake_model(d, flash="mixed")
            out = os.path.join(d, "s.json")
            A.export_styles(mp, out, n_styles=2, per_style=8)
            prof = json.load(open(out))
            self.assertEqual(prof["version"], 3)
            has13 = any(len(sc["feat"]) == 13 for s in prof["styles"] for sc in s["scenes"])
            self.assertTrue(has13, "fler-stil v3 skal ha minst én 13-dim scene")

    def test_legacy_multistyle_stays_v2(self):
        with tempfile.TemporaryDirectory() as d:
            mp = _fake_model(d, flash="none")
            out = os.path.join(d, "s.json")
            A.export_styles(mp, out, n_styles=2, per_style=8)
            prof = json.load(open(out))
            self.assertEqual(prof["version"], 2)
            self.assertTrue(all(len(sc["feat"]) == 12
                                for s in prof["styles"] for sc in s["scenes"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
