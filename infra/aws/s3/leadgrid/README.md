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
