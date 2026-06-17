# Refine Mood Asset

## Frontend
- Location: components/IntentConsole.tsx (refinement textarea + button).
- Prerequisite: a mood asset must have been generated; lastMoodContext is stored.
- Action: user enters refinement text → handleRefine builds refinedContext (guidance + refinement) → calls /api/mood-asset with refinement → publishes codegen:complete or codegen:error.
- UX: shows loading state; clears refinement on success.

## Backend
- Endpoint: /api/mood-asset now accepts `refinement` (string) and injects it into the generation prompt.
- Same code-review agents run; approved flag controls whether frontend renders or shows error.
