#!/usr/bin/env python3
"""Render branded 1080x1080 marketing posters from real app screenshots.

Usage:
    python3 render-posters.py --out ./out [--canvas 1080x1080]

Pipeline: download webfonts once -> emit one self-contained HTML per post ->
screenshot each with Chromium's headless_shell at exact canvas size.

Why headless_shell and not chrome: `chrome --window-size=1080,1080` renders a
1080x993 viewport, so anything anchored to the bottom gets clipped.

See SKILL.md for asset locations, brand tokens and the review checklist.
"""
from __future__ import annotations

import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.request

REPO_ASSETS = pathlib.Path(
    "frontend/client/public/leadgrid"
)  # relative to monorepo root

SHELL_CANDIDATES = [
    "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
]

FONT_SPECS = [("Sora", 700), ("Sora", 800), ("Manrope", 500), ("Manrope", 600)]
UA = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Brand tokens — source: frontend/client/src/pages/leadgrid-landing.tsx PALETTE
BRAND = dict(bg="#0b0518", deep="#050211", accent="#A78BFA",
             bright="#C084FC", text="#F4F0FF", muted="#C4B9E4")

# One entry per post. `shot` is a path under frontend/client/public/leadgrid/.
# card = (left, top, width, height) of the floating screenshot card.
# img  = (width, left, top) of the <img> inside that card — this is the crop.
POSTS = [
    dict(
        name="01-markedsskann",
        shot="app/oversikt.png",
        eyebrow="Markedsskann",
        h1='Slutt å lure på<br><span class="hl">hvor kundene er</span>',
        sub="Leadgrid skanner Brønnøysundregistrene og Google Places, "
            "og plotter bedriftene rett inn på kartet ditt.",
        tag="Brønnøysund · SSB · Kartverket",
        alt="Leadgrid markedsskann med leads som pins på kart",
        card=(600, 300, 600, 720), img=(680, -70, -20), subw=430,
    ),
    dict(
        name="02-omrader",
        shot="app/team.png",
        eyebrow="Områder & team",
        h1='Alle vet hvem som<br>har <span class="hl">hvilket område</span>',
        sub="Tegn territoriene på kartet og tildel dem. Da slipper dere "
            "diskusjonen om hvem som egentlig tok den kunden.",
        tag="Områder hentet fra Kartverket",
        alt="Leadgrid territoriekart med områder tildelt hver selger",
        card=(600, 300, 600, 720), img=(650, -25, -30), subw=430,
    ),
]

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:__DEEP__}
.slide{width:__W__px;height:__H__px;position:relative;overflow:hidden;background:__BG__;
  color:__TEXT__;font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased}
.ground{position:absolute;inset:0;z-index:1;background:
  radial-gradient(1150px 850px at 84% -10%, rgba(167,139,250,.38), transparent 62%),
  radial-gradient(720px 600px at -12% 104%, rgba(124,107,196,.22), transparent 64%),
  linear-gradient(166deg,#180d34 0%,__BG__ 50%,__DEEP__ 100%)}
.mesh{position:absolute;inset:0;z-index:2;opacity:.5;
  background-image:linear-gradient(rgba(244,240,255,.05) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(244,240,255,.05) 1px,transparent 1px);
  background-size:62px 62px;
  -webkit-mask-image:radial-gradient(760px 700px at 24% 30%,#000 10%,transparent 72%)}
.glow{position:absolute;z-index:3;border-radius:50%;filter:blur(64px);
  background:radial-gradient(closest-side,rgba(167,139,250,.50),transparent 74%)}
.shot{position:absolute;z-index:4;overflow:hidden;border-radius:22px;background:#0e0722;
  border:1px solid rgba(192,132,252,.34);
  box-shadow:0 44px 90px rgba(0,0,0,.72), 0 0 0 7px rgba(167,139,250,.07)}
.shot img{position:absolute;display:block}
.shot::after{content:"";position:absolute;inset:0;border-radius:22px;pointer-events:none;
  background:linear-gradient(124deg,rgba(255,255,255,.13),rgba(255,255,255,.02) 28%,transparent 52%)}
.scrim{position:absolute;left:0;right:0;bottom:0;height:270px;z-index:5;
  background:linear-gradient(180deg,rgba(5,2,17,0),rgba(5,2,17,.82) 58%,rgba(5,2,17,.96))}
.pad{position:absolute;inset:0;padding:72px;z-index:8}
.lockup{display:flex;align-items:center;gap:18px}
.logo{width:62px;height:62px;border-radius:14px;flex:none;display:block;
  filter:drop-shadow(0 10px 22px rgba(124,58,237,.5))}
.word{font-family:'Sora';font-weight:800;font-size:38px;letter-spacing:-1.2px;line-height:1}
.eyebrow{margin-top:48px;display:inline-block;padding:10px 21px;border-radius:999px;
  background:rgba(167,139,250,.15);border:1px solid rgba(192,132,252,.42);color:#DCCCFF;
  font-weight:700;font-size:18px;letter-spacing:.09em;text-transform:uppercase}
h1{margin-top:24px;font-family:'Sora';font-weight:800;font-size:56px;line-height:1.06;
  letter-spacing:-1.9px;max-width:486px}
h1 .hl{background:linear-gradient(96deg,__BRIGHT__,#A855F7 52%,#E879F9);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:22px;font-weight:500;font-size:25px;line-height:1.46;color:__MUTED__}
.foot{position:absolute;left:72px;right:72px;bottom:70px;z-index:9;display:flex;
  align-items:center;justify-content:space-between;gap:20px;
  border-top:1px solid rgba(244,240,255,.18);padding-top:24px}
.foot .url{font-family:'Sora';font-weight:700;font-size:24px;letter-spacing:-.3px}
.foot .tag{font-weight:600;font-size:19px;color:#BCB1DE;text-align:right}
"""

PAGE = """<!doctype html><html lang=no><head><meta charset=utf-8><style>
{faces}{css}
.glow{{left:{gl}px;top:{gt}px;width:{gw}px;height:{gh}px}}
.shot{{left:{cl}px;top:{ct}px;width:{cw}px;height:{ch}px;
  transform:perspective(1800px) rotateY(-13deg) rotateX(2deg) rotateZ(-1deg)}}
.shot img{{width:{iw}px;left:{il}px;top:{it}px}}
.sub{{max-width:{subw}px}}
</style></head><body>
<div class="slide">
  <div class="ground"></div><div class="mesh"></div><div class="glow"></div>
  <div class="shot"><img src="{shot}" alt="{alt}"></div>
  <div class="scrim"></div>
  <div class="pad">
    <div class="lockup"><img class="logo" src="{logo}" alt="Leadgrid">
      <span class="word">Leadgrid</span></div>
    <span class="eyebrow">{eyebrow}</span>
    <h1>{h1}</h1>
    <p class="sub">{sub}</p>
  </div>
  <div class="foot"><span class="url">leadgrid.no</span><span class="tag">{tag}</span></div>
</div></body></html>"""


def fetch(url: str) -> bytes:
    return urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=30
    ).read()


def ensure_fonts(font_dir: pathlib.Path) -> str:
    """Download the latin subset of each weight; return @font-face rules."""
    font_dir.mkdir(parents=True, exist_ok=True)
    faces = []
    for family, weight in FONT_SPECS:
        target = font_dir / f"{family}-{weight}.woff2"
        if not target.exists():
            css = fetch(
                f"https://fonts.googleapis.com/css2?family={family}"
                f":wght@{weight}&display=swap"
            ).decode()
            blocks = re.split(r"/\*\s*([a-z0-9\-]+)\s*\*/", css)
            url = None
            for i in range(1, len(blocks), 2):
                if blocks[i].strip() == "latin":
                    match = re.search(r"url\((https://[^)]+\.woff2)\)", blocks[i + 1])
                    if match:
                        url = match.group(1)
            if not url:  # no latin block — fall back to the last face offered
                found = re.findall(r"url\((https://[^)]+\.woff2)\)", css)
                if not found:
                    sys.exit(f"no woff2 for {family} {weight}")
                url = found[-1]
            target.write_bytes(fetch(url))
        faces.append(
            f"@font-face{{font-family:'{family}';src:url({target.resolve()}) "
            f"format('woff2');font-weight:{weight};font-display:block}}"
        )
    return "".join(faces)


def find_shell() -> str:
    for path in SHELL_CANDIDATES:
        if pathlib.Path(path).exists():
            return path
    found = shutil.which("chromium") or shutil.which("google-chrome")
    if found:
        return found
    sys.exit("no chromium binary found; see SKILL.md §3")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out", type=pathlib.Path)
    ap.add_argument("--assets", default=REPO_ASSETS, type=pathlib.Path,
                    help="path to frontend/client/public/leadgrid")
    ap.add_argument("--canvas", default="1080x1080")
    args = ap.parse_args()

    width, height = (int(v) for v in args.canvas.lower().split("x"))
    out = args.out
    build = out / "html"
    build.mkdir(parents=True, exist_ok=True)

    assets = args.assets.resolve()
    if not (assets / "logo.png").exists():
        sys.exit(f"brand assets not found under {assets} — pass --assets")

    faces = ensure_fonts(out / "fonts")
    css = CSS
    for key, value in [("__W__", width), ("__H__", height), ("__BG__", BRAND["bg"]),
                       ("__DEEP__", BRAND["deep"]), ("__TEXT__", BRAND["text"]),
                       ("__BRIGHT__", BRAND["bright"]), ("__MUTED__", BRAND["muted"])]:
        css = css.replace(key, str(value))

    shell = find_shell()
    for post in POSTS:
        cl, ct, cw, ch = post["card"]
        iw, il, it = post["img"]
        page = PAGE.format(
            faces=faces, css=css,
            gl=cl - 40, gt=ct - 30, gw=cw + 80, gh=ch - 60,
            cl=cl, ct=ct, cw=cw, ch=ch, iw=iw, il=il, it=it,
            subw=post["subw"],
            shot=(assets / post["shot"]).resolve(),
            logo=(assets / "logo.png").resolve(),
            alt=post["alt"], eyebrow=post["eyebrow"], h1=post["h1"],
            sub=post["sub"], tag=post["tag"],
        )
        html_path = build / f"{post['name']}.html"
        html_path.write_text(page, encoding="utf-8")
        png_path = out / f"{post['name']}.png"
        subprocess.run(
            [shell, "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
             "--force-device-scale-factor=1", f"--window-size={width},{height}",
             "--virtual-time-budget=6000", f"--screenshot={png_path}",
             f"file://{html_path.resolve()}"],
            check=True, capture_output=True,
        )
        print("rendered", png_path)

    print("\nNow LOOK at every PNG — see SKILL.md §7 for the four recurring bugs.")


if __name__ == "__main__":
    main()
