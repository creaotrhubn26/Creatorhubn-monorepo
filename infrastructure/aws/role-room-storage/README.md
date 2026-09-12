# The Role Room production storage

Dedicated private AWS S3 bucket:
`the-role-room-prod-745600963362-eu-north-1` in `eu-north-1`.

This bucket is a separate security and lifecycle boundary for The Role Room.
It must use BucketOwnerEnforced ownership, block all public access, SSE-S3
encryption, versioning and the TLS-only bucket policy in this directory. The
backend identity must receive only `application-policy.json`; provisioning
credentials must never be installed in the application runtime.

## Runtime variables

Production uses Render's rotating OIDC credentials. Configure these values on
the backend service:

```text
AWS_ROLE_ARN=arn:aws:iam::745600963362:role/TheRoleRoomStorageRuntimeProd
AWS_ROLE_ROOM_BUCKET_NAME=the-role-room-prod-745600963362-eu-north-1
AWS_ROLE_ROOM_REGION=eu-north-1
```

Render automatically supplies `AWS_WEB_IDENTITY_TOKEN_FILE` after deployment;
do not configure that value manually. The backend explicitly selects this web
identity provider, so unrelated AWS keys on the same service cannot take
precedence over the Role Room role.

For short-lived local or emergency operation only, the backend also supports
`AWS_ROLE_ROOM_ACCESS_KEY_ID`, `AWS_ROLE_ROOM_SECRET_ACCESS_KEY` and optional
`AWS_ROLE_ROOM_SESSION_TOKEN`. There is deliberately no fallback to generic AWS
or B2 credentials.

## Canonical object hierarchy

```text
organizations/{organizationId}/
  projects/{projectId}/
    production/continuity/production-days/{productionDayId}/
      scenes/{sceneId}/uploads/{userId}/{objectId}-{filename}
```

Users without an organization use `personal-{userId}` as the tenant segment.
All segments are sanitized. PostgreSQL is the source of authorization and
ownership; an S3 key or signed URL never grants project access on its own.

Objects are private and encrypted. The API inspects the file signature before
streaming the object to S3 and stores only S3 metadata in
`casting_production_continuity_media`. Reads require current project access and
return a signed URL lasting at most ten minutes.

## Provisioning checklist

After authenticating an AWS CLI profile for account `745600963362`, run:

```bash
./infrastructure/aws/role-room-storage/provision.sh <aws-profile>
```

The idempotent script creates the exact bucket when needed and applies public
access blocking, BucketOwnerEnforced ownership, AES256 encryption, versioning,
TLS-only bucket policy, lifecycle, CORS and tags. It refuses to run in another
AWS account.

The production account already defines `TheRoleRoomStorageRuntimeProd`, trusted
only by the exact Render backend service through the workspace OIDC provider.
For a new environment, create an equivalent least-privilege role using
`application-policy.json`. Set the three explicit runtime variables above,
redeploy so Render can inject its rotating token file, and run:

```bash
node scripts/deploy/render-backend.mjs assert-role-room-storage-runtime
```
