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

- `platform/releases/{application}/{version}/` contains immutable, signed application builds.
- `platform/releases/{application}/latest.json` is written last as the atomic release pointer.
- `temporary/` expires after 1 day.
- `exports/` expires after 7 days.
- `quarantine/` expires after 14 days.
- incomplete multipart uploads are aborted after 7 days.

The zero-byte prefix markers in S3 exist for console discoverability only.
Objects must always use the complete canonical hierarchy above.

## Product media

Product-owned media that belongs to no tenant lives under `products/{product}/`,
one folder per product so the bucket stays tidy. Each product gets its own IAM
statement in `application-policy.json` scoped to its prefix; never widen
`organizations/*` for product media.

```text
products/senseaid-explore/
  areas/{areaSlug}/
    pois/{poiSlug}/
      audio/{kind}-{chapterNo}-{lang}-v{version}.mp3
      captions/{kind}-{chapterNo}-{lang}-v{version}.vtt
      images/{objectId}-{filename}
```

SenseAid Explore (the audio guide app, `backend/server/reiseguide-storage.ts`)
writes narration and audio-description files here with the backend's CreatorHub
credentials (statement `SenseAidExploreMediaAccess`). Objects stay private: the
app only ever receives `/api/guide/media/{key}`, which validates the key against
the hierarchy above and redirects to a 15-minute presigned URL. Re-apply
`application-policy.json` to the CreatorHub backend IAM identity when this
prefix is introduced.

## Application distribution

Pro Tools Companion is distributed from the private prefix
`platform/releases/protools-companion/`. GitHub Actions builds and verifies the
signed installers, then assumes the narrowly-scoped
`CreatorHubGitHubApplicationReleasePublisher` role through GitHub OIDC. It
uploads immutable version files first and replaces `latest.json` only after all
artifacts are present and readable.

The backend runtime has read-only access to `platform/releases/*`. It validates
the manifest, maps fixed artifact IDs to exact keys, and issues five-minute S3
URLs. Browser and Tauri clients only receive CreatorHub API URLs; neither client
uses GitHub as a download or update origin.

Provision or reconcile the publisher with an authenticated administrative
profile:

```bash
./infrastructure/aws/creatorhubn-storage/provision-release-publisher.sh tidsflyt
```

Apply `application-policy.json` to the existing CreatorHub backend IAM identity
when this prefix is introduced. Do not give the release publisher access to
tenant objects under `organizations/`, and do not grant the backend write access
to application releases.

Browser and Adobe UXP uploads receive short-lived, checksum-bound presigned
URLs after PostgreSQL authorization. The bucket CORS origin is therefore `*`
because UXP origins vary by host/runtime; this does not make the bucket public
or bypass the signature, expiry, object key or checksum bound into each URL.
