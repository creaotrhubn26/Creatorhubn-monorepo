from PIL import Image, ImageDraw, ImageFilter
import math

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# ---- Bakgrunn: mørk navy vertikal gradient (CreatorHub) i en squircle ----
top = (16, 22, 38)      # #101626
bot = (10, 14, 24)      # #0a0e18
grad = Image.new("RGBA", (S, S), (0, 0, 0, 255))
gpx = grad.load()
for y in range(S):
    t = y / (S - 1)
    r = int(top[0] + (bot[0]-top[0]) * t)
    g = int(top[1] + (bot[1]-top[1]) * t)
    b = int(top[2] + (bot[2]-top[2]) * t)
    for x in range(S):
        gpx[x, y] = (r, g, b, 255)

# squircle-maske (avrundet firkant med liten marg)
margin = 44
radius = 224
mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([margin, margin, S-margin, S-margin], radius=radius, fill=255)
img.paste(grad, (0, 0), mask)

# subtil indre topp-glød (oransje) for varme
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([S*0.18, -S*0.28, S*0.82, S*0.36], fill=(255, 140, 0, 46))
glow = glow.filter(ImageFilter.GaussianBlur(70))
img = Image.alpha_composite(img, Image.composite(glow, Image.new("RGBA",(S,S),(0,0,0,0)), mask))

draw = ImageDraw.Draw(img)

# ---- Pro Tools-aktige audio-mix-bars (oransje), symmetrisk waveform ----
heights = [0.34, 0.52, 0.72, 0.90, 1.0, 0.90, 0.72, 0.52, 0.34]
n = len(heights)
bar_w = 58
gap = 30
total_w = n * bar_w + (n - 1) * gap
x0 = (S - total_w) // 2
cy = int(S * 0.52)
max_h = int(S * 0.50)

o_top = (255, 178, 71)   # #ffb247
o_bot = (255, 124, 0)    # #ff7c00

for i, h in enumerate(heights):
    bh = int(max_h * h)
    bx = x0 + i * (bar_w + gap)
    by0 = cy - bh // 2
    by1 = cy + bh // 2
    # per-bar vertikal gradient
    bar = Image.new("RGBA", (bar_w, bh), (0,0,0,0))
    bpx = bar.load()
    for yy in range(bh):
        tt = yy / max(1, bh-1)
        r = int(o_top[0] + (o_bot[0]-o_top[0]) * tt)
        g = int(o_top[1] + (o_bot[1]-o_top[1]) * tt)
        b = int(o_top[2] + (o_bot[2]-o_top[2]) * tt)
        for xx in range(bar_w):
            bpx[xx, yy] = (r, g, b, 255)
    bmask = Image.new("L", (bar_w, bh), 0)
    ImageDraw.Draw(bmask).rounded_rectangle([0,0,bar_w-1,bh-1], radius=bar_w//2, fill=255)
    img.paste(bar, (bx, by0), bmask)

# ---- Transport-playhead: tynn lys linje + trekant øverst (DAW-signal) ----
draw = ImageDraw.Draw(img)
ph_x = x0 + 4 * (bar_w + gap) + bar_w // 2  # midtbaren
ln_top = int(S*0.16); ln_bot = int(S*0.86)
draw.line([(ph_x, ln_top), (ph_x, ln_bot)], fill=(255, 255, 255, 38), width=4)
tri = 26
draw.polygon([(ph_x-tri, ln_top-6), (ph_x+tri, ln_top-6), (ph_x, ln_top+22)], fill=(255,255,255,210))

# tynn indre kant for skarphet
ImageDraw.Draw(img).rounded_rectangle([margin, margin, S-margin, S-margin], radius=radius, outline=(255,255,255,18), width=3)

img.save("/tmp/ptc_icon_1024.png")
print("lagret /tmp/ptc_icon_1024.png", img.size)
