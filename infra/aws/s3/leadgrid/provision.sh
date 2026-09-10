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

actual_account_id="$(aws sts get-caller-identity \
  --profile "$AWS_PROFILE_NAME" \
  --query Account \
  --output text)"

if [[ "$actual_account_id" != "$EXPECTED_ACCOUNT_ID" ]]; then
  echo "Refusing to provision account $actual_account_id; expected $EXPECTED_ACCOUNT_ID" >&2
  exit 1
fi

if ! aws s3api head-bucket --profile "$AWS_PROFILE_NAME" --bucket "$BUCKET" >/dev/null 2>&1; then
  aws s3api create-bucket \
    --profile "$AWS_PROFILE_NAME" \
    --region "$REGION" \
    --bucket "$BUCKET" \
    --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
fi

aws s3api put-public-access-block \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

aws s3api put-bucket-ownership-controls \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

aws s3api put-bucket-encryption \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration "file://${SCRIPT_DIR}/encryption.json"

aws s3api put-bucket-tagging \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --tagging "file://${SCRIPT_DIR}/tags.json"

aws s3api put-bucket-lifecycle-configuration \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --lifecycle-configuration "file://${SCRIPT_DIR}/lifecycle.json"

aws s3api put-bucket-cors \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --cors-configuration "file://${SCRIPT_DIR}/cors.json"

bucket_policy="$(jq -cn --arg bucket "$BUCKET" '{
  Version: "2012-10-17",
  Statement: [{
    Sid: "DenyInsecureTransport",
    Effect: "Deny",
    Principal: "*",
    Action: "s3:*",
    Resource: ["arn:aws:s3:::" + $bucket, "arn:aws:s3:::" + $bucket + "/*"],
    Condition: {Bool: {"aws:SecureTransport": "false"}}
  }]
}')"

aws s3api put-bucket-policy \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --policy "$bucket_policy"

empty_file="$(mktemp)"
trap 'rm -f "$empty_file"' EXIT

for prefix in \
  "_system/" \
  "platform/" \
  "platform/assets/" \
  "platform/templates/" \
  "platform/releases/" \
  "organizations/" \
  "users/" \
  "temporary/" \
  "quarantine/" \
  "exports/" \
  "migration/"
do
  aws s3api put-object \
    --profile "$AWS_PROFILE_NAME" \
    --bucket "$BUCKET" \
    --key "$prefix" \
    --body "$empty_file" \
    --content-type "application/x-directory" \
    --server-side-encryption AES256 >/dev/null
done

aws s3api put-object \
  --profile "$AWS_PROFILE_NAME" \
  --bucket "$BUCKET" \
  --key "_system/storage-layout.json" \
  --body "${SCRIPT_DIR}/storage-layout.json" \
  --content-type "application/json" \
  --cache-control "no-store" \
  --server-side-encryption AES256 >/dev/null

echo "Provisioned s3://${BUCKET}"
