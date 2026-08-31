#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-landing-page-485614}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-protash}"
REPOSITORY="${REPOSITORY:-protash}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-protash}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
  echo "Example: PROJECT_ID=my-gcp-project npm run gcp:deploy"
  exit 1
fi

# Runtime env vars (incl. DEEPSEEK_API_KEY) come from Doppler.
# Auth with either a service token (CI) or an interactive `doppler login` (local):
#   export DOPPLER_TOKEN=dp.st.prd.xxxxxxxx      # read-only, scoped to protash/prd
command -v doppler >/dev/null || { echo "doppler CLI not found. https://docs.doppler.com/docs/install-cli"; exit 1; }
command -v python3 >/dev/null || { echo "python3 not found (needed to render the env file)."; exit 1; }

gcloud config set project "${PROJECT_ID}" >/dev/null

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE}"

# 1. Build + push the image via Cloud Build.
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}"

# 2. Render the Doppler config to a Cloud Run env-vars file (DOPPLER_* keys dropped).
ENV_FILE="$(mktemp -t protash-env.XXXXXX)"
trap 'rm -f "${ENV_FILE}"' EXIT
doppler secrets download --no-file --format json \
  --project "${DOPPLER_PROJECT}" --config "${DOPPLER_CONFIG}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); [print("%s: %s" % (k, json.dumps(str(v)))) for k,v in d.items() if not k.startswith("DOPPLER_")]' \
  > "${ENV_FILE}"

# 3. Drop any legacy GCP Secret Manager bindings first. gcloud refuses to turn a
# secretKeyRef env var into a plaintext one in the same `run deploy`, so this is
# a separate best-effort step (a no-op once the service has none / doesn't exist).
gcloud run services update "${SERVICE}" \
  --region "${REGION}" \
  --clear-secrets >/dev/null 2>&1 || true

# 4. Deploy the revision with the Doppler-sourced env vars.
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --env-vars-file "${ENV_FILE}"

echo "Deployment complete."
echo "Service: ${SERVICE}"
echo "Region: ${REGION}"
echo "Image: ${IMAGE}"
echo "Secrets: Doppler ${DOPPLER_PROJECT}/${DOPPLER_CONFIG}"
