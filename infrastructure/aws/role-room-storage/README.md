# The Role Room production storage

This directory records the configuration of the private S3 bucket used for
The Role Room documents and images.

- Account: `745600963362`
- Region: `eu-north-1` (Stockholm)
- Bucket: `the-role-room-prod-745600963362-eu-north-1`
- Video: Cloudflare Stream only; never S3
- Sound Room: private AWS S3 originals from browser and Pro Tools, with
  checksum-bound multipart upload, AAC preview and server waveform
- Object versioning: disabled until GDPR deletion removes every object version
- Object Lock: disabled

The bucket has S3 Block Public Access enabled, Bucket Owner Enforced ownership,
explicit SSE-S3 encryption, a TLS-only bucket policy, restricted browser CORS,
and lifecycle cleanup for temporary content.

`storage-layout.json` is the canonical object-key layout. Tenant-owned object
keys contain opaque identifiers only. Stable technical paths may be retained
for shared platform models, releases and datasets. User-visible filenames and
personal data belong in PostgreSQL, not in S3 keys or metadata.

The Render application assumes `TheRoleRoomStorageRuntimeProd` with managed
OIDC and short-lived STS credentials. Its trust policy is bound to the exact
Render workspace, environment and service IDs. `runtime-iam-policy.json`
allows only object read/write/delete and the object-scoped multipart
restart/abort actions under the application's documented data prefixes. It
cannot list the bucket, access `_system/` or `migration/`, change bucket
configuration, use IAM, or delete the bucket.

`the-role-room-storage-prod` is a temporary, non-console IAM user used only by
the resumable R2/B2 migration and inventory audit. Its broader
`app-iam-policy.json` includes list and multipart cleanup operations required by
those scripts. Delete its access key, user and managed policy after the final
migration verification; never expose this identity to application runtime.

The application selects this bucket with `ROLE_ROOM_STORAGE_PROVIDER=aws_s3`,
`AWS_ROLE_ROOM_BUCKET_NAME`, `AWS_ROLE_ROOM_REGION` and `AWS_ROLE_ARN`. Render
injects `AWS_WEB_IDENTITY_TOKEN_FILE` at deploy time; do not set that variable
manually. The AWS SDK default credential provider reads the token file. Static
`AWS_ROLE_ROOM_ACCESS_KEY_ID` and `AWS_ROLE_ROOM_SECRET_ACCESS_KEY` remain a
temporary migration/rollback fallback and are ignored whenever a complete web
identity configuration is present.

Existing B2 keys are mapped deterministically into `storage-layout.json`; the
compatibility layer maps old database references to the same canonical keys.
Historical R2 buckets use the same migration program with an explicit source
bucket.

Run the migration from `backend/` with a dry run first:

```sh
npm run storage:migrate-role-room-to-s3 -- --all
npm run storage:migrate-role-room-to-s3 -- --all --execute
npm run storage:migrate-role-room-to-s3 -- --all --verify-only --verify-content
npm run storage:migrate-role-room-to-s3 -- --source=r2 --all --execute --concurrency=1
npm run storage:audit-role-room-s3
```

If a source-side daily bandwidth cap interrupts an already SHA-verified run,
resume with `--skip-existing-content` to avoid re-downloading completed source
objects. Newly copied objects are still SHA-256 verified. A later independent
`--verify-only --verify-content` run remains the final verification gate.

The migration never deletes source objects. Content verification compares a
fresh SHA-256 digest of every source and destination object.
The inventory audit compares the union of every configured R2/B2 source with
S3 and fails on missing data, size mismatches, cross-source key conflicts or
unexpected target objects.

Sound Room has a narrower, database-led migration with one audit row per
audio version:

```sh
npm run storage:migrate-sound-room-to-s3 -- --all
npm run storage:migrate-sound-room-to-s3 -- --all --execute
```

Execution copies, re-reads and SHA-256 verifies both sides while retaining B2.
`--delete-source-after-verify` is a separate explicit cleanup gate that repeats
the full two-sided checksum verification before source deletion.
