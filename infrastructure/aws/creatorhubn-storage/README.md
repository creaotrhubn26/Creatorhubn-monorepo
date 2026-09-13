# CreatorHubn production storage

AWS S3 bucket: `creatorhubn-prod-745600963362-eu-north-1` in `eu-north-1`.

The bucket is private, uses BucketOwnerEnforced ownership, blocks all public
access, encrypts every object with SSE-S3, has versioning enabled, and denies
non-TLS requests. Application credentials should receive only the permissions
in `application-policy.json`; do not run the application with the provisioning
profile.

## Canonical object-key hierarchy

```text
organizations/{organizationId}/
  users/{userId}/
    projects/{projectId}/
      sound-room/{audioRoomId}/
        browser/uploads/{objectId}/original.{extension}
        protools/sessions/{sessionId}/bounces/{objectId}/original.{extension}
        references/{objectId}-{filename}
        keepers/{objectId}-{filename}
      video-room/versions/{objectId}/original.{extension}
      assets/{module}/{objectId}-{filename}
```

Users without an organization use the stable tenant segment
`personal-{userId}`. Identifiers and filenames must be sanitized before being
placed in an object key. The bucket is not used as the source of authorization;
every presign/read request must resolve organization, user and project access
from PostgreSQL first.

Operational prefixes are deliberately outside tenant storage:

- `temporary/` expires after 1 day.
- `exports/` expires after 7 days.
- `quarantine/` expires after 14 days.
- incomplete multipart uploads are aborted after 7 days.

The zero-byte prefix markers in S3 exist for console discoverability only.
Objects must always use the complete canonical hierarchy above.

Browser and Adobe UXP uploads receive short-lived, checksum-bound presigned
URLs after PostgreSQL authorization. The bucket CORS origin is therefore `*`
because UXP origins vary by host/runtime; this does not make the bucket public
or bypass the signature, expiry, object key or checksum bound into each URL.
