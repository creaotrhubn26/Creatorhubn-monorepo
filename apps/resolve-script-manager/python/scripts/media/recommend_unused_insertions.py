"""Anbefal innsetting av ubrukte klipp (bryllup: «fyll hullene»).

Kobler sammen: opptakstid (Date Created + Start TC, filnavn-fallback) →
anker i timelinen (nærmeste brukte nabo fra samme kamera) → hull-analyse
rundt ankeret (lange strekk uten kutt på V1 = b-roll-mulighet, eksisterende
b-roll på V2+ demper) → score → topp-N kandidater. Valgfritt: Claude vision
(thumbnails av kandidat + timeline-kontekst) gir norsk begrunnelse+confidence.

Kjøres ETTER categorize_unused_clips (forventer dag-bin/UBRUKT/<kamera>).

Params:
  bins=Dag 1,Dag 2       dag-bins (contains-match)
  target=UBRUKT
  topN=25                antall kandidater (etter score)
  minGapSeconds=6        ignorer ankre i strekk kortere enn dette
  vision=false           true → Claude vision-begrunnelser på kandidatene
  bearer=<token>         auth for anthropic-proxy (app-flyt); ellers
                         ANTHROPIC_API_KEY-env (direkte)
  model=claude-sonnet-4-6
  maxFrames=12           frames samplet GJENNOM det ubrukte klippet (frame-for-frame)
  frameStep=2.0          ~sekunder mellom samplene (styrer antall opp til maxFrames)
  dedupe=true            duplikat-vakt: (1) dHash mot klipp som alt ligger i
                         timelinen rundt ankeret, (2) like kandidater klynges →
                         kun beste per scene, (3) maks maxPerAnchor per anker.
                         Ekskluderte rapporteres i «excluded» m/ grunn.
  dupThreshold=12        Hamming-terskel (lavere = strengere likhet)
  maxPerAnchor=2         maks kandidater per ankerpunkt
  contextWindowSec=15    vindu rundt ankeret for timeline-sjekken
  cacheDir=/tmp/postagent-thumbs

Vision ser: slutten av forrige brukte klipp + hele det ubrukte (jevnt samplet)
+ starten av neste brukte → dom (passer/ikke), begrunnelse, confidence OG
sterkeste segment (bestStartSec/bestEndSec) til trimmet innsetting.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402


def _identity(clip) -> tuple[str, str]:
    uid = ""
    try:
        uid = clip.GetUniqueId() or ""
    except Exception:
        pass
    fpath = ""
    try:
        fpath = clip.GetClipProperty("File Path") or ""
    except Exception:
        pass
    return (uid or fpath or (clip.GetName() or "")), fpath


def _natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name or "")]


def _record_key(clip):
    """Sorterbar opptaksnøkkel: (0, dato, start-tc) når begge finnes,
    ellers (1, filnavn-naturlig). Per-kamera-avgjørelsen tas av kalleren."""
    try:
        date = (clip.GetClipProperty("Date Created") or "").strip()
        tc = (clip.GetClipProperty("Start TC") or "").strip()
    except Exception:
        date, tc = "", ""
    if date and tc:
        return (0, date, tc)
    return None


def _frames_to_tc(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def _ffmpeg() -> str:
    return shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"


def _thumb(path: str, at_sec: float, cache: str) -> str | None:
    """Én jpeg-thumbnail (cached på filbane+tid)."""
    if not path or not os.path.isfile(path):
        return None
    key = hashlib.sha1(f"{path}|{at_sec:.1f}".encode()).hexdigest()[:16]
    out = os.path.join(cache, f"{key}.jpg")
    if os.path.exists(out):
        return out
    os.makedirs(cache, exist_ok=True)
    r = subprocess.run([_ffmpeg(), "-y", "-v", "error", "-ss", f"{at_sec:.2f}", "-i", path,
                        "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "5", out],
                       capture_output=True)
    return out if os.path.exists(out) else None


def _dhash(path: str, at_sec: float) -> int | None:
    """64-bit dHash av én frame (9x8 gråtone via ffmpeg) — til duplikat-sjekk."""
    if not path or not os.path.isfile(path):
        return None
    r = subprocess.run([_ffmpeg(), "-v", "error", "-ss", f"{max(0.1, at_sec):.2f}", "-i", path,
                        "-frames:v", "1", "-vf", "scale=9:8:flags=area,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True)
    d = r.stdout
    if len(d) < 72:
        return None
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (1 if d[y * 9 + x] > d[y * 9 + x + 1] else 0)
    return bits


def _ham(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _clip_sig(path: str, dur: float) -> list[int]:
    """Hash-signatur: frames på 25/50/75 % av klippet."""
    out = []
    for p in (0.25, 0.5, 0.75):
        h = _dhash(path, dur * p)
        if h is not None:
            out.append(h)
    return out


def _sim(sig_a: list[int], sig_b: list[int]) -> int | None:
    """Minste Hamming-avstand mellom to signaturer (lav = likt motiv)."""
    if not sig_a or not sig_b:
        return None
    return min(_ham(a, b) for a in sig_a for b in sig_b)


def _clip_duration_sec(clip, fps: float) -> float:
    try:
        frames = clip.GetClipProperty("Frames")
        if frames:
            return float(frames) / max(1.0, fps)
    except Exception:
        pass
    return 0.0


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline.")
        return

    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    top_n = int(params.get("topN") or 25)
    min_gap = float(params.get("minGapSeconds") or 6)
    want_vision = str(params.get("vision", "")).lower() in ("true", "1", "yes")
    cache = params.get("cacheDir") or "/tmp/postagent-thumbs"

    # ── Timeline-skann: posisjoner + V1-strekk + b-roll-dekning (V2+) ──
    pos: dict[str, int] = {}
    v1_items: list[tuple[int, int, str, str]] = []   # (start, end, navn, filbane)
    broll: list[tuple[int, int]] = []                # dekning på V2+
    tl_items: list[tuple[int, int, str, float]] = []  # (start, end, filbane, kilde-midt-sek)
    vtracks = timeline.GetTrackCount("video") or 0
    for t in range(1, vtracks + 1):
        for it in timeline.GetItemListInTrack("video", t) or []:
            try:
                mpi = it.GetMediaPoolItem()
            except Exception:
                mpi = None
            start, end = int(it.GetStart() or 0), int(it.GetEnd() or 0)
            if mpi:
                uid, fpath = _identity(mpi)
                for key in (uid, fpath):
                    if key and (key not in pos or start < pos[key]):
                        pos[key] = start
                if t == 1:
                    v1_items.append((start, end, mpi.GetName() or "?", fpath))
                if fpath:
                    try:
                        src_mid = (int(it.GetLeftOffset() or 0) + (end - start) / 2) / fps
                    except Exception:
                        src_mid = (end - start) / 2 / fps
                    tl_items.append((start, end, fpath, src_mid))
            if t >= 2:
                broll.append((start, end))
    for t in range(1, (timeline.GetTrackCount("audio") or 0) + 1):
        for it in timeline.GetItemListInTrack("audio", t) or []:
            try:
                mpi = it.GetMediaPoolItem()
            except Exception:
                continue
            if not mpi:
                continue
            uid, fpath = _identity(mpi)
            start = int(it.GetStart() or 0)
            for key in (uid, fpath):
                if key and (key not in pos or start < pos[key]):
                    pos[key] = start
    v1_items.sort()

    def v1_stretch(frame: int):
        """(strekk-lengde sek, kontekst-navn, kontekst-filbane) for V1-item på frame."""
        for s, e, name, fpath in v1_items:
            if s <= frame < e:
                return (e - s) / fps, name, fpath
        return 0.0, None, None

    def broll_covered(frame: int, pad_sec: float = 2.0) -> bool:
        pad = int(pad_sec * fps)
        return any(s - pad <= frame <= e + pad for s, e in broll)

    # ── Bins ──
    bin_names = [b.strip() for b in (params.get("bins") or "Dag 1,Dag 2").split(",") if b.strip()]
    target = (params.get("target") or "UBRUKT").strip()
    root = conn.media_pool.GetRootFolder()
    found: dict = {}

    def walk(folder):
        name = (folder.GetName() or "").strip()
        for w in bin_names:
            if w not in found and w.lower() in name.lower():
                found[w] = folder
        for sub in folder.GetSubFolderList() or []:
            walk(sub)

    walk(root)

    # ── Kandidater m/ anker + hull-score ──
    candidates = []
    analyzed = 0
    for wanted, folder in found.items():
        ubrukt = next((s for s in folder.GetSubFolderList() or []
                       if (s.GetName() or "").strip().upper() == target.upper()), None)
        if not ubrukt:
            continue
        day_cams = {(s.GetName() or "").strip(): s for s in folder.GetSubFolderList() or []
                    if (s.GetName() or "").strip().upper() != target.upper()}
        for ucam in ubrukt.GetSubFolderList() or []:
            cam = (ucam.GetName() or "").strip()
            unused = ucam.GetClipList() or []
            used = (day_cams.get(cam).GetClipList() or []) if day_cams.get(cam) else []
            merged = [(c, False) for c in unused] + [(c, True) for c in used]
            # Opptakstid når (nesten) alle har den — ellers filnavn-sekvens
            rec_keys = [_record_key(c) for c, _ in merged]
            use_record = sum(1 for k in rec_keys if k) >= max(1, int(len(merged) * 0.8))
            order = sorted(
                range(len(merged)),
                key=lambda i: rec_keys[i] if (use_record and rec_keys[i])
                else (1, str(_natural_key(merged[i][0].GetName() or ""))),
            )
            seq = [merged[i] for i in order]
            used_seq = []
            for idx, (c, is_used) in enumerate(seq):
                if is_used:
                    uid, fpath = _identity(c)
                    p = pos.get(uid) or (pos.get(fpath) if fpath else None)
                    used_seq.append((idx, c.GetName() or "?", p, fpath, _clip_duration_sec(c, fps)))
            for idx, (c, is_used) in enumerate(seq):
                if is_used:
                    continue
                analyzed += 1
                prev = next((u for u in reversed(used_seq) if u[0] < idx and u[2] is not None), None)
                nxt = next((u for u in used_seq if u[0] > idx and u[2] is not None), None)
                # (idx, navn, tl-pos, filbane, varighet-sek)
                anchor = prev or nxt
                if not anchor:
                    continue
                gap_sec, ctx_name, ctx_path = v1_stretch(anchor[2])
                if gap_sec < min_gap:
                    continue
                covered = broll_covered(anchor[2])
                _, fpath = _identity(c)
                dur = _clip_duration_sec(c, fps)
                score = min(gap_sec, 60.0) + (0.0 if covered else 20.0) + (10.0 if 2.0 <= dur <= 45.0 else 0.0)
                _uid, _ = _identity(c)
                candidates.append({
                    "clip": c.GetName() or "?",
                    "uid": _uid,
                    "camera": cam,
                    "bin": folder.GetName(),
                    "filePath": fpath,
                    "durationSec": round(dur, 1),
                    "anchorFrame": anchor[2],
                    "estTc": _frames_to_tc(anchor[2], fps),
                    "prevUsed": {"name": prev[1], "tc": _frames_to_tc(prev[2], fps)} if prev else None,
                    "nextUsed": {"name": nxt[1], "tc": _frames_to_tc(nxt[2], fps)} if nxt else None,
                    "gapSeconds": round(gap_sec, 1),
                    "brollCovered": covered,
                    "contextClip": ctx_name,
                    "_contextPath": ctx_path,
                    "_prevPath": prev[3] if prev else None,
                    "_prevDur": prev[4] if prev else 0.0,
                    "_nextPath": nxt[3] if nxt else None,
                    "_nextDur": nxt[4] if nxt else 0.0,
                    "orderedBy": "opptakstid" if use_record else "filnavn",
                    "score": round(score, 1),
                })

    candidates.sort(key=lambda cnd: -cnd["score"])

    # ── Duplikat-vakt: (1) finnes motivet alt i timelinen? (2) like kandidater ──
    excluded: list[dict] = []
    dedupe = str(params.get("dedupe", "true")).lower() in ("true", "1", "yes")
    if dedupe and candidates:
        thresh = int(params.get("dupThreshold") or 12)
        max_per_anchor = int(params.get("maxPerAnchor") or 2)
        window = int(float(params.get("contextWindowSec") or 15) * fps)

        for cand in candidates:
            cand["_sig"] = _clip_sig(cand["filePath"], cand["durationSec"] or 4.0)

        # (1) mot timelinen: hash klipp som ligger rundt ankeret (alle spor)
        ctx_cache: dict[int, list[list[int]]] = {}
        kept: list[dict] = []
        for cand in candidates:
            a = cand["anchorFrame"]
            if a not in ctx_cache:
                ctx = [ti for ti in tl_items if ti[0] < a + window and ti[1] > a - window][:16]
                sigs = []
                for _s, _e, fp, src_mid in ctx:
                    h = _dhash(fp, src_mid)
                    if h is not None:
                        sigs.append([h])
                ctx_cache[a] = sigs
            dists = [_sim(cand["_sig"], s) for s in ctx_cache[a]]
            dists = [d for d in dists if d is not None]
            if dists and min(dists) <= thresh:
                cand["reason"] = f"motivet finnes alt i timelinen rundt {cand['estTc']} (avstand {min(dists)})"
                excluded.append(cand)
            else:
                kept.append(cand)

        # (2) mot hverandre: én representant per scene (beste score først)
        reps: list[dict] = []
        for cand in kept:
            dup_of = next((r for r in reps
                           if (_sim(cand["_sig"], r["_sig"]) or 99) <= thresh), None)
            if dup_of:
                cand["reason"] = f"duplikat-scene av {dup_of['clip']}"
                excluded.append(cand)
            else:
                reps.append(cand)

        # (3) maks N per anker
        per_anchor: dict[int, int] = {}
        final: list[dict] = []
        for cand in reps:
            n = per_anchor.get(cand["anchorFrame"], 0)
            if n >= max_per_anchor:
                cand["reason"] = f"alt {max_per_anchor} kandidater på samme anker {cand['estTc']}"
                excluded.append(cand)
            else:
                per_anchor[cand["anchorFrame"]] = n + 1
                final.append(cand)
        candidates = final

    for cand in candidates + excluded:
        cand.pop("_sig", None)

    picks = candidates[:top_n]

    # ── Thumbnail per kandidat (til UI-kort) ──
    if picks and not dry_run:
        for cand in picks:
            tp = _thumb(cand["filePath"], max(0.5, (cand["durationSec"] or 2) * 0.3), cache)
            if tp:
                cand["thumb"] = tp

    # ── Claude vision (valgfritt): frame-for-frame gjennom hele klippet ──
    vision_ran = 0
    if want_vision and picks and not dry_run:
        try:
            bearer = params.get("bearer")
            if bearer:
                from anthropic_proxy import Anthropic  # type: ignore
                client = Anthropic(bearer_token=bearer)
            else:
                import anthropic  # type: ignore
                client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            model = params.get("model") or "claude-sonnet-4-6"
            max_frames = int(params.get("maxFrames") or 12)
            frame_step = float(params.get("frameStep") or 2.0)
            # prosjektindeks: gjenbruk betalte vision-dommer når klippet
            # (fingerprint) og ankeret er uendret
            _idx = None
            try:
                from project_index import ProjectIndex, fingerprint as _fp
                _idx = ProjectIndex(conn.project, resolve=conn.resolve)
            except Exception:
                _idx = None

            def grid(path: str, dur: float, n: int, lo: float = 0.02, hi: float = 0.98):
                """Jevnt samplede thumbnails gjennom [lo..hi] av klippet."""
                if not path or dur <= 0 or n <= 0:
                    return []
                pts = [lo + (hi - lo) * i / max(1, n - 1) for i in range(n)] if n > 1 else [0.5]
                out = []
                for p in pts:
                    tp = _thumb(path, max(0.2, dur * p), cache)
                    if tp:
                        out.append((tp, round(dur * p, 1)))
                return out

            for cand in picks:
                dur = cand["durationSec"] or 4.0
                if _idx and cand.get("uid"):
                    fp_now = _fp(cand["filePath"]) if cand.get("filePath") else None
                    cached = _idx.get_analysis(f"vision:{cand['anchorFrame']}",
                                               cand["uid"], fp_now)
                    if cached:
                        cand["vision"] = cached
                        cand["visionCached"] = True
                        vision_ran += 1
                        for k in ("_prevPath", "_prevDur", "_nextPath", "_nextDur",
                                  "_contextPath"):
                            cand.pop(k, None)
                        continue
                n = max(4, min(max_frames, int(dur / frame_step) + 1))
                cand_frames = grid(cand["filePath"], dur, n)          # hele klippet
                prev_frames = grid(cand.pop("_prevPath", None), cand.pop("_prevDur", 0),
                                   2, 0.75, 0.95)                     # slutten av forrige brukte
                next_frames = grid(cand.pop("_nextPath", None), cand.pop("_nextDur", 0),
                                   2, 0.05, 0.25)                     # starten av neste brukte
                cand.pop("_contextPath", None)
                if not cand_frames:
                    cand["vision"] = {"error": "ingen frames (offline media?)"}
                    continue
                content = []
                for tp, _at in prev_frames + cand_frames + next_frames:
                    with open(tp, "rb") as fh:
                        content.append({"type": "image", "source": {
                            "type": "base64", "media_type": "image/jpeg",
                            "data": base64.standard_b64encode(fh.read()).decode()}})
                ts_list = ", ".join(f"{at}s" for _tp, at in cand_frames)
                content.append({"type": "text", "text": (
                    "Du hjelper en bryllupsfilm-klipper. "
                    + (f"Bilde 1-{len(prev_frames)}: SLUTTEN av klippet som ligger i timelinen "
                       f"FØR hullet ({cand['prevUsed']['name']}). " if prev_frames else "")
                    + f"Deretter {len(cand_frames)} bilder samplet GJENNOM HELE det UBRUKTE klippet "
                    f"({cand['clip']}, {dur}s, kamera {cand['camera']}, tidspunkter: {ts_list}). "
                    + (f"Siste {len(next_frames)} bilder: STARTEN av klippet som kommer ETTER hullet "
                       f"({cand['nextUsed']['name']}). " if next_frames else "")
                    + f"Hullet er på ~{cand['estTc']}, et {cand['gapSeconds']}s strekk uten kutt"
                    + (", allerede b-roll der" if cand["brollCovered"] else ", ingen b-roll der") + ". "
                    "Vurder HELE forløpet i det ubrukte klippet (bevegelse, innhold som endrer seg, "
                    "uskarpe/rotete partier) og pek ut det STERKESTE sammenhengende segmentet. "
                    'Svar KUN med JSON: {"beskrivelse": "<hva skjer gjennom klippet, 1-2 setninger>", '
                    '"passer": true/false, "begrunnelse": "<1-2 setninger på norsk: passer det mellom '
                    'før- og etter-klippet?>", "confidence": 0-100, '
                    '"bestStartSec": <sek>, "bestEndSec": <sek>, '
                    '"segmentGrunn": "<kort hvorfor akkurat dette segmentet>"}')})
                try:
                    msg = client.messages.create(model=model, max_tokens=500,
                                                 messages=[{"role": "user", "content": content}])
                    text = msg.content[0].text if getattr(msg, "content", None) else "{}"
                    text = text[text.find("{"):text.rfind("}") + 1]
                    cand["vision"] = json.loads(text)
                    cand["framesAnalyzed"] = len(cand_frames) + len(prev_frames) + len(next_frames)
                    vision_ran += 1
                    if _idx and cand.get("uid"):
                        try:
                            _idx.record_analysis(f"vision:{cand['anchorFrame']}", cand["uid"],
                                                 cand["vision"],
                                                 _fp(cand["filePath"]) if cand.get("filePath") else None)
                            _idx.commit()
                        except Exception:
                            pass
                except Exception as e:  # per-kandidat: fortsett
                    cand["vision"] = {"error": str(e)[:150]}

            # ── Scene-dedup: samme MOTIV beskrevet ulikt lurer piksel-hash —
            # la Claude gruppere kandidatene på beskrivelsene (tekst, billig).
            with_desc = [c for c in picks if (c.get("vision") or {}).get("beskrivelse")
                         and c["vision"].get("passer") is not False]
            if dedupe and len(with_desc) >= 2:
                listing = "\n".join(
                    f"{i}: {c['clip']} (confidence {c['vision'].get('confidence', '?')}) — "
                    f"{c['vision']['beskrivelse']}" for i, c in enumerate(with_desc))
                try:
                    msg = client.messages.create(model=model, max_tokens=400, messages=[{
                        "role": "user", "content":
                        "Bryllupsfilm-kandidater til b-roll. Grupper klipp som viser SAMME "
                        "scene/motiv (f.eks. flere panoreringer av samme dekorerte vegg = én "
                        "gruppe; en klipper trenger bare ett av dem).\n" + listing +
                        '\nSvar KUN med JSON: {"grupper": [[indekser som er samme scene], ...]} '
                        "— kun grupper med 2+ klipp."}])
                    text = msg.content[0].text
                    groups = json.loads(text[text.find("{"):text.rfind("}") + 1]).get("grupper", [])
                    for g in groups:
                        members = [with_desc[i] for i in g if 0 <= i < len(with_desc)]
                        if len(members) < 2:
                            continue
                        members.sort(key=lambda c: -(c["vision"].get("confidence") or 0))
                        rep = members[0]
                        for dup in members[1:]:
                            dup["vision"]["passer"] = False
                            dup["vision"]["begrunnelse"] = (
                                f"Samme scene som {rep['clip']} — velg én. "
                                + (dup["vision"].get("begrunnelse") or ""))[:300]
                            excluded.append({**dup, "reason": f"samme scene som {rep['clip']}"})
                except Exception:
                    pass  # dedup er best-effort — kandidatene består uansett
        except Exception as e:
            for cand in picks:
                cand.setdefault("vision", {"error": f"vision utilgjengelig: {str(e)[:120]}"})

    for cand in picks:
        for k in ("_contextPath", "_prevPath", "_prevDur", "_nextPath", "_nextDur"):
            cand.pop(k, None)

    # ── Grønne markører på anbefalte hjemsteder (valgfritt) ──
    markers_added = 0
    if str(params.get("markers", "")).lower() in ("true", "1", "yes") and picks and not dry_run:
        tl_start = int(timeline.GetStartFrame() or 0)
        groups: dict[int, list] = {}
        for cand in picks:
            if cand.get("vision", {}).get("passer") is False:
                continue  # marker kun det som (trolig) passer
            groups.setdefault(cand["anchorFrame"], []).append(cand)
        for frame, group in groups.items():
            lines = []
            for cand in group[:8]:
                vi = cand.get("vision") or {}
                if vi.get("begrunnelse"):
                    seg = (f" [beste segment {vi['bestStartSec']}–{vi['bestEndSec']}s]"
                           if vi.get("bestStartSec") is not None else "")
                    lines.append(f"{cand['clip']} ({vi.get('confidence', '?')}%){seg}: "
                                 f"{vi['begrunnelse']}")
                else:
                    lines.append(f"{cand['clip']} (score {cand['score']}, "
                                 f"{cand['gapSeconds']}s strekk uten kutt)")
            try:
                if timeline.AddMarker(max(0, frame - tl_start), "Green",
                                      f"ANBEFALT ({len(group)})",
                                      "Ubrukte klipp som kunne passet her:\n" + "\n".join(lines), 1):
                    markers_added += 1
            except Exception:
                pass

    bridge.result({
        "timeline": timeline.GetName(),
        "fps": fps,
        "analyzedUnused": analyzed,
        "candidatesTotal": len(candidates),
        "topN": top_n,
        "visionRan": vision_ran,
        "markersAdded": markers_added,
        "recommendations": picks,
        "excluded": [{"clip": e["clip"], "estTc": e["estTc"], "reason": e.get("reason", "")}
                     for e in excluded],
        "dryRun": dry_run,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
