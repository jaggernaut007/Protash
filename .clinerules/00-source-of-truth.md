# Source of truth — do not fork context

This repo is driven by multiple agent harnesses (Claude Code, Codex, Cline, Antigravity).
`AGENTS.md` at the repo root is the single source of truth for every tool.

- **Do not generate a Memory Bank.** The project context already exists as versioned artifacts —
  treat these as your Memory Bank:
  - `AGENTS.md` — stack, commands, Definition of Done, code standards. Authoritative; read first.
  - `README.md` — project orientation.
  - `docs/` — design/feature specs (`customer-journey.md`, `data-flow.md`,
    `message-bus-and-events.md`, `mood-asset-generation.md`, `saved-moodboards.md`,
    `day-night-toggle.md`, `refine-mood-asset.md`) — read the relevant spec before touching
    the feature it describes.
- Same mistake made twice → add a one-line rule to `AGENTS.md` (portable), not to a
  tool-specific file.
- Output dense, direct text. Omit pleasantries.
