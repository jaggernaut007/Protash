# Data Flow (High Level)

## Request → Intent Assessment
- User submits intent in IntentConsole (client) → POST /api/board with action `createIntent` and POST /api/board/search (context) → POST /api/intent (assessment).
- The board endpoint is action-based: `createIntent`, `updateIntent`, `deleteIntent`, and `resetBoard` are handled by `/api/board`.
- /api/intent (server) uses OpenAI to assess intent and returns guidance/uiType/confidence.

## Mood Asset Generation
- Client builds MoodAssetContext (intent, domain, guidance, boardContext, uiType, optional refinement) → POST /api/mood-asset.
- /api/mood-asset (server) calls OpenAI generateText, runs 4 review agents (prompt/ui/frontend/qa) in parallel, and only returns approved code if all pass; includes evaluations in the response.
- Client checks `approved`: on true it publishes codegen:complete (Canvas renders); on false it publishes codegen:error (no render). This keeps unapproved code out of the UI while still surfacing review feedback.

## Refinement Loop
- After first render, user adds refinement text → POST /api/mood-asset with `refinement` included → same review path → canvas updates if approved.

## Saving & Retrieval
- Save Mood: client POST /api/board/artifact (createArtifact type=moodAsset with componentCode, intentId, metadata). boardStore persists to .data/board.json and indexes via vectorIndex.
- Saved list: client GET /api/board, filters artifacts where type=moodAsset; Load sets CodeContext from artifact.content and fetches intent by intentId to restore currentIntent.

## Message Bus (client-side)
- Topics: codegen:complete, codegen:error.
- Producers: IntentConsole after mood-asset API success/failure.
- Consumers: IntentConsole listener → onMoodAssetGenerated callback → CodeContext setCode → Canvas rerenders.
