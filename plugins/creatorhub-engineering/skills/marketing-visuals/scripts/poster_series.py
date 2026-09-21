#!/usr/bin/env python3
"""Leadgrid solution series v2 — 1080x1350 (4:5), three layout variants,
tight single-element crops, CTA on every post, demo names masked."""
import os
import pathlib

# assets/, fonts/, layers/ and output land here; default is CWD
ROOT = pathlib.Path(os.environ.get("LEADGRID_WORK", ".")).resolve()
BUILD = ROOT / "build/v2"
BUILD.mkdir(parents=True, exist_ok=True)
W, H = 1080, 1350

FONTS = {"SORA700": "fonts/Sora-700.woff2", "SORA800": "fonts/Sora-800.woff2",
         "MAN500": "fonts/Manrope-500.woff2", "MAN600": "fonts/Manrope-600.woff2",
         "MAN700": "fonts/Manrope-700.woff2"}


def place(crop, fw, min_h, max_h):
    """Fit a source crop into a frame of fixed width `fw`.

    The frame height follows the crop's aspect (clamped), so a wide, short
    element gets a short band instead of dragging in half the screen. If the
    crop is taller than max_h allows, it is contained rather than cropped.
    Returns (scale, frame_h, left, top).
    """
    x0, y0, x1, y1 = crop
    cw, ch = x1 - x0, y1 - y0
    s = fw / cw
    fh = fw * ch / cw
    if fh > max_h:
        fh, s = max_h, max_h / ch
    elif fh < min_h:
        fh = min_h
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return s, round(fh), -(cx * s - fw / 2), -(cy * s - fh / 2)


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#050211}
.slide{width:__W__px;height:__H__px;position:relative;overflow:hidden;background:#0b0518;
  color:#F4F0FF;font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased}
.ground{position:absolute;inset:0;z-index:1;background:
  radial-gradient(1150px 900px at 84% -8%, rgba(167,139,250,.34), transparent 62%),
  radial-gradient(720px 620px at -12% 104%, rgba(124,107,196,.20), transparent 64%),
  linear-gradient(168deg,#180d34 0%,#0b0518 52%,#050211 100%)}
.mesh{position:absolute;inset:0;z-index:2;opacity:.45;
  background-image:linear-gradient(rgba(244,240,255,.05) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(244,240,255,.05) 1px,transparent 1px);
  background-size:62px 62px}

.lockup{position:absolute;left:68px;top:64px;z-index:20;display:flex;align-items:center;gap:16px}
.logo{width:58px;height:58px;border-radius:13px;display:block;
  filter:drop-shadow(0 10px 22px rgba(124,58,237,.55))}
.word{font-family:'Sora';font-weight:800;font-size:35px;letter-spacing:-1.1px;line-height:1}

.eyebrow{display:inline-block;padding:9px 20px;border-radius:999px;
  background:rgba(167,139,250,.16);border:1px solid rgba(192,132,252,.45);color:#DCCCFF;
  font-weight:700;font-size:17px;letter-spacing:.09em;text-transform:uppercase}
h1{margin-top:20px;font-family:'Sora';font-weight:800;font-size:58px;line-height:1.05;
  letter-spacing:-2px}
h1 .hl{background:linear-gradient(96deg,#C084FC,#A855F7 52%,#E879F9);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:18px;font-weight:500;font-size:24px;line-height:1.45;color:#C4B9E4}
.cta{margin-top:30px;display:inline-flex;align-items:center;gap:14px;padding:22px 38px;
  border-radius:999px;background:linear-gradient(134deg,#7C3AED,#9333EA 52%,#A855F7);
  box-shadow:0 20px 46px rgba(124,58,237,.55), inset 0 1px 0 rgba(255,255,255,.26);
  font-weight:700;font-size:24px;color:#fff;letter-spacing:-.2px}
.cta svg{width:23px;height:23px;display:block}

.foot{position:absolute;left:68px;right:68px;bottom:60px;z-index:20;display:flex;
  align-items:center;justify-content:space-between;gap:20px;
  border-top:1px solid rgba(244,240,255,.18);padding-top:20px}
.foot .url{font-family:'Sora';font-weight:700;font-size:23px;letter-spacing:-.3px}
.foot .tag{font-weight:600;font-size:18px;color:#BCB1DE;text-align:right}

/* the cropped UI detail */
.frame{position:absolute;overflow:hidden;z-index:4}
.frame img{position:absolute;display:block}
.b-card img{position:absolute;display:block}
.mask{position:absolute;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
  background:rgba(20,10,42,.30);border-radius:7px;z-index:6}
.detail-glow{position:absolute;z-index:3;border-radius:50%;filter:blur(62px);
  background:radial-gradient(closest-side,rgba(167,139,250,.55),transparent 74%)}

/* variant A: detail fills the top, text below */
.a-frame{left:0;width:__W__px}
.a-shade{position:absolute;left:0;top:0;right:0;z-index:5;background:
  linear-gradient(180deg,rgba(6,2,17,.88) 0%,rgba(6,2,17,.22) 22%,rgba(6,2,17,.06) 52%,
  rgba(8,3,22,.74) 82%,#0b0518 100%)}
.a-copy{position:absolute;left:68px;right:68px;z-index:20}

/* variant B: person photo full-bleed, copy lower-left, detail card floating right */
.b-photo{position:absolute;inset:0;z-index:1;overflow:hidden}
.b-photo img{position:absolute;display:block;filter:saturate(.80) brightness(.80) contrast(1.05)}
.b-violet{position:absolute;inset:0;z-index:2;mix-blend-mode:color;opacity:.46;
  background:linear-gradient(200deg,#8B5CF6,#5B21B6 60%,#2E1065)}
.b-shade{position:absolute;inset:0;z-index:3;background:
  linear-gradient(112deg,rgba(6,2,17,.93) 0%,rgba(6,2,17,.76) 34%,rgba(6,2,17,.22) 62%,rgba(6,2,17,.05) 82%),
  linear-gradient(180deg,rgba(6,2,17,.55) 0%,transparent 30%,rgba(5,2,17,.92) 88%)}
.b-card{position:absolute;right:44px;top:292px;width:470px;z-index:8;
  overflow:hidden;border-radius:20px;border:1px solid rgba(192,132,252,.42);background:#0e0722;
  box-shadow:0 38px 80px rgba(0,0,0,.76), 0 0 0 6px rgba(167,139,250,.08);
  transform:perspective(1500px) rotateY(-11deg) rotateX(2deg)}
.b-copy{position:absolute;left:68px;right:120px;bottom:150px;z-index:20}

/* variant C: copy on top, wide detail band below */
.c-copy{position:absolute;left:68px;right:68px;top:196px;z-index:20}
.c-frame{left:0;width:__W__px}
.c-edge{position:absolute;left:0;right:0;z-index:5;pointer-events:none;
  box-shadow:inset 0 22px 42px -18px rgba(5,2,17,.95), inset 0 -22px 42px -18px rgba(5,2,17,.95);
  border-top:1px solid rgba(192,132,252,.32);border-bottom:1px solid rgba(192,132,252,.32)}
.c-cta{position:absolute;left:68px;bottom:142px;z-index:20}
"""
CSS = (CSS.replace("__W__", str(W)).replace("__H__", str(H)))

ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15"/>'
         '<path d="m13 6 6 6-6 6"/></svg>')

LOCKUP = ('<div class="lockup"><img class="logo" src="{logo}" alt="Leadgrid">'
          '<span class="word">Leadgrid</span></div>')

POSTS = [
    dict(name="01-markedsskann", variant="C", shot="oversikt.png",
         crop=(20, 202, 912, 300), eyebrow="Markedsskann",
         h1='Slutt å lure på<br><span class="hl">hvor kundene er</span>',
         sub="Leadgrid skanner Brønnøysundregistrene og Google Places og legger "
             "bedriftene rett på kartet ditt.",
         cta="Prøv gratis", tag="Brønnøysund · SSB · Kartverket",
         alt="Leadgrid statusoversikt: hot, varme og lunkne leads"),

    dict(name="02-omrader", variant="C", shot="team.png",
         crop=(108, 478, 562, 872), eyebrow="Områder & team",
         h1='Alle vet hvem som<br>har <span class="hl">hvilket område</span>',
         sub="Tegn territoriene på kartet og tildel dem. Da slipper dere diskusjonen "
             "om hvem som egentlig tok den kunden.",
         cta="Se hvordan", tag="Kartgrunnlag: Kartverket",
         alt="Leadgrid territorier tildelt hver selger på kartet"),

    dict(name="03-pipeline", variant="C", shot="leads.png",
         crop=(6, 344, 692, 410), eyebrow="Pipeline",
         h1='Hvem ringer<br>du <span class="hl">først?</span>',
         sub="Hver lead får score, status, eier og neste oppfølging — automatisk.",
         cta="Prøv gratis", tag="Lead score · oppfølging · verdi",
         alt="Leadgrid pipeline-rad med lead score 92 og neste oppfølging"),

    dict(name="04-moter", variant="B", shot="moter.png", photo="person-woman.jpg",
         photo_fit=(1780, -430, -120),
         crop=(626, 536, 926, 746), eyebrow="Møter & ruter",
         h1='Ruta ligger klar<br>før <span class="hl">du setter deg i bilen</span>',
         sub="Reisetid, adresse og hva som gjenstår på sjekklista — samlet på møtet.",
         cta="Book en demo", tag="Reise-ETA · sjekkliste",
         alt="Leadgrid rute til møte med reisetid og sjekkliste"),

    dict(name="05-dorsalg", variant="A", shot="dorsalg.png",
         crop=(452, 352, 802, 766), eyebrow="Dørsalg & verving",
         h1='Ingen dør blir<br><span class="hl">gått to ganger</span>',
         sub="Salg, «ikke hjemme» og avslag registreres på adressen. Kartet oppdateres "
             "for hele teamet med én gang.",
         cta="Prøv gratis", tag="400 av 1853 adresser dekket",
         alt="Leadgrid dørsalg: tett klynge av adressepins over Oslo"),

    dict(name="06-kvalitet", variant="B", shot="kvalitet.png", photo="person-montor.jpg",
         photo_fit=(1950, -720, -150),
         crop=(310, 604, 1236, 872), eyebrow="Kvalitet",
         h1='Tallene stemmer<br><span class="hl">før de telles</span>',
         sub="Hvert salg gjennom en verifiseringskø, med kvalitetsgrad per selger.",
         cta="Se hvordan", tag="Verifiseringskø · kvalitetsgrad",
         alt="Leadgrid kvalitetsgrad per selger"),

    dict(name="07-leadgrid-go", variant="C", shot="kjorebok.png",
         crop=(362, 322, 878, 444), eyebrow="Leadgrid Go",
         h1='Kjøreboka<br><span class="hl">fører seg selv</span>',
         sub="Kilometer, kjøregodtgjørelse og bom logges automatisk. Du bekrefter "
             "bare formålet etterpå.",
         cta="Prøv gratis", tag="Kjørebok · flåte · bilbooking",
         alt="Leadgrid Go: kilometer, kjøregodtgjørelse og bom for måneden"),

    dict(name="08-leadbook", variant="A", shot="leadbook.png",
         crop=(600, 488, 926, 782), eyebrow="Leadbook",
         h1='Alle får med seg<br><span class="hl">det som funker</span>',
         sub="Åpningsreplikker, innvendinger og neste steg i maler teamet faktisk bruker.",
         cta="Se hvordan", tag="Maler · Pondus-score · akademi",
         alt="Leadgrid Pondus-analyse med score 88"),

    dict(name="09-salgsledelse", variant="C", shot="salgsledelse.png",
         crop=(14, 88, 930, 184), eyebrow="Salgsledelse",
         h1='Mål, provisjon<br>og <span class="hl">premier samlet</span>',
         sub="Godkjenn deals, følg team-forecast, kjør konkurranser og del ut premier. "
             "Uten regneark.",
         cta="Book en demo", tag="Forecast · provisjon · premier",
         alt="Leadgrid salgssjef-verktøy: godkjenning, forecast og coaching"),

    dict(name="10-i-lomma", variant="B", shot="iphone.png", photo="person-handverker.jpg",
         photo_fit=(2050, -560, -60),
         crop=(18, 166, 238, 378), eyebrow="iPad · iPhone · Apple Watch",
         h1='Kontoret ligger<br>i <span class="hl">jakkelomma</span>',
         sub="Besøk, notat og status logges hjemme hos kunden. Ingenting skal "
             "etterregistreres på kontoret.",
         cta="Kom i gang", tag="Native apper for Apple",
         alt="Leadgrid iPhone-app med dagens agenda"),
]



PORTRAIT = {"oversikt.png", "team.png", "leads.png", "moter.png",
            "leadbook.png", "salgsledelse.png"}


def src_width(post):
    """Intrinsic pixel width of the source screenshot."""
    if post["shot"] == "iphone.png":
        return 248
    return 930 if post["shot"] in PORTRAIT else 1240


def masks_html(post, s, ox, oy):
    out = []
    for mx0, my0, mx1, my1 in post.get("masks", []):
        out.append(
            f'<div class="mask" style="left:{mx0 * s + ox:.0f}px;top:{my0 * s + oy:.0f}px;'
            f'width:{(mx1 - mx0) * s:.0f}px;height:{(my1 - my0) * s:.0f}px"></div>')
    return "".join(out)


def build():
    faces = "".join(
        f"@font-face{{font-family:'{'Sora' if k.startswith('SORA') else 'Manrope'}';"
        f"src:url({(ROOT / v).resolve()}) format('woff2');"
        f"font-weight:{k[-3:]};font-display:block}}" for k, v in FONTS.items())
    logo = (ROOT / "assets/logo.png").resolve()

    for post in POSTS:
        shot = (ROOT / "assets" / post["shot"]).resolve()
        cta = f'<div class="cta">{post["cta"]} {ARROW}</div>'
        copy = (f'<span class="eyebrow">{post["eyebrow"]}</span>'
                f'<h1>{post["h1"]}</h1><p class="sub">{post["sub"]}</p>')
        foot = (f'<div class="foot"><span class="url">leadgrid.no</span>'
                f'<span class="tag">{post["tag"]}</span></div>')
        lock = LOCKUP.format(logo=logo)

        if post["variant"] == "A":
            s, fh, ox, oy = place(post["crop"], W, 260, 812)
            body = f"""
  <div class="ground"></div><div class="mesh"></div>
  <div class="frame a-frame" style="top:0;height:{fh}px"><img src="{shot}" alt="{post['alt']}"
     style="width:{src_width(post) * s:.0f}px;left:{ox:.0f}px;top:{oy:.0f}px">
     {masks_html(post, s, ox, oy)}</div>
  <div class="a-shade" style="height:{fh}px"></div>
  {lock}
  <div class="a-copy" style="top:{fh + 44}px">{copy}{cta}</div>
  {foot}"""

        elif post["variant"] == "B":
            s, fh, ox, oy = place(post["crop"], 470, 240, 430)
            pw, pl, pt = post["photo_fit"]
            photo = (ROOT / "assets" / post["photo"]).resolve()
            src_w = src_width(post)
            body = f"""
  <div class="b-photo"><img src="{photo}" alt=""
       style="width:{pw}px;left:{pl}px;top:{pt}px"></div>
  <div class="b-violet"></div><div class="b-shade"></div>
  <div class="detail-glow" style="right:20px;top:270px;width:470px;height:380px"></div>
  <div class="b-card" style="height:{fh}px"><img src="{shot}" alt="{post['alt']}"
       style="width:{src_w * s:.0f}px;left:{ox:.0f}px;top:{oy:.0f}px">
       {masks_html(post, s, ox, oy)}</div>
  {lock}
  <div class="b-copy">{copy}{cta}</div>
  {foot}"""

        else:  # C
            s, fh, ox, oy = place(post["crop"], W, 340, 480)
            src_w = src_width(post)
            body = f"""
  <div class="ground"></div><div class="mesh"></div>
  {lock}
  <div class="c-copy">{copy}</div>
  <div class="detail-glow" style="left:120px;top:660px;width:840px;height:300px"></div>
  <div class="frame c-frame" style="top:{1090 - fh}px;height:{fh}px"><img src="{shot}"
       alt="{post['alt']}" style="width:{src_w * s:.0f}px;left:{ox:.0f}px;top:{oy:.0f}px">
       {masks_html(post, s, ox, oy)}</div>
  <div class="c-edge" style="top:{1090 - fh}px;height:{fh}px"></div>
  <div class="c-cta">{cta}</div>
  {foot}"""

        html = (f"<!doctype html><html lang=no><head><meta charset=utf-8>"
                f"<style>{faces}{CSS}</style></head><body>"
                f'<div class="slide">{body}</div></body></html>')
        (BUILD / f"{post['name']}.html").write_text(html, encoding="utf-8")
    print("built", len(POSTS), "v2 posts")


if __name__ == "__main__":
    build()
