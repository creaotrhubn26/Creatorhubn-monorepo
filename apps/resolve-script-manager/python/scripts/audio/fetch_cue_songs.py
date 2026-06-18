"""Fetch Cue Songs — batch-nedlasting av ALLE sanger i et prosjekts cue_map.json
(yt-dlp + beat-grids) i ett kall, i stedet for én og én med fetch_source_song.

Leser staging/<projectId>/cue_map.json, samler unike songId (= YouTube-video-id),
og kaller fetch_source_song.py per sang (privat bryllups-bruk).

Input:
  projectId:  staging-prosjekt [required]

Output: { downloaded:[id...], skipped:[id...], failed:[{id,error}] }
"""
from __future__ import annotations
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

STAGING = os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging")
FETCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fetch_source_song.py")


def run(params: dict, dry_run: bool) -> None:
    project_id = (params.get("projectId") or "").strip()
    if not project_id:
        bridge.error("projectId kreves"); sys.exit(1)
    cue_path = os.path.join(STAGING, project_id, "cue_map.json")
    if not os.path.isfile(cue_path):
        bridge.error(f"Fant ikke {cue_path} — lag cue_map.json først"); sys.exit(1)
    try:
        cues = json.load(open(cue_path))
    except (OSError, json.JSONDecodeError) as e:
        bridge.error(f"cue_map.json ulesbar: {e}"); sys.exit(1)

    ids, seen = [], set()
    for c in cues:
        sid = c.get("songId")
        if sid and sid not in seen:
            seen.add(sid); ids.append(sid)
    if not ids:
        bridge.error("Ingen songId i cue_map.json (kun naturlyd?)"); sys.exit(1)

    if dry_run:
        bridge.result({"wouldDownload": ids, "count": len(ids)}); return

    downloaded, skipped, failed = [], [], []
    for i, sid in enumerate(ids, 1):
        bridge.progress(int(100*i/len(ids)), 100, f"Henter {sid} ({i}/{len(ids)})…")
        dest = os.path.join(STAGING, project_id, "source_songs", f"{sid}.wav")
        if os.path.isfile(dest):
            skipped.append(sid); continue
        prm = json.dumps({"youtubeUrl": f"https://www.youtube.com/watch?v={sid}",
                          "projectId": project_id, "projectType": "wedding"})
        try:
            r = subprocess.run([sys.executable, FETCH, f"--params={prm}"],
                               capture_output=True, text=True, timeout=900)
            ok = '"type": "result"' in (r.stdout or "") and os.path.isfile(dest)
            if ok: downloaded.append(sid)
            else:
                err = "yt-dlp feilet"
                for ln in (r.stdout or "").splitlines():
                    if '"type": "error"' in ln:
                        try: err = json.loads(ln).get("message", err)
                        except Exception: pass
                failed.append({"id": sid, "error": err[:200]})
        except Exception as e:
            failed.append({"id": sid, "error": str(e)[:200]})

    bridge.result({"downloaded": downloaded, "skipped": skipped, "failed": failed,
                   "total": len(ids)})


if __name__ == "__main__":
    bridge.main_guard(run)
