Output dense, direct text. Omit pleasantries.

# Protash

Intent to Enterprise Prototype in Seconds. Multi-agent dashboard builder generating domain-aware, data-driven React components with business-logic validation.

## Stack (pin as adopted)
- TypeScript + React 18 + Vite
- Tailwind CSS + Recharts for visualizations
- Shadcn/ui components
- Multi-agent orchestration (agentic pipeline, 6 stages)

## Commands
- `npm install` — install deps
- `npm run dev` — dev server (localhost:5173)
- `npm run build` — production build
- `npm run lint` — TypeScript + ESLint
- `npm test` — unit tests (if present)

## Architecture
- Entry point: `src/main.tsx`
- Agent pipeline: orchestrator calls 6 sequential agents (businessContextAgent, dataDiscoveryAgent, queryPlanAgent, layoutPlanAgent, assembleAgent, evaluateAgent)
- UI renders generated React component with live data binding
- Each stage has validation gates; failures trigger correction rounds (up to 5)

## Definition of Done
1. TypeScript compiles cleanly
2. Generated component renders without runtime errors
3. Data visuals match domain KPIs
4. Business logic validation passes (no grade-on-own-work)
5. Builds without warnings

## Cross-harness compatibility
`AGENTS.md` is the single source of truth for every agent harness driving this repo. Per-tool bridges:
- Claude Code → `CLAUDE.md` (`@AGENTS.md` import) + `.claude/rules/`
- Codex CLI → reads this file natively (keep it lean)
- Cline → `.clinerules/00-source-of-truth.md`; no parallel Memory Bank
- Antigravity CLI → `GEMINI.md` thin bridge, speculative until its discovery mechanism is documented
Durable rules go here (portable) — never into a tool-specific file.

