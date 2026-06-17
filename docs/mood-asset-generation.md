# Mood Asset Generation

## Frontend
- Location: app/page.tsx, components/IntentConsole.tsx, components/Canvas.tsx
- Flow: user submits intent → intent console fetches board context + connectors → calls /api/intent → calls /api/mood-asset → publishes codegen:complete → Canvas renders via DynamicCanvasRenderer.
- State: CodeContext holds current generated code; messageBus broadcasts codegen events; loading/error handled in IntentConsole.
- Review gating: renders only when coding agents approve; errors surface via codegen:error.

## Backend
- Endpoint: /api/intent assesses intent and returns guidance/uiType.
- Endpoint: /api/mood-asset builds prompt with intent + guidance (+ optional refinement) and calls OpenAI via ai SDK.
- Code review: promptWriterAgent, uiUxAgent, frontendAgent, qaAgent run in parallel; returns approved flag + evaluations.
- Persistence: boardStore unchanged during generation; artifacts only saved when user hits Save Mood.
