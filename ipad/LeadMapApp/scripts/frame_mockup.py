#!/usr/bin/env python3
"""
frame_mockup.py — ramme et rått simulator-skjermbilde inn i en ren, moderne
enhets-bezel (avrundede hjørner + tynn ramme, transparent bakgrunn).

Brukes av capture-mockups.sh, men kan kjøres frittstående:
    python3 frame_mockup.py <inn.png> <ut.png> [--radius 0.09] [--bezel 14] [--color 8,8,10]

Ingen ekstern enhets-kunst nødvendig — genererer bezelen selv, så samme
script funker for iPhone, iPad og watch (juster --radius/--bezel).
Krever kun Pillow (PIL).
"""
import argparse
from PIL import Image, ImageDraw


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size[0], size[1]], radius=radius, fill=255)
    return mask


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--radius", type=float, default=0.09,
                    help="Hjørne-radius som andel av korteste side (default 0.09)")
    ap.add_argument("--bezel", type=int, default=14, help="Ramme-tykkelse i px (default 14)")
    ap.add_argument("--color", default="8,8,10", help="Bezel-farge R,G,B (default 8,8,10)")
    args = ap.parse_args()

    shot = Image.open(args.src).convert("RGBA")
    w, h = shot.size
    radius = int(min(w, h) * args.radius)

    # 1. Rund av skjermbildets hjørner.
    shot.putalpha(rounded_mask((w, h), radius))

    # 2. Legg skjermbildet på en litt større, avrundet bezel-plate.
    b = args.bezel
    bw, bh = w + 2 * b, h + 2 * b
    color = tuple(int(c) for c in args.color.split(",")) + (255,)
    bezel = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    plate = Image.new("RGBA", (bw, bh), color)
    plate.putalpha(rounded_mask((bw, bh), radius + b))
    bezel = Image.alpha_composite(bezel, plate)
    bezel.alpha_composite(shot, (b, b))

    bezel.save(args.dst)
    print(f"framed → {args.dst} ({bw}x{bh}, radius {radius}px, bezel {b}px)")


if __name__ == "__main__":
    main()
