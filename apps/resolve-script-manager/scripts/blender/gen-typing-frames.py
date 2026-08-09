"""
gen-typing-frames.py — pre-generer skjerm-bilder for skrive-animasjon (system
python3 + PIL; Blenders innebygde Python har ikke PIL). Hvert bilde = basis-
skjermbildet + et tekstfelt som bygges opp tegn-for-tegn. Blender-scriptet
(render-device-scene.py --screendir) bytter tekstur per frame.

Kjør:
  python3 gen-typing-frames.py --text "Hei" --frames 36 --out <dir> [--base shot.png]
"""
import sys, os, math
from PIL import Image, ImageDraw, ImageFont

argv = sys.argv[1:]
def arg(flag, default=None):
    return argv[argv.index(flag) + 1] if flag in argv else default

TEXT = arg('--text', '')
FRAMES = int(arg('--frames', '36'))
OUT = arg('--out', '/tmp/typing-frames')
BASE = arg('--base', None)
OSK = '--osk' in argv  # tegn on-screen-tastatur (telefon/tablet)
KEYPOP = '--keypop' in argv  # tast svever opp idet man taster
os.makedirs(OUT, exist_ok=True)


def load_font(px):
    for p in ('/System/Library/Fonts/Helvetica.ttc',
              '/System/Library/Fonts/Supplemental/Arial.ttf',
              '/Library/Fonts/Arial.ttf'):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, px)
            except Exception:
                pass
    return ImageFont.load_default()


# Basis-skjermbilde (eller en nøytral gradient om ingen gitt).
if BASE and os.path.exists(BASE):
    base = Image.open(BASE).convert('RGB')
else:
    base = Image.new('RGB', (900, 1200))
    bd = ImageDraw.Draw(base)
    for y in range(base.height):
        t = y / base.height
        bd.line([(0, y), (base.width, y)], fill=(int(15 + 40 * t), int(23 + 30 * t), int(42 + 90 * t)))

W, H = base.size
fh = max(28, int(H * 0.045))
font = load_font(fh)


def _char_weight(ch, i):
    w = 1.0
    if ch == ' ': w = 2.4
    elif ch in '.!?': w = 3.2
    elif ch in ',;:': w = 1.9
    if i < 3: w *= 1.35
    w *= 0.82 + 0.36 * (((i * 2654435761) % 97) / 97)
    return w


def _schedule(text):
    cum = [0.0]; s = 0.0
    for i, ch in enumerate(text):
        s += _char_weight(ch, i); cum.append(s)
    total = s or 1.0
    return [c / total for c in cum]


_CUM = _schedule(TEXT)


def state_at(t):
    """Humanisert (matcher keyboardAnim.ts): (typed, next, sub) — next = tegnet som skrives NÅ."""
    n = len(TEXT)
    if n == 0:
        return '', None, 1.0
    lt = min(1.0, max(0.0, t) / 0.96)
    count = 0
    while count < n and _CUM[count + 1] <= lt:
        count += 1
    nxt = TEXT[count] if count < n else None
    sub = 0.0 if count >= n else max(0.0, min(1.0, (lt - _CUM[count]) / max(1e-6, _CUM[count + 1] - _CUM[count])))
    return TEXT[:count], nxt, sub


OSK_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']


def draw_keyboard(d, W, H, pressed):
    """iOS-stil on-screen-tastatur nederst; highlighter trykt tast. Returnerer kb-topp (frac)."""
    kb_top = 0.62
    kb_y = int(kb_top * H)
    kb_h = H - kb_y
    d.rectangle([0, kb_y, W, H], fill=(28, 28, 30))
    p = pressed.lower() if pressed else None
    key_pad = int(W * 0.008)
    row_h = kb_h / 4.6
    kfont = load_font(int(row_h * 0.42))
    for r, chars in enumerate(OSK_ROWS):
        n = len(chars)
        inset = int(W * 0.05) if r == 1 else int(W * 0.10) if r == 2 else 0
        avail = W - inset * 2 - key_pad * (n + 1)
        kw = avail / n
        kh = int(row_h * 0.82)
        ky = kb_y + key_pad + int(r * row_h)
        for c, ch in enumerate(chars):
            kx = int(inset + key_pad + c * (kw + key_pad))
            hot = (p == ch)
            d.rounded_rectangle([kx, ky, int(kx + kw), ky + kh], radius=int(kh * 0.16),
                                fill=(59, 130, 246) if hot else (74, 74, 77))
            d.text((int(kx + kw / 2), ky + kh // 2), ch.upper(), font=kfont, fill=(255, 255, 255), anchor='mm')
    # mellomrom-rad
    ky = kb_y + key_pad + int(3 * row_h)
    kh = int(row_h * 0.82)
    sp_x = int(W * 0.22)
    sp_w = int(W * 0.56)
    d.rounded_rectangle([sp_x, ky, sp_x + sp_w, ky + kh], radius=int(kh * 0.16),
                        fill=(59, 130, 246) if p == ' ' else (74, 74, 77))
    return kb_top


for i in range(1, FRAMES + 1):
    t = 0.0 if FRAMES <= 1 else (i - 1) / (FRAMES - 1)
    im = base.copy()
    d = ImageDraw.Draw(im)
    typed, nxt, sub = state_at(t)
    pad = int(W * 0.05)
    fieldh = int(fh * 1.6)
    if OSK:
        kb_top = draw_keyboard(d, W, H, nxt)
        fy = int((kb_top - 0.11) * H)  # feltet rett over tastaturet
    else:
        fy = int(H * 0.44)
    fw = W - pad * 2
    d.rounded_rectangle([pad, fy, pad + fw, fy + fieldh], radius=int(fh * 0.3), fill=(255, 255, 255))
    tx = pad + int(pad * 0.4)
    ty = fy + fieldh // 2
    d.text((tx, ty), typed, font=font, fill=(11, 18, 32), anchor='lm')
    # caret (blink)
    if (math.floor(t * max(1, len(TEXT)) * 2) % 2) == 0 and t < 1:
        cw = d.textlength(typed, font=font)
        cx = tx + int(cw) + 3
        d.rectangle([cx, fy + int(fh * 0.35), cx + max(2, int(W * 0.004)), fy + fieldh - int(fh * 0.35)], fill=(37, 99, 235))
    # keyPop: tasten som trykkes svever opp + fader (RGBA-overlay for alpha).
    if KEYPOP and nxt is not None and nxt != ' ' and t < 1:
        rise = sub
        s = int(min(W, H) * 0.11 * (0.9 + rise * 0.3))
        baseY = (0.58 if OSK else 0.40) * H
        cy = int(baseY - rise * H * 0.16); cx2 = W // 2
        alpha = int(max(0, 1 - rise) * 255)
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        od.rounded_rectangle([cx2 - s // 2, cy - s // 2, cx2 + s // 2, cy + s // 2], radius=int(s * 0.18), fill=(255, 255, 255, alpha))
        kf = load_font(int(s * 0.56))
        od.text((cx2, cy), nxt.upper(), font=kf, fill=(11, 18, 32, alpha), anchor='mm')
        im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
    im.save(os.path.join(OUT, f'screen_{i:04d}.png'))

print(f'FERDIG {FRAMES} typing-frames -> {OUT}')
