#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-landing-page-485614}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-protash}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
  exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

# Secrets live in Doppler (project: protash), not GCP Secret Manager.
# secretmanager.googleapis.com is intentionally not enabled here.
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Docker images for Protash"
fi

echo "Bootstrap complete."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Repository: ${REPOSITORY}"
echo
echo "Secrets are managed in Doppler. Create a service token for the"
echo "protash/prd config and export it before deploying:"
echo "  export DOPPLER_TOKEN=dp.st.prd.xxxxxxxx"
echo "  npm run gcp:deploy"
