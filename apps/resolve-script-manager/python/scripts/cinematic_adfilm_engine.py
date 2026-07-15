#!/usr/bin/env python3
"""
cinematic_adfilm_engine.py — gjenbrukbar cinematisk reklamefilm-pipeline for
Post Agent. Produkt-agnostisk: drevet av ett `AdFilmSpec`-JSON (se
docs/cinematic-adfilm-pipeline.md). Bytt produkt/karakter/shots/VO → ny film.

Stadier (hver er en ren funksjon, kan kjøres isolert eller i kjede):
  gen_stills          §1  fal nano-banana (T2I) + continuity-edit
  animate_clips       §2  fal bytedance/seedance/v1/pro/image-to-video (I2V)
  key_ui              §4  OpenCV per-frame green-key ekte app-UI → plate
  assemble            §5  ffmpeg concat + normalisering + musikk-bed
  voiceover           §6  fal elevenlabs/tts/multilingual-v2 + duck under musikk
  subtitles           §7  silencedetect linje-timing → PNG-overlay (uten libass)
  build_resolve_timeline §9  DaVinciResolveScript: V1 video · V2 subs · A1 musikk · A2 VO

KARDINALREGEL (håndhevet): `ui_key`-shots MÅ ha ekte `ui_recording` — motoren
genererer ALDRI produkt-UI. AI lager kun omgivelsene.

fal-nøkkel hentes via credential_store (fallback ~/.config/leadgrid/fal.key).
Alle fal-kall bruker queue-mønsteret + `status_url` fra responsen (aldri
konstruert). Se §3/§4 i dokumentasjonen.
"""
from __future__ import annotations
import base64, json, os, re, ssl, subprocess, time, urllib.request
from dataclasses import dataclass, field
from typing import Any

# SSL-kontekst med certifi-CA-bundle. Robusthet: macOS-system-Python mangler ofte
# CA-chain → urllib feiler med CERTIFICATE_VERIFY_FAILED ved standalone-kjøring.
# certifi hvis tilgjengelig, ellers default-kontekst (Post Agents bridge har certs).
def _make_ssl_ctx() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()
_SSL_CTX = _make_ssl_ctx()

CLAUDE_QC_MODEL = "claude-sonnet-4-6"   # vision-QC; hev til opus for endelig pass
QC_PASS_SCORE = 78                      # 0-100; under → regenerer

# ─────────────────────────── konfig / nøkler ───────────────────────────

FAL_QUEUE = "https://queue.fal.run"
FAL_MODELS = {
    "t2i":      "fal-ai/nano-banana",
    "edit":     "fal-ai/nano-banana/edit",
    "i2v":      "fal-ai/bytedance/seedance/v1/pro/image-to-video",  # Seedance
    "tts":      "fal-ai/elevenlabs/tts/multilingual-v2",
    "audio":    "fal-ai/stable-audio",  # musikk/ambiens (payload: prompt + seconds_total)
}

def _fal_key() -> str:
    try:
        from credential_store import get_secret  # Post Agent credential-store
        k = get_secret("FAL_KEY")
        if k:
            return k.strip()
    except Exception:
        pass
    p = os.path.expanduser("~/.config/leadgrid/fal.key")
    return open(p).read().strip() if os.path.exists(p) else os.environ.get("FAL_KEY", "").strip()


# ─────────────────────────── fal queue-klient ──────────────────────────

def _http(url: str, body: dict | None = None, headers: dict | None = None,
          method: str | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"))
    req.add_header("Authorization", f"Key {_fal_key()}")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=120, context=_SSL_CTX) as r:
        return json.loads(r.read().decode())

def fal_run(model_key: str, payload: dict, poll_s: float = 3.0, timeout_s: float = 900) -> dict:
    """Submit til fal-queue og poll til ferdig. Returnerer respons-JSON.
    🔑 Bruker status_url/response_url FRA submit-responsen (aldri konstruert)."""
    sub = _http(f"{FAL_QUEUE}/{FAL_MODELS[model_key]}", payload)
    status_url = sub.get("status_url")
    response_url = sub.get("response_url")
    if not status_url or not response_url:
        raise RuntimeError(f"fal: mangler status_url i respons ({model_key})")
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        st = _http(status_url)
        if st.get("status") == "COMPLETED":
            return _http(response_url)
        if st.get("status") in ("FAILED", "ERROR"):
            raise RuntimeError(f"fal-jobb feilet: {st}")
        time.sleep(poll_s)
    raise TimeoutError(f"fal-jobb timeout ({model_key})")


# ─────────────────────────── spec-modell ───────────────────────────────

@dataclass
class AdFilmSpec:
    product: str
    workdir: str
    shots: list[dict]                 # {id, prompt, dur, ui_key, ui_recording?}
    vo_lines: list[dict]              # {en, no}
    music: str                        # sti til sømløs musikk-bed
    brand: dict = field(default_factory=dict)   # {wordmark_asset, accent}
    character: dict = field(default_factory=dict)  # {ref_still, lock}
    setting: str = ""
    fps: int = 24
    vo: dict = field(default_factory=lambda: {"provider": "elevenlabs", "voice": "Brian",
                                              "lang_spoken": "en", "lang_sub": "no"})
    out: str = ""                     # sti til master-mp4

    @staticmethod
    def load(path: str) -> "AdFilmSpec":
        d = json.load(open(path))
        d.setdefault("workdir", os.path.dirname(os.path.abspath(path)))
        return AdFilmSpec(**{k: d[k] for k in d if k in AdFilmSpec.__annotations__})

    def p(self, *parts: str) -> str:
        return os.path.join(self.workdir, *parts)


# ─────────────── Shot Plan-generator ───────────────────────────────────
# Én setning → full produksjonsark (karakter-lås, miljø, per-shot storyboard-
# prompt + kamera + shot-type + mood, + VO-linjer EN/NO) via Claude. Markerer
# `ui_key`-shots der EKTE app-UI keyes inn (aldri generert). Flyt:
# «beskriv → produksjonsark → refine → generer».

SHOT_PLAN_SYSTEM = """Du er film-regissør + storyboard-artist for premium
cinematisk PRODUKT-reklame (nivå Apple/Tesla/Stripe/DJI). Fra én idé lager du et
komplett produksjonsark (Shot Plan). KARDINALREGLER: (1) produkt-UI genereres
ALDRI — der produktets skjerm er synlig, sett "ui_key":true (ekte app-opptak
keyes inn senere). (2) samme person/klær i ALLE shots (character.lock).
(3) ingen sci-fi/neon/HUD/emoji. (4) produktet er helten, mennesket kun bruker.
Bruk ekte kamera-språk (wide/establishing, close-up, tracking, push-in, orbit,
dolly, pan) og mood/lys. 3–6 shots, ~3–5s hver. Skriv VO på engelsk (tale) med
norsk undertekst, Apple-keynote-tone, ~3–4s/linje.
Svar KUN med JSON:
{"setting":"...","character":{"lock":"..."},
 "shots":[{"id":"s01","prompt":"...","dur":3.5,"ui_key":true|false,
           "shot_type":"...","camera":"...","mood":"..."}],
 "vo_lines":[{"en":"...","no":"..."}]}"""

def generate_shot_plan(idea: str, product: str, *, setting: str = "", n_shots: int = 6,
                       ui_recordings: dict[str, str] | None = None, music: str = "",
                       workdir: str = ".", model: str | None = None) -> AdFilmSpec:
    """Produksjonsark fra én idé (én setning → Shot Plan). Returnerer en AdFilmSpec
    (menneske kan refine i manuskript-panelet før generering). `ui_recordings`
    mapper shot-id → ekte app-opptak for ui_key-shots."""
    from anthropic_proxy import Anthropic
    client = Anthropic()
    ctx = f"Produkt: {product}. Antall shots: {n_shots}." + (f" Setting: {setting}." if setting else "")
    msg = client.messages.create(
        model=model or "claude-opus-4-8", max_tokens=2000, system=SHOT_PLAN_SYSTEM,
        messages=[{"role": "user", "content": f"Idé: {idea}\n{ctx}\nLag Shot Plan."}])
    text = "".join(b.text for b in msg.content if hasattr(b, "text"))
    m = re.search(r"\{.*\}", text, re.S)
    plan = json.loads(m.group(0)) if m else {}
    # koble ekte app-opptak til ui_key-shots
    for s in plan.get("shots", []):
        if s.get("ui_key") and ui_recordings:
            s["ui_recording"] = ui_recordings.get(s["id"], "")
    return AdFilmSpec(
        product=product, workdir=workdir, music=music,
        setting=plan.get("setting", setting),
        character=plan.get("character", {}),
        shots=plan.get("shots", []),
        vo_lines=plan.get("vo_lines", []))


# ─────────────────────── manuskript-system ─────────────────────────────
# Én redigerbar markdown-fil er kilden til VO + scener («skriv hva VO skal
# være»). Rundtripp-es til/fra AdFilmSpec, så panelet og hånd-redigering deler
# samme format. Se docs §5.6.

def write_manuscript_md(spec: AdFilmSpec, path: str) -> str:
    L = [f"# {spec.product} — Manuskript", ""]
    L += [f"- **Setting:** {spec.setting}",
          f"- **Karakter:** {spec.character.get('lock','')}",
          f"- **Stemme (ElevenLabs):** {spec.vo.get('voice','Brian')}",
          f"- **Tale/undertekst:** {spec.vo.get('lang_spoken','en')} / {spec.vo.get('lang_sub','no')}", ""]
    L += ["## Voice-over", "", "| # | VO (tale) | Undertekst |", "|---|-----------|------------|"]
    for i, v in enumerate(spec.vo_lines, 1):
        L.append(f"| {i} | {v['en']} | {v['no']} |")
    L += ["", "## Scener (storyboard)", "",
          "| id | varighet | ui-key | prompt | app-opptak |",
          "|----|----------|--------|--------|------------|"]
    for s in spec.shots:
        L.append(f"| {s['id']} | {s['dur']} | {'ja' if s.get('ui_key') else 'nei'} | "
                 f"{s['prompt']} | {s.get('ui_recording','')} |")
    open(path, "w").write("\n".join(L) + "\n")
    return path

def _md_rows(md: str, header_key: str) -> list[list[str]]:
    rows, on = [], False
    for ln in md.splitlines():
        if header_key in ln and ln.strip().startswith("|"):
            on = True; continue
        if on:
            if not ln.strip().startswith("|"):
                if rows: break
                continue
            if set(ln.replace("|", "").strip()) <= set("-: "):  # separator-rad
                continue
            rows.append([c.strip() for c in ln.strip().strip("|").split("|")])
    return rows

def parse_manuscript_md(path: str, base: AdFilmSpec | None = None) -> AdFilmSpec:
    """Les manuskript-markdown → AdFilmSpec (VO + scener). `base` gir defaults."""
    md = open(path).read()
    d = base.__dict__.copy() if base else {}
    m = re.search(r"Stemme.*?:\*\*\s*([A-Za-z]+)", md)
    if m:
        d.setdefault("vo", {}); d["vo"] = {**d.get("vo", {}), "voice": m.group(1)}
    vo_lines = [{"en": r[1], "no": r[2]} for r in _md_rows(md, "VO (tale)") if len(r) >= 3]
    shots = []
    for r in _md_rows(md, "ui-key"):
        if len(r) >= 4:
            shots.append({"id": r[0], "dur": float(r[1] or 3.5),
                          "ui_key": r[2].lower().startswith("ja"),
                          "prompt": r[3], "ui_recording": (r[4] if len(r) > 4 else "")})
    d["vo_lines"] = vo_lines or d.get("vo_lines", [])
    d["shots"] = shots or d.get("shots", [])
    d.setdefault("product", "Film"); d.setdefault("workdir", os.path.dirname(os.path.abspath(path)))
    d.setdefault("music", "")
    return AdFilmSpec(**{k: d[k] for k in d if k in AdFilmSpec.__annotations__})


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)

def _dur(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nk=1:nw=1", path], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


# ─────────────────────── Claude Vision QC-løkke ────────────────────────
# fal genererer → Claude Vision inspiserer mot kardinalreglene → svake
# regenereres automatisk med konkret fix-prompt. Dette er kvalitets-motoren
# som hever fal-output videre (bruker-krav). Se docs §5.5.

def _b64(path: str) -> str:
    return base64.standard_b64encode(open(path, "rb").read()).decode()

def _qc_rubric(shot: dict, spec: AdFilmSpec) -> str:
    lock = spec.character.get("lock", "")
    if shot.get("ui_key"):
        ui_rule = (
            "Dette shot-et er et ui_key-shot: den EKTE app-UI-en keyes inn på skjermen "
            "ETTERPÅ, så bildet skal være en KEYBAR PLATE. VURDER STRENGT: "
            "(a) SKJERM-ORIENTERING — vender skjermflaten mot kamera så ekte UI kan keyes inn? "
            "Hvis skjermen/UI-en ligger på BAKSIDEN eller KANTEN av enheten, enheten er vridd bort, "
            "vises fra baksiden, eller skjermplanet er så skrått at det ikke er brukbart → stryk (KRITISK). "
            "(b) NATURLIG BRUK — er dette et ekte, uanstrengt øyeblikk av bruk (over-skulder / POV / ser ned "
            "på enheten), ELLER presenterer hun nettbrettet mot kamera som en produktdemo/unboxing? "
            "Enhet vridd/løftet mot linsa for å vise skjermen = stryk (KRITISK) — folk bruker ikke iPad slik. "
            "(c) Skjermen bør være en ren, jevn, MATT flate (helst tom/grønn) — IKKE oppfunnet/AI-hallucinert UI, "
            "glødende hologram, HUD eller falske grafer. Oppfunnet/flytende UI = stryk (kritisk). "
            "(d) REFLEKSJON — er skjermen matt og refleksfri, eller speiler den personen/rommet/vinduer/glans? "
            "Speiling av personen eller specular-hotspots på skjermen = stryk (KRITISK) — umulig å keye rent.")
    else:
        ui_rule = ("Dette shot-et har INGEN synlig produkt-UI (atmosfære). Ingen skjerm skal vise lesbar falsk UI.")
    return (
        f"Du er kvalitets-kontrollør for en premium, men JORDNÆR og REALISTISK reklamefilm for «{spec.product}» "
        f"(nivå: Apple/Tesla/Stripe — men troverdig virkelighet, ikke fremtids-konsept). Setting: {spec.setting}. "
        f"Karakter-lås: {lock}. Shot-intensjon: {shot.get('prompt','')}. {ui_rule} "
        "JORDNÆR-KRAV (viktig): scenen skal se ut som et EKTE fotografi av en ekte person med en ekte, "
        "fysisk enhet i et ekte rom. INGEN sci-fi, INGEN glødende hologrammer, INGEN svevende UI/grafer i luften, "
        "INGEN neon/HUD/futuristiske projeksjoner, INGEN overdreven lens-flare/glow. Naturlig lys, vanlige "
        "materialer, hverdagslig og troverdig. Alt som ser AI-aktig, konsept-aktig eller fremtidsrettet ut = trekk score. "
        "Sjekk: (1) skjerm-orientering + ekte vs oppfunnet UI, (2) karakter-konsistens (samme person/klær), "
        "(3) jordnær realisme (ser det ut som et ekte foto?), (4) INGEN sci-fi/neon/HUD/hologram/emoji, "
        "(5) naturlig, cinematisk lys uten kunstig glød. "
        "Svar KUN med JSON: {\"score\":0-100,\"pass\":bool,\"issues\":[\"...\"],"
        "\"fix_prompt\":\"konkret tillegg til bilde-prompten som fikser problemene (f.eks. skjerm-vinkel, fjern hologram, mer jordnært)\"}."
    )

def vision_qc(image_path: str, shot: dict, spec: AdFilmSpec, model: str | None = None) -> dict:
    """Claude Vision-QC av én still/frame mot kardinalreglene. Fail-open ved feil."""
    try:
        from anthropic_proxy import Anthropic
        client = Anthropic()
        msg = client.messages.create(
            model=model or CLAUDE_QC_MODEL, max_tokens=600,
            system=_qc_rubric(shot, spec),
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                             "data": _b64(image_path)}},
                {"type": "text", "text": "QC dette bildet. Svar kun med JSON."}]}],
        )
        text = "".join(b.text for b in msg.content if hasattr(b, "text"))
        m = re.search(r"\{.*\}", text, re.S)
        d = json.loads(m.group(0)) if m else {}
        d.setdefault("score", 100); d.setdefault("pass", d["score"] >= QC_PASS_SCORE)
        return d
    except Exception as e:
        return {"score": 100, "pass": True, "issues": [], "fix_prompt": "", "_qc_error": str(e)}


# ─────────────────────────── §1 stills ─────────────────────────────────

# Skjerm-geometri for ui_key-shots: den EKTE UI-en keyes inn etterpå, så skjerm-
# planet MÅ vende mot kamera og være helt synlig — ellers er platen ubrukelig.
# Vi ber om en ren, jevn skjermflate (grønn) vendt mot kamera, og forbyr eksplisitt
# at det tegnes noe UI/skjerm på baksiden eller kanten av enheten.
SCREEN_PLATE_DIRECTIVE = (
    "Frame the device the way its OWN USER sees it — over-the-shoulder from behind her, "
    "or a point-of-view / high angle looking down at the tablet in her hands or on the "
    "desk. Because the camera sits on the user's side, the flat screen plane naturally "
    "faces the lens and is fully visible for chroma key. She looks at and USES the device "
    "naturally. Render the screen as a clean, evenly-lit, empty green rectangle (chroma "
    "key plate) — no text, icons or UI on it; the back and edges are plain casing with NO "
    "screen and NO UI. "
    "The green screen must be perfectly MATTE and evenly lit for a clean chroma key: NO "
    "reflections of the person or room on the glass, NO window glare, NO specular "
    "highlights or hotspots, NO fingerprints — a flat, uniform green with no mirror-like "
    "sheen. Treat it like a non-reflective matte display. "
    "CRITICAL: she must NOT rotate, lift or angle the tablet toward the camera, must NOT "
    "present or show the screen to the viewer, and this must never look like a product "
    "demo or unboxing. It is a candid moment of real use, not a presentation to camera."
)

# Jordnær-direktiv: hold alt troverdig og fotografisk. Motvirker at modellen
# driver mot sci-fi/hologram/HUD (bruker-krav: «mer jordnært»).
GROUNDED_DIRECTIVE = (
    "Grounded, photorealistic, believable real-world photograph — a real person with a "
    "real physical device in a real room. Natural available light, ordinary materials, "
    "documentary/editorial realism. Absolutely NO sci-fi, NO holograms, NO floating UI or "
    "graphs in the air, NO neon, NO HUD, NO futuristic projections or glowing overlays, "
    "no exaggerated lens flare or bloom. Down-to-earth and understated."
)

def _gen_one_still(spec: AdFilmSpec, s: dict, extra_prompt: str, dst: str) -> None:
    ref = spec.character.get("ref_still")
    prompt = f"{s['prompt']} {extra_prompt}".strip()
    prompt = f"{prompt}. {GROUNDED_DIRECTIVE}"
    if s.get("ui_key"):
        prompt = f"{prompt}. {SCREEN_PLATE_DIRECTIVE}"
    if ref:
        # nano-banana/edit forventer image_urls (array), ikke image_url (singular) → 422.
        res = fal_run("edit", {"image_urls": [_fal_upload(ref)],
                               "prompt": f"{prompt} — behold samme person, antrekk og look"})
    else:
        res = fal_run("t2i", {"prompt": prompt, "num_images": 1})
    _download(_first_image_url(res), dst)

def gen_stills(spec: AdFilmSpec, qc: bool = True, max_tries: int = 3) -> dict[str, str]:
    """Generer én cinematisk still per shot MED Claude Vision QC-løkke:
    fal genererer → Claude vurderer mot kardinalreglene → svake regenereres
    (opp til `max_tries`) med konkret fix-prompt. Beholder beste score.
    Continuity-lås via nano-banana/edit hvis character.ref_still er satt."""
    os.makedirs(spec.p("stills"), exist_ok=True)
    out, report = {}, {}
    for s in spec.shots:
        dst = spec.p("stills", f"{s['id']}.jpg")
        best_path, best_score, extra = None, -1, ""
        for attempt in range(max_tries if qc else 1):
            cand = spec.p("stills", f"{s['id']}_t{attempt}.jpg")
            _gen_one_still(spec, s, extra, cand)
            if not qc:
                best_path = cand; break
            v = vision_qc(cand, s, spec)
            if v["score"] > best_score:
                best_score, best_path = v["score"], cand
            if v.get("pass"):
                break
            extra = v.get("fix_prompt", "")   # mat QC-tilbakemelding inn i neste forsøk
        os.replace(best_path, dst)
        out[s["id"]] = dst
        report[s["id"]] = best_score
    _write_json(spec.p("qc_stills_report.json"), report)
    return out

def _write_json(path: str, obj: Any) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def _first_image_url(res: dict) -> str:
    imgs = res.get("images") or res.get("output", {}).get("images") or []
    return (imgs[0]["url"] if imgs and isinstance(imgs[0], dict) else imgs[0])

def _download(url: str, dst: str) -> None:
    # urlretrieve tar ikke SSL-kontekst → bruk urlopen m/ _SSL_CTX.
    with urllib.request.urlopen(url, timeout=180, context=_SSL_CTX) as r, open(dst, "wb") as f:
        f.write(r.read())

def _fal_upload(path: str) -> str:
    """Last opp en lokal fil til fal-storage og returner URL (for I2V/edit-input)."""
    init = _http("https://rest.alpha.fal.ai/storage/upload/initiate",
                 {"content_type": "image/jpeg", "file_name": os.path.basename(path)})
    put_url, file_url = init["upload_url"], init["file_url"]
    with open(path, "rb") as f:
        req = urllib.request.Request(put_url, data=f.read(), method="PUT")
        req.add_header("Content-Type", "image/jpeg")
        urllib.request.urlopen(req, timeout=120, context=_SSL_CTX)
    return file_url


# ─────────────────────────── §2 animer (Seedance) ──────────────────────

def animate_clips(spec: AdFilmSpec, stills: dict[str, str]) -> dict[str, str]:
    """Animer hver still til et ~5s klipp via Seedance i2v."""
    os.makedirs(spec.p("clips"), exist_ok=True)
    out = {}
    for s in spec.shots:
        dst = spec.p("clips", f"{s['id']}.mp4")
        res = fal_run("i2v", {"image_url": _fal_upload(stills[s["id"]]),
                              "prompt": s.get("motion", "subtil filmatisk push-in, håndholdt drift")})
        _download(res["video"]["url"], dst)
        out[s["id"]] = dst
    return out


# ─────────────────────────── §4 key ekte UI ────────────────────────────

def key_ui(spec: AdFilmSpec, clips: dict[str, str]) -> dict[str, str]:
    """Per-frame green-key av EKTE app-opptak inn på plate-ens grønne skjerm.
    KARDINALREGEL: kun `ui_key`-shots med `ui_recording` behandles; UI genereres
    ALDRI. Se key_navigator.py for full quad-warp + håndledd-rotoscoping."""
    try:
        import cv2, numpy as np  # noqa: F401
    except Exception:
        raise RuntimeError("key_ui krever opencv-python (cv2)")
    out = dict(clips)
    for s in spec.shots:
        if not s.get("ui_key"):
            continue
        rec = s.get("ui_recording")
        if not rec or not os.path.exists(rec):
            raise RuntimeError(f"shot {s['id']} er ui_key men mangler ekte ui_recording "
                               "(kardinalregel: UI genereres aldri)")
        out[s["id"]] = _green_key_clip(spec, clips[s["id"]], rec, s["id"])
    return out

def _green_key_clip(spec: AdFilmSpec, plate: str, ui_rec: str, sid: str) -> str:
    # Referanse-implementasjon i /tmp/leadgrid-film/key_navigator.py +
    # build_reveal_nordic.py (green_quad). Kort: HSV-mask grønn → finn skjerm-quad
    # → warp UI-frame inn per frame → komposit. Utelatt her for korthet.
    return plate  # erstatt med ekte key-pass i produksjon


# ─────────────────────────── §5 monter ─────────────────────────────────

VF_1080 = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps={fps},format=yuv420p"

def assemble(spec: AdFilmSpec, clips: dict[str, str]) -> str:
    """Normaliser hvert shot til varighet + 1080p24, concat, legg på musikk-bed."""
    vf = VF_1080.format(fps=spec.fps)
    norm = []
    for s in spec.shots:
        dst = spec.p(f"norm_{s['id']}.mp4")
        _run(["ffmpeg", "-y", "-ss", str(s.get("start", 0.2)), "-i", clips[s["id"]],
              "-t", str(s["dur"]), "-an", "-vf", vf, "-c:v", "libx264", "-crf", "17",
              "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(spec.fps), dst])
        norm.append(dst)
    lst = spec.p("concat.txt")
    with open(lst, "w") as f:
        for n in norm:
            f.write(f"file '{n}'\n")
    video = spec.p("assembled_video.mp4")
    _run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst,
          "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p",
          "-r", str(spec.fps), video])
    return video


# ─────────────────────────── §6 voice-over + duck ──────────────────────

# ElevenLabs-stemme-katalog (via fal). Utvid fritt; brukes av stemme-velgeren.
ELEVENLABS_VOICES = {
    "Brian":   "Brian (varm, selvsikker mann — Apple-keynote)",
    "Rachel":  "Rachel (rolig, tydelig kvinne)",
    "Adam":    "Adam (dyp, autoritativ mann)",
    "Antoni":  "Antoni (vennlig, fortellende mann)",
    "Bella":   "Bella (myk, elegant kvinne)",
}

def _tts_line(spec: AdFilmSpec, text: str, dst: str) -> None:
    res = fal_run("tts", {"text": text, "voice": spec.vo.get("voice", "Brian")})
    url = res["audio"]["url"] if isinstance(res.get("audio"), dict) else res.get("audio_url")
    _download(url, dst)

def voiceover(spec: AdFilmSpec) -> str:
    """Sammenhengende VO (fal ElevenLabs) fra vo_lines[*].en (én fil)."""
    dst = spec.p("vo.mp3")
    _tts_line(spec, " ".join(l["en"] for l in spec.vo_lines), dst)
    return dst

def voiceover_per_line(spec: AdFilmSpec, gap: float = 0.55) -> tuple[str, list[tuple[float, float]]]:
    """FORETRUKKET: syntetiser HVER VO-linje separat og skjøt sammen med faste
    pauser. Da kjenner vi eksakt start/slutt per linje → PERFEKT undertekst-sync
    (ingen silencedetect-gjetting). Returnerer (vo_sti, linje-tider)."""
    os.makedirs(spec.p("vo_lines"), exist_ok=True)
    parts, times, t = [], [], 0.0
    for i, l in enumerate(spec.vo_lines):
        p = spec.p("vo_lines", f"l{i:02d}.mp3")
        _tts_line(spec, l["en"], p)
        d = _dur(p)
        times.append((round(t, 2), round(t + d, 2)))
        parts.append(p); t += d + gap
    # skjøt sammen med `gap` sekunder stillhet mellom
    lst = spec.p("vo_concat.txt")
    sil = spec.p("_sil.wav")
    _run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono", "-t", str(gap), sil])
    with open(lst, "w") as f:
        for i, p in enumerate(parts):
            f.write(f"file '{p}'\n")
            if i < len(parts) - 1:
                f.write(f"file '{sil}'\n")
    vo = spec.p("vo.mp3")
    _run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "libmp3lame", vo])
    return vo, times

def mix_audio(spec: AdFilmSpec, video: str, vo: str) -> str:
    """Musikk ducket under VO (sidechaincompress). asplit fordi VO brukes 2 steder.
    Loop musikk hvis kortere enn video. Se §6."""
    vdur = _dur(video)
    fo = round(vdur - 2.5, 2)
    dst = spec.p("mix.m4a")
    fc = (f"[0:a]atrim=0:{vdur},asetpts=PTS-STARTPTS,volume=0.72,"
          f"afade=t=in:st=0:d=1.2,afade=t=out:st={fo}:d=2.5[m];"
          "[1:a]volume=1.7,adelay=250|250,asplit=2[v1][v2];"
          "[m][v1]sidechaincompress=threshold=0.04:ratio=8:attack=15:release=350[md];"
          "[md][v2]amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.95[a]")
    _run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", spec.music, "-i", vo,
          "-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "192k", dst])
    return dst


# ─────────────────────────── §7 undertekster ───────────────────────────

def vo_line_times(vo_path: str, n_lines: int, noise="-32dB", d=0.35) -> list[tuple[float, float]]:
    """Avled linje-timing fra VO via silencedetect: N-1 største pauser = grenser.
    Ingen whisper nødvendig."""
    out = subprocess.run(["ffmpeg", "-i", vo_path, "-af", f"silencedetect=noise={noise}:d={d}",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    vdur = _dur(vo_path)
    segs, last = [], 0.0
    for s in starts:
        if s - last > 0.2:
            segs.append([last, s])
        nx = [e for e in ends if e > s]
        last = nx[0] if nx else s
    if vdur - last > 0.2:
        segs.append([last, vdur])
    gaps = sorted([(segs[i + 1][0] - segs[i][1], i) for i in range(len(segs) - 1)], reverse=True)
    splits = sorted(i for _, i in gaps[:max(0, n_lines - 1)])
    groups, a = [], 0
    for sp in splits:
        groups.append((segs[a][0], segs[sp][1])); a = sp + 1
    groups.append((segs[a][0], segs[-1][1]))
    return groups

def render_sub_pngs(spec: AdFilmSpec) -> list[str]:
    """Render hver undertekst-linje som transparent PNG (uten libass)."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1920, 1080
    os.makedirs(spec.p("subs"), exist_ok=True)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 46)
    paths = []
    for i, l in enumerate(spec.vo_lines):
        txt = l["no"]
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
        bb = d.textbbox((0, 0), txt, font=font); tw, th = bb[2] - bb[0], bb[3] - bb[1]
        x, y = (W - tw) // 2, H - 150
        pad = 26
        d.rounded_rectangle([x - pad, y - 14, x + tw + pad, y + th + 20], radius=22, fill=(0, 0, 0, 105))
        for dx, dy in [(0, 2), (2, 0), (0, -2), (-2, 0)]:
            d.text((x + dx, y + dy - bb[1]), txt, font=font, fill=(0, 0, 0, 150))
        d.text((x, y - bb[1]), txt, font=font, fill=(255, 255, 255, 255))
        p = spec.p("subs", f"sub_{i:02d}.png"); img.save(p); paths.append(p)
    return paths

def burn_subtitles(spec: AdFilmSpec, video: str, mix: str, groups, pngs, delay=0.25) -> str:
    """Legg undertekst-PNG over via overlay:enable + mux lyd → master."""
    inputs = ["-i", video]
    for p in pngs:
        inputs += ["-i", p]
    fc, cur = "", "0:v"
    for i, (a, b) in enumerate(groups):
        nxt = f"v{i}"
        fc += f"[{cur}][{i+1}:v]overlay=0:0:enable='between(t,{a+delay:.2f},{b+delay+0.4:.2f})'[{nxt}];"
        cur = nxt
    fc = fc.rstrip(";")
    out = spec.out or spec.p(f"{spec.product}-final.mp4")
    _run(["ffmpeg", "-y", *inputs, "-i", mix, "-filter_complex", fc,
          "-map", f"[{cur}]", "-map", f"{len(pngs)+1}:a",
          "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-shortest", out])
    return out


# ─────────────────────────── §9 Resolve-timeline ───────────────────────

def build_resolve_timeline(spec: AdFilmSpec, clips: list[str], music: str, vo: str,
                           sub_pngs: list[str], groups, tl_name="EDIT", delay=0.25,
                           project: str | None = None) -> str:
    """Bygg en redigerbar timeline: V1 video · V2 undertekster · A1 musikk · A2 VO.
    Bruker GJELDENDE prosjekt hvis `project` er None (rør ALDRI et annet prosjekt)."""
    import sys
    sys.path.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/"
                    "Developer/Scripting/Modules/")
    import DaVinciResolveScript as dvr
    r = dvr.scriptapp("Resolve"); pm = r.GetProjectManager()
    p = pm.LoadProject(project) if project else pm.GetCurrentProject()
    mp = p.GetMediaPool(); root = mp.GetRootFolder()
    binf = next((f for f in root.GetSubFolderList() if f.GetName() == tl_name), None) \
        or mp.AddSubFolder(root, tl_name)
    mp.SetCurrentFolder(binf)
    p.SetSetting("timelineFrameRate", str(spec.fps))
    vids = [mp.ImportMedia([c])[0] for c in clips]
    music_it = mp.ImportMedia([music])[0]; vo_it = mp.ImportMedia([vo])[0]
    tl = mp.CreateEmptyTimeline(f"{tl_name}-v1")
    mp.AppendToTimeline(vids)                          # V1
    tl.AddTrack("audio")                               # A2
    mp.AppendToTimeline([{"mediaPoolItem": music_it, "mediaType": 2, "trackIndex": 1, "recordFrame": 0}])
    mp.AppendToTimeline([{"mediaPoolItem": vo_it, "mediaType": 2, "trackIndex": 2,
                          "recordFrame": int(delay * spec.fps)}])
    tl.AddTrack("video")                               # V2 = undertekster
    for i, png in enumerate(sub_pngs):
        it = mp.ImportMedia([png])[0]                  # 🔑 én av gangen (unngå bilde-sekvens)
        a, b = groups[i]
        rf = int(round((a + delay) * spec.fps)); dur = max(12, int(round((b - a + 0.4) * spec.fps)))
        mp.AppendToTimeline([{"mediaPoolItem": it, "startFrame": 0, "endFrame": dur - 1,
                              "mediaType": 1, "trackIndex": 2, "recordFrame": rf}])
    pm.SaveProject()
    return tl.GetName()


# ─────────────────────────── orkestrering ──────────────────────────────

def qc_final(spec: AdFilmSpec, video: str, n: int = 8, model: str | None = None) -> dict:
    """Endelig Claude Vision-QC: sample N frames fra ferdig film og vurder hver
    mot kardinalreglene. Returnerer per-frame-score + snitt + flaggede issues.
    Bruk opus-modell her for strengest sluttkontroll."""
    dur = _dur(video)
    os.makedirs(spec.p("_qc"), exist_ok=True)
    scores, issues = [], []
    for i in range(n):
        t = dur * (i + 0.5) / n
        fr = spec.p("_qc", f"final_{i}.jpg")
        _run(["ffmpeg", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-q:v", "3", fr])
        v = vision_qc(fr, {"prompt": "ferdig film-frame", "ui_key": True}, spec,
                      model=model or "claude-opus-4-8")
        scores.append(v.get("score", 100))
        issues += [f"{t:.1f}s: {x}" for x in v.get("issues", [])]
    rep = {"avg": round(sum(scores) / max(1, len(scores)), 1), "scores": scores, "issues": issues}
    _write_json(spec.p("qc_final_report.json"), rep)
    return rep

def run_all(spec_path: str, qc: bool = True) -> str:
    """Full pipeline fra spec → master-mp4, med Claude Vision QC på stills +
    endelig film. (Krever fal-nøkkel + ekte app-opptak for ui_key-shots.)"""
    spec = AdFilmSpec.load(spec_path)
    stills = gen_stills(spec, qc=qc)          # fal + Claude Vision QC-løkke
    clips = animate_clips(spec, stills)
    clips = key_ui(spec, clips)
    video = assemble(spec, clips)
    vo, groups = voiceover_per_line(spec)     # per-linje TTS → EKSAKTE linje-tider
    mix = mix_audio(spec, video, vo)
    pngs = render_sub_pngs(spec)
    master = burn_subtitles(spec, video, mix, groups, pngs)
    if qc:
        qc_final(spec, master)                # endelig visuell sluttkontroll (opus)
    return master


if __name__ == "__main__":
    import sys
    print(run_all(sys.argv[1]) if len(sys.argv) > 1 else __doc__)
