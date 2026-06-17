# Message Bus and Events

## Frontend
- MessageBus instance created in app/page.tsx and passed to IntentConsole.
- IntentConsole subscribes to `codegen:complete` and `codegen:error`; publishes `codegen:complete` after mood asset generation.
- Canvas reacts when CodeContext is updated by onMoodAssetGenerated callback.
- Refinement reuses same events; error path surfaces via codegen:error.

## Backend
- /api/mood-asset does not publish; it returns data. Frontend publishes events after API success to keep UI reactive.
- MessageBus is client-side in this version; topics: codegen:complete, codegen:error.
