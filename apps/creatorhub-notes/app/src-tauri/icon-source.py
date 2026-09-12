"""Lager icon-source.png — kilden `tauri icon` genererer resten fra.

Merket er notatets eget: fire tekstlinjer, én markert. Samme grep som
søketreffet i appen, samme palett som styles.css.

    python3 icon-source.py && npm run tauri icon src-tauri/icon-source.png
"""

from PIL import Image, ImageDraw

S = 1024
GROUND = (25, 29, 28, 255)  # --paper mørk
ACCENT = (87, 183, 160, 255)  # --accent mørk
INK = (227, 232, 230, 255)  # --ink mørk

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([40, 40, S - 40, S - 40], radius=224, fill=255)
img.paste(Image.new("RGBA", (S, S), GROUND), (0, 0), mask)

draw = ImageDraw.Draw(img)

# Fire linjer tekst. Den andre er treffet: full metning, litt bredere plate.
left, top, height, gap, radius = 208, 300, 68, 52, 34
widths = [0.78, 0.92, 0.62, 0.44]
for i, w in enumerate(widths):
    y = top + i * (height + gap)
    x2 = left + int((S - 2 * left) * w) + 100
    if i == 1:
        draw.rounded_rectangle([left - 34, y - 22, x2 + 34, y + height + 22], radius=28, fill=(87, 183, 160, 46))
        draw.rounded_rectangle([left, y, x2, y + height], radius=radius, fill=ACCENT)
    else:
        draw.rounded_rectangle([left, y, x2, y + height], radius=radius, fill=INK)

img.save("icon-source.png")
print("skrev icon-source.png")
