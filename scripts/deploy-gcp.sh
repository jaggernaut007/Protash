#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-landing-page-485614}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-ashley-os-landing}"
REPOSITORY="${REPOSITORY:-ashley-os}"
OPENAI_SECRET="${OPENAI_SECRET:-OPENAI_API_KEY}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
  echo "Example: PROJECT_ID=my-gcp-project npm run gcp:deploy"
  exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE}"

gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION="${REGION}",_SERVICE="${SERVICE}",_IMAGE="${IMAGE}",_OPENAI_SECRET="${OPENAI_SECRET}"

echo "Deployment submitted."
echo "Service: ${SERVICE}"
echo "Region: ${REGION}"
echo "Image: ${IMAGE}"
