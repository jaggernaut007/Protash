#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-landing-page-485614}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-ashley-os}"
OPENAI_SECRET="${OPENAI_SECRET:-OPENAI_API_KEY}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
  echo "Example: PROJECT_ID=my-gcp-project npm run gcp:bootstrap"
  exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Docker images for Ashley OS deployments"
fi

if ! gcloud secrets describe "${OPENAI_SECRET}" >/dev/null 2>&1; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "Secret ${OPENAI_SECRET} does not exist."
    echo "Set OPENAI_API_KEY in your shell and rerun to create it automatically."
    exit 1
  fi

  printf "%s" "${OPENAI_API_KEY}" | gcloud secrets create "${OPENAI_SECRET}" \
    --data-file=-
else
  if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    printf "%s" "${OPENAI_API_KEY}" | gcloud secrets versions add "${OPENAI_SECRET}" \
      --data-file=-
  fi
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${OPENAI_SECRET}" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${OPENAI_SECRET}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

echo "Bootstrap complete."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Repository: ${REPOSITORY}"
echo "Secret: ${OPENAI_SECRET}"
