"""Generate Contact Sheets — frame-uttrekk + montasjer for frame-for-frame-analyse
av en lang film (bryllup el.l.). Grunnlaget for å forstå historien før man velger
klipp. Trekker ut ett bilde hvert N sek (rask input-seek), legger tidskode-label
og fliser dem til kontaktark (Pillow — ffmpeg her mangler ofte drawtext).

Input:
  videoPath:    abs sti til kilde-video [required]
  intervalSec:  sekunder mellom frames (default 10)
  outDir:       output-mappe (default /tmp/wedding-analysis/<basename>/montages)
  width:        tile-bredde px (default 384)

Output: { frames, sheets, outDir }
"""
from __future__ import annotations
import os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

FONT_CANDIDATES = ("/System/Library/Fonts/Supplemental/Arial.ttf",
                   "/System/Library/Fonts/Helvetica.ttc")
FFMPEG = next((p for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg")
               if os.path.isfile(p) or p == "ffmpeg"), "ffmpeg")
FFPROBE = FFMPEG.replace("ffmpeg", "ffprobe")


def _duration(video: str) -> float:
    try:
        out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                              "-of", "default=noprint_wrappers=1:nokey=1", video],
                             capture_output=True, text=True, timeout=30).stdout.strip()
        return float(out)
    except Exception:
        return 0.0


def run(params: dict, dry_run: bool) -> None:
    video = (params.get("videoPath") or "").strip()
    if not video or not os.path.isfile(video):
        bridge.error(f"videoPath finnes ikke: {video}"); sys.exit(1)
    interval = max(1, int(params.get("intervalSec") or 10))
    width = int(params.get("width") or 384)
    base = os.path.splitext(os.path.basename(video))[0]
    out_dir = (params.get("outDir") or f"/tmp/wedding-analysis/{base}/montages").strip()
    frames_dir = tempfile.mkdtemp(prefix="cs_frames_")
    os.makedirs(out_dir, exist_ok=True)

    dur = _duration(video)
    if dur <= 0:
        bridge.error("Kunne ikke lese varighet (ffprobe)"); sys.exit(1)
    stamps = list(range(0, int(dur), interval))
    if dry_run:
        bridge.result({"wouldExtract": len(stamps), "durationSec": round(dur, 1), "outDir": out_dir}); return

    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        bridge.error("Pillow mangler — pip install pillow i venv-py312"); sys.exit(1)

    bridge.progress(5, 100, f"Trekker ut {len(stamps)} frames…")

    def extract(ts: int) -> str | None:
        fp = os.path.join(frames_dir, f"f_{ts:06d}.jpg")
        try:
            subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-ss", str(ts),
                            "-i", video, "-frames:v", "1", "-vf", f"scale={width}:-1", fp],
                           capture_output=True, timeout=30)
            return fp if os.path.isfile(fp) else None
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=6) as ex:
        got = [f for f in ex.map(extract, stamps) if f]

    bridge.progress(60, 100, "Bygger kontaktark…")
    font = None
    for fc in FONT_CANDIDATES:
        if os.path.isfile(fc):
            try: font = ImageFont.truetype(fc, 15); break
            except Exception: pass
    if font is None: font = ImageFont.load_default()

    got.sort()
    TW = width; TH = int(width * 9 / 16); LH = 20
    COLS, ROWS = 5, 6; PER = COLS * ROWS; cellH = TH + LH
    def mmss(t): return f"{t//60}:{t%60:02d}"
    sheets = 0
    for s in range(0, len(got), PER):
        chunk = got[s:s+PER]
        sheet = Image.new("RGB", (COLS*TW, ROWS*cellH), (12, 14, 22))
        d = ImageDraw.Draw(sheet)
        for j, fp in enumerate(chunk):
            ts = int(os.path.basename(fp)[2:8]); r, c = divmod(j, COLS); x, y = c*TW, r*cellH
            try: sheet.paste(Image.open(fp).convert("RGB").resize((TW, TH)), (x, y+LH))
            except Exception: pass
            d.rectangle([x, y, x+TW, y+LH], fill=(0, 0, 0))
            d.text((x+4, y+2), f"{mmss(ts)}  #{ts//interval}", fill=(255, 220, 120), font=font)
        sheet.save(os.path.join(out_dir, f"montage_{sheets:02d}.jpg"), quality=80)
        sheets += 1

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({"frames": len(got), "sheets": sheets, "outDir": out_dir,
                   "intervalSec": interval, "durationSec": round(dur, 1)})


if __name__ == "__main__":
    bridge.main_guard(run)
