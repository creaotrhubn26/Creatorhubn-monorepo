#!/usr/bin/env python3
"""Export the poster layers as standalone images, so each one can become an
editable image slot in a Mockup Studio project.

Produces, per post:
  layers/<name>-detail.png   the cropped UI element (what the poster zooms into)
  layers/<name>-bg.png       only for photo-backed posts: the graded photo bed

Chromium is also the resizer here — there is no PIL/ImageMagick in this box.
"""
import os
import pathlib, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from poster_series import POSTS, place, src_width  # noqa: E402

# assets/, fonts/, layers/ and output land here; default is CWD
ROOT = pathlib.Path(os.environ.get("LEADGRID_WORK", ".")).resolve()
LAYERS = ROOT / "layers"
LAYERS.mkdir(exist_ok=True)
TMP = ROOT / "build/layers"
TMP.mkdir(parents=True, exist_ok=True)
SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"

# Target size for each exported detail. Wide/short elements get a wide, short
# image; the aspect always follows the crop so nothing is stretched.
DETAIL_W = 1080


def shoot(html: str, out: pathlib.Path, w: int, h: int) -> None:
    page = TMP / (out.stem + ".html")
    page.write_text(html, encoding="utf-8")
    subprocess.run(
        [SHELL, "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--force-device-scale-factor=1", f"--window-size={w},{h}",
         "--virtual-time-budget=8000", f"--screenshot={out}",
         f"file://{page.resolve()}"],
        check=True, capture_output=True)


def frame_box(post):
    """The box this detail occupies in the poster — layer is exported at exactly
    this size so Mockup Studio's fit:cover is a no-op instead of a crop."""
    if post["variant"] == "A":
        w, lo, hi = 1080, 260, 812
    elif post["variant"] == "B":
        w, lo, hi = 470, 240, 430
    else:
        w, lo, hi = 1080, 340, 480
    scale, h, ox, oy = place(post["crop"], w, lo, hi)
    return w, h, scale, ox, oy


def export_detail(post) -> None:
    DETAIL_W, h, s, ox, oy = frame_box(post)
    shot = (ROOT / "assets" / post["shot"]).resolve()
    # variant A runs to the top edge, where the lockup sits on top of it
    scrim = '<div class="scrim"></div>' if post["variant"] == "A" else ""
    html = f"""<!doctype html><html><head><meta charset=utf-8><style>
*{{margin:0;padding:0}}html,body{{background:#0b0518}}
.f{{position:relative;width:{DETAIL_W}px;height:{h}px;overflow:hidden;background:#0e0722}}
.f img{{position:absolute;display:block;width:{src_width(post) * s:.0f}px;
  left:{ox:.0f}px;top:{oy:.0f}px}}
.scrim{{position:absolute;left:0;right:0;top:0;height:210px;
  background:linear-gradient(180deg,rgba(6,2,17,.92),rgba(6,2,17,.55) 46%,transparent)}}
</style></head><body><div class="f"><img src="{shot}">{scrim}</div></body></html>"""
    shoot(html, LAYERS / f"{post['name']}-detail.png", DETAIL_W, h)


def export_bg(post) -> None:
    """The graded photo bed for the photo-backed variants, flattened to one image."""
    pw, pl, pt = post["photo_fit"]
    photo = (ROOT / "assets" / post["photo"]).resolve()
    html = f"""<!doctype html><html><head><meta charset=utf-8><style>
*{{margin:0;padding:0}}html,body{{background:#0b0518}}
.s{{position:relative;width:1080px;height:1350px;overflow:hidden;background:#0b0518}}
.p{{position:absolute;inset:0;overflow:hidden}}
.p img{{position:absolute;display:block;width:{pw}px;left:{pl}px;top:{pt}px;
  filter:saturate(.80) brightness(.80) contrast(1.05)}}
.v{{position:absolute;inset:0;mix-blend-mode:color;opacity:.46;
  background:linear-gradient(200deg,#8B5CF6,#5B21B6 60%,#2E1065)}}
.d{{position:absolute;inset:0;background:
  linear-gradient(112deg,rgba(6,2,17,.93) 0%,rgba(6,2,17,.76) 34%,rgba(6,2,17,.22) 62%,rgba(6,2,17,.05) 82%),
  linear-gradient(180deg,rgba(6,2,17,.55) 0%,transparent 30%,rgba(5,2,17,.92) 88%)}}
</style></head><body><div class="s"><div class="p"><img src="{photo}"></div>
<div class="v"></div><div class="d"></div></div></body></html>"""
    shoot(html, LAYERS / f"{post['name']}-bg.png", 1080, 1350)


def main() -> None:
    for post in POSTS:
        export_detail(post)
        if post.get("photo"):
            export_bg(post)
        print("exported", post["name"])


if __name__ == "__main__":
    main()
