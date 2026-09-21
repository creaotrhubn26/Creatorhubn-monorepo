#!/usr/bin/env python3
"""Emit the Leadgrid poster series as editable Mockup Studio projects.

One MockupDoc per post: canvas + text slots + image slots, so every headline
can be retyped and every screenshot swapped inside Mockup Studio — instead of
handing over flat PNGs.

Schema: apps/resolve-script-manager/src/components/mockup-studio/mockupStudioModel.ts
  MockupDoc { id, name, version:1, template, canvas, devices[], texts[], images[], updatedAt }
Images must be data: / http(s): / /assets/ — local paths are rejected server-side,
so every layer is embedded as a data URI. Cap is 6.5 MB per project.
"""
import base64, json, os, pathlib, re, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from poster_series import POSTS  # noqa: E402
from export_layers import frame_box  # noqa: E402

# assets/, fonts/, layers/ and output land here; default is CWD
ROOT = pathlib.Path(os.environ.get("LEADGRID_WORK", ".")).resolve()
OUT = ROOT / "mockups"
OUT.mkdir(exist_ok=True)

ACCENT, ACCENT2 = "#A78BFA", "#C084FC"
WHITE, MUTED = "#F4F0FF", "#C4B9E4"


def data_uri(path: pathlib.Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def plain(html: str) -> list[str]:
    """'Alle får med seg<br><span class="hl">det som funker</span>' -> two lines,
    flagged for which line carries the accent colour."""
    parts = re.split(r"<br\s*/?>", html)
    out = []
    for part in parts:
        accent = 'class="hl"' in part
        out.append((re.sub(r"<[^>]+>", "", part).strip(), accent))
    return out


def text(tid, role, body, x, y, w, size, *, color=WHITE, weight=600,
         line_height=1.1, tracking=0, upper=False, align="left"):
    return dict(id=tid, role=role, text=body, x=x, y=y, w=w, size=size,
                weight=weight, color=color, align=align, lineHeight=line_height,
                tracking=tracking, uppercase=upper)


def image(iid, path, x, y, w, h, *, radius=0, fit="cover", alt=""):
    return dict(id=iid, image=data_uri(path), x=x, y=y, w=w, h=h, radius=radius,
                fit=fit, rotation=0, shadow=radius > 0, altText=alt)


def build(post):
    name = post["name"]
    detail = ROOT / "layers" / f"{name}-detail.png"
    logo = ROOT / "assets/logo.png"
    images, texts = [], []

    # background bed (photo variants only) must sit first — z-order is array order
    if post.get("photo"):
        images.append(image(f"{name}-bg", ROOT / "layers" / f"{name}-bg.png",
                            0, 0, 1080, 1350, alt="Bakgrunnsfoto"))

    # where the detail image sits, and where the copy block starts under it
    fw, fh, _, _, _ = frame_box(post)
    if post["variant"] == "A":
        images.append(image(f"{name}-detail", detail, 0, 0, fw, fh,
                            alt=post["alt"]))
        copy_y = fh + 46
    elif post["variant"] == "B":
        images.append(image(f"{name}-detail", detail, 1036 - fw, 292, fw, fh,
                            radius=20, alt=post["alt"]))
        copy_y = 862
    else:  # C — wide band anchored above the footer
        images.append(image(f"{name}-detail", detail, 0, 1090 - fh, fw, fh,
                            alt=post["alt"]))
        copy_y = 200

    images.append(image(f"{name}-logo", logo, 68, 64, 58, 58, radius=13,
                        alt="Leadgrid-logo"))
    texts.append(text(f"{name}-word", "tag", "Leadgrid", 142, 76, 400, 35,
                      weight=800, line_height=1))

    texts.append(text(f"{name}-eyebrow", "eyebrow", post["eyebrow"], 68, copy_y,
                      600, 17, color=ACCENT2, weight=700, tracking=0.09,
                      upper=True))

    y = copy_y + 48
    for i, (line, accent) in enumerate(plain(post["h1"])):
        texts.append(text(f"{name}-title-{i}", "title", line, 68, y, 940, 58,
                          color=ACCENT2 if accent else WHITE, weight=800,
                          line_height=1.05, tracking=-0.03))
        y += 61

    y += 16
    texts.append(text(f"{name}-body", "body", post["sub"], 68, y, 880, 24,
                      color=MUTED, weight=500, line_height=1.45))

    y += 40 + 34 * (len(post["sub"]) // 52)
    texts.append(text(f"{name}-cta", "tag", f"{post['cta']}  →", 68, y, 520, 24,
                      color=ACCENT2, weight=700))

    texts.append(text(f"{name}-url", "tag", "leadgrid.no", 68, 1258, 400, 23,
                      weight=700))
    texts.append(text(f"{name}-meta", "tag", post["tag"], 600, 1262, 412, 18,
                      color=MUTED, weight=600, align="right"))

    return dict(
        id=f"leadgrid-{name}", name=f"Leadgrid — {post['eyebrow']}",
        version=1, template="leadgrid-post",
        canvas=dict(w=1080, h=1350, accent=ACCENT, accent2=ACCENT2,
                    background="dark", bgStyle="gradient", bgColor="#0b0518"),
        devices=[], texts=texts, images=images,
        updatedAt=int(time.time() * 1000), status="draft",
    )


def main():
    docs = []
    for post in POSTS:
        doc = build(post)
        blob = json.dumps(doc, ensure_ascii=False)
        size = len(blob.encode()) / 1024 / 1024
        if size > 6.0:
            print(f"  ! {doc['id']} is {size:.1f} MB — over the 6.5 MB cap")
        (OUT / f"{doc['id']}.json").write_text(blob, encoding="utf-8")
        docs.append(doc)
        print(f"{doc['id']:34s} {size:.2f} MB  "
              f"{len(doc['texts'])} tekst / {len(doc['images'])} bilde")
    (OUT / "leadgrid-alle-prosjekter.json").write_text(
        json.dumps(docs, ensure_ascii=False), encoding="utf-8")
    total = sum((OUT / f"{d['id']}.json").stat().st_size for d in docs)
    print(f"\n{len(docs)} prosjekter, {total / 1024 / 1024:.1f} MB totalt")


if __name__ == "__main__":
    main()
