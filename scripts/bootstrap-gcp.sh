#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-landing-page-485614}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-protash}"
DEEPSEEK_SECRET="${DEEPSEEK_SECRET:-DEEPSEEK_API_KEY}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
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
    --description="Docker images for Protash"
fi

if ! gcloud secrets describe "${DEEPSEEK_SECRET}" >/dev/null 2>&1; then
  if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
    echo "Secret ${DEEPSEEK_SECRET} does not exist."
    echo "Set DEEPSEEK_API_KEY in your shell and rerun to create it automatically."
    exit 1
  fi
  printf "%s" "${DEEPSEEK_API_KEY}" | gcloud secrets create "${DEEPSEEK_SECRET}" \
    --data-file=-
else
  if [[ -n "${DEEPSEEK_API_KEY:-}" ]]; then
    printf "%s" "${DEEPSEEK_API_KEY}" | gcloud secrets versions add "${DEEPSEEK_SECRET}" \
      --data-file=-
  fi
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "${DEEPSEEK_SECRET}" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

gcloud secrets add-iam-policy-binding "${DEEPSEEK_SECRET}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

echo "Bootstrap complete."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Repository: ${REPOSITORY}"
echo "Secret: ${DEEPSEEK_SECRET}"
