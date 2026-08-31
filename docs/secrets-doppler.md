# Secrets — Doppler

Protash's runtime secrets live in [Doppler](https://doppler.com), not GCP Secret
Manager and not committed `.env` files. This doc covers day-to-day use and the
migration that got us here.

## Project layout

| Doppler project | Config | Used by |
|---|---|---|
| `protash` | `dev` | local development (`doppler.yaml` default) |
| `protash` | `stg` | staging (unused today; parity with prd) |
| `protash` | `prd` | Cloud Run deploy (`scripts/deploy-gcp.sh`) |

Variables:

| Key | dev | stg | prd |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | real key | real key | real key |
| `BOARD_STORAGE_MODE` | `file` | `memory` | `memory` |
| `NODE_ENV` | — | — | `production` |

`DEEPSEEK_API_KEY` is the only true secret. It powers every LLM call in the
6-stage pipeline via the OpenAI-compatible client in `lib/aiConfig.ts`
(`app/api/agent/route.ts` builds its own client with the same env var).

## Local development

```bash
doppler login          # once per machine
doppler setup          # reads doppler.yaml -> protash / dev
npm run dev            # dev / start / eval are wrapped in `doppler run`
```

`npm run build` is intentionally **not** wrapped — it runs inside the Docker
build where Doppler is not present, and `next build` does not need the key.

Editing values:

```bash
doppler secrets set DEEPSEEK_API_KEY=sk-... --project protash --config dev
doppler secrets get DEEPSEEK_API_KEY --project protash --config prd
```

Running without Doppler: `cp .env.example .env.local` and fill in real values.
`.env` / `.env*.local` are git-, docker-, and gcloud-ignored.

## Deploy flow

`npm run gcp:deploy` (`scripts/deploy-gcp.sh`) does:

1. `gcloud builds submit` → `cloudbuild.yaml` builds and pushes the image only.
2. `doppler secrets download --format json` for `protash/prd` → rendered to a
   temp Cloud Run env-vars file (`DOPPLER_*` metadata keys stripped) with
   `python3`.
3. `gcloud run services update --clear-secrets` (best-effort) to drop any legacy
   Secret Manager binding — see gotcha below.
4. `gcloud run deploy --env-vars-file <tmp>` applies the values as plaintext env
   vars on a new revision.

Target defaults (override with env vars): `PROJECT_ID=landing-page-485614`,
`REGION=europe-west1`, `SERVICE=protash`, `DOPPLER_CONFIG=prd`.

### CI / non-interactive

Provide a read-only Doppler service token instead of `doppler login`:

```bash
export DOPPLER_TOKEN=dp.st.prd.xxxxxxxx   # protash/prd, read-only
npm run gcp:deploy
```

Token `ci-gcp-deploy` already exists for `protash/prd`
(`doppler configs tokens` to list/revoke).

## Migration notes (2026-08-31)

What changed:

- `cloudbuild.yaml` — dropped `--set-secrets DEEPSEEK_API_KEY=...:latest`; build
  step now only builds + pushes.
- `scripts/deploy-gcp.sh` — pulls from Doppler and deploys env vars locally.
- `scripts/bootstrap-gcp.sh` — removed `secretmanager.googleapis.com`
  enablement, secret creation, and IAM bindings.
- `package.json` — `dev` / `start` / `eval` wrapped in `doppler run`.
- `doppler.yaml` — new; pins repo to `protash` / `dev`.
- `.dockerignore` / `.gcloudignore` — added `.env`.

Nothing was migrated *out* of GCP Secret Manager: the old `DEEPSEEK_API_KEY`
secret in `landing-page-485614` had already been deleted, so the pre-migration
Cloud Run revision was referencing a `NOT_FOUND` secret and would have failed any
cold start.

Gotchas hit during rollout:

1. **Doppler CLI in Cloud Build** — installing it in the `cloud-sdk` builder
   failed (bad flag, then missing `gnupg`). Fix: don't. The deploy step runs
   locally where `doppler` is already installed and authed.
2. **secretKeyRef → plaintext** — `gcloud run deploy` refuses to change an env
   var that is currently a `secretKeyRef` into a string literal in one call
   (`Cannot update environment variable [...] to string literal because it has
   already been set with a different type`). Must `gcloud run services update
   --clear-secrets` (or `--remove-secrets=KEY`) first; the script now does this.
3. **`.env` in build context** — `.env` was not ignored, so it rode along in the
   Cloud Build source tarball. Added to `.dockerignore` / `.gcloudignore`.
   `DEEPSEEK_API_KEY` is not `NEXT_PUBLIC_*`, so it was never inlined into the
   built output, but rotate the key if the early build tarball is a concern.

## Rollback

Doppler → Secret Manager, if ever needed:

```bash
printf "%s" "$(doppler secrets get DEEPSEEK_API_KEY --plain --project protash --config prd)" \
  | gcloud secrets create DEEPSEEK_API_KEY --data-file=- --project landing-page-485614
gcloud run services update protash --region europe-west1 \
  --update-secrets DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest \
  --remove-env-vars DEEPSEEK_API_KEY
```

Then restore the `--set-secrets` line in `cloudbuild.yaml` from git history.
