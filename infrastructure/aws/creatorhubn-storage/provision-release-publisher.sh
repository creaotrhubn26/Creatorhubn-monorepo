#!/usr/bin/env bash
set -euo pipefail

profile="${1:-tidsflyt}"
expected_account="745600963362"
region="eu-north-1"
bucket="creatorhubn-prod-${expected_account}-${region}"
role="CreatorHubGitHubApplicationReleasePublisher"
policy="CreatorHubProToolsCompanionReleasePublisher"
infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

account=$(aws sts get-caller-identity --profile "$profile" --query Account --output text)
if [[ "$account" != "$expected_account" ]]; then
  echo "Expected AWS account $expected_account, got $account" >&2
  exit 1
fi
aws s3api head-bucket --profile "$profile" --bucket "$bucket"

provider_arn="arn:aws:iam::${expected_account}:oidc-provider/token.actions.githubusercontent.com"
if ! aws iam get-open-id-connect-provider --profile "$profile" \
  --open-id-connect-provider-arn "$provider_arn" >/dev/null 2>&1; then
  aws iam create-open-id-connect-provider --profile "$profile" \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com >/dev/null
fi

if aws iam get-role --profile "$profile" --role-name "$role" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --profile "$profile" --role-name "$role" \
    --policy-document "file://${infra_dir}/release-publisher-trust-policy.json"
else
  aws iam create-role --profile "$profile" --role-name "$role" \
    --assume-role-policy-document "file://${infra_dir}/release-publisher-trust-policy.json" >/dev/null
fi
aws iam put-role-policy --profile "$profile" --role-name "$role" --policy-name "$policy" \
  --policy-document "file://${infra_dir}/release-publisher-policy.json"

role_arn=$(aws iam get-role --profile "$profile" --role-name "$role" --query 'Role.Arn' --output text)
gh variable set AWS_APPLICATION_RELEASE_ROLE_ARN --repo creaotrhubn26/Creatorhubn-monorepo --body "$role_arn"
gh variable set CREATORHUB_APPLICATIONS_BUCKET --repo creaotrhubn26/Creatorhubn-monorepo --body "$bucket"
gh variable set CREATORHUB_APPLICATIONS_REGION --repo creaotrhubn26/Creatorhubn-monorepo --body "$region"
echo "Configured $role_arn and GitHub release variables."
