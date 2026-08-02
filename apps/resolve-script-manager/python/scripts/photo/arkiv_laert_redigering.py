"""Arkiv-lært bilderedigering — lær fotografens stil fra egne RAW→ferdig-par.

Prinsippet (samme som Imagen AI, lokalt): for hvert leverte bilde der både
råfilen (CR3/ARW) og den ferdig redigerte JPG-en finnes, ekstraheres
redigeringen som per-kanal tonekurver (CDF-matching — robust mot beskjæring
og rotasjon) + LAB-fargeskift, lagret med scene-features. Nye bilder får
appliseret det vektede snittet av sine k nærmeste arkiv-scener, pluss en
forsiktig ansiktsmålt dodge og stille film-finish.

Hver bryllupsleveranse blir dermed treningsdata for restene av samme bryllup
— og modellfiler kan gjenbrukes på tvers av oppdrag med samme stil.

Bruk:
  Lær en modell fra et arkiv (kan ta 10-20 min for ~200 par):
    python3 arkiv_laert_redigering.py laer \
        --raa "/sti/til/Photography" [--raa "<flere>"] \
        --levering "/sti/til/Levering" [--levering "<flere>"] \
        --modell ~/.config/postagent/stilmodeller/<bryllup>.npz

  Rediger råfiler med en lært modell:
    python3 arkiv_laert_redigering.py rediger \
        --modell ~/.config/postagent/stilmodeller/<bryllup>.npz \
        --inn "/sti/til/raafiler" --ut "/sti/til/utmappe" [--k 5]

Modeller: ~/.config/postagent/stilmodeller/ (f.eks. manjot-armaan-2025.npz,
lært av 226 par 2026-07-29).

Avhengigheter: rawpy, opencv-python, numpy + YuNet-modellen i
~/.config/postagent/models/yunet.onnx.

Kolorist-finish (fra proff-research): hudtone-linje-korreksjon (vectorscope
~35°, C* 20-34) forankret i målte ansikter, og rød-vern som hindrer at
lehengaer driver mot oransje.

Ærlige rammer: lærer tone og farge (globale transformasjoner per scene) —
IKKE retusj, ikke lokale penselstrøk. Best der arkivet har lignende scener.
"""
from __future__ import annotations

import argparse
import glob
import os
import sys

import cv2
import numpy as np
import rawpy

MODELS = os.path.expanduser("~/.config/postagent/models")
RAW_EXT = (".CR3", ".cr3", ".ARW", ".arw", ".NEF", ".nef", ".RAF", ".raf")
_det = None


def detector():
    global _det
    if _det is None:
        _det = cv2.FaceDetectorYN_create(os.path.join(MODELS, "yunet.onnx"), "", (320, 320), 0.6)
    return _det


def develop(raw_path: str, half: bool = True):
    with rawpy.imread(raw_path) as raw:
        rgb = raw.postprocess(use_camera_wb=True, output_bps=8, no_auto_bright=False,
                              half_size=half,
                              highlight_mode=rawpy.HighlightMode.Blend,
                              output_color=rawpy.ColorSpace.sRGB)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def is_color(img, thresh: float = 4.0) -> bool:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    return (np.abs(lab[:, :, 1] - 128).mean() + np.abs(lab[:, :, 2] - 128).mean()) > thresh


def cdf_lut(src_chan, dst_chan):
    """Monoton tonekurve som mapper src-histogrammet til dst-histogrammet."""
    s_cdf = np.cumsum(cv2.calcHist([src_chan], [0], None, [256], [0, 256]).ravel())
    d_cdf = np.cumsum(cv2.calcHist([dst_chan], [0], None, [256], [0, 256]).ravel())
    s_cdf /= max(s_cdf[-1], 1)
    d_cdf /= max(d_cdf[-1], 1)
    lut = np.interp(s_cdf, d_cdf, np.arange(256)).astype(np.float32)
    k = np.ones(9) / 9.0
    return np.clip(np.convolve(np.pad(lut, 4, mode="edge"), k, mode="valid"), 0, 255)


def _std_ratio(dst_chan, src_chan, lo=0.6, hi=1.7):
    """Reinhard-spredningsforhold dst/src for én kanal, klemt mot outliere."""
    s = float(src_chan.std())
    if s < 1e-3:
        return 1.0
    return float(np.clip(dst_chan.std() / s, lo, hi))


def features(img):
    small = cv2.resize(img, (128, 128))
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[:, :, 0]
    hist = cv2.calcHist([L.astype(np.uint8)], [0], None, [8], [0, 256]).ravel()
    hist /= max(hist.sum(), 1)
    return np.concatenate([hist,
                           [L.mean() / 255.0, L.std() / 128.0,
                            (lab[:, :, 1].mean() - 128) / 20.0,
                            (lab[:, :, 2].mean() - 128) / 20.0]]).astype(np.float32)


def flash_fired(jpg_path, raw_path):
    """Fyrte blitsen? EXIF Flash-tag (0x9209), bit 0 = «fired». Del D: lar
    stil-modellen SKILLE blits-scener fra ambient (gelet blits ≠ tungsten selv om
    begge er «varme»). Best-effort, INGEN hard ny avhengighet:
      1) PIL på den leverte JPG-en (bevart av de fleste eksportører),
      2) exiftool på JPG → RAW (leser CR3/ARW som PIL ikke kan).
    None når ukjent → scenen forblir 12-dim (Del D inert for den scenen)."""
    try:
        from PIL import Image
        ex = getattr(Image.open(jpg_path), "_getexif", lambda: None)() or {}
        v = ex.get(0x9209)
        if v is not None:
            return bool(int(v) & 0x1)
    except Exception:
        pass
    import subprocess
    for p in (jpg_path, raw_path):
        try:
            r = subprocess.run(["exiftool", "-s3", "-n", "-Flash", p],
                               capture_output=True, text=True, timeout=10)
            s = r.stdout.strip()
            if not s:
                continue
            try:
                return bool(int(float(s)) & 0x1)     # -n → numerisk Flash-verdi
            except ValueError:
                low = s.lower()                       # tekst-fallback
                if "did not fire" in low or "no flash" in low or "not fire" in low:
                    return False
                if "fire" in low:
                    return True
        except Exception:
            pass
    return None


def learn(raw_roots, lev_roots, model_path, max_pairs=250):
    raw_index = {}
    for root in raw_roots:
        for ext in RAW_EXT:
            for p in glob.glob(f"{root}/**/*{ext}", recursive=True):
                raw_index.setdefault(os.path.splitext(os.path.basename(p))[0], p)
    jpgs = []
    for root in lev_roots:
        jpgs += glob.glob(f"{root}/**/*.jpg", recursive=True)
        jpgs += glob.glob(f"{root}/**/*.JPG", recursive=True)
    pairs = [(raw_index[b], j) for j in sorted(jpgs)
             for b in [os.path.splitext(os.path.basename(j))[0]]
             if b in raw_index and "-Edit" not in j]
    step = max(1, len(pairs) // max_pairs)
    pairs = pairs[::step]
    print(f"{len(pairs)} RAW↔JPG-par til læring", flush=True)
    feats, luts, ab_shifts, lab_std, names, flash = [], [], [], [], [], []
    for i, (rp, jp) in enumerate(pairs):
        try:
            neutral = develop(rp)
            edited = cv2.imread(jp, cv2.IMREAD_COLOR)
            if edited is None or not is_color(edited):
                continue
            eh = cv2.resize(edited, (neutral.shape[1], neutral.shape[0]))
            luts.append(np.stack([cdf_lut(neutral[:, :, c], eh[:, :, c]) for c in range(3)]))
            n_lab = cv2.cvtColor(neutral, cv2.COLOR_BGR2LAB).astype(np.float32)
            e_lab = cv2.cvtColor(eh, cv2.COLOR_BGR2LAB).astype(np.float32)
            ab_shifts.append([float(e_lab[:, :, 1].mean() - n_lab[:, :, 1].mean()),
                              float(e_lab[:, :, 2].mean() - n_lab[:, :, 2].mean())])
            # Reinhard-spredning: hvor mye fotografen endrer STD (spredning) per
            # LAB-kanal (L=kontrast, a/b=metning). Middel-skiftet over fanget bare
            # halve Reinhard-fargeoverføringen; dette er den andre halvparten.
            lab_std.append([_std_ratio(e_lab[:, :, c], n_lab[:, :, c]) for c in range(3)])
            feats.append(features(neutral))
            names.append(os.path.basename(jp))
            # Del D: blits-flagg fra EXIF (1=fyrte, 0=ikke, nan=ukjent). MÅ append-
            # es HER, i lås med feats, så indeksene holder linja.
            ff = flash_fired(jp, rp)
            flash.append(1.0 if ff is True else (0.0 if ff is False else np.nan))
        except Exception as e:
            print(f"  hopp: {os.path.basename(rp)} ({str(e)[:40]})", flush=True)
        if (i + 1) % 25 == 0:
            print(f"  lært {len(feats)} av {i+1}", flush=True)
    os.makedirs(os.path.dirname(os.path.expanduser(model_path)), exist_ok=True)
    np.savez_compressed(os.path.expanduser(model_path), feats=np.array(feats),
                        luts=np.array(luts), ab=np.array(ab_shifts),
                        lab_std=np.array(lab_std), names=np.array(names),
                        flash=np.array(flash, dtype=np.float32))
    known = int(np.count_nonzero(~np.isnan(flash)))
    fired = int(np.nansum(np.array(flash, dtype=np.float32)))
    print(f"MODELL LAGRET: {len(feats)} scener → {model_path} "
          f"(blits kjent for {known}, fyrte {fired})", flush=True)


def face_boxes(img):
    h, w = img.shape[:2]
    sc = 1000 / max(h, w)
    small = cv2.resize(img, (int(w*sc), int(h*sc)))
    det = detector()
    det.setInputSize((small.shape[1], small.shape[0]))
    _n, faces = det.detect(small)
    return [(v[0]/sc, v[1]/sc, v[2]/sc, v[3]/sc) for v in faces[:, :4]] if faces is not None else []


def gentle_face_dodge(img, target=105.0):
    """Person-maskert gamma-løft KUN når ansiktene måler for mørkt."""
    faces = face_boxes(img)
    if not faces:
        return img, "ingen ansikter"
    L = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    vals = []
    for (x, y, fw, fh) in faces:
        roi = L[int(max(0, y)):int(y+fh), int(max(0, x)):int(x+fw)]
        if roi.size > 100:
            vals.append(float(np.median(roi)))
    if not vals:
        return img, "ingen målbare ansikter"
    fl = float(np.median(vals))
    if fl >= target - 6:
        return img, f"ok ({fl:.0f})"
    m = np.zeros(img.shape[:2], np.float32)
    for (x, y, fw, fh) in faces:
        cv2.ellipse(m, (int(x+fw/2), int(y+fh/2)), (int(fw*0.85), int(fh*1.05)), 0, 0, 360, 1.0, -1)
        cv2.ellipse(m, (int(x+fw/2), int(y+fh/2+fh*2.1)), (int(fw*1.5), int(fh*2.2)), 0, 0, 360, 0.8, -1)
    k = int(max(img.shape[:2]) * 0.11) | 1
    m = cv2.GaussianBlur(np.clip(m, 0, 1), (k, k), 0)[:, :, None]
    gamma = max(0.55, np.log(target / 255.0) / np.log(max(fl, 5.0) / 255.0))
    f = img.astype(np.float32) / 255.0
    lifted = np.power(f, np.float32(gamma))
    out = np.clip((f * (1 - m) + lifted * m) * 255, 0, 255).astype(np.uint8)
    return out, f"dodge {fl:.0f}→γ{gamma:.2f}"


def skin_line_correct(img, faces, target_hue_deg=35.0, chroma_range=(20.0, 34.0)):
    """Kolorist-grep: roter fargebalansen dempet så hud faller på hudtone-linjen
    (vectorscope ~10:30 ≈ 35° i LAB), og hold hud-chroma i naturlig område."""
    if not faces:
        return img
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    h, w = lab.shape[:2]
    a_v, b_v = [], []
    for (x, y, fw, fh) in faces:
        x0, y0 = max(0, int(x)), max(0, int(y))
        roi = lab[y0:min(h, int(y+fh)), x0:min(w, int(x+fw)), :]
        if roi[:, :, 0].size > 100:
            a_v.append(float(np.median(roi[:, :, 1])) - 128.0)
            b_v.append(float(np.median(roi[:, :, 2])) - 128.0)
    if not a_v:
        return img
    a0, b0 = float(np.median(a_v)), float(np.median(b_v))
    chroma = (a0 * a0 + b0 * b0) ** 0.5
    if chroma < 3.0:
        return img
    hue = np.degrees(np.arctan2(b0, a0))
    dtheta = np.radians(np.clip(target_hue_deg - hue, -8.0, 8.0)) * 0.7
    target_c = np.clip(chroma, *chroma_range)
    scale = np.clip(target_c / chroma, 0.88, 1.12) ** 0.5
    ca, sa = np.cos(dtheta), np.sin(dtheta)
    A = (lab[:, :, 1] - 128.0)
    B = (lab[:, :, 2] - 128.0)
    lab[:, :, 1] = np.clip((A * ca - B * sa) * scale + 128.0, 0, 255)
    lab[:, :, 2] = np.clip((A * sa + B * ca) * scale + 128.0, 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def protect_reds(img, hue_shift=-5, sat_gain=1.04):
    """Lehenga-vernet: rødt som driver mot oransje skyves tilbake mot dyp rød.
    Kun mettede rød/rød-oransje-piksler røres (H<14 eller H>172, S>90)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.int16)
    Hc, S = hsv[:, :, 0], hsv[:, :, 1]
    m = (((Hc < 14) | (Hc > 172)) & (S > 90))
    if not m.any():
        return img
    hsv[:, :, 0][m] = (Hc[m] + hue_shift) % 180
    hsv[:, :, 1][m] = np.clip(S[m].astype(np.float32) * sat_gain, 0, 255).astype(np.int16)
    return cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)


def apply_model(raw_path, model, out_dir, k=5):
    base = os.path.splitext(os.path.basename(raw_path))[0]
    img = develop(raw_path, half=False)
    f = features(img)
    # Farge-vektet kNN: a/b-fargesnittet (feature-indeks 10–11) vektes tyngre så
    # scene-matchingen styres av LYS-/FARGE-betingelsen (tungsten/dagslys/motlys)
    # — det er der stil er betinget, jf. research (Imagen/Aftershoot-mønsteret).
    diff = model["feats"] - f[None, :]
    if diff.shape[1] >= 12:
        diff[:, 10:12] *= 1.6
    d = np.linalg.norm(diff, axis=1)
    idx = np.argsort(d)[:k]
    wts = 1.0 / (d[idx] + 1e-4)
    wts /= wts.sum()
    lut = np.tensordot(wts, model["luts"][idx], axes=1)
    ab = np.tensordot(wts, model["ab"][idx], axes=1)
    out = np.empty_like(img)
    xs = np.arange(256)
    for c in range(3):
        out[:, :, c] = np.interp(img[:, :, c].ravel(), xs, lut[c]).reshape(img.shape[:2])
    lab_img = cv2.cvtColor(out, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_img[:, :, 1] = np.clip(lab_img[:, :, 1] + 0.5 * ab[0], 0, 255)
    lab_img[:, :, 2] = np.clip(lab_img[:, :, 2] + 0.5 * ab[1], 0, 255)
    # Reinhard-spredning (andre halvpart): skaler hver LAB-kanals STD mot den
    # lærte looken (L=kontrast, a/b=metning) rundt bildets egne kanal-snitt.
    # Bakoverkompatibelt — hoppes over for gamle modeller uten `lab_std`.
    if "lab_std" in model:
        std_r = np.tensordot(wts, model["lab_std"][idx], axes=1)
        for c in range(3):
            ch = lab_img[:, :, c]
            m = float(ch.mean())
            lab_img[:, :, c] = np.clip(m + (ch - m) * float(std_r[c]), 0, 255)
    out = cv2.cvtColor(lab_img.astype(np.uint8), cv2.COLOR_LAB2BGR)
    faces = face_boxes(out)
    out = skin_line_correct(out, faces)
    out = protect_reds(out)
    out, dlog = gentle_face_dodge(out)
    # stille finish («film is quiet»): lett skarphet + fin korning
    blur = cv2.GaussianBlur(out, (0, 0), 1.0)
    out = cv2.addWeighted(out, 1.10, blur, -0.10, 0)
    h, w = out.shape[:2]
    n = np.random.default_rng(11).normal(0, 1.8 * max(1.0, w/3000.0), (h, w, 1))
    out = np.clip(out.astype(np.float32) + n, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, f"{base}_farge.jpg"), out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    refs = ", ".join(str(model["names"][i]) for i in idx[:3])
    return base, f"{dlog} | lært av: {refs}"


def _flash_value(model):
    """Hent blits-arrayet fra en modell (nan-fylt hvis fraværende → gamle .npz).
    Returnerer None når modellen ikke har blits-data i det hele tatt."""
    if "flash" not in model:
        return None
    fl = np.asarray(model["flash"], dtype=np.float32).ravel()
    return fl if np.any(~np.isnan(fl)) else None


def _flash_dim(flash, sel):
    """13. feature-element for en scene-klynge: snitt av de KJENTE blits-verdiene
    i utvalget `sel` (0..1 = andel blits). None når ingen kjent → behold 12-dim."""
    if flash is None:
        return None
    vals = flash[np.asarray(sel, dtype=int)]
    known = vals[~np.isnan(vals)]
    if known.size == 0:
        return None
    return round(float(known.mean()), 4)


def export_profile(model_path, out_json, clusters=32):
    """Destillér en .npz-stilmodell til en kompakt, bærbar JSON-profil for
    on-device-bruk (iOS CaptureApp). Klynger scenene til ~`clusters` sentroider
    (cv2.kmeans på scene-features) og lagrer per klynge: feature-sentroide +
    gjennomsnittlig per-kanal-LUT (uint8) + a/b-skift + Reinhard-std. Liten nok
    til å buntes (~50–120 KB); k-NN + LUT kjøres trivielt on-device."""
    m = dict(np.load(os.path.expanduser(model_path), allow_pickle=True))
    feats = m["feats"].astype(np.float32)
    luts = m["luts"].astype(np.float32)
    ab = m["ab"].astype(np.float32)
    lab_std = m["lab_std"].astype(np.float32) if "lab_std" in m else np.ones((len(feats), 3), np.float32)
    flash = _flash_value(m)
    n = len(feats)
    if n > clusters:
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _c, labels, _cen = cv2.kmeans(feats, clusters, None, crit, 4, cv2.KMEANS_PP_CENTERS)
        labels = labels.ravel()
        groups = range(clusters)
    else:
        labels = np.arange(n)
        groups = range(n)
    scenes = []
    flash_aware = False
    for g in groups:
        sel = np.where(labels == g)[0]
        if len(sel) == 0:
            continue
        feat = [round(float(v), 5) for v in feats[sel].mean(0)]
        # Del D: append 13. blits-element når klyngen har kjent blits (→ 13-dim v3-
        # scene); ellers behold 12-dim. App-en itererer minste dim, så miks er trygt.
        fd = _flash_dim(flash, sel)
        if fd is not None:
            feat.append(fd)
            flash_aware = True
        scenes.append({
            "feat": feat,
            "lut": [[int(round(v)) for v in luts[sel, c].mean(0)] for c in range(3)],
            "ab": [round(float(v), 4) for v in ab[sel].mean(0)],
            "labStd": [round(float(v), 4) for v in lab_std[sel].mean(0)],
            "weight": int(len(sel)),
        })
    import json
    prof = {"version": 3 if flash_aware else 1,
            "source": os.path.basename(model_path), "scenes": scenes}
    with open(os.path.expanduser(out_json), "w") as fh:
        json.dump(prof, fh, separators=(",", ":"))
    size = os.path.getsize(os.path.expanduser(out_json))
    print(f"PROFIL LAGRET: {len(scenes)} sentroider (fra {n} scener) → {out_json} ({size//1024} KB)", flush=True)


def _scene_dicts(feats, luts, ab, lab_std, sel, clusters, flash=None):
    """Bygg scene-sentroide-liste for et utvalg scene-indekser (`sel`), klynget
    på scene-features til ~`clusters` sentroider. Delt av eksport-veiene. Når
    `flash` (globalt array) er gitt appendes 13. blits-dim per sub-klynge (Del D)."""
    fs, ls, ab_s, std_s = feats[sel], luts[sel], ab[sel], lab_std[sel]
    sel = np.asarray(sel, dtype=int)
    fl_s = flash[sel] if flash is not None else None
    if len(sel) > clusters:
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _c, lab, _cen = cv2.kmeans(fs.astype(np.float32), clusters, None, crit, 4, cv2.KMEANS_PP_CENTERS)
        lab = lab.ravel()
        groups = range(clusters)
    else:
        lab = np.arange(len(sel))
        groups = range(len(sel))
    out = []
    for g in groups:
        idx = np.where(lab == g)[0]
        if len(idx) == 0:
            continue
        feat = [round(float(v), 5) for v in fs[idx].mean(0)]
        fd = _flash_dim(fl_s, idx) if fl_s is not None else None
        if fd is not None:
            feat.append(fd)
        out.append({
            "feat": feat,
            "lut": [[int(round(v)) for v in ls[idx, c].mean(0)] for c in range(3)],
            "ab": [round(float(v), 4) for v in ab_s[idx].mean(0)],
            "labStd": [round(float(v), 4) for v in std_s[idx].mean(0)],
            "weight": int(len(idx)),
        })
    return out


def _style_signature(luts, ab, lab_std):
    """Per-scene REDIGERINGS-signatur (ikke scene-innhold): [lysløft, kontrast,
    varme(a), tint(b), metning(a-std)] — hva fotografen GJØR, ikke hva bildet er."""
    bright = luts.mean(axis=(1, 2)) / 255.0            # snitt-utgang = lysløft
    contrast = luts.std(axis=(1, 2)) / 128.0           # kurve-spredning = kontrast
    return np.stack([bright, contrast, ab[:, 0] / 20.0, ab[:, 1] / 20.0, lab_std[:, 1]], axis=1)


def _style_name(warm, bright, contrast, used):
    """Beskrivende norsk stil-navn fra klynge-karakteristikk (IKKE par-navn).
    `warm/bright/contrast` er z-score-avvik fra snittet på tvers av stilene."""
    color = "Varm" if warm > 0.4 else ("Kjølig" if warm < -0.4 else "Nøytral")
    if contrast > 0.5:
        tone = "stemningsfull"
    elif contrast < -0.5:
        tone = "luftig" if bright > 0 else "filmisk"
    else:
        tone = "lys" if bright > 0.5 else ("dempet" if bright < -0.5 else "ren")
    name = f"{color} & {tone}"
    i = 2
    base = name
    while name in used:                                 # unngå kollisjon
        name = f"{base} {i}"; i += 1
    used.add(name)
    return name


def export_styles(model_path, out_json, n_styles=4, per_style=24):
    """Fler-stil-eksport (research «cluster, don't average»): klynger scenene på
    REDIGERINGS-signatur til `n_styles` distinkte looker, auto-navngir hver
    beskrivende, og skriver en multi-stil-JSON. Hver stil får egne scene-
    sentroider for on-device k-NN innen den valgte looken."""
    import json
    m = dict(np.load(os.path.expanduser(model_path), allow_pickle=True))
    feats, luts, ab = m["feats"].astype(np.float32), m["luts"].astype(np.float32), m["ab"].astype(np.float32)
    lab_std = m["lab_std"].astype(np.float32) if "lab_std" in m else np.ones((len(feats), 3), np.float32)
    flash = _flash_value(m)
    sig = _style_signature(luts, ab, lab_std)
    z = (sig - sig.mean(0)) / (sig.std(0) + 1e-6)       # normalisér akser
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.3)
    _c, labels, cen = cv2.kmeans(z.astype(np.float32), n_styles, None, crit, 6, cv2.KMEANS_PP_CENTERS)
    labels = labels.ravel()
    used, styles = set(), []
    order = sorted(range(n_styles), key=lambda g: -int((labels == g).sum()))
    for g in order:
        sel = np.where(labels == g)[0]
        if len(sel) < 8:                                # dropp bittesmå klynger
            continue
        name = _style_name(float(cen[g, 2]), float(cen[g, 0]), float(cen[g, 1]), used)
        styles.append({"name": name, "count": int(len(sel)),
                       "scenes": _scene_dicts(feats, luts, ab, lab_std, sel, per_style, flash=flash)})
    # Del D: v3 når noen scene fikk en 13. blits-dim (ellers uendret v2).
    flash_aware = any(len(sc["feat"]) >= 13 for s in styles for sc in s["scenes"])
    prof = {"version": 3 if flash_aware else 2,
            "source": os.path.basename(model_path), "styles": styles}
    with open(os.path.expanduser(out_json), "w") as fh:
        json.dump(prof, fh, separators=(",", ":"))
    size = os.path.getsize(os.path.expanduser(out_json))
    print(f"FLER-STIL LAGRET: {len(styles)} stiler → {out_json} ({size//1024} KB, "
          f"v{prof['version']})", flush=True)
    for s in styles:
        print(f"  • «{s['name']}» ({s['count']} scener, {len(s['scenes'])} sentroider)", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="mode", required=True)
    ap_l = sub.add_parser("laer")
    ap_l.add_argument("--raa", action="append", required=True)
    ap_l.add_argument("--levering", action="append", required=True)
    ap_l.add_argument("--modell", required=True)
    ap_l.add_argument("--maks-par", type=int, default=250)
    ap_r = sub.add_parser("rediger")
    ap_r.add_argument("--modell", required=True)
    ap_r.add_argument("--inn", required=True)
    ap_r.add_argument("--ut", required=True)
    ap_r.add_argument("--k", type=int, default=5)
    ap_e = sub.add_parser("eksporter")
    ap_e.add_argument("--modell", required=True)
    ap_e.add_argument("--ut", required=True, help="JSON-profil-sti")
    ap_e.add_argument("--klynger", type=int, default=32)
    ap_s = sub.add_parser("stiler")
    ap_s.add_argument("--modell", required=True)
    ap_s.add_argument("--ut", required=True, help="multi-stil-JSON-sti")
    ap_s.add_argument("--antall", type=int, default=4, help="antall distinkte stiler")
    args = ap.parse_args()
    if args.mode == "laer":
        learn(args.raa, args.levering, args.modell, args.maks_par)
        return
    if args.mode == "eksporter":
        export_profile(args.modell, args.ut, args.klynger)
        return
    if args.mode == "stiler":
        export_styles(args.modell, args.ut, args.antall)
        return
    model = dict(np.load(os.path.expanduser(args.modell), allow_pickle=True))
    os.makedirs(args.ut, exist_ok=True)
    raws = []
    for ext in RAW_EXT:
        raws += glob.glob(os.path.join(args.inn, f"*{ext}"))
    raws = sorted(set(raws))
    print(f"{len(raws)} råfiler → {args.ut}", flush=True)
    for i, rp in enumerate(raws):
        base, note = apply_model(rp, model, args.ut, args.k)
        print(f"  [{i+1}/{len(raws)}] {base}: {note}", flush=True)
    print("FERDIG", flush=True)


if __name__ == "__main__":
    main()
