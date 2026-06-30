"""
revision_ingest — fri-tekst klient-tilbakemelding → strukturerte feedback-punkter.

Primært: Claude via anthropic_proxy (krever RR_BEARER_TOKEN, satt av appen).
Fallback: heuristisk parser (testbar offline) så fanen aldri står tom.

Output (result): { "source": "llm"|"heuristic", "items": [FeedbackItem...] }
"""
from __future__ import annotations
import os, sys, json, re, uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge
from revision_engine import FeedbackItem, TARGETS, INTENTS

SYSTEM = (
    "Du er en video-post-produksjons-assistent. Del kunde-tilbakemelding opp i "
    "diskrete, handlbare punkter. Returner KUN gyldig JSON-array. Hvert element: "
    '{"text": ordrett sitat, "target": en av '
    f'{list(TARGETS)}, "intent": en av {list(INTENTS)}, '
    '"anchor": story-øyeblikket endringen gjelder (fri tekst, f.eks. "når appen vises", '
    '"etter at hun har vasket av skoene", "Bendik sier trodde du gjorde det") eller null}. '
    "Ett punkt pr konkret ønske. Behold kundens språk i text."
)

def _llm(feedback: str) -> list[dict] | None:
    try:
        from anthropic_proxy import Anthropic
        client = Anthropic()
        msg = client.messages.create(
            model="claude-sonnet-4-6", max_tokens=1500, system=SYSTEM,
            messages=[{"role": "user", "content": feedback}])
        text = "".join(b.text for b in msg.content if getattr(b, "text", ""))
        m = re.search(r"\[.*\]", text, re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as e:
        bridge.warn(f"LLM-ingest utilgjengelig ({e}); bruker heuristikk")
        return None

# ── heuristisk fallback ──────────────────────────────────────────────────────
_ANCHOR_PAT = re.compile(r"(?:etter at|når|naar|idet|før|foer)\s+([^.,;:]+)", re.I)
def _classify(line: str) -> dict:
    low = line.lower()
    target = "audio"
    if any(w in low for w in ("farge", "grade", "color", "look", "kontrast")): target = "color"
    elif any(w in low for w in ("reframe", "beskjær", "beskjaer", "crop", "9:16", "vertikal")): target = "reframe"
    elif any(w in low for w in ("tekst", "caption", "undertekst", "teksting")): target = "text"
    elif any(w in low for w in ("klipp", "pacing", "tempo", "rytme")): target = "pacing"
    intent = "level"
    if any(w in low for w in ("bytt", "erstatt", "ny sang", "bytt ut")): intent = "replace"
    elif any(w in low for w in ("for høyt", "for hoeyt", "skurrer", "for lavt", "juster ned", "juster opp", "nivå", "nivaa")): intent = "level"
    elif any(w in low for w in ("bygg", "gradvis", "overgang", "jevn", "myk", "brått", "braatt", "oppbygg")): intent = "transition"
    elif any(w in low for w in ("når", "naar", "etter at", "tidspunkt", "ved ")): intent = "timing"
    am = _ANCHOR_PAT.search(line)
    anchor = am.group(1).strip() if am else None
    return {"text": line.strip(), "target": target, "intent": intent, "anchor": anchor}

def _heuristic(feedback: str) -> list[dict]:
    # split på linjeskift OG setningsslutt, dropp tomme/overskrifter
    raw = re.split(r"[\n]+|(?<=[.!?])\s+", feedback)
    items = []
    for line in raw:
        line = line.strip(" -•\t")
        if len(line) < 6: continue
        if line.lower().rstrip(":") in ("lyd og musikk", "oppsummering", "some-video", "video 1", "hovedvideo"): continue
        items.append(_classify(line))
    return items

def run(params: dict) -> None:
    feedback = (params.get("feedback") or "").strip()
    if not feedback:
        bridge.error("Ingen tilbakemelding gitt (params.feedback mangler)"); sys.exit(1)
    bridge.log("Tolker tilbakemelding…")
    parsed = _llm(feedback); source = "llm"
    if not parsed:
        parsed = _heuristic(feedback); source = "heuristic"
    items = []
    for p in parsed:
        fi = FeedbackItem(id=f"fb_{uuid.uuid4().hex[:8]}", text=p.get("text", ""),
                          target=p.get("target", "audio") if p.get("target") in TARGETS else "audio",
                          intent=p.get("intent", "level") if p.get("intent") in INTENTS else "level",
                          anchor=p.get("anchor"))
        items.append(fi.__dict__)
    bridge.log(f"{len(items)} punkter ({source})")
    bridge.result({"source": source, "items": items})

if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
