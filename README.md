# Protash — Intent to Enterprise Prototype in Seconds

Describe a business use case in plain English. Protash generates a fully interactive, domain-aware enterprise dashboard — real KPIs, realistic data, Recharts visualizations, and production-quality Tailwind styling — validated by a 6-stage multi-agent pipeline before it ever reaches your screen.

**Live demo:** [protash.shreyasjagannath.com](https://protash.shreyasjagannath.com)

---

## Why Protash

Most prototyping tools produce generic wireframes. Stakeholders see "Lorem ipsum" and "User A" and immediately check out.

Protash takes the opposite approach: it reads your intent, extracts domain entities, KPIs, and workflows specific to your industry, and generates a React component wired with plausible data — "Acme Corp | $142,000 | Proposal | Sarah Chen | 12 days" rather than placeholders. The result looks like something your engineering team actually built, not an AI artifact.

The pipeline is also self-healing. If the generated code has a runtime bug or fails business-alignment checks, agents flag the blockers and request a targeted fix — up to five correction rounds — before returning anything to the user.

---

## How the Pipeline Works

A single request passes through six sequential stages:

```
User Intent
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Stage 1 · businessContextAgent                     │
│  Extracts domain, entities, KPIs, workflows,        │
│  recommended chart types, and a hypothesis          │
│  (e.g. "what must stakeholders validate in 5 min?") │
└────────────────────┬────────────────────────────────┘
                     │ BusinessContext
                     ▼
┌─────────────────────────────────────────────────────┐
│  Stage 2 · specAgent                                │
│  Produces the screen spec: primary screen name,     │
│  named UI components, data model, interaction       │
│  pattern, and BDD success criteria                  │
└────────────────────┬────────────────────────────────┘
                     │ Spec
                     ▼
┌─────────────────────────────────────────────────────┐
│  Stage 3 · uxArchitectAgent                         │
│  Selects layout, chart types (Recharts API names),  │
│  color accents, header copy, and 8-10 rows of       │
│  realistic domain-specific mock data                │
└────────────────────┬────────────────────────────────┘
                     │ UXPlan
                     ▼
┌─────────────────────────────────────────────────────┐
│  Stage 4 · generatePrototypeCode                    │
│  Generates a self-contained React component.        │
│  No external imports — everything runs in a         │
│  sandboxed Babel renderer in the browser.           │
└────────┬───────────────────────────────┬────────────┘
         │                               │
         ▼ (parallel)                    ▼ (parallel)
┌────────────────┐             ┌─────────────────────┐
│  Stage 5 · QA  │             │  Stage 6 · Reviewer │
│  Data realism  │             │  Business alignment │
│  Visual check  │             │  KPI visibility     │
│  Blockers: no  │             │  Domain specificity │
│  placeholders, │             │  On-domain check    │
│  no blank views│             │                     │
└────────┬───────┘             └──────────┬──────────┘
         │                               │
         └──────────────┬────────────────┘
                        │ if any blocker:
                        ▼
              ┌──────────────────────┐
              │  Pre-check           │
              │  frontendAgent       │
              │  Runtime safety:     │
              │  JSX syntax, hook    │
              │  ordering, no fetch  │
              │  calls, null Context │
              └──────────┬───────────┘
                         │ hard-fail
                         ▼
                  ← Code Fix Request →
                  (up to 5 iterations)
                         │ all approved
                         ▼
                  Rendered Component
```

All structured outputs are validated against Zod schemas at the boundary of each stage. An agent that returns malformed JSON causes that stage to retry rather than silently passing bad data downstream.

---

## Sandboxed Browser Renderer

Generated components run entirely in the browser — no server round-trips after the initial generation. The renderer:

1. Transpiles the incoming JSX/TSX string with `@babel/standalone` (preset: `react` + `typescript`, classic runtime).
2. Pre-injects React hooks, Recharts, and other globals so components can use them without `import` statements.
3. Dynamically evaluates the module and mounts the exported default function into a React error boundary.

This means the component you see is _exactly_ what would run in a Next.js project. It also lets the sandboxed environment catch real runtime errors (bad hook ordering, null context access, etc.) and surface them in the UI as actionable messages rather than browser crashes.

---

## Agent Communication

Agents communicate through a typed `MessageBus` that supports both direct agent-to-agent messages and pub/sub topic subscriptions:

```
Orchestrator ──publish──▶ MessageBus ──route──▶ frontendAgent
                                     ──route──▶ qaAgent
                                     ──route──▶ reviewerAgent

Topics:
  codegen:complete  – canvas renders the approved component
  codegen:error     – error state surfaced without rendering bad code
```

The orchestrator runs agents in a configurable loop (`maxIterations = 5`). If an agent rejects, it triggers a targeted `requestCodeFix` call that passes the specific blockers as a diff prompt rather than regenerating from scratch — faster and cheaper than a full re-run.

---

## Model Economics

Protash uses **DeepSeek-V3** (`deepseek-chat`) for all pipeline stages:

| Tier | Use | Model |
|------|-----|-------|
| Orchestrator | Stages 1–4, code fixes | `deepseek-chat` |
| Worker | Stages 5–6, pre-check, evals | `deepseek-chat` |

DeepSeek-V3 is priced at **$0.27/M input tokens** — roughly 18× cheaper than GPT-4o — while matching or exceeding it on coding benchmarks. A full 6-stage pipeline run (including parallel eval agents) typically costs under $0.01.

The AI SDK layer uses a custom `fetch` wrapper to rewrite `role: "developer"` → `role: "system"` before the request leaves the process, working around an ai-sdk v2 behaviour that causes DeepSeek to reject the request.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Edge Runtime) |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 3 |
| Sandboxed transpilation | `@babel/standalone` 7 |
| Charts | Recharts 3 |
| Animation | Framer Motion 12 |
| AI SDK | Vercel AI SDK v5 (`ai`, `@ai-sdk/openai`) |
| AI Model | DeepSeek-V3 via OpenAI-compatible API |
| Schema validation | Zod 4 |
| Unit tests | Vitest 4 |
| E2E tests | Playwright |
| Containerisation | Docker (standalone Next.js output) |
| Cloud | GCP Cloud Run + Artifact Registry + Secret Manager |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [DeepSeek API key](https://platform.deepseek.com/) (free tier available)

### Install

```bash
git clone https://github.com/jaggernaut007/Protash.git
cd Protash
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key

# Optional — defaults shown
BOARD_STORAGE_MODE=file    # 'file' (local) or 'memory' (stateless)
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), type a business use case, and hit generate.

---

## Project Structure

```
app/
  api/
    agent/route.ts          Edge API: orchestrates the 6-stage pipeline
    board/route.ts          Board CRUD (intents, artifacts)
    mood-asset/route.ts     Mood-board asset generation
  page.tsx                  Root shell

components/
  Canvas.tsx                Resizable canvas host
  CanvasWithSavePanel.tsx   Canvas + save/load UI
  ChatbotSidebar.tsx        Prompt input and chat history
  DynamicCanvasRenderer.tsx Babel sandbox + Recharts injector

context/
  CodeContext.tsx           Global code state (current component)
  SavedComponentContext.tsx Saved component list state

lib/
  agents.ts                 All 6 pipeline agents + Agent interface
  agentContracts.ts         Zod schemas for inter-stage typed outputs
  aiConfig.ts               DeepSeek client + model constants
  messageBus.ts             Typed pub/sub message bus
  multiAgentOrchestrator.ts Iteration loop, fix requests, summary
  designLanguage.ts         Shared Tailwind class conventions injected into prompts
  boardStore.ts             File / in-memory board persistence

types/
  babel-standalone.d.ts     Type shims for Babel in the browser

scripts/
  bootstrap-gcp.sh          One-shot GCP resource provisioning
  deploy-gcp.sh             Cloud Run deploy
```

---

## Design Language

Generated components follow a shared design system defined in `lib/designLanguage.ts` and injected into every code-gen prompt. The key conventions:

| Purpose | Tailwind classes |
|---------|-----------------|
| Primary panels | `.panel-steel`, `.panel-frosted-glass` |
| Soft containers | `.panel-steel-soft` |
| Buttons | `.button-steel` |
| Inputs | `.input-steel` |
| Sizing | `w-full h-full`, `rounded-2xl` / `rounded-3xl` |

The global stylesheet reads `data-theme="day" | "night"` from the `<html>` element and switches CSS variables accordingly, so all generated components automatically support dark mode without code changes.

---

## Storage

| Mode | Where | Persistence |
|------|-------|-------------|
| `file` (default, local) | `.data/board.json` | Survives restarts |
| `memory` (default, hosted) | In-process Map | Resets on restart / scale-out |

To add durable production storage, replace the store implementation in `lib/boardStore.ts` with Firestore, Cloud SQL, or an equivalent — the interface is a simple async key-value abstraction.

---

## Running Tests

```bash
npm test            # Vitest unit tests
npm run eval        # LLM eval suite (scripts/eval.ts)
npx playwright test # End-to-end tests
```

---

## GCP Deployment

The repo ships a full Cloud Run pipeline:

### 1. Bootstrap GCP resources

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-west1"
export REPOSITORY="protash"
export DEEPSEEK_API_KEY="your-key"
npm run gcp:bootstrap
```

Enables required APIs, creates the Artifact Registry repository, and stores the API key in Secret Manager.

### 2. Deploy

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-west1"
export SERVICE="protash-landing"
export REPOSITORY="protash"
npm run gcp:deploy
```

The pipeline builds a standalone Next.js Docker image, pushes it to Artifact Registry, and deploys to Cloud Run with:

- `NODE_ENV=production`
- `BOARD_STORAGE_MODE=memory` (stateless, safe for scale-out)
- `DEEPSEEK_API_KEY` mounted from Secret Manager

### 3. Local production check

```bash
npm run build
npm run docker:build
```

---

## Contributing

1. Fork and clone the repo.
2. Create a feature branch off `main`.
3. Make your changes with tests where applicable.
4. Open a pull request — describe the intent, not just the diff.

Issues and ideas welcome on the [GitHub issue tracker](https://github.com/jaggernaut007/Protash/issues).

---

## License

MIT
