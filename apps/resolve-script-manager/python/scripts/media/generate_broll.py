"""Generer b-roll med Higgsfield (Seedance 2.0) når UBRUKT ikke strekker til.

Koblingen: hull-analysen finner et strekk uten b-roll → ingen brukbare
kandidater i UBRUKT → generer et klipp som passer, FORANKRET i parets eget
materiale: en ekte frame fra klippet på ankeret brukes som --start-image,
så Seedance animerer DERES scene (samme lys, samme look) i stedet for å
finne på en fremmed. Resultatet importeres i Media Pool («GENERERT»-bin)
og kan settes inn med den vanlige innsettings-mekanikken.

Ærlige rammer: egnet for ATMOSFÆRE-inserts (dekor, blomster, ringer, lokale,
himmel, levende stillbilder) — IKKE for mennesker (generert brudepar i en
ekte bryllupsfilm er uaktuelt; prompten får automatisk «no people» med
mindre noPeople=false settes bevisst).

Modi:
  plan      Vis hva som ville blitt generert + kreditt-status. Ingen kost.
  generate  Kjør Seedance 2.0 via higgsfield-CLI (--wait), last ned, legg
            i <prosjektrot>/GENERERT/, ImportMedia → «GENERERT»-bin.
            KOSTER KREDITTER (~40-70 for 5s 1080p; 4K ≈ 3x).

Params:
  prompt=<engelsk motiv-beskrivelse>   (påkrevd for generate)
  anchorTc=<HH:MM:SS:FF>   hent start-bilde fra klippet på dette punktet
                           (utelates → ren tekst-til-video)
  imagePath=<sti>          FOTOGRAFENS stillbilde som start-bilde («levende
                           foto»: Seedance animerer det ekte bildet subtilt
                           — parallakse/push-in). Prioriteres over anchorTc.
  duration=5               sekunder (4-15)
  resolution=1080p         480p|720p|1080p|4k
  noPeople=true            legger «no people, no faces» i prompten
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402
from project_index import clip_identity  # noqa: E402

HF = os.path.expanduser("~/.local/bin/higgsfield")

# Levende foto-presets (kalibrert med Daniel 2026-07-25): bevegelsesnivå
# → prompt + varighet. Brukes når imagePath er satt og motionLevel valgt.
LIVING_PRESETS = {
    "subtle": (5, "subtle cinematic live-photo effect: very gentle slow push-in "
               "with soft parallax, natural micro-motion in fabric and hair, "
               "preserve the exact subjects, composition, colors and lighting of "
               "the photograph, photorealistic, elegant wedding film insert"),
    "medium": (6, "cinematic living photograph with clearly visible gentle motion: "
               "slow dolly-in camera move with parallax between people, the people "
               "naturally alive - subtle laughing, smiling, heads turning slightly "
               "toward each other, blinking, dupattas and fabric swaying softly, "
               "hair moving in light breeze, warm celebratory atmosphere, preserve "
               "the exact same people, faces, composition, colors and lighting as "
               "the photograph, photorealistic wedding film"),
    "high": (8, "cinematic living photograph with rich dynamic motion: slow "
             "handheld drift and gentle orbit around the group creating strong "
             "parallax, people vividly alive - laughing together, turning toward "
             "each other, gesturing naturally, fabric and dupattas flowing, "
             "celebratory energy, yet preserve the exact same people, faces, "
             "composition, colors and lighting as the photograph, photorealistic "
             "wedding film"),
}


def _tc_frames(tc: str, fps: float) -> int:
    m = re.match(r"(\d+):(\d+):(\d+)[:;](\d+)", (tc or "").strip())
    if not m:
        return 0
    h, mi, s, f = (int(x) for x in m.groups())
    return int((h * 3600 + mi * 60 + s) * round(fps) + f)


def _topmost_at(timeline, frame):
    """Øverste EKTE medieklipp på framen — generatorer/titler (uten
    mediefil) hoppes over."""
    best = None
    for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
        for it in timeline.GetItemListInTrack("video", t) or []:
            if int(it.GetStart() or 0) <= frame < int(it.GetEnd() or 0):
                try:
                    mpi = it.GetMediaPoolItem()
                    if mpi and (mpi.GetClipProperty("File Path") or ""):
                        best = (t, it)
                except Exception:
                    continue
    return best[1] if best else None


def _context_frame(timeline, tc: str, fps: float, out_dir: str) -> str | None:
    """Ekte frame fra klippet på ankeret → start-bilde for Seedance."""
    frame = _tc_frames(tc, fps)
    it = _topmost_at(timeline, frame)
    if not it:
        return None
    try:
        mpi = it.GetMediaPoolItem()
        fpath = mpi.GetClipProperty("File Path") or ""
        clip_fps = float(mpi.GetClipProperty("FPS") or fps)
    except Exception:
        return None
    if not fpath or not os.path.isfile(fpath):
        return None
    src_sec = (int(it.GetLeftOffset() or 0) + (frame - int(it.GetStart() or 0))) / clip_fps
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"context_{int(time.time())}.png")
    ff = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    subprocess.run([ff, "-y", "-v", "error", "-ss", f"{max(0.1, src_sec):.2f}", "-i", fpath,
                    "-frames:v", "1", "-vf", "scale=1920:-2", out],
                   capture_output=True, timeout=120)
    return out if os.path.isfile(out) else None


def _project_root(media_pool) -> str:
    from collections import Counter
    roots = Counter()

    def walk(folder):
        for c in folder.GetClipList() or []:
            try:
                fp = c.GetClipProperty("File Path") or ""
            except Exception:
                continue
            if fp and os.path.isfile(fp):
                parts = fp.split("/")
                if len(parts) > 3:
                    roots["/".join(parts[:4])] += 1
        for sub in folder.GetSubFolderList() or []:
            walk(sub)

    walk(media_pool.GetRootFolder())
    return roots.most_common(1)[0][0] if roots else os.path.expanduser("~/Movies")


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    timeline = project.GetCurrentTimeline()
    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0) if timeline else 25.0
    mode = (params.get("mode") or "plan").strip().lower()

    if not os.path.isfile(HF):
        bridge.error("higgsfield-CLI mangler (~/.local/bin/higgsfield) — kjør oppsettet først.")
        return
    status = ""
    try:
        status = subprocess.run([HF, "account", "status"], capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=30).stdout.strip()
    except Exception:
        pass

    prompt = (params.get("prompt") or "").strip()
    anchor_tc = (params.get("anchorTc") or "").strip()
    motion = (params.get("motionLevel") or "").strip().lower()
    img_param = os.path.expanduser((params.get("imagePath") or "").strip())
    preset_dur = None
    if img_param and motion in LIVING_PRESETS and not prompt:
        preset_dur, prompt = LIVING_PRESETS[motion]
        params = {**params, "noPeople": params.get("noPeople", "false")}
    duration = max(4, min(15, int(params.get("duration") or preset_dur or 5)))
    resolution = (params.get("resolution") or "1080p").strip()
    if str(params.get("noPeople", "true")).lower() in ("true", "1", "yes"):
        prompt = (prompt + ", no people, no faces, no text").strip(", ")
    est = {"480p": 15, "720p": 25, "1080p": 12, "4k": 22}
    est_credits = est.get(resolution, 12) * duration  # grov: ~12 kr/s 1080p, 22/s 4K

    if mode == "plan":
        ctx_available = False
        img = os.path.expanduser((params.get("imagePath") or "").strip())
        if img:
            ctx_available = os.path.isfile(img)
        elif anchor_tc and timeline:
            ctx_available = _topmost_at(timeline, _tc_frames(anchor_tc, fps)) is not None
        bridge.result({"mode": mode, "account": status, "prompt": prompt or "(mangler)",
                       "anchorTc": anchor_tc or None,
                       "contextFrameAvailable": ctx_available,
                       "duration": duration, "resolution": resolution,
                       "estCredits": est_credits,
                       "note": "generate koster kreditter og importerer i Media Pool "
                               "(«GENERERT»-bin). Forankres i ekte frame når anchorTc er satt.",
                       "dryRun": dry_run})
        return

    if mode == "generate":
        if not prompt:
            bridge.error("prompt= kreves — eller imagePath + motionLevel "
                         "(subtle|medium|high) for levende foto.")
            return
        if dry_run:
            bridge.result({"mode": mode, "dryRun": True,
                           "summary": f"Ville generert {duration}s {resolution}: {prompt[:100]}"})
            return
        root = _project_root(conn.media_pool)
        gen_dir = os.path.join(root, "GENERERT")
        os.makedirs(gen_dir, exist_ok=True)
        start_image = None
        img = os.path.expanduser((params.get("imagePath") or "").strip())
        if img and os.path.isfile(img):
            start_image = img
        elif anchor_tc and timeline:
            start_image = _context_frame(timeline, anchor_tc, fps, gen_dir)
        cmd = [HF, "generate", "create", "seedance_2_0", "--prompt", prompt,
               "--duration", str(duration), "--resolution", resolution,
               "--aspect_ratio", "16:9", "--wait", "--json"]
        if start_image:
            cmd += ["--start-image", start_image]
        bridge.progress(0, 100, "Seedance genererer — tar 1-3 minutter …")
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=900)
        url = None
        for chunk in re.findall(r"\{.*\}|\[.*\]", r.stdout, re.S):
            try:
                data = json.loads(chunk)
                items = data if isinstance(data, list) else [data]
                for it in items:
                    u = (it.get("result_url") or it.get("url")
                         or (it.get("results") or [{}])[0].get("url", "")
                         if isinstance(it, dict) else "")
                    if isinstance(u, str) and u.startswith("http"):
                        url = u
            except Exception:
                continue
        if not url:
            m = re.search(r"https://\S+\.mp4\S*", r.stdout + r.stderr)
            url = m.group(0) if m else None
        if not url:
            bridge.error("Fikk ingen resultat-URL fra Higgsfield: "
                         + (r.stdout + r.stderr)[-300:])
            return
        slug = re.sub(r"[^a-z0-9]+", "-", prompt.lower())[:40].strip("-")
        out_path = os.path.join(gen_dir, f"broll_{slug}_{int(time.time())}.mp4")
        subprocess.run(["curl", "-sL", "-o", out_path, url], timeout=600)
        if not os.path.isfile(out_path) or os.path.getsize(out_path) < 10000:
            bridge.error("Nedlasting av generert klipp feilet.")
            return
        # importer + legg i GENERERT-bin
        imported = conn.media_pool.ImportMedia([out_path]) or []
        clip_info = None
        if imported:
            gen_bin = None
            root_folder = conn.media_pool.GetRootFolder()
            for s in root_folder.GetSubFolderList() or []:
                if (s.GetName() or "").strip().upper() == "GENERERT":
                    gen_bin = s
                    break
            if not gen_bin:
                gen_bin = conn.media_pool.AddSubFolder(root_folder, "GENERERT")
            if gen_bin:
                conn.media_pool.MoveClips(imported, gen_bin)
            ident = clip_identity(imported[0])
            clip_info = {"clip": ident["name"], "uid": ident["uid"], "path": out_path}
        bridge.result({"mode": mode, "generated": out_path,
                       "sizeMb": round(os.path.getsize(out_path) / 1e6, 1),
                       "groundedInContextFrame": bool(start_image),
                       "imported": clip_info,
                       "account": status,
                       "note": "Sett inn via vanlig innsetting (uid-en over) — eller dra "
                               "fra GENERERT-binnen.", "dryRun": dry_run})
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
