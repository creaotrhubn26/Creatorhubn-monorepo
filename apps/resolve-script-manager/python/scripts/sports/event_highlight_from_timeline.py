"""
Sports Event — bygg cinematisk highlight fra en KILDE-timeline (generisk).

Klipper MUSIKK-FØRST og PÅ BEAT (librosa beat-tracking): stille oppbygning på
låt 1 med lengre, akselererende klipp → hardt kutt til motor-låt på dens drop →
tett beat-puls, med slow-mo hero-treff på sterke beats. Shot-variasjon (aldri
lik kilde/type etter hverandre; drone som pust). Vision scorer innsats
(klatring/kryp/slit/gjørme) for «tungt & slitent».

Research-prinsipper: klipp på beatet, akselererende rytme mot toppen, kontrast
sakte/raskt, slow-mo reservert til drop/klimaks, shot-variasjon mot monotoni.

Metoder (alle verifisert i Resolve-API): vertikal timeline via
useCustomSettings; slow-mo via symlink→FPS=25 (50→25=2x, original urørt);
9:16-reframe via SmartReframe (AI motiv-sporing), ZoomX/Y fallback.

params: { source_timeline?(current), buildup_song?("Long Goodbye"),
          main_song?("Grains"), target_s?(100), buildup_s?(38),
          aspect?("16:9"|"9:16"), new_timeline_name?, use_vision?(true),
          slowmo?(true) }
result: { timeline, aspect, cuts, duration_s, buildup_cuts, main_cuts,
          slowmo_n, tempo, songs }
"""
from __future__ import annotations
import os, sys, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge
import vision_bridge

TERRAIN = ("mud", "water", "dirt", "soil", "ground", "sand", "swamp", "field", "outdoor")
EFFORT_TYPES = ("klatring", "kryp", "slit")


def _frame(path, t):
    f = tempfile.mktemp(suffix=".jpg")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-ss", f"{max(0,t):.2f}", "-i", path,
                    "-frames:v", "1", "-vf", "scale=640:-2", f], check=False)
    return f if os.path.exists(f) else None


def _score_clip(clip, use_vision):
    if clip["kind"] == "drone":
        return 0.4, "oversikt", ["drone/oversikt"], "aerial"
    why, score, typ, scene_top = [], 0.25, "action", ""
    if use_vision:
        fr = _frame(clip["path"], clip["src_in_s"] + min(clip["dur_s"] / 2, 1.5))
        vz = vision_bridge.analyze_image(fr, requests="pose,quality,classify") if fr else None
        if fr and os.path.exists(fr):
            os.remove(fr)
        if vz:
            arms, horiz, fq = vz.get("arms_raised", 0), vz.get("horizontal", 0), vz.get("face_quality", 0)
            sc = vz.get("scene", [])
            scene_top = (sc[0].get("label", "") if sc else "").lower()
            scene = " ".join(s.get("label", "") for s in sc).lower()
            terrain = any(w in scene for w in TERRAIN)
            persons = len(vz.get("persons", []))
            score = 0.9 * arms + 0.8 * horiz + 0.6 * fq + (0.3 if terrain else 0) + (0.15 if persons else 0)
            if arms: typ = "klatring"; why.append("armer/klatring")
            elif horiz: typ = "kryp"; why.append("horisontal (kryp/gjørme)")
            elif fq >= 0.4: typ = "slit"; why.append(f"slit-ansikt q={fq:.2f}")
            if terrain: why.append("terreng")
    return round(min(1.4, score), 3), typ, (why or ["bevegelse"]), scene_top


def _motion_at(path, t, gap=0.4):
    """rask bevegelses-måling: to små gråtone-frames ~gap fra hverandre → mean abs diff.
    Skiller action (høy) fra «folk står» (lav). → 0..~40."""
    import numpy as np
    a = tempfile.mktemp(suffix=".jpg"); b = tempfile.mktemp(suffix=".jpg")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-ss", f"{max(0,t):.2f}", "-i", path,
                    "-frames:v", "1", "-vf", "scale=96:54,format=gray", a], check=False)
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-ss", f"{max(0,t)+gap:.2f}", "-i", path,
                    "-frames:v", "1", "-vf", "scale=96:54,format=gray", b], check=False)
    try:
        import numpy as np
        from PIL import Image
        ia = np.asarray(Image.open(a), dtype="float32"); ib = np.asarray(Image.open(b), dtype="float32")
        m = float(np.mean(np.abs(ia - ib)))
    except Exception:
        m = 0.0
    for f in (a, b):
        try: os.remove(f)
        except OSError: pass
    return m


def _score_best_moment(clip, use_vision):
    """Sampler flere frames over hele klippet og velger BESTE øyeblikk. Faktorerer
    inn BEVEGELSE (action vs «folk står»). → (score, type, why, scene_top, best_t)."""
    dur = clip["dur_s"] or 4.0
    if clip["kind"] == "drone":
        return 0.4, "oversikt", ["drone/oversikt"], "aerial", dur * 0.4
    times = [dur * f for f in (0.2, 0.4, 0.6, 0.8)] if dur > 3 else [max(0.0, dur / 2)]
    if not use_vision:
        return 0.3, "action", ["bevegelse"], "", times[len(times) // 2]
    best = (0.2, "action", ["bevegelse"], "", times[0])
    for t in times:
        fr = _frame(clip["path"], t)
        vz = vision_bridge.analyze_image(fr, requests="pose,quality,classify") if fr else None
        if fr and os.path.exists(fr):
            os.remove(fr)
        if not vz:
            continue
        arms, horiz, fq = vz.get("arms_raised", 0), vz.get("horizontal", 0), vz.get("face_quality", 0)
        sc = vz.get("scene", [])
        scene_top = (sc[0].get("label", "") if sc else "").lower()
        scene = " ".join(s.get("label", "") for s in sc).lower()
        terrain = any(w in scene for w in TERRAIN)
        persons = len(vz.get("persons", []))
        score = 0.9 * arms + 0.8 * horiz + 0.6 * fq + (0.3 if terrain else 0) + (0.15 if persons else 0)
        if score > best[0]:
            if arms: typ, why = "klatring", ["armer/klatring"]
            elif horiz: typ, why = "kryp", ["horisontal (kryp/gjørme)"]
            elif fq >= 0.4: typ, why = "slit", [f"slit-ansikt q={fq:.2f}"]
            else: typ, why = "action", ["bevegelse"]
            if terrain: why.append("terreng")
            best = (round(min(1.4, score), 3), typ, why, scene_top, t)
    # BEVEGELSES-vekting: demp statiske «folk står»-shots kraftig, belønn action
    sc, typ, why, scene_top, best_t = best
    mot = _motion_at(clip["path"], best_t)
    mnorm = min(1.0, mot / 12.0)
    sc = round(sc * (0.4 + 0.6 * mnorm), 3)
    why = why + [f"{'lite ' if mnorm < 0.35 else ''}bevegelse ({mot:.0f})"]
    return sc, typ, why, scene_top, best_t


def _find_song(mp, needle):
    needle = needle.lower(); stack = [mp.GetRootFolder()]
    while stack:
        f = stack.pop()
        for c in f.GetClipList():
            p = (c.GetClipProperty("File Path") or "")
            if needle in (c.GetName() or "").lower() and p.lower().endswith((".wav", ".mp3", ".aif", ".aiff")):
                return c, p
        stack += f.GetSubFolderList()
    return None, None


def _beats(path):
    """→ (tempo, beat_times[], energy_per_beat[]) via librosa."""
    import numpy as np, librosa
    w = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", path, "-ac", "1", "-ar", "22050", w], check=False)
    y, sr = librosa.load(w, sr=22050)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
    be = np.interp(beats, rt, rms); be = be / (be.max() + 1e-9)
    return float(np.atleast_1d(tempo)[0]), list(map(float, beats)), list(map(float, be))


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np

    buildup_song = params.get("buildup_song", "Long Goodbye")
    main_song = params.get("main_song", "Grains")
    target = float(params.get("target_s", 100))
    bu_dur = float(params.get("buildup_s", 38))
    aspect = params.get("aspect", "16:9")
    use_vision = bool(params.get("use_vision", True))
    slowmo = bool(params.get("slowmo", True))
    W, H = (1080, 1920) if aspect == "9:16" else (1920, 1080)
    name = params.get("new_timeline_name") or f"Highlight {aspect} — cinematic"

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt"); sys.exit(1)
    pr = conn.project; mp = pr.GetMediaPool()
    fps = float(pr.GetSetting("timelineFrameRate") or 25)

    from_bins = bool(params.get("from_bins", False))
    exclude_bins = set(b.lower() for b in params.get("exclude_bins", ["musikk", "music"]))
    clips = []
    if from_bins:
        # KILDE = alle video-klipp i binene (unntatt musikk) → stor pool for NO-REUSE
        stack = [mp.GetRootFolder()]
        while stack:
            f = stack.pop()
            if (f.GetName() or "").lower() in exclude_bins:
                continue
            for cl in f.GetClipList():
                path = cl.GetClipProperty("File Path") or ""
                if not path.lower().endswith((".mxf", ".mp4", ".mov", ".m4v")):
                    continue
                # hopp over hjelpe-media (slow-mo-symlinks, crossfaddet musikk-bed)
                if "rr_slow" in path or "rr_music" in path or "_SLOW" in (cl.GetName() or ""):
                    continue
                try: srcfps = float(cl.GetClipProperty("FPS") or fps)
                except Exception: srcfps = fps
                try: dur = float(cl.GetClipProperty("Frames") or 0) / srcfps
                except Exception: dur = 0.0
                nm = cl.GetName() or ""
                clips.append({"mpi": cl, "path": path, "srcfps": srcfps, "src_in_s": 0.0,
                              "dur_s": dur, "name": nm,
                              "kind": "drone" if ("DJI" in nm or path.lower().endswith(".mp4")) else "cam"})
            stack += f.GetSubFolderList()
        # score-cache (unngå re-scoring ved iterasjon)
        import json as _json
        cache_path = os.path.join(tempfile.gettempdir(), "rr_score_cache.json")
        try: cache = _json.load(open(cache_path))
        except Exception: cache = {}
        bridge.log(f"Bins: {len(clips)} klipp · finner beste øyeblikk (Vision={'på' if use_vision else 'av'}, cache={len(cache)}) …")
        for i, c in enumerate(clips):
            bridge.progress(i + 1, len(clips), c["name"][:26])
            ck = f"{c['path']}|{round(c['dur_s'],1)}|v2mot"
            if ck in cache:
                c["score"], c["type"], c["why"], c["scene"], best_t = cache[ck]
            else:
                c["score"], c["type"], c["why"], c["scene"], best_t = _score_best_moment(c, use_vision)
                cache[ck] = [c["score"], c["type"], c["why"], c["scene"], best_t]
            c["src_in_s"] = max(0.0, best_t - 0.4)   # start litt før øyeblikket
        try: _json.dump(cache, open(cache_path, "w"))
        except Exception: pass
    else:
        src_name = params.get("source_timeline") or pr.GetCurrentTimeline().GetName()
        src_tl = next((pr.GetTimelineByIndex(i) for i in range(1, pr.GetTimelineCount() + 1)
                       if pr.GetTimelineByIndex(i).GetName() == src_name), None)
        if not src_tl:
            bridge.error(f"Fant ikke kilde «{src_name}»"); sys.exit(1)
        seen = set()
        for vt in range(1, src_tl.GetTrackCount("video") + 1):
            for it in src_tl.GetItemListInTrack("video", vt):
                mpi = it.GetMediaPoolItem()
                if not mpi: continue
                path = mpi.GetClipProperty("File Path") or ""
                try: srcfps = float(mpi.GetClipProperty("FPS") or fps)
                except Exception: srcfps = fps
                key = (path, round(it.GetLeftOffset() / srcfps, 1))
                if key in seen: continue
                seen.add(key)
                clips.append({"mpi": mpi, "path": path, "srcfps": srcfps,
                              "src_in_s": it.GetLeftOffset() / srcfps, "dur_s": it.GetDuration() / fps,
                              "name": it.GetName(),
                              "kind": "drone" if ("DJI" in it.GetName() or "drone" in path.lower()) else "cam"})
        bridge.log(f"Kilde «{src_name}»: {len(clips)} klipp · scorer (Vision={'på' if use_vision else 'av'}) …")
        for i, c in enumerate(clips):
            bridge.progress(i + 1, len(clips), c["name"][:26])
            c["score"], c["type"], c["why"], c["scene"] = _score_clip(c, use_vision)

    # ---- musikk + beats ----
    bu_c, bu_path = _find_song(mp, buildup_song)
    mn_c, mn_path = _find_song(mp, main_song)
    if not (bu_c and mn_c):
        bridge.error("Fant ikke begge låtene i media-poolen"); sys.exit(1)
    bu_tempo, bu_beats, _ = _beats(bu_path)
    mn_tempo, mn_beats, mn_en = _beats(mn_path)
    main_dur = target - bu_dur
    bridge.log(f"Beats: oppbygning {bu_tempo:.0f} BPM · motor {mn_tempo:.0f} BPM")

    # ---- kutt-grid på beat (akselererende i oppbygning, tett i motor) ----
    def cut_points(beats, lo, hi, pace):
        sel = [b for b in beats if lo <= b <= hi]
        if len(sel) < 2: return [lo, hi]
        pts, i = [sel[0]], 0
        while i < len(sel) - 1:
            prog = (sel[i] - lo) / (hi - lo + 1e-9)
            i = min(i + max(1, int(round(pace(prog)))), len(sel) - 1)
            pts.append(sel[i])
            if sel[i] >= hi: break
        return pts
    # oppbygning: ROLIGE holdte bilder (4→3 beats ≈ 4→3s @60BPM). motor: rolig start
    # → tight klimaks (2.5→1 beat). Lavere tetthet = mindre gjenbruk + mindre frenetisk.
    bu_pts = cut_points(bu_beats, 0.5, bu_dur, lambda p: 4 - 1 * p)
    mn_pts = cut_points(mn_beats, 0.3, main_dur, lambda p: 2.5 - 1.5 * p)
    # timeline-tider: motor forskyves med bu_dur
    slots = []  # (t_start, dur, section)
    for a, b in zip(bu_pts, bu_pts[1:]):
        slots.append((a, b - a, "buildup"))
    for a, b in zip(mn_pts, mn_pts[1:]):
        slots.append((bu_dur + a, b - a, "main"))
    bridge.log(f"{len(slots)} kutt på beat ({sum(1 for s in slots if s[2]=='buildup')} oppbygning + {sum(1 for s in slots if s[2]=='main')} motor)")

    # ---- STRENG no-reuse: hvert klipp maks én gang. Antall kutt begrenses av pool. ----
    def diversify(seq):
        """grådig omrokkering: unngå samme dominante scene rett etter hverandre."""
        pool, out = list(seq), []
        while pool:
            i = 0
            if out:
                for j, c in enumerate(pool):
                    if c.get("scene") != out[-1].get("scene"):
                        i = j; break
            out.append(pool.pop(i))
        return out

    n_bu = sum(1 for s in slots if s[2] == "buildup")
    n_mn = sum(1 for s in slots if s[2] == "main")
    drone = sorted((c for c in clips if c["kind"] == "drone"), key=lambda c: -c["score"])
    cam = sorted((c for c in clips if c["kind"] != "drone"), key=lambda c: -c["score"])
    # OPPBYGNING: veksle drone (atmosfære) + STERKESTE cam (aldri svake «folk står»-rester).
    bu_seq, di, ci = [], 0, 0
    while len(bu_seq) < n_bu and (di < len(drone) or ci < len(cam)):
        if di < len(drone):
            bu_seq.append(drone[di]); di += 1
        if len(bu_seq) < n_bu and ci < len(cam):
            bu_seq.append(cam[ci]); ci += 1
    used = set(c["path"] for c in bu_seq)
    # MOTOR: neste sterkeste cam (ekskl. oppbygning), bygg til topp (sterkeste SIST).
    mn_seq = list(reversed(diversify([c for c in cam if c["path"] not in used][:n_mn])))
    ordered_clips = [("buildup", c) for c in bu_seq] + [("main", c) for c in mn_seq]
    # ingen gjenbruk → antall slots = antall unike klipp
    if len(ordered_clips) < len(slots):
        bridge.warn(f"Kun {len(ordered_clips)} unike klipp for {len(slots)} kutt — kortere (ingen gjenbruk)")
        slots = slots[:len(ordered_clips)]
    else:
        ordered_clips = ordered_clips[:len(slots)]

    # ---- opprett timeline (slett eksisterende med samme navn først) ----
    mp.SetCurrentFolder(mp.GetRootFolder())
    existing = [pr.GetTimelineByIndex(i) for i in range(1, pr.GetTimelineCount() + 1)
                if pr.GetTimelineByIndex(i).GetName() == name]
    if existing:
        mp.DeleteTimelines(existing)
    tl = mp.CreateEmptyTimeline(name)
    if not tl: bridge.error("Kunne ikke opprette timeline"); sys.exit(1)
    pr.SetCurrentTimeline(tl)
    tl.SetSetting("useCustomSettings", "1")
    tl.SetSetting("timelineResolutionWidth", str(W)); tl.SetSetting("timelineResolutionHeight", str(H))

    # slow-mo mpi-cache (symlink→25fps)
    slowdir = os.path.join(tempfile.gettempdir(), "rr_slow"); os.makedirs(slowdir, exist_ok=True)
    slow_cache = {}
    def slow_mpi(path):
        if path in slow_cache: return slow_cache[path]
        link = os.path.join(slowdir, os.path.splitext(os.path.basename(path))[0] + "_SLOW" + os.path.splitext(path)[1])
        if not os.path.lexists(link):
            try: os.symlink(path, link)
            except OSError: return None
        mp.SetCurrentFolder(mp.GetRootFolder())
        imp = mp.ImportMedia([link])
        if not imp: return None
        m = imp[0]; m.SetClipProperty("FPS", "25"); slow_cache[path] = m; return m

    # bygg clipInfo: hver slot → et klipp, kutt-varighet = beat-spenn.
    # hero slow-mo: hvert ~5. motor-slot med sterk innsats, spenner lengre.
    infos, hero_flags = [], []
    for si, (t0, dur, section) in enumerate(slots):
        c = ordered_clips[si][1]     # STRENG no-reuse: ett unikt klipp per slot
        hero = (slowmo and section == "main" and c["score"] >= 0.6 and c["type"] in EFFORT_TYPES and si % 5 == 0)
        src_in = c["src_in_s"]
        if hero:
            sm = slow_mpi(c["path"])
            if sm:
                # fyll HELE beat-intervallet på timeline i halv fart: action=dur/2
                # (25fps-tolket → dur sek på 25fps-timeline). Kutt lander fortsatt på beat.
                infos.append({"mediaPoolItem": sm, "startFrame": int(round(src_in * c["srcfps"])),
                              "endFrame": int(round((src_in + dur / 2) * c["srcfps"])),
                              "trackIndex": 1, "mediaType": 1})
                hero_flags.append(True); continue
        # fyll HELE beat-intervallet fra kilden (kilde-MXF er lang) → kutt på beat
        infos.append({"mediaPoolItem": c["mpi"], "startFrame": int(round(src_in * c["srcfps"])),
                      "endFrame": int(round((src_in + dur) * c["srcfps"])), "trackIndex": 1, "mediaType": 1})
        hero_flags.append(False)
    mp.AppendToTimeline(infos)

    items = tl.GetItemListInTrack("video", 1)

    # stabilisering på hvert klipp (håndholdt action → roligere, cinematisk)
    if bool(params.get("stabilize", True)):
        stab = 0
        for it in items:
            try:
                if it.Stabilize(): stab += 1
            except Exception:
                pass
        bridge.log(f"Stabilisert {stab}/{len(items)} klipp")

    # 9:16 reframe (SmartReframe → ZoomX/Y fallback)
    if aspect == "9:16":
        zoom = round((H / W) * (16 / 9), 3)
        for it in items:
            try:
                if not it.SmartReframe(): it.SetProperty("ZoomX", zoom); it.SetProperty("ZoomY", zoom)
            except Exception:
                it.SetProperty("ZoomX", zoom); it.SetProperty("ZoomY", zoom)

    # FARGE (kun på denne timelinen, ikke prosjekt-globalt): Canon C80 C-Log2→Rec709
    # base-LUT PER KLIPP på C80-materialet. Drone er allerede Rec.709 → ingen LUT.
    cam_lut = params.get("cam_lut", "Canon C80 BaseLUTs/BaseLUT - Canon C80 - C-Log2 to Rec709.cube")
    if cam_lut:
        applied = 0
        for it, (_, c) in zip(items, ordered_clips):
            if c["kind"] == "drone":
                continue
            try:
                if it.SetLUT(1, cam_lut):
                    applied += 1
            except Exception:
                pass
        bridge.log(f"C-Log2→Rec709 LUT på {applied} C80-klipp (drone urørt)")
    # valgfri kreativ CDL oppå (av som standard)
    if bool(params.get("grade", False)):
        cdl = {"NodeIndex": "2", "Slope": "0.98 0.99 1.00", "Offset": "0 0 0",
               "Power": "1.06 1.06 1.04", "Saturation": "1.05"}
        for it in items:
            try: it.SetCDL(cdl)
            except Exception: pass

    # ---- sømløs musikk: crossfade oppbygning-låt → motor-låt til ÉN bed ----
    vid_dur = (tl.GetEndFrame() - tl.GetStartFrame()) / fps
    xf = 1.6
    combined = os.path.join(tempfile.gettempdir(), f"rr_music_{int(bu_dur)}_{int(main_dur)}.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", bu_path, "-i", mn_path, "-filter_complex",
                    f"[0:a]atrim=0:{bu_dur + xf},afade=t=in:d=1.5[a0];"
                    f"[1:a]atrim=0:{main_dur + 2}[a1];"
                    f"[a0][a1]acrossfade=d={xf}:c1=tri:c2=tri,afade=t=out:st={max(0,vid_dur-2):.1f}:d=2[out]",
                    "-map", "[out]", combined], check=False)
    mp.SetCurrentFolder(mp.GetRootFolder())
    mus = mp.ImportMedia([combined]) if os.path.exists(combined) else None
    if mus:
        mp.AppendToTimeline([{"mediaPoolItem": mus[0], "startFrame": 0, "endFrame": int(round(vid_dur * fps)),
                              "trackIndex": 1, "recordFrame": tl.GetStartFrame(), "mediaType": 2}])

    n_hero = sum(hero_flags)
    bridge.log(f"Bygde «{name}» ({aspect}) · {len(infos)} beat-kutt · {vid_dur:.0f}s · {n_hero} slow-mo · "
               f"{buildup_song}→{main_song}")
    bridge.result({"timeline": name, "aspect": aspect, "cuts": len(infos), "duration_s": round(vid_dur, 1),
                   "buildup_cuts": sum(1 for s in slots if s[2] == "buildup"),
                   "main_cuts": sum(1 for s in slots if s[2] == "main"),
                   "slowmo_n": n_hero, "tempo": {"buildup": round(bu_tempo), "main": round(mn_tempo)},
                   "songs": [f"{buildup_song} {bu_dur:.0f}s", f"{main_song} {max(0,vid_dur-bu_dur):.0f}s"]})


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
