#!/usr/bin/env python3
"""Backup all env-vars for one Render service.

Fetches via paginated GET → AES-256-GCM encrypts with RENDER_ENV_BACKUP_KEY
→ writes local `.backups/render-envs/<service>-<date>.enc` → uploads to B2.

Decoupled-key design: RENDER_ENV_BACKUP_KEY is *not* an env-var on the
service being backed up, so a bulk-PUT wipe cannot lock you out of
restore. Store it ONLY in GH Actions secrets + 1Password.

Required env-vars (from GH secret or local shell):
  RENDER_API_KEY            (rnd_…)
  RENDER_SERVICE_ID         (e.g. srv-d76ob60ule4c73dv2p60)
  RENDER_ENV_BACKUP_KEY     (32 bytes hex = 64 chars)
  B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME  (optional — skips upload if missing)
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import os
import pathlib
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
LOCAL_BACKUPS = REPO_ROOT / ".backups" / "render-envs"


def env(key: str, required: bool = True) -> str:
    v = os.environ.get(key, "").strip()
    if not v and required:
        sys.exit(f"❌ Missing env-var: {key}")
    return v


def fetch_render_envs(api_key: str, service_id: str) -> dict[str, str]:
    """Paginate through all env-vars, return key→value map."""
    out: dict[str, str] = {}
    cursor: str | None = None
    base = f"https://api.render.com/v1/services/{service_id}/env-vars"
    for page in range(1, 20):
        url = f"{base}?limit=100" + (f"&cursor={cursor}" if cursor else "")
        result = subprocess.run(
            ["curl", "-s", "-m", "20", "-H", f"Authorization: Bearer {api_key}", url],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            sys.exit(f"❌ curl failed (page {page}): {result.stderr[:200]}")
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            sys.exit(f"❌ JSON decode failed (page {page}): {e}")
        if not data:
            break
        for item in data:
            ev = item["envVar"]
            out[ev["key"]] = ev.get("value", "")
        new_cursor = data[-1].get("cursor")
        if not new_cursor or new_cursor == cursor:
            break
        cursor = new_cursor
        time.sleep(0.3)
    return out


def encrypt(plaintext: bytes, key_hex: str) -> dict:
    """AES-256-GCM. Returns dict ready to JSON-serialize."""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        sys.exit("❌ pip install cryptography  (needed for AES-GCM)")
    key = bytes.fromhex(key_hex)
    if len(key) != 32:
        sys.exit(f"❌ RENDER_ENV_BACKUP_KEY must be 32-byte hex (64 chars), got {len(key)} bytes")
    iv = secrets.token_bytes(12)
    aead = AESGCM(key)
    ct = aead.encrypt(iv, plaintext, associated_data=b"render-envs-backup-v1")
    return {
        "scheme": "AES-256-GCM",
        "version": 1,
        "iv": base64.b64encode(iv).decode(),
        "ciphertext": base64.b64encode(ct).decode(),
    }


def b2_upload(local_path: pathlib.Path, b2_key_id: str, b2_key: str, bucket_name: str) -> str:
    """Upload via b2_authorize_account → b2_get_upload_url → b2_upload_file."""
    # Step 1: authorize_account
    cred = base64.b64encode(f"{b2_key_id}:{b2_key}".encode()).decode()
    auth_resp = subprocess.run(
        ["curl", "-s", "-m", "20", "-H", f"Authorization: Basic {cred}",
         "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"],
        capture_output=True, text=True, timeout=30,
    )
    if auth_resp.returncode != 0:
        sys.exit(f"❌ B2 auth failed: {auth_resp.stderr[:200]}")
    auth = json.loads(auth_resp.stdout)
    if "authorizationToken" not in auth:
        sys.exit(f"❌ B2 auth response missing token: {auth}")
    api_url = auth["apiUrl"]
    auth_token = auth["authorizationToken"]
    # Step 2: find bucket id
    list_resp = subprocess.run(
        ["curl", "-s", "-m", "20", "-H", f"Authorization: {auth_token}",
         "-d", json.dumps({"accountId": auth["accountId"], "bucketName": bucket_name}),
         f"{api_url}/b2api/v2/b2_list_buckets"],
        capture_output=True, text=True, timeout=30,
    )
    bucket_list = json.loads(list_resp.stdout)
    if not bucket_list.get("buckets"):
        sys.exit(f"❌ B2 bucket {bucket_name!r} not found")
    bucket_id = bucket_list["buckets"][0]["bucketId"]
    # Step 3: get upload url
    up_resp = subprocess.run(
        ["curl", "-s", "-m", "20", "-H", f"Authorization: {auth_token}",
         "-d", json.dumps({"bucketId": bucket_id}),
         f"{api_url}/b2api/v2/b2_get_upload_url"],
        capture_output=True, text=True, timeout=30,
    )
    up = json.loads(up_resp.stdout)
    upload_url = up["uploadUrl"]
    upload_auth = up["authorizationToken"]
    # Step 4: upload file
    data = local_path.read_bytes()
    sha1 = subprocess.run(["shasum", "-a", "1", str(local_path)], capture_output=True, text=True).stdout.split()[0]
    b2_filename = f"render-envs/{local_path.name}"
    file_resp = subprocess.run(
        ["curl", "-s", "-m", "60", "-X", "POST", upload_url,
         "-H", f"Authorization: {upload_auth}",
         "-H", f"X-Bz-File-Name: {b2_filename}",
         "-H", "Content-Type: application/octet-stream",
         "-H", f"Content-Length: {len(data)}",
         "-H", f"X-Bz-Content-Sha1: {sha1}",
         "--data-binary", f"@{local_path}"],
        capture_output=True, text=True, timeout=90,
    )
    if file_resp.returncode != 0:
        sys.exit(f"❌ B2 upload failed: {file_resp.stderr[:200]}")
    file_info = json.loads(file_resp.stdout)
    if "fileId" not in file_info:
        sys.exit(f"❌ B2 upload error: {file_info}")
    return b2_filename


def main() -> None:
    api_key = env("RENDER_API_KEY")
    service_id = env("RENDER_SERVICE_ID")
    backup_key = env("RENDER_ENV_BACKUP_KEY")
    b2_key_id = env("B2_APPLICATION_KEY_ID", required=False)
    b2_key = env("B2_APPLICATION_KEY", required=False)
    b2_bucket = env("B2_BUCKET_NAME", required=False)

    print(f"📥 Fetching env-vars for {service_id}…")
    kv = fetch_render_envs(api_key, service_id)
    print(f"   Got {len(kv)} env-vars")

    if len(kv) < 50:
        sys.exit(f"❌ Refusing to write backup: only {len(kv)} env-vars (looks wiped). Investigate first.")

    blob = json.dumps({
        "service_id": service_id,
        "fetched_at": dt.datetime.utcnow().isoformat() + "Z",
        "count": len(kv),
        "envs": kv,
    }, indent=2).encode()

    print(f"🔐 Encrypting ({len(blob)} bytes)…")
    enc = encrypt(blob, backup_key)

    LOCAL_BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.utcnow().strftime("%Y-%m-%d_%H%M%S")
    local_path = LOCAL_BACKUPS / f"{service_id}-{stamp}.json.enc"
    local_path.write_text(json.dumps(enc, indent=2))
    print(f"💾 Local: {local_path}")

    if b2_key_id and b2_key and b2_bucket:
        print(f"☁️  Uploading to B2 bucket {b2_bucket}…")
        b2_path = b2_upload(local_path, b2_key_id, b2_key, b2_bucket)
        print(f"   ✅ b2://{b2_bucket}/{b2_path}")
    else:
        print("⚠️  Skipping B2 upload (no B2_* env-vars set)")

    # Rotate: keep only the 30 most-recent local backups
    backups = sorted(LOCAL_BACKUPS.glob(f"{service_id}-*.json.enc"))
    if len(backups) > 30:
        for old in backups[:-30]:
            old.unlink()
            print(f"🗑️  Pruned {old.name}")

    print(f"\n✅ Backup complete: {len(kv)} env-vars encrypted")


if __name__ == "__main__":
    main()
