"""Smart relink (by content) — relinker OFFLINE klipp selv når FILNAVNET er endret, ved å matche på
metadata (varighet/FPS/oppløsning/frames) i stedet for navn. Slår Resolves eksakt-navn-felle.
mode="scan": for hvert offline klipp, les kjente egenskaper fra media-pool, søk kandidat-filer under
caller-leverte searchRoots (os.walk KUN der — ALDRI blind glob over /Volumes), probe dem billig via
ffprobe (degraderer grasiøst hvis ffprobe mangler), score match og returner rangerte kandidater.
mode="apply": params {relinks:[{oldPath,newPath}]} → ReplaceClip per item (pålitelig).
Params: mode, searchRoots (liste), relinks (liste), maxCandidatesPerRoot, autoScore (terskel)."""
from __future__ import annotations
import os, sys, json, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

VIDEO_EXTS = {".mov", ".mp4", ".mxf", ".braw", ".r3d", ".mts", ".m2ts", ".avi", ".mkv", ".m4v", ".dng"}
AUDIO_EXTS = {".wav", ".aif", ".aiff", ".mp3", ".m4a", ".flac", ".aac"}
MEDIA_EXTS = VIDEO_EXTS | AUDIO_EXTS

# Auto-match: kandidat regnes som trygt auto-treff hvis score >= dette OG er unik (klart best).
DEFAULT_AUTO_SCORE = 0.92


def _has_ffprobe() -> bool:
    try:
        subprocess.run(["ffprobe", "-version"], capture_output=True, timeout=5)
        return True
    except Exception:
        return False


def _ffprobe(path: str) -> dict | None:
    """Billig metadata-probe. Returnerer {duration,fps,width,height,size,kind} eller None."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=20,
        ).stdout
        data = json.loads(out or "{}")
    except Exception:
        return None
    info: dict[str, Any] = {"size": None, "duration": None, "fps": None, "width": None, "height": None, "kind": "unknown"}
    try:
        info["size"] = int(data.get("format", {}).get("size") or 0) or None
    except (TypeError, ValueError):
        pass
    try:
        d = data.get("format", {}).get("duration")
        if d is not None:
            info["duration"] = float(d)
    except (TypeError, ValueError):
        pass
    for st in (data.get("streams") or []):
        ct = st.get("codec_type")
        if ct == "video" and info["width"] is None:
            info["kind"] = "video"
            try:
                info["width"] = int(st.get("width") or 0) or None
                info["height"] = int(st.get("height") or 0) or None
            except (TypeError, ValueError):
                pass
            rate = st.get("avg_frame_rate") or st.get("r_frame_rate") or ""
            if "/" in rate:
                try:
                    num, den = rate.split("/")
                    den = float(den)
                    if den:
                        info["fps"] = round(float(num) / den, 3)
                except (TypeError, ValueError):
                    pass
        elif ct == "audio" and info["kind"] == "unknown":
            info["kind"] = "audio"
    return info


def _clip_known_props(it) -> dict:
    """Hent kjente egenskaper for offline-klipp fra media-pool (det vi VET om originalen)."""
    cp = it.GetClipProperty() or {}
    known: dict[str, Any] = {"duration": None, "fps": None, "width": None, "height": None, "frames": None}
    # Frames
    try:
        f = cp.get("Frames")
        if f:
            known["frames"] = int(str(f).strip())
    except (TypeError, ValueError):
        pass
    # FPS
    try:
        fps = cp.get("FPS")
        if fps:
            known["fps"] = round(float(str(fps).strip()), 3)
    except (TypeError, ValueError):
        pass
    # Resolution "1920x1080"
    res = (cp.get("Resolution") or "").strip()
    if "x" in res:
        try:
            w, h = res.lower().split("x")
            known["width"] = int(w.strip())
            known["height"] = int(h.strip())
        except (TypeError, ValueError):
            pass
    # Duration: foretrekk frames/fps (presist), ellers parse "Duration"-tc grovt
    if known["frames"] and known["fps"]:
        known["duration"] = round(known["frames"] / known["fps"], 3)
    else:
        dur = (cp.get("Duration") or "").strip()
        if ":" in dur:
            parts = dur.split(":")
            try:
                if len(parts) == 4 and known["fps"]:  # HH:MM:SS:FF
                    hh, mm, ss, ff = (float(p) for p in parts)
                    known["duration"] = round(hh * 3600 + mm * 60 + ss + ff / known["fps"], 3)
                elif len(parts) >= 3:
                    hh, mm, ss = (float(p) for p in parts[:3])
                    known["duration"] = round(hh * 3600 + mm * 60 + ss, 3)
            except (TypeError, ValueError):
                pass
    return known


def _score(known: dict, cand: dict) -> tuple[float, list[str]]:
    """Score 0..1 hvor godt en kandidat matcher de kjente egenskapene. Returnerer (score, grunner)."""
    why: list[str] = []
    parts: list[float] = []
    # Varighet — sterkeste signal
    kd, cd = known.get("duration"), cand.get("duration")
    if kd and cd:
        diff = abs(kd - cd)
        tol = max(0.5, kd * 0.02)  # ±2% eller 0.5s
        s = max(0.0, 1.0 - diff / (tol * 4)) if diff <= tol * 4 else 0.0
        parts.append(s * 3.0)  # vekt 3
        if diff <= tol:
            why.append(f"varighet {cd:.1f}s ≈ {kd:.1f}s")
        else:
            why.append(f"varighet avviker ({cd:.1f}s vs {kd:.1f}s)")
    # FPS — eksakt eller ikke
    kf, cf = known.get("fps"), cand.get("fps")
    if kf and cf:
        if abs(kf - cf) < 0.05:
            parts.append(1.0)
            why.append(f"FPS {cf:g}")
        else:
            parts.append(0.0)
            why.append(f"FPS-avvik ({cf:g} vs {kf:g})")
    # Oppløsning — eksakt
    kw, kh = known.get("width"), known.get("height")
    cw, ch = cand.get("width"), cand.get("height")
    if kw and kh and cw and ch:
        if kw == cw and kh == ch:
            parts.append(1.0)
            why.append(f"{cw}x{ch}")
        else:
            parts.append(0.0)
            why.append(f"oppløsning-avvik ({cw}x{ch} vs {kw}x{kh})")
    if not parts:
        # Ingen sammenlignbar metadata (f.eks. ffprobe mangler) — nøytral lav score
        return 0.0, ["ingen metadata å score på"]
    # Normaliser: maks mulig sum = 3 (dur) + 1 (fps) + 1 (res) avhengig av hva som fantes
    max_weight = 0.0
    if kd and cd:
        max_weight += 3.0
    if kf and cf:
        max_weight += 1.0
    if kw and kh and cw and ch:
        max_weight += 1.0
    score = round(sum(parts) / max_weight, 3) if max_weight else 0.0
    return score, why


def _gather_candidates(roots: list[str], audio_only: bool, max_per_root: int) -> list[str]:
    """os.walk KUN innenfor caller-leverte roots — aldri blind /Volumes-glob. Returnerer media-filstier."""
    exts = AUDIO_EXTS if audio_only else MEDIA_EXTS
    files: list[str] = []
    for r in roots:
        if not r or not os.path.isdir(r):
            continue
        count = 0
        for dirpath, _dirs, fnames in os.walk(r):
            for fn in fnames:
                if os.path.splitext(fn)[1].lower() in exts:
                    files.append(os.path.join(dirpath, fn))
                    count += 1
                    if count >= max_per_root:
                        break
            if count >= max_per_root:
                break
    return files


def _walk(folder, acc):
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)


def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    roots = params.get("searchRoots") or []
    max_per_root = int(params.get("maxCandidatesPerRoot") or 2000)
    auto_score = float(params.get("autoScore") or DEFAULT_AUTO_SCORE)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    mp = conn.project.GetMediaPool()
    items: list[Any] = []
    _walk(mp.GetRootFolder(), items)

    # offline klipp = filsti registrert men finnes ikke på disk
    offline_items: list[tuple[Any, str, dict]] = []
    online = 0
    total_clips = 0
    for it in items:
        cp = it.GetClipProperty() or {}
        fp = cp.get("File Path", "")
        if not fp:
            continue
        total_clips += 1
        if os.path.isfile(fp):
            online += 1
            continue
        offline_items.append((it, fp, _clip_known_props(it)))

    if mode == "apply":
        relinks = params.get("relinks") or []
        if dry_run:
            bridge.result({"mode": "apply", "dryRun": True, "wouldRelink": len(relinks),
                           "note": f"Tørrkjøring: ville relinket {len(relinks)} klipp via ReplaceClip (innhold-match)."})
            return
        by_oldpath = {fp: it for it, fp, _ in offline_items}
        # fallback: indekser alle klipp på filsti i tilfelle oldPath ikke er offline-listet
        all_by_path: dict[str, Any] = {}
        for it in items:
            cp = it.GetClipProperty() or {}
            p = cp.get("File Path", "")
            if p:
                all_by_path.setdefault(p, it)
        done = 0
        failed: list[str] = []
        for i, r in enumerate(relinks, 1):
            old = r.get("oldPath")
            new = r.get("newPath")
            it = by_oldpath.get(old) or all_by_path.get(old)
            if not it or not new or not os.path.isfile(new):
                failed.append(old)
                continue
            try:
                if it.ReplaceClip(new):
                    done += 1
                else:
                    failed.append(old)
            except Exception:
                failed.append(old)
            bridge.progress(i, len(relinks), f"Relinker ({done} ok)")
        bridge.result({"mode": "apply", "relinked": done, "failed": len(failed), "failedPaths": failed[:10],
                       "note": (f"Relinket {done} klipp på innhold. " +
                                (f"{len(failed)} feilet (sjekk at ny sti finnes/matcher)." if failed else "Ferdig."))})
        return

    # ── mode == scan ───────────────────────────────────────────────────────
    have_ffprobe = _has_ffprobe()
    if not offline_items:
        bridge.result({"clips": total_clips, "online": online, "offline": 0, "items": [],
                       "ffprobe": have_ffprobe,
                       "note": "Alle media online — ingenting å relinke."})
        return
    if not roots:
        bridge.result({"clips": total_clips, "online": online, "offline": len(offline_items), "items": [],
                       "ffprobe": have_ffprobe, "needsSearchRoots": True,
                       "note": (f"⚠️ {len(offline_items)} offline klipp. Velg én eller flere søke-mapper "
                                "(searchRoots) der de nye/omdøpte filene ligger, så scanner jeg på innhold.")})
        return

    # Probe kandidater én gang (cache per sti) — del på video/audio for å unngå unødig probing
    any_audio_offline = any(os.path.splitext(fp)[1].lower() in AUDIO_EXTS for _, fp, _ in offline_items)
    any_video_offline = any(os.path.splitext(fp)[1].lower() in VIDEO_EXTS or os.path.splitext(fp)[1].lower() not in AUDIO_EXTS
                            for _, fp, _ in offline_items)
    candidate_paths = _gather_candidates(roots, audio_only=(any_audio_offline and not any_video_offline), max_per_root=max_per_root)
    bridge.log(f"Fant {len(candidate_paths)} kandidat-filer i {len(roots)} søke-mappe(r). ffprobe={have_ffprobe}")

    probe_cache: dict[str, dict] = {}

    def _candinfo(path: str) -> dict:
        if path in probe_cache:
            return probe_cache[path]
        if have_ffprobe:
            info = _ffprobe(path) or {}
        else:
            # Degradert: kun filstørrelse + type fra extension (ingen varighet/fps/res).
            info = {"size": None, "duration": None, "fps": None, "width": None, "height": None,
                    "kind": "audio" if os.path.splitext(path)[1].lower() in AUDIO_EXTS else "video"}
            try:
                info["size"] = os.path.getsize(path)
            except OSError:
                pass
        probe_cache[path] = info
        return info

    out_items = []
    auto_matchable = 0
    for idx, (it, fp, known) in enumerate(offline_items, 1):
        old_ext = os.path.splitext(fp)[1].lower()
        is_audio = old_ext in AUDIO_EXTS
        scored = []
        for cpath in candidate_paths:
            cext = os.path.splitext(cpath)[1].lower()
            # match-ekstensjon-klasse: lyd↔lyd, video↔video
            if (cext in AUDIO_EXTS) != is_audio:
                continue
            cinfo = _candinfo(cpath)
            sc, why = _score(known, cinfo)
            if not have_ffprobe:
                # Uten ffprobe har vi ingen reell match-signal — list etter ekstensjon, score 0.
                why = ["ffprobe mangler — kun ekstensjon-match (installer ffmpeg for innhold-scoring)"]
            scored.append({"path": cpath, "score": sc, "why": "; ".join(why)})
        scored.sort(key=lambda c: c["score"], reverse=True)
        top = scored[:8]
        # auto-match: best unik over terskel og klart bedre enn nr.2
        auto = None
        if have_ffprobe and len(top) >= 1 and top[0]["score"] >= auto_score:
            second = top[1]["score"] if len(top) > 1 else 0.0
            if top[0]["score"] - second >= 0.1 or len(top) == 1:
                auto = top[0]["path"]
                auto_matchable += 1
        out_items.append({
            "name": (it.GetName() or os.path.basename(fp)),
            "oldPath": fp,
            "known": known,
            "candidates": top,
            "autoMatch": auto,
        })
        bridge.progress(idx, len(offline_items), f"Scorer offline klipp ({auto_matchable} auto-treff)")

    note = f"⚠️ {len(offline_items)} offline klipp. "
    if not have_ffprobe:
        note += ("ffprobe ikke funnet — kan kun liste kandidater etter filtype, ikke score på innhold. "
                 "Installer ffmpeg (brew install ffmpeg) for å matche omdøpte filer på varighet/FPS/oppløsning. "
                 "Velg riktig fil manuelt i listen.")
    elif auto_matchable:
        note += (f"{auto_matchable} har et trygt innhold-treff (autoMatch satt — klar til apply). "
                 "Resten: velg blant rangerte kandidater i UX.")
    else:
        note += "Ingen entydige innhold-treff — gå gjennom rangerte kandidater og velg riktig fil."

    bridge.result({"clips": total_clips, "online": online, "offline": len(offline_items),
                   "ffprobe": have_ffprobe, "searchRoots": roots, "candidatesProbed": len(probe_cache),
                   "autoMatchable": auto_matchable, "items": out_items, "note": note})


if __name__ == "__main__":
    bridge.main_guard(run)
