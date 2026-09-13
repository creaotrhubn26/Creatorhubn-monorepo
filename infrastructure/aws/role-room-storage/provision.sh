#!/usr/bin/env bash

set -Eeuo pipefail

ROLE_ROOM_AWS_PROFILE="${1:-}"
ROLE_ROOM_AWS_ACCOUNT_ID="745600963362"
ROLE_ROOM_AWS_REGION="eu-north-1"
ROLE_ROOM_BUCKET="the-role-room-prod-${ROLE_ROOM_AWS_ACCOUNT_ID}-${ROLE_ROOM_AWS_REGION}"
ROLE_ROOM_RUNTIME_ROLE="TheRoleRoomStorageRuntimeProd"
ROLE_ROOM_RUNTIME_POLICY_ARN="arn:aws:iam::${ROLE_ROOM_AWS_ACCOUNT_ID}:policy/TheRoleRoomStorageRuntimeProd"
ROLE_ROOM_INFRA_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

if [ -z "$ROLE_ROOM_AWS_PROFILE" ]; then
  echo "Usage: $0 <aws-profile>" >&2
  exit 2
fi

ROLE_ROOM_CALLER_ACCOUNT=$(aws sts get-caller-identity \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --query Account \
  --output text)
if [ "$ROLE_ROOM_CALLER_ACCOUNT" != "$ROLE_ROOM_AWS_ACCOUNT_ID" ]; then
  echo "Refusing to provision The Role Room bucket in AWS account $ROLE_ROOM_CALLER_ACCOUNT" >&2
  exit 1
fi

ROLE_ROOM_MATCHING_BUCKET=$(aws s3api list-buckets \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --query "Buckets[?Name=='${ROLE_ROOM_BUCKET}'].Name | [0]" \
  --output text)
if [ "$ROLE_ROOM_MATCHING_BUCKET" != "$ROLE_ROOM_BUCKET" ]; then
  aws s3api create-bucket \
    --profile "$ROLE_ROOM_AWS_PROFILE" \
    --bucket "$ROLE_ROOM_BUCKET" \
    --region "$ROLE_ROOM_AWS_REGION" \
    --create-bucket-configuration "LocationConstraint=${ROLE_ROOM_AWS_REGION}"
fi

aws s3api put-public-access-block \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --public-access-block-configuration \
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

aws s3api put-bucket-ownership-controls \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

aws s3api put-bucket-encryption \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":false,"BlockedEncryptionTypes":{"EncryptionType":["SSE-C"]}}]}'

aws s3api put-bucket-versioning \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-policy \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --policy "file://${ROLE_ROOM_INFRA_DIR}/bucket-policy.json"

aws s3api put-bucket-lifecycle-configuration \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --lifecycle-configuration "file://${ROLE_ROOM_INFRA_DIR}/lifecycle.json"

aws s3api put-bucket-cors \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --cors-configuration "file://${ROLE_ROOM_INFRA_DIR}/cors.json"

aws s3api put-bucket-tagging \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --bucket "$ROLE_ROOM_BUCKET" \
  --tagging "file://${ROLE_ROOM_INFRA_DIR}/tags.json"

ROLE_ROOM_ATTACHED_POLICY=$(aws iam list-attached-role-policies \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --role-name "$ROLE_ROOM_RUNTIME_ROLE" \
  --query "AttachedPolicies[?PolicyArn=='${ROLE_ROOM_RUNTIME_POLICY_ARN}'].PolicyArn | [0]" \
  --output text)
if [ "$ROLE_ROOM_ATTACHED_POLICY" != "$ROLE_ROOM_RUNTIME_POLICY_ARN" ]; then
  echo "Refusing to replace the runtime policy: $ROLE_ROOM_RUNTIME_POLICY_ARN is not attached to $ROLE_ROOM_RUNTIME_ROLE" >&2
  exit 1
fi

ROLE_ROOM_DEFAULT_POLICY_VERSION=$(aws iam get-policy \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --policy-arn "$ROLE_ROOM_RUNTIME_POLICY_ARN" \
  --query Policy.DefaultVersionId \
  --output text)
ROLE_ROOM_CURRENT_POLICY=$(mktemp)
trap 'rm -f "$ROLE_ROOM_CURRENT_POLICY"' EXIT
aws iam get-policy-version \
  --profile "$ROLE_ROOM_AWS_PROFILE" \
  --policy-arn "$ROLE_ROOM_RUNTIME_POLICY_ARN" \
  --version-id "$ROLE_ROOM_DEFAULT_POLICY_VERSION" \
  --query PolicyVersion.Document \
  --output json > "$ROLE_ROOM_CURRENT_POLICY"

if ! python3 - "$ROLE_ROOM_CURRENT_POLICY" "${ROLE_ROOM_INFRA_DIR}/application-policy.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as current, open(sys.argv[2], encoding="utf-8") as desired:
    raise SystemExit(0 if json.load(current) == json.load(desired) else 1)
PY
then
  ROLE_ROOM_POLICY_VERSION_COUNT=$(aws iam list-policy-versions \
    --profile "$ROLE_ROOM_AWS_PROFILE" \
    --policy-arn "$ROLE_ROOM_RUNTIME_POLICY_ARN" \
    --query 'length(Versions)' \
    --output text)
  if [ "$ROLE_ROOM_POLICY_VERSION_COUNT" -ge 5 ]; then
    echo "Refusing to delete an IAM rollback version: $ROLE_ROOM_RUNTIME_POLICY_ARN already has five versions" >&2
    exit 1
  fi
  aws iam create-policy-version \
    --profile "$ROLE_ROOM_AWS_PROFILE" \
    --policy-arn "$ROLE_ROOM_RUNTIME_POLICY_ARN" \
    --policy-document "file://${ROLE_ROOM_INFRA_DIR}/application-policy.json" \
    --set-as-default
fi

echo "The Role Room S3 bucket and runtime policy are configured: $ROLE_ROOM_BUCKET"
