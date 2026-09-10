#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly EXPECTED_ACCOUNT_ID="745600963362"
readonly REGION="eu-north-1"
readonly BUCKET="leadgrid-prod-${EXPECTED_ACCOUNT_ID}-${REGION}"
readonly AWS_PROFILE_NAME="${1:-tidsflyt}"

command -v aws >/dev/null || { echo "aws CLI is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
command -v shasum >/dev/null || { echo "shasum is required" >&2; exit 1; }

actual_account_id="$(aws sts get-caller-identity \
  --profile "$AWS_PROFILE_NAME" \
  --query Account \
  --output text)"
[[ "$actual_account_id" == "$EXPECTED_ACCOUNT_ID" ]]

location="$(aws s3api get-bucket-location \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --query LocationConstraint \
  --output text)"
[[ "$location" == "$REGION" ]]

aws s3api get-public-access-block --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '.PublicAccessBlockConfiguration
    | .BlockPublicAcls and .IgnorePublicAcls and .BlockPublicPolicy and .RestrictPublicBuckets' >/dev/null

aws s3api get-bucket-policy-status --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '.PolicyStatus.IsPublic == false' >/dev/null

bucket_policy="$(aws s3api get-bucket-policy \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --query Policy \
  --output text)"
jq -e --arg bucket "$BUCKET" '
  .Statement == [{
    Sid: "DenyInsecureTransport",
    Effect: "Deny",
    Principal: "*",
    Action: "s3:*",
    Resource: ["arn:aws:s3:::" + $bucket, "arn:aws:s3:::" + $bucket + "/*"],
    Condition: {Bool: {"aws:SecureTransport": "false"}}
  }]' <<< "$bucket_policy" >/dev/null

aws s3api get-bucket-ownership-controls --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '.OwnershipControls.Rules == [{"ObjectOwnership":"BucketOwnerEnforced"}]' >/dev/null

aws s3api get-bucket-encryption --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '.ServerSideEncryptionConfiguration.Rules[0]
    | .ApplyServerSideEncryptionByDefault.SSEAlgorithm == "AES256"
      and .BlockedEncryptionTypes.EncryptionType == ["SSE-C"]' >/dev/null

aws s3api get-bucket-cors --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '.CORSRules[0]
    | .AllowedOrigins == ["https://leadgrid.no", "https://www.leadgrid.no"]
      and .AllowedMethods == ["GET", "HEAD", "PUT"]' >/dev/null

aws s3api get-bucket-lifecycle-configuration --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '([.Rules[].ID] | sort) == ([
      "AbortIncompleteMultipartUploads",
      "ExpireDataExports",
      "ExpireQuarantinedUploads",
      "ExpireTemporaryUploads"
    ] | sort)' >/dev/null

aws s3api get-bucket-tagging --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" \
  | jq -e '.TagSet | sort_by(.Key) == ([
      {Key: "DataClassification", Value: "personal-data"},
      {Key: "Environment", Value: "production"},
      {Key: "ManagedBy", Value: "aws-cli"},
      {Key: "Project", Value: "Leadgrid"}
    ] | sort_by(.Key))' >/dev/null

versioning_json="$(aws s3api get-bucket-versioning \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --output json)"
[[ -z "$versioning_json" || "$(jq -r '.Status // ""' <<< "$versioning_json")" == "" ]]

expected_prefixes="$(printf '%s\n' \
  "_system/" \
  "exports/" \
  "migration/" \
  "organizations/" \
  "platform/" \
  "quarantine/" \
  "temporary/" \
  "users/")"

actual_prefixes="$(aws s3api list-objects-v2 \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --delimiter '/' \
  --query 'CommonPrefixes[].Prefix' \
  --output text | tr '\t' '\n' | sort)"

[[ "$actual_prefixes" == "$expected_prefixes" ]]

organization_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
project_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
lead_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
user_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
asset_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
organization_key="organizations/${organization_id}/projects/${project_id}/leads/${lead_id}/attachments/${asset_id}/original.json"
user_key="users/${user_id}/files/${asset_id}/original.json"
verification_keys=("$organization_key" "$user_key")
source_file="$(mktemp)"
downloaded_file="$(mktemp)"
layout_file="$(mktemp)"

cleanup() {
  for key in "${verification_keys[@]}"; do
    aws s3api delete-object \
      --profile "$AWS_PROFILE_NAME" \
      --bucket "$BUCKET" \
      --key "$key" >/dev/null 2>&1 || true
  done
  rm -f "$source_file" "$downloaded_file" "$layout_file"
}
trap cleanup EXIT

jq -n --arg organizationId "$organization_id" --arg userId "$user_id" '{
  schemaVersion: 1,
  organizationId: $organizationId,
  userId: $userId,
  containsPersonalData: false
}' > "$source_file"

for key in "${verification_keys[@]}"; do
  aws s3api put-object \
    --profile "$AWS_PROFILE_NAME" \
    --bucket "$BUCKET" \
    --key "$key" \
    --body "$source_file" \
    --content-type "application/json" \
    --metadata "purpose=tenant-prefix-e2e" \
    --checksum-algorithm SHA256 >/dev/null

  aws s3api head-object \
    --profile "$AWS_PROFILE_NAME" \
    --bucket "$BUCKET" \
    --key "$key" \
    | jq -e '.ServerSideEncryption == "AES256"
      and .ContentType == "application/json"
      and .Metadata.purpose == "tenant-prefix-e2e"' >/dev/null

  listed_key="$(aws s3api list-objects-v2 \
    --profile "$AWS_PROFILE_NAME" \
    --bucket "$BUCKET" \
    --prefix "$key" \
    --query "Contents[?Key=='${key}'].Key | [0]" \
    --output text)"
  [[ "$listed_key" == "$key" ]]
done

aws s3api get-object \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --key "$organization_key" \
  "$downloaded_file" >/dev/null

[[ "$(shasum -a 256 "$source_file" | awk '{print $1}')" == \
   "$(shasum -a 256 "$downloaded_file" | awk '{print $1}')" ]]

aws s3api get-object \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --key "_system/storage-layout.json" \
  "$layout_file" >/dev/null
cmp -s "${SCRIPT_DIR}/storage-layout.json" "$layout_file"

cleanup
trap - EXIT

for key in "${verification_keys[@]}"; do
  if aws s3api head-object \
    --profile "$AWS_PROFILE_NAME" \
    --bucket "$BUCKET" \
    --key "$key" >/dev/null 2>&1
  then
    echo "Verification object still exists after cleanup: $key" >&2
    exit 1
  fi
done

public_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  "https://${BUCKET}.s3.${REGION}.amazonaws.com/_system/storage-layout.json")"
[[ "$public_status" == "403" ]]

echo "LEADGRID_S3_CONFIGURATION=PASS"
echo "LEADGRID_S3_ORGANIZATION_USER_PREFIXES=PASS"
echo "LEADGRID_S3_UPLOAD_LIST_DOWNLOAD_DELETE=PASS"
echo "LEADGRID_S3_PUBLIC_READ_BLOCKED=PASS"
