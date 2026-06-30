"""
Revisjons-motor — generaliserbar kjerne for feedback → fiks → evaluer-sløyfen.

Designet rundt PetKey-lærdommen (se memory project_revision_feedback_loop):
ett strukturert `revision_spec` som AI genererer, motoren utfører, evaluatoren
sjekker og mennesket redigerer. Tre PLUGGBARE registre gjør at sløyfen
generaliserer til alle prosjekt-typer (lyd i dag; farge/reframe/teksting senere):

  ANCHOR_RESOLVERS  — modalitet → finn eksakt timecode for et story-anker
  FIXERS            — fiks-type → parameterisert, deterministisk endring
  EVALUATORS        — metrikk → ble tilbakemeldingen beviselig fulgt?

Motoren har INGEN Resolve-avhengighet — scripts injiserer kontekst (målinger,
timeline-info) så modulen kan enhets-testes frittstående.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Callable

SPEC_VERSION = 1

# ── domene-vokabular (utvidbart) ───────────────────────────────────────────
TARGETS = ("audio", "color", "reframe", "text", "pacing")       # voks fritt
INTENTS = ("replace", "level", "transition", "timing", "look", "remove", "add")

# ── datamodell ──────────────────────────────────────────────────────────────
@dataclass
class FeedbackItem:
    """Ett diskret punkt utledet fra fri-tekst tilbakemelding."""
    id: str
    text: str                       # ordrett kunde-formulering
    target: str = "audio"           # TARGETS
    intent: str = "level"           # INTENTS
    anchor: str | None = None       # story-anker, fri tekst ("når appen vises")
    anchor_tc: str | None = None    # løst timecode (HH:MM:SS:FF) — None til lokalisert
    anchor_confidence: float = 0.0  # 0..1; < gate => MÅ bekreftes av menneske
    status: str = "received"        # received|localized|planned|executed|evaluated
    needs_confirm: bool = True
    ambiguous: bool = False         # True hvis ankeret matcher flere steder → MÅ spørre hvor
    candidates: list = field(default_factory=list)  # [{tc, t_s, context}] ved tvetydighet

@dataclass
class Change:
    """En parameterisert endring knyttet til ett feedback-punkt."""
    id: str
    feedback_id: str
    fixer: str                      # nøkkel i FIXERS
    params: dict[str, Any] = field(default_factory=dict)
    evaluator: str | None = None    # nøkkel i EVALUATORS
    expect: dict[str, Any] = field(default_factory=dict)  # forventning evaluatoren sjekker

@dataclass
class RevisionSpec:
    job: str
    timeline: str
    fps: float = 25.0
    start_tc: str = "01:00:00:00"
    duration_s: float = 0.0
    feedback: list[FeedbackItem] = field(default_factory=list)
    changes: list[Change] = field(default_factory=list)
    version: int = SPEC_VERSION

    def to_dict(self) -> dict[str, Any]: return asdict(self)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "RevisionSpec":
        fb = [FeedbackItem(**x) for x in d.get("feedback", [])]
        ch = [Change(**x) for x in d.get("changes", [])]
        return RevisionSpec(job=d["job"], timeline=d["timeline"], fps=d.get("fps", 25.0),
                            start_tc=d.get("start_tc", "01:00:00:00"), duration_s=d.get("duration_s", 0.0),
                            feedback=fb, changes=ch, version=d.get("version", SPEC_VERSION))

# ── timecode-hjelpere ────────────────────────────────────────────────────────
def s_to_tc(sec: float, fps: float = 25.0, start_tc: str = "01:00:00:00") -> str:
    sh, sm, ss, sf = (int(x) for x in start_tc.split(":"))
    base = ((sh*3600 + sm*60 + ss) * fps) + sf
    f = int(round(base + sec * fps))
    return f"{f//int(3600*fps):02d}:{(f//int(60*fps))%60:02d}:{(f//int(fps))%60:02d}:{f%int(fps):02d}"

def tc_to_s(tc: str, fps: float = 25.0, start_tc: str = "01:00:00:00") -> float:
    def fr(t): h,m,s,f=(int(x) for x in t.split(":")); return ((h*3600+m*60+s)*fps)+f
    return (fr(tc)-fr(start_tc))/fps

# ── PLUGGBARE REGISTRE ───────────────────────────────────────────────────────
# Resolver: (anker-tekst, kontekst) -> {tc, confidence, still?, why}
ANCHOR_RESOLVERS: dict[str, Callable[[str, dict], dict]] = {}
# Fixer: (params, kontekst) -> {ok, output?}  (den deterministiske byggeren)
FIXERS: dict[str, Callable[[dict, dict], dict]] = {}
# Evaluator: (change, målinger) -> {passed: bool, evidence: str}
EVALUATORS: dict[str, Callable[[Any, dict], dict]] = {}

def resolver(modality: str):
    def deco(fn): ANCHOR_RESOLVERS[modality] = fn; return fn
    return deco
def fixer(key: str):
    def deco(fn): FIXERS[key] = fn; return fn
    return deco
def evaluator(key: str):
    def deco(fn): EVALUATORS[key] = fn; return fn
    return deco

# ── innebygde EVALUATORS (rene funksjoner på målinger — testbare) ────────────
@evaluator("dialogue_evenness")
def _eval_even(change, meas: dict) -> dict:
    spread = meas.get("dialogue_rms_spread_db")
    lim = change.expect.get("max_spread_db", 4.0)
    ok = spread is not None and spread <= lim
    return {"passed": ok, "evidence": f"dialog-spenn {spread} dB (mål ≤ {lim})"}

@evaluator("peak_ceiling")
def _eval_peak(change, meas: dict) -> dict:
    pk = meas.get("peak_db"); lim = change.expect.get("max_peak_db", -3.0)
    ok = pk is not None and pk <= lim + 0.1
    return {"passed": ok, "evidence": f"peak {pk} dB (tak {lim})"}

@evaluator("music_at")
def _eval_music(change, meas: dict) -> dict:
    # meas['music_segments'] = [{song, tl_in_tc, tl_out_tc}]
    want = change.expect.get("song", "").lower(); near_tc = change.expect.get("at_tc")
    for seg in meas.get("music_segments", []):
        if want in seg.get("song", "").lower():
            return {"passed": True, "evidence": f"{seg['song']} @ {seg.get('tl_in_tc')}"}
    return {"passed": False, "evidence": f"fant ikke '{want}' nær {near_tc}"}

@evaluator("loudness_target")
def _eval_loud(change, meas: dict) -> dict:
    lufs = meas.get("integrated_lufs"); tgt = change.expect.get("target_lufs", -14.0)
    tol = change.expect.get("tol", 1.0)
    ok = lufs is not None and abs(lufs - tgt) <= tol
    return {"passed": ok, "evidence": f"{lufs} LUFS (mål {tgt}±{tol})"}

@evaluator("manual")
def _eval_manual(change, meas: dict) -> dict:
    # kreative punkter ('bygg gradvis', 'føles brått') kan ikke auto-verifiseres
    return {"passed": None, "evidence": "kreativt — krever menneskelig signoff"}

# ── evaluering av en hel spec ────────────────────────────────────────────────
def evaluate(spec: RevisionSpec, measurements: dict) -> list[dict]:
    """Kjør registrerte evaluators per change → liste m/ status pr feedback-punkt."""
    out = []
    by_fb = {f.id: f for f in spec.feedback}
    for ch in spec.changes:
        ev = EVALUATORS.get(ch.evaluator or "manual", EVALUATORS["manual"])
        r = ev(ch, measurements)
        fb = by_fb.get(ch.feedback_id)
        out.append({"feedback_id": ch.feedback_id,
                    "feedback": fb.text if fb else ch.feedback_id,
                    "evaluator": ch.evaluator, "passed": r["passed"], "evidence": r["evidence"]})
    return out

def confidence_gate(item: FeedbackItem, gate: float = 0.75) -> bool:
    """True hvis lokaliseringen er trygg nok til å utføres uten bekreftelse."""
    return item.anchor_tc is not None and item.anchor_confidence >= gate and not item.ambiguous


def find_anchor_occurrences(anchor: str, words: list[dict], fps: float = 25.0,
                            start_tc: str = "01:00:00:00") -> dict:
    """Finn ALLE steder en anker-frase sies i videoen (fra transkript m/ ord-tider).

    Lærdom (Daniel, PetKey katte-SoMe): hvis en replikk gjentas — f.eks. «ja» sies
    BÅDE når mamma svarer i starten OG i «Ja, kanskje det» til slutt — MÅ systemet
    flagge tvetydighet og SPØRRE brukeren hvor fiksen skal gjøres, ikke gjette.

    words: [{"word": str, "start": sec, "end": sec}]
    Returnerer {matches: [{tc, t_s, context}], count, needs_disambiguation}.
    """
    key = anchor.lower().strip(" ,.?!")
    toks = key.split()
    matches = []
    for i, w in enumerate(words):
        seq = " ".join(x["word"].lower().strip(" ,.?!") for x in words[i:i+len(toks)])
        if seq == key or (len(toks) == 1 and key in w["word"].lower()):
            ctx = " ".join(x["word"].strip() for x in words[max(0,i-2):i+len(toks)+2])
            matches.append({"tc": s_to_tc(w["start"], fps, start_tc),
                            "t_s": round(w["start"], 2), "context": ctx})
    return {"matches": matches, "count": len(matches),
            "needs_disambiguation": len(matches) > 1}


def scan_gap_artifacts(samples, sr: int, speech_intervals: list, fps: float = 25.0,
                       start_tc: str = "01:00:00:00", thresh_db: float = -30.0,
                       win: float = 0.4, protect: list | None = None) -> list:
    """Skann dialog for ARTEFAKTER: hørbar energi UTENFOR tale-segmentene.

    Lærdom (Daniel, katte-SoMe): demucs/leveling lager pust/bleed/whoosh i pausene
    mellom replikker (f.eks. en boostet pust @28s). Artefakt-skanning MÅ være et fast
    steg i revisjons-prosessen. Loud lyd i en pause = artefakt-kandidat → flagg m/ TC.

    `protect`: liste av (t0,t1) som er kjent ekte tale (f.eks. en stille «Ja?» whisper
    bommer på) — flagges IKKE som artefakt.
    samples: mono float; speech_intervals: [(start_s,end_s)] fra whisper ord-tider.
    Returnerer [{tc, t_s, level_db, severity}].
    """
    import math
    n = len(samples); sp="speech"
    def is_speech(t0, t1):
        for s, e in speech_intervals:
            if t0 < e and t1 > s: return True
        return False
    def is_protected(t0, t1):
        for s, e in (protect or []):
            if t0 < e and t1 > s: return True
        return False
    out = []; t = 0.0
    while t < n / sr:
        i0, i1 = int(t * sr), int(min((t + win) * sr, n))
        if i1 - i0 > 10 and not is_speech(t, t + win) and not is_protected(t, t + win):
            seg = samples[i0:i1]
            rms = 20 * math.log10((sum(float(x) * x for x in seg) / len(seg)) ** 0.5 + 1e-9) if len(seg) else -99
            if rms > thresh_db:
                sev = "high" if rms > thresh_db + 10 else "med"
                out.append({"tc": s_to_tc(t, fps, start_tc), "t_s": round(t, 2),
                            "level_db": round(rms, 1), "severity": sev})
        t += win
    return out


@fixer("tascam_line_replace")
def _fix_tascam(params: dict, ctx: dict) -> dict:
    """Gjenbrukbar fiks: rens EN replikk ved å hente samme take fra dual-system
    Tascam (mygg-bin), synke frame-presist og splice inn. Implementasjon i
    `revision_tascam.py` (find_line_in_mics → extract_clean → align_to_edit →
    level_match → splice). Verifisert PetKey katte-SoMe: «En i klassen min…» fra
    005_310403.wav @226.9s, synket til edit @60.4s. params:
    {ref_clip, mic_files[], dialogue_path, edit_search[t0,t1], target_rms_db}."""
    import revision_tascam as T
    gate = params.get("min_corr", 0.72)   # KONFIDANS-TERSKEL (lærdom: 0.67 var falskt BTS-treff)
    f = T.find_line_in_mics(params["ref_clip"], params["mic_files"])
    if not f["best"]:
        return {"ok": False, "why": "ikke funnet i mygg-filer"}
    if f["best"]["corr"] < gate:
        # under terskel → IKKE splice (ville ellers satt inn feil take/BTS-prat) → flagg for menneske
        return {"ok": False, "why": f"ingen trygt treff (beste korr {f['best']['corr']} < {gate})",
                "needs_human": True, "candidates": f["all"][:5]}
    return {"ok": True, "found": f["best"], "candidates": f["all"][:5],
            "note": "extract_clean→align_to_edit→level_match→splice for å fullføre"}


@evaluator("no_gap_artifacts")
def _eval_artifacts(change, meas: dict) -> dict:
    arts = meas.get("gap_artifacts", [])
    n = len([a for a in arts if a.get("severity") == "high"])
    return {"passed": n == 0, "evidence": f"{len(arts)} pause-artefakter ({n} høye)"}


@resolver("dialogue_phrase")
def _resolve_dialogue(anchor: str, ctx: dict) -> dict:
    """Anker-resolver for dialog: krever ctx['words'] (whisper ord-tider).
    >1 treff => needs_disambiguation => UI MÅ spørre hvor."""
    r = find_anchor_occurrences(anchor, ctx.get("words", []),
                                ctx.get("fps", 25.0), ctx.get("start_tc", "01:00:00:00"))
    if r["count"] == 0:
        return {"tc": None, "confidence": 0.0, "why": "ikke funnet", "candidates": []}
    if r["needs_disambiguation"]:
        return {"tc": None, "confidence": 0.3, "why": f"{r['count']} steder — må bekreftes",
                "candidates": r["matches"]}
    return {"tc": r["matches"][0]["tc"], "confidence": 0.9, "why": "ett treff",
            "candidates": r["matches"]}

__all__ = ["RevisionSpec","FeedbackItem","Change","evaluate","confidence_gate",
           "ANCHOR_RESOLVERS","FIXERS","EVALUATORS","resolver","fixer","evaluator",
           "s_to_tc","tc_to_s","TARGETS","INTENTS","SPEC_VERSION"]
