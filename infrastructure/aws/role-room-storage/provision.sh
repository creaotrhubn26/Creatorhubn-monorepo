#!/usr/bin/env bash

set -Eeuo pipefail

ROLE_ROOM_AWS_PROFILE="${1:-}"
ROLE_ROOM_AWS_ACCOUNT_ID="745600963362"
ROLE_ROOM_AWS_REGION="eu-north-1"
ROLE_ROOM_BUCKET="the-role-room-prod-${ROLE_ROOM_AWS_ACCOUNT_ID}-${ROLE_ROOM_AWS_REGION}"
ROLE_ROOM_INFRA_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

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

echo "The Role Room S3 bucket is configured: $ROLE_ROOM_BUCKET"
