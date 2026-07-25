"""Versjonert prosjektindeks — stabile ID-er, fingerprints og analyse-cache.

Prinsipp: klippNAVN er aldri identitet. Alt keyes på Resolves GetUniqueId()
(prosjekt/timeline/klipp/item) + innholds-fingerprint (størrelse + blake2b
av første+siste MB — overlever omdøping/flytting, avslører endret innhold).

Lagres som SQLite per prosjekt: ~/.config/postagent/index/<projectGuid>.db
Schema-versjonert (SCHEMA_VERSION) + Resolve-versjon stemples på analyser,
slik at utdaterte data OPPDAGES i stedet for å antas gyldige.

Tabeller (Daniels feltliste):
  meta         project/schema/resolve-identitet + tidsstempler
  clips        uid, navn, filbane, fingerprint, fps, varighet, kamera-metadata
  timelines    uid, navn, fps, start/end-frame (timecode ranges)
  markers      timeline_uid + frame/farge/label/note + kilde
  transcripts  timeline_uid + start/end-frame + tekst (subtitle-avledet)
  analyses     kind + subject_uid + payload + fingerprint + resolve_version
               (vision-dommer, dHash-signaturer, tempo, jumpcuts …)
  suggestions  kind + subject_uid + payload + status (new/accepted/rejected)
  actions      utførte handlinger m/ objekt-referanser (uid-liste)
  rollbacks    action_id → backup-referanse (f.eks. backup-timeline-navn)
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time

SCHEMA_VERSION = 1
INDEX_DIR = os.path.expanduser("~/.config/postagent/index")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS clips (
    uid TEXT PRIMARY KEY, name TEXT, path TEXT, fingerprint TEXT,
    fps REAL, duration_sec REAL, camera_type TEXT, camera_serial TEXT,
    updated_ts REAL);
CREATE TABLE IF NOT EXISTS timelines (
    uid TEXT PRIMARY KEY, name TEXT, fps REAL,
    start_frame INTEGER, end_frame INTEGER, updated_ts REAL);
CREATE TABLE IF NOT EXISTS markers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, timeline_uid TEXT, frame INTEGER,
    color TEXT, label TEXT, note TEXT, source TEXT, created_ts REAL);
CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, timeline_uid TEXT,
    start_frame INTEGER, end_frame INTEGER, text TEXT, created_ts REAL);
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, subject_uid TEXT,
    fingerprint TEXT, payload TEXT, resolve_version TEXT, created_ts REAL);
CREATE INDEX IF NOT EXISTS idx_analyses ON analyses (kind, subject_uid);
CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, subject_uid TEXT,
    payload TEXT, status TEXT DEFAULT 'new', created_ts REAL);
CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, via TEXT, script_id TEXT,
    params TEXT, dry_run INTEGER, ok INTEGER, result TEXT, objects TEXT);
CREATE TABLE IF NOT EXISTS rollbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, action_id INTEGER,
    kind TEXT, ref TEXT, created_ts REAL);
"""


def fingerprint(path: str) -> str | None:
    """Innholds-fingerprint: størrelse + blake2b av første+siste MB.
    Rask nok for 1600 klipp; overlever omdøping, avslører re-eksport."""
    try:
        size = os.path.getsize(path)
        h = hashlib.blake2b(digest_size=16)
        h.update(str(size).encode())
        with open(path, "rb") as fh:
            h.update(fh.read(1024 * 1024))
            if size > 2 * 1024 * 1024:
                fh.seek(-1024 * 1024, os.SEEK_END)
                h.update(fh.read(1024 * 1024))
        return f"{size}:{h.hexdigest()}"
    except Exception:
        return None


def clip_identity(clip, with_fingerprint: bool = False) -> dict:
    """Stabil identitet for et media pool-klipp. ALDRI navn alene."""
    out = {"uid": "", "name": "", "path": "", "fingerprint": None}
    try:
        out["uid"] = clip.GetUniqueId() or ""
    except Exception:
        pass
    try:
        out["name"] = clip.GetName() or ""
        out["path"] = clip.GetClipProperty("File Path") or ""
    except Exception:
        pass
    if not out["uid"]:
        out["uid"] = "path:" + out["path"] if out["path"] else "name:" + out["name"]
    if with_fingerprint and out["path"]:
        out["fingerprint"] = fingerprint(out["path"])
    return out


class ProjectIndex:
    @classmethod
    def open_raw(cls, guid: str):
        """Åpne indeksen på GUID alene — uten Resolve-tilkobling. Brukes av
        billige sidecar-skrivinger (action-føring fra panelet)."""
        self = cls.__new__(cls)
        os.makedirs(INDEX_DIR, exist_ok=True)
        self.path = os.path.join(INDEX_DIR, f"{guid or 'unnamed'}.db")
        self.db = sqlite3.connect(self.path)
        self.db.executescript(_SCHEMA)
        row = self.db.execute("SELECT value FROM meta WHERE key='resolve_version'").fetchone()
        self.resolve_version = row[0] if row else ""
        return self

    def __init__(self, project, resolve=None):
        guid = ""
        try:
            guid = project.GetUniqueId() or ""
        except Exception:
            pass
        if not guid:
            guid = "unnamed"
        os.makedirs(INDEX_DIR, exist_ok=True)
        self.path = os.path.join(INDEX_DIR, f"{guid}.db")
        self.db = sqlite3.connect(self.path)
        self.db.executescript(_SCHEMA)
        self.resolve_version = ""
        try:
            self.resolve_version = resolve.GetVersionString() if resolve else ""
        except Exception:
            pass
        now = str(time.time())
        for k, v in (("schema_version", str(SCHEMA_VERSION)), ("project_guid", guid),
                     ("project_name", (project.GetName() or "") if project else ""),
                     ("resolve_version", self.resolve_version), ("updated", now)):
            self.db.execute("INSERT INTO meta (key, value) VALUES (?, ?) "
                            "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (k, v))
        self.db.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('created', ?)", (now,))
        self.db.commit()

    # ── skriving ──
    def upsert_clip(self, ident: dict, fps=None, duration_sec=None,
                    camera_type=None, camera_serial=None):
        self.db.execute(
            "INSERT INTO clips (uid, name, path, fingerprint, fps, duration_sec, "
            "camera_type, camera_serial, updated_ts) VALUES (?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(uid) DO UPDATE SET name=excluded.name, path=excluded.path, "
            "fingerprint=COALESCE(excluded.fingerprint, clips.fingerprint), "
            "fps=COALESCE(excluded.fps, clips.fps), "
            "duration_sec=COALESCE(excluded.duration_sec, clips.duration_sec), "
            "camera_type=COALESCE(excluded.camera_type, clips.camera_type), "
            "camera_serial=COALESCE(excluded.camera_serial, clips.camera_serial), "
            "updated_ts=excluded.updated_ts",
            (ident["uid"], ident.get("name"), ident.get("path"), ident.get("fingerprint"),
             fps, duration_sec, camera_type, camera_serial, time.time()))

    def upsert_timeline(self, uid, name, fps, start_frame, end_frame):
        self.db.execute(
            "INSERT INTO timelines (uid, name, fps, start_frame, end_frame, updated_ts) "
            "VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name, "
            "fps=excluded.fps, start_frame=excluded.start_frame, "
            "end_frame=excluded.end_frame, updated_ts=excluded.updated_ts",
            (uid, name, fps, start_frame, end_frame, time.time()))

    def replace_markers(self, timeline_uid, markers, source="resolve"):
        self.db.execute("DELETE FROM markers WHERE timeline_uid=? AND source=?",
                        (timeline_uid, source))
        self.db.executemany(
            "INSERT INTO markers (timeline_uid, frame, color, label, note, source, created_ts) "
            "VALUES (?,?,?,?,?,?,?)",
            [(timeline_uid, m["frame"], m.get("color"), m.get("label"), m.get("note"),
              source, time.time()) for m in markers])

    def replace_transcripts(self, timeline_uid, segments):
        self.db.execute("DELETE FROM transcripts WHERE timeline_uid=?", (timeline_uid,))
        self.db.executemany(
            "INSERT INTO transcripts (timeline_uid, start_frame, end_frame, text, created_ts) "
            "VALUES (?,?,?,?,?)",
            [(timeline_uid, s["startFrame"], s["endFrame"], s["text"], time.time())
             for s in segments])

    def record_analysis(self, kind, subject_uid, payload, fingerprint_=None):
        self.db.execute(
            "INSERT INTO analyses (kind, subject_uid, fingerprint, payload, "
            "resolve_version, created_ts) VALUES (?,?,?,?,?,?)",
            (kind, subject_uid, fingerprint_, json.dumps(payload, ensure_ascii=False),
             self.resolve_version, time.time()))

    def record_action(self, via, script_id, params, dry_run, ok, result, objects=None):
        cur = self.db.execute(
            "INSERT INTO actions (ts, via, script_id, params, dry_run, ok, result, objects) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (time.time(), via, script_id, json.dumps(params, ensure_ascii=False)[:2000],
             int(dry_run), int(ok), json.dumps(result, ensure_ascii=False)[:2000],
             json.dumps(objects or [])))
        return cur.lastrowid

    def record_rollback(self, action_id, kind, ref):
        self.db.execute("INSERT INTO rollbacks (action_id, kind, ref, created_ts) "
                        "VALUES (?,?,?,?)", (action_id, kind, ref, time.time()))

    # ── lesing ──
    def get_analysis(self, kind, subject_uid, fingerprint_=None):
        """Nyeste analyse for objektet — kun hvis fingerprint fortsatt stemmer
        (None = godta uansett). Utdatert data oppdages, ikke antas."""
        row = self.db.execute(
            "SELECT payload, fingerprint, resolve_version FROM analyses "
            "WHERE kind=? AND subject_uid=? ORDER BY created_ts DESC LIMIT 1",
            (kind, subject_uid)).fetchone()
        if not row:
            return None
        payload, fp, _rv = row
        if fingerprint_ and fp and fp != fingerprint_:
            return None  # innholdet har endret seg → cachen er død
        return json.loads(payload)

    def counts(self):
        out = {}
        for t in ("clips", "timelines", "markers", "transcripts", "analyses",
                  "suggestions", "actions", "rollbacks"):
            out[t] = self.db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        return out

    def meta(self):
        return dict(self.db.execute("SELECT key, value FROM meta").fetchall())

    def commit(self):
        self.db.commit()

    def close(self):
        self.db.commit()
        self.db.close()
