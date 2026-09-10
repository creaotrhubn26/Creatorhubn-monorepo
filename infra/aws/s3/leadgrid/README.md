# Leadgrid S3 production storage

This directory is the reproducible AWS CLI definition for the private Leadgrid
production bucket:

`leadgrid-prod-745600963362-eu-north-1`

The setup mirrors the security baseline used by The Role Room: bucket-owner
enforced ownership, no ACLs, complete public-access blocking, SSE-S3 encryption,
TLS-only access, explicit production CORS origins and expiration of temporary,
quarantined and exported data.

## Provision and verify

The scripts refuse to target an AWS account other than `745600963362`.

```bash
./infra/aws/s3/leadgrid/provision.sh tidsflyt
./infra/aws/s3/leadgrid/verify.sh tidsflyt
```

`verify.sh` uploads a non-personal random verification object, verifies head,
list and download behavior, compares SHA-256 checksums, deletes the object and
confirms that anonymous reads remain blocked.

## Tenant key contract

Use opaque UUIDs at every tenant boundary:

```text
organizations/{organizationId}/projects/{projectId}/...
organizations/{organizationId}/users/{userId}/...
users/{userId}/...
```

Never put organization names, person names, email addresses, phone numbers,
lead names or original filenames into an object key. The backend must perform
authorization before issuing a short-lived presigned URL. PostgreSQL remains
authoritative for ownership and human-readable metadata.

Project and user IDs are historically free-form text in parts of Leadgrid.
The runtime maps those values deterministically to opaque UUID-shaped prefix
segments before creating a key. The original identifier stays in PostgreSQL
and is never exposed in S3.

S3 is a flat object store. The slash-separated hierarchy is implemented through
key prefixes; zero-byte root markers make the intended top-level structure
visible in the AWS console before tenant data exists.

## What Leadgrid stores here

The application runtime sends these organization-owned uploads to this bucket
through the `AWS_LEADGRID_*` contract:

- lead attachments
- Canvas PDF originals
- Pitch Deck images and mockups
- partner verification documents
- videos for organization-owned Academy courses
- sales prize-catalog images

PostgreSQL stores the organization/project/entity relationship, uploader,
display name, MIME type, byte size and SHA-256. S3 stores only the bytes and a
non-personal purpose marker. Signed URLs are generated only after backend
authorization.

Raw meeting audio, completed CSV/XLSX import payloads, reproducible previews
and unapproved Discovery crawl bodies are deliberately not retained. Official
Academy media and global templates are platform assets and are not charged to
a customer organization. Existing B2 Academy videos remain readable; new video
uploads for organization-owned courses use temporary S3 objects that are
validated and finalized before they are registered. Profile images keep their
legacy provider until their stable signed-delivery migration is complete;
mixing a private S3 key into a public URL column would create expired or broken
images across non-Leadgrid products that also consume the shared user profile.

The live object-path verification is available as:

```bash
cd backend
LEADGRID_S3_E2E=1 npm run test:leadgrid-s3:e2e
```

It performs server PUT, signed GET, byte comparison and DELETE, followed by a
direct temporary PUT, header/signature validation, server-side finalization,
SHA-256 verification and cleanup. It requires the four production-style
`AWS_LEADGRID_*` variables; local short-lived AWS sessions may additionally
provide `LEADGRID_S3_E2E_SESSION_TOKEN` without changing the Render contract.

The machine-readable inventory and exact prefixes live in
`storage-layout.json`.

## Render runtime identity

The production backend uses the IAM service user
`leadgrid-production-storage` with the inline policy in
`runtime-policy.json`. It can list and manage objects only below these prefixes:

```text
organizations/
users/
temporary/
exports/
quarantine/
```

It cannot read another product's bucket, inspect bucket policy, list the bucket
root or modify `_system/` and `platform/`. Render stores its credentials under
four service-local environment variables:

```text
AWS_LEADGRID_ACCESS_KEY_ID
AWS_LEADGRID_SECRET_ACCESS_KEY
AWS_LEADGRID_BUCKET_NAME
AWS_LEADGRID_REGION
```

Do not use the global `AWS_ACCESS_KEY_ID` fallback: unrelated R2 code in the
shared backend recognizes that name. Rotate the IAM access key deliberately and
update each Render key through the single-variable API endpoint, never through
the collection replacement endpoint.
