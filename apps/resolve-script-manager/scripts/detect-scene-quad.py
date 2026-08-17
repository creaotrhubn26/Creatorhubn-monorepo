"""
detect-scene-quad.py — auto-detekter skjerm-quaden i et lifestyle-scene-bilde
(største SVARTE region) og skriv ut hjørnene (TL,TR,BR,BL) relativt (0..1) +
aspect. Mater rett inn i MOCKUP_SCENES (mockupScenes.ts).

Metoden: nedskaler → terskel mørke piksler → BFS-labeling (4-nabo) → største
komponent → hjørne-ekstremer (håndterer perspektiv-warpet, konveks quad).

Kjør:  python3 detect-scene-quad.py <bilde.jpg> [--thresh 45]
Ut:    JSON {"aspect": W/H, "screen": [[TLx,TLy],[TRx,TRy],[BRx,BRy],[BLx,BLy]]}
"""
import sys, json
from collections import deque
import numpy as np
from PIL import Image

if len(sys.argv) < 2:
    print('bruk: detect-scene-quad.py <bilde> [--thresh N]', file=sys.stderr); sys.exit(1)
path = sys.argv[1]
thresh = int(sys.argv[sys.argv.index('--thresh') + 1]) if '--thresh' in sys.argv else 45

im = Image.open(path).convert('RGB')
W0, H0 = im.size
scale = 400 / W0
sm = im.resize((400, max(1, round(H0 * scale))))
a = np.asarray(sm, dtype=np.float32)
luma = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
mask = luma < thresh
H, W = mask.shape

# BFS-labeling (4-nabo) → finn største mørke komponent.
seen = np.zeros_like(mask, dtype=bool)
best = []
for y in range(H):
    for x in range(W):
        if mask[y, x] and not seen[y, x]:
            comp = []
            q = deque([(y, x)]); seen[y, x] = True
            while q:
                cy, cx = q.popleft(); comp.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            if len(comp) > len(best):
                best = comp

if len(best) < (W * H) * 0.01:
    print(json.dumps({'error': 'fant ingen tydelig svart skjerm-region'}), file=sys.stderr); sys.exit(2)

pts = np.array(best, dtype=np.float32)  # (row=y, col=x)
ys, xs = pts[:, 0], pts[:, 1]
s, d = xs + ys, xs - ys
tl = (xs[np.argmin(s)], ys[np.argmin(s)])   # min x+y
br = (xs[np.argmax(s)], ys[np.argmax(s)])   # max x+y
tr = (xs[np.argmax(d)], ys[np.argmax(d)])   # max x-y
bl = (xs[np.argmin(d)], ys[np.argmin(d)])   # min x-y

def rel(p):
    return [round(float(p[0]) / W, 4), round(float(p[1]) / H, 4)]

print(json.dumps({'aspect': round(W0 / H0, 4), 'screen': [rel(tl), rel(tr), rel(br), rel(bl)]}))
