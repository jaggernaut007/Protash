# Protash - Super Rapid Prototyper

A Next.js + Tailwind CSS workspace with a glassmorphic UI, an interactive canvas, and an AI chatbot sidebar. Built with TypeScript and the App Router.

## Features

- **Glassmorphic UI**: Clean, frosted-glass aesthetic using Tailwind.
- **Interactive Canvas**: Render and manage components with save/load.
- **Saved Components**: Persist, list, and reuse canvas items.
- **AI Chat**: Chatbot sidebar backed by an agent API route.
- **Orchestration**: Message bus and multi-agent coordination utilities.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI SDKs**: `ai`, `@ai-sdk/openai`

## Scripts

- `dev`: Start the Next.js dev server
- `build`: Create a production build
- `start`: Run the production server
- `lint`: Lint the project

## Quick Start

### Install

```bash
npm install
```

### Develop

```bash
npm run dev
```

Then open http://localhost:3000.

### Build & Run

```bash
npm run build
npm start
```

## Environment

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.

- `OPENAI_API_KEY`: required for AI routes
- `BOARD_STORAGE_MODE=file|memory`: optional
- Local development defaults to `file`
- Hosted production defaults to `memory`

## Deployment Notes

- The app is deploy-safe on platforms like Vercel.
- Board state is ephemeral in hosted production unless you replace the in-memory store with persistent storage.
- Local development still persists the board to `.data/board.json`.
- The included GCP path targets Cloud Run because this project uses dynamic API routes and server-side OpenAI calls.

## GCP Deployment

This repo now includes a Cloud Run deployment path for the landing page app.

### What gets deployed

- A standalone Next.js production server in a Docker container
- A Cloud Build pipeline defined in `cloudbuild.yaml`
- Shell scripts in `scripts/` to bootstrap GCP resources and deploy
- Runtime secret injection from Secret Manager for `OPENAI_API_KEY`

### Prerequisites

- `gcloud` CLI authenticated to your GCP account
- Docker available locally if you want to test the image with `npm run docker:build`
- A GCP project with billing enabled

### 1. Bootstrap GCP resources

Set your project and optionally your OpenAI key in the shell:

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-west1"
export REPOSITORY="ashley-os"
export OPENAI_API_KEY="your-rotated-openai-key"
npm run gcp:bootstrap
```

This enables the required APIs, creates the Artifact Registry repository if needed, and creates or updates the `OPENAI_API_KEY` secret.

### 2. Deploy to Cloud Run

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-west1"
export SERVICE="ashley-os-landing"
export REPOSITORY="ashley-os"
npm run gcp:deploy
```

The deployment pipeline will:

- Build the container image
- Push it to Artifact Registry
- Deploy the app to Cloud Run
- Set `NODE_ENV=production`
- Force `BOARD_STORAGE_MODE=memory` for deploy-safe ephemeral storage
- Mount `OPENAI_API_KEY` from Secret Manager

### 3. Local production check

```bash
npm run build
npm run docker:build
```

### Notes

- Cloud Run is stateless. Saved board data resets across revisions and instance restarts while `BOARD_STORAGE_MODE=memory` is used.
- If you need persistent board data in production, move `lib/boardStore.ts` to Firestore, Cloud SQL, or another durable store.
- Do not deploy with the current `.env.local` key. Rotate it first and store the new value in Secret Manager.

## Project Structure (key files)

```
app/
  globals.css
  layout.tsx
  page.tsx
  PreloadLibs.tsx
  api/
    agent/
      route.ts
components/
  Canvas.tsx
  CanvasWithSavePanel.tsx
  ChatbotSidebar.tsx
  DynamicCanvasRenderer.tsx
  SavedComponentsPanel.tsx
context/
  CodeContext.tsx
  SavedComponentContext.tsx
lib/
  agents.ts
  messageBus.ts
  multiAgentOrchestrator.ts
  useSavedComponents.ts
types/
  babel-standalone.d.ts
```

## Notable Modules

- **Canvas & Renderer**: `Canvas.tsx`, `DynamicCanvasRenderer.tsx` for drawing and dynamic component rendering; `CanvasWithSavePanel.tsx` pairs the canvas with a save UI.
- **Saved Components**: `SavedComponentsPanel.tsx` and `useSavedComponents.ts` manage persistence and retrieval.
- **Chatbot**: `ChatbotSidebar.tsx` provides the UI; the API lives in `app/api/agent/route.ts`.
- **Orchestrator & Bus**: `multiAgentOrchestrator.ts` and `messageBus.ts` coordinate agent workflows and events.
- **Contexts**: `CodeContext.tsx`, `SavedComponentContext.tsx` share state across the app.

## Development Notes

- Tailwind setup is defined in `tailwind.config.ts` and global styles in `app/globals.css`.
- TypeScript config lives in `tsconfig.json`; Next.js config in `next.config.ts`.
- If you use the VS Code task, a background `dev` task is available.

## Design Language for Generated Components

- Shared guidance lives in `lib/designLanguage.ts` and is injected into coding agents.
- Use the following classes for consistent visuals:
  - Panels: `.panel-steel`, `.panel-steel-soft`, `.panel-frosted-glass`
  - Buttons: `.button-steel`
  - Inputs: `.input-steel`
  - Layout: `w-full h-full`, `rounded-2xl`/`rounded-3xl`, responsive spacing
- Theme awareness: the page sets `data-theme` to `day` or `night`; global CSS adapts accordingly.
- The canvas wraps generated components with `.panel-steel-soft` for cohesion.

## License

MIT
