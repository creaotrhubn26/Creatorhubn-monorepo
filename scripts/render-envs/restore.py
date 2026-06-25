#!/usr/bin/env python3
"""Restore env-vars from an encrypted backup to a Render service.

Per-key PUT only — NEVER bulk-PUT (that REPLACES the whole collection).

Usage:
  python3 scripts/render-envs/restore.py <backup-file.json.enc>
  python3 scripts/render-envs/restore.py --from-b2 <YYYY-MM-DD>     # downloads latest for that date
  python3 scripts/render-envs/restore.py --dry-run <file>           # just decrypt + list keys

Required env-vars:
  RENDER_API_KEY            (target service)
  RENDER_SERVICE_ID         (target — verified against backup's stored service_id)
  RENDER_ENV_BACKUP_KEY     (decryption key, 64-char hex)
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import subprocess
import sys
import time

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]


def env(key: str, required: bool = True) -> str:
    v = os.environ.get(key, "").strip()
    if not v and required:
        sys.exit(f"❌ Missing env-var: {key}")
    return v


def decrypt(enc: dict, key_hex: str) -> bytes:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        sys.exit("❌ pip install cryptography")
    if enc.get("scheme") != "AES-256-GCM":
        sys.exit(f"❌ Unknown cipher scheme: {enc.get('scheme')}")
    key = bytes.fromhex(key_hex)
    iv = base64.b64decode(enc["iv"])
    ct = base64.b64decode(enc["ciphertext"])
    aead = AESGCM(key)
    return aead.decrypt(iv, ct, associated_data=b"render-envs-backup-v1")


def b2_download(b2_filename: str, dest: pathlib.Path) -> None:
    """Download via B2 native API. Reads creds from env."""
    b2_id = env("B2_APPLICATION_KEY_ID")
    b2_key = env("B2_APPLICATION_KEY")
    cred = base64.b64encode(f"{b2_id}:{b2_key}".encode()).decode()
    auth_resp = subprocess.run(
        ["curl", "-s", "-m", "20", "-H", f"Authorization: Basic {cred}",
         "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"],
        capture_output=True, text=True, timeout=30,
    )
    auth = json.loads(auth_resp.stdout)
    down_url = auth["downloadUrl"]
    auth_token = auth["authorizationToken"]
    bucket = env("B2_BUCKET_NAME")
    url = f"{down_url}/file/{bucket}/{b2_filename}"
    r = subprocess.run(
        ["curl", "-s", "-m", "60", "-H", f"Authorization: {auth_token}", url, "-o", str(dest)],
        capture_output=True, text=True, timeout=90,
    )
    if r.returncode != 0:
        sys.exit(f"❌ B2 download failed: {r.stderr[:200]}")


def per_key_put(api_key: str, service_id: str, key: str, value: str) -> tuple[bool, int]:
    """One PUT call. Returns (ok, http_code)."""
    body = json.dumps({"value": value})
    url = f"https://api.render.com/v1/services/{service_id}/env-vars/{key}"
    r = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "PUT",
         "-H", f"Authorization: Bearer {api_key}",
         "-H", "Content-Type: application/json",
         url, "-d", body],
        capture_output=True, text=True, timeout=30,
    )
    code = int(r.stdout.strip() or 0)
    return (200 <= code < 300, code)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("file", nargs="?", help="Path to .json.enc backup, OR omit and use --from-b2")
    p.add_argument("--from-b2", metavar="YYYY-MM-DD", help="Download latest backup for given date from B2")
    p.add_argument("--dry-run", action="store_true", help="Decrypt and list keys, but do not PUT")
    p.add_argument("--throttle", type=float, default=0.5, help="Seconds between PUTs (default 0.5)")
    args = p.parse_args()

    backup_key = env("RENDER_ENV_BACKUP_KEY")

    if args.from_b2:
        service_id = env("RENDER_SERVICE_ID")
        # List all matching files in B2 — pick newest with date prefix
        b2_id = env("B2_APPLICATION_KEY_ID")
        b2_key = env("B2_APPLICATION_KEY")
        cred = base64.b64encode(f"{b2_id}:{b2_key}".encode()).decode()
        auth = json.loads(subprocess.run(
            ["curl", "-s", "-H", f"Authorization: Basic {cred}",
             "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"],
            capture_output=True, text=True, timeout=30).stdout)
        api_url = auth["apiUrl"]
        auth_token = auth["authorizationToken"]
        # Find bucket id
        bucket = env("B2_BUCKET_NAME")
        bl = json.loads(subprocess.run(
            ["curl", "-s", "-H", f"Authorization: {auth_token}",
             "-d", json.dumps({"accountId": auth["accountId"], "bucketName": bucket}),
             f"{api_url}/b2api/v2/b2_list_buckets"], capture_output=True, text=True, timeout=30).stdout)
        bucket_id = bl["buckets"][0]["bucketId"]
        # List with prefix
        prefix = f"render-envs/{service_id}-{args.from_b2}"
        lf = json.loads(subprocess.run(
            ["curl", "-s", "-H", f"Authorization: {auth_token}",
             "-d", json.dumps({"bucketId": bucket_id, "prefix": prefix, "maxFileCount": 100}),
             f"{api_url}/b2api/v2/b2_list_file_names"], capture_output=True, text=True, timeout=30).stdout)
        files = sorted(f["fileName"] for f in lf.get("files", []))
        if not files:
            sys.exit(f"❌ No backup found in B2 with prefix {prefix}")
        chosen = files[-1]
        dest = pathlib.Path("/tmp") / pathlib.Path(chosen).name
        print(f"⬇️  Downloading {chosen} → {dest}")
        b2_download(chosen, dest)
        backup_path = dest
    elif args.file:
        backup_path = pathlib.Path(args.file)
    else:
        sys.exit("❌ Provide either a file path or --from-b2 YYYY-MM-DD")

    print(f"🔐 Decrypting {backup_path}…")
    enc = json.loads(backup_path.read_text())
    blob = decrypt(enc, backup_key)
    payload = json.loads(blob.decode())
    kv: dict[str, str] = payload["envs"]
    src_service = payload.get("service_id", "?")
    print(f"   service in backup: {src_service}")
    print(f"   fetched_at: {payload.get('fetched_at')}")
    print(f"   {len(kv)} env-vars in backup")

    if args.dry_run:
        print("\n=== Keys in backup (dry-run, no PUT) ===")
        for k in sorted(kv.keys()):
            print(f"  - {k}  ({len(kv[k])} chars)")
        return

    api_key = env("RENDER_API_KEY")
    target_service = env("RENDER_SERVICE_ID")
    if target_service != src_service:
        print(f"⚠️  WARNING: target {target_service!r} ≠ backup {src_service!r}")
        if input("Continue anyway? [y/N] ").strip().lower() != "y":
            sys.exit("Aborted")

    print(f"\n🚀 Restoring {len(kv)} env-vars to {target_service} (per-key PUT, throttle {args.throttle}s)…")
    ok = 0
    fail: list[str] = []
    for i, k in enumerate(sorted(kv.keys()), 1):
        success, code = per_key_put(api_key, target_service, k, kv[k])
        if success:
            ok += 1
            print(f"  ✅ [{i:3d}/{len(kv)}] {k}")
        elif code == 429:
            print(f"  ⏳ [{i:3d}/{len(kv)}] {k} → 429, sleep 15s & retry")
            time.sleep(15)
            success, code = per_key_put(api_key, target_service, k, kv[k])
            if success:
                ok += 1
                print(f"  ✅ [{i:3d}/{len(kv)}] {k} (retry)")
            else:
                fail.append(k)
                print(f"  ❌ [{i:3d}/{len(kv)}] {k} → HTTP {code}")
        else:
            fail.append(k)
            print(f"  ❌ [{i:3d}/{len(kv)}] {k} → HTTP {code}")
        time.sleep(args.throttle)

    print(f"\n=== RESULT: {ok}/{len(kv)} OK, {len(fail)} failed ===")
    if fail:
        print("Failed keys:", fail)
        sys.exit(1)


if __name__ == "__main__":
    main()
