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

S3 is a flat object store. The slash-separated hierarchy is implemented through
key prefixes; zero-byte root markers make the intended top-level structure
visible in the AWS console before tenant data exists.

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
