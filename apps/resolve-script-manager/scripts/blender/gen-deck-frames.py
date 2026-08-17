"""
gen-deck-frames.py — pre-generer laptop-tastatur-dekk-bilder for skrive-animasjon
(system python3 + PIL). Komplett Mac/Windows-layout; tasten som trykkes highlightes
per frame. render-device-scene.py (--deckdir) bytter dekk-tekstur per bilde.

Speiler Three.js `deckRows` (keyboardAnim.ts) så Blender-veien matcher live-editoren.

Kjør:  python3 gen-deck-frames.py --text "Hei" --frames 36 --out <dir> --layout mac|windows
"""
import sys, os, math
from PIL import Image, ImageDraw, ImageFont

argv = sys.argv[1:]
def arg(flag, default=None):
    return argv[argv.index(flag) + 1] if flag in argv else default

TEXT = arg('--text', '')
FRAMES = int(arg('--frames', '36'))
OUT = arg('--out', '/tmp/deck-frames')
LAYOUT = arg('--layout', 'mac')
os.makedirs(OUT, exist_ok=True)
W, H = 1024, 640


def load_font(px):
    for p in ('/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf'):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, px)
            except Exception:
                pass
    return ImageFont.load_default()


def keys(s, w=1.0):
    return [{'label': c.upper(), 'w': w, 'char': c} for c in s]


def deck_rows(layout):
    fn = [{'label': 'esc', 'w': 1.3}] + [{'label': f'F{i+1}', 'w': 1.0} for i in range(12)] + [{'label': '⌫' if layout == 'mac' else 'del', 'w': 1.1}]
    num = [{'label': '`', 'w': 1, 'char': '`'}] + keys('1234567890') + [{'label': '-', 'w': 1, 'char': '-'}, {'label': '=', 'w': 1, 'char': '='}, {'label': '⌫' if layout == 'mac' else 'Backspace', 'w': 1.9}]
    top = [{'label': 'tab', 'w': 1.5}] + keys('qwertyuiop') + [{'label': '[', 'w': 1, 'char': '['}, {'label': ']', 'w': 1, 'char': ']'}, {'label': '\\', 'w': 1.5, 'char': '\\'}]
    home = [{'label': 'caps', 'w': 1.8}] + keys('asdfghjkl') + [{'label': ';', 'w': 1, 'char': ';'}, {'label': "'", 'w': 1, 'char': "'"}, {'label': 'return' if layout == 'mac' else 'Enter', 'w': 2.2}]
    shift = [{'label': 'shift', 'w': 2.4}] + keys('zxcvbnm') + [{'label': ',', 'w': 1, 'char': ','}, {'label': '.', 'w': 1, 'char': '.'}, {'label': '/', 'w': 1, 'char': '/'}, {'label': 'shift', 'w': 2.6}]
    if layout == 'mac':
        mod = [{'label': 'fn', 'w': 1}, {'label': '⌃', 'w': 1.1}, {'label': '⌥', 'w': 1.1}, {'label': '⌘', 'w': 1.3}, {'label': '', 'w': 6, 'char': ' '}, {'label': '⌘', 'w': 1.3}, {'label': '⌥', 'w': 1.1}, {'label': '◀', 'w': 0.9}, {'label': '▲▼', 'w': 0.9}, {'label': '▶', 'w': 0.9}]
    else:
        mod = [{'label': 'Ctrl', 'w': 1.3}, {'label': '⊞', 'w': 1.1}, {'label': 'Alt', 'w': 1.1}, {'label': '', 'w': 6, 'char': ' '}, {'label': 'Alt', 'w': 1.1}, {'label': '⊞', 'w': 1.1}, {'label': '▤', 'w': 1}, {'label': 'Ctrl', 'w': 1.3}, {'label': '◀', 'w': 0.9}, {'label': '▶', 'w': 0.9}]
    return [fn, num, top, home, shift, mod]


def _char_weight(ch, i):
    w = 1.0
    if ch == ' ': w = 2.4
    elif ch in '.!?': w = 3.2
    elif ch in ',;:': w = 1.9
    if i < 3: w *= 1.35
    w *= 0.82 + 0.36 * (((i * 2654435761) % 97) / 97)  # deterministisk jitter (matcher TS)
    return w


def _schedule(text):
    cum = [0.0]; s = 0.0
    for i, ch in enumerate(text):
        s += _char_weight(ch, i); cum.append(s)
    total = s or 1.0
    return [c / total for c in cum]


_CUM = _schedule(TEXT)


def state_at(t):
    """Humanisert (matcher keyboardAnim.ts): returnerer tegnet som skrives NÅ (highlight)."""
    n = len(TEXT)
    if n == 0:
        return None
    lt = min(1.0, max(0.0, t) / 0.96)
    count = 0
    while count < n and _CUM[count + 1] <= lt:
        count += 1
    return TEXT[count].lower() if count < n else None


def draw_deck(pressed):
    im = Image.new('RGB', (W, H))
    x = ImageDraw.Draw(im)
    for y in range(H):
        c = int(32 + 11 * y / H)
        x.line([(0, y), (W, y)], fill=(c, c + 2, c + 6))
    kbX, kbY, kbW, kbH = int(W * 0.05), int(H * 0.05), int(W * 0.90), int(H * 0.90)
    x.rounded_rectangle([kbX, kbY, kbX + kbW, kbY + kbH], radius=12, fill=(19, 21, 25))
    rows = deck_rows(LAYOUT)
    row_gap = kbH * 0.014
    kpad = kbW * 0.006
    row_h = (kbH - row_gap * (len(rows) + 1)) / len(rows)
    for r, row in enumerate(rows):
        ky = kbY + row_gap + r * (row_h + row_gap)
        kh = row_h * 0.62 if r == 0 else row_h
        ky0 = ky + row_h * 0.2 if r == 0 else ky
        total = sum(k['w'] for k in row)
        avail = kbW - kpad * (len(row) + 1)
        kx = kbX + kpad
        for k in row:
            kw = (k['w'] / total) * avail
            hot = pressed is not None and k.get('char') == pressed
            r = max(3, int(kh * 0.16)); dep = max(2, int(kh * 0.09))
            # skygge/dybde under tasten
            x.rounded_rectangle([kx, ky0 + dep, kx + kw, ky0 + kh + dep], radius=r, fill=(12, 13, 16))
            # keycap-sider (mørkere base)
            x.rounded_rectangle([kx, ky0, kx + kw, ky0 + kh], radius=r, fill=(28, 30, 35))
            # keycap topp-flate (lysere, innfelt + løftet) → skulpturert taste
            ins = max(2, kw * 0.10)
            top = (60, 132, 246) if hot else (62, 66, 74)
            x.rounded_rectangle([kx + ins, ky0 + ins * 0.55, kx + kw - ins, ky0 + kh - ins * 1.5], radius=max(2, int(r * 0.7)), fill=top)
            lab = k['label']
            if lab:
                fs = kh * (0.44 if len(lab) == 1 else 0.31)
                f = load_font(max(7, int(fs)))
                while x.textlength(lab, font=f) > kw * 0.78 and fs > 6:
                    fs *= 0.9
                    f = load_font(max(7, int(fs)))
                x.text((kx + kw / 2, ky0 + kh / 2 - ins * 0.45), lab, font=f, fill=(255, 255, 255) if hot else (226, 230, 236), anchor='mm')
            kx += kw + kpad
    return im


for i in range(1, FRAMES + 1):
    t = 0.0 if FRAMES <= 1 else (i - 1) / (FRAMES - 1)
    draw_deck(state_at(t)).save(os.path.join(OUT, f'deck_{i:04d}.png'))

print(f'FERDIG {FRAMES} deck-frames -> {OUT}')
