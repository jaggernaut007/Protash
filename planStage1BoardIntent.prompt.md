## Plan: Stage-1 Board + Intent Layer

Add a single Board domain with private context, durable artifacts, and intent-scoped UIs, plus reoriented agents to reason over life data instead of just code.

### Steps
1. Define domain models and storage: Board, Intent, Decision, Constraint, Preference, Connector, Artifact; add a lightweight server store (e.g., in-memory or file-backed for now) with CRUD API routes under app/api/board.
2. Add RAG scaffold: vectorize board artifacts (decisions/constraints/preferences/intents) via a simple embedding + in-memory index; expose /api/board/search to retrieve context for prompts.
3. Rework agent pipeline: replace code-gen prompt with life-domain reasoning prompt; let agents ingest board context (RAG results + connector summaries) and output both guidance and optional transient UI specs; keep code-gen as a secondary tool to render UIs from specs.
4. Replace fixed sidebar flow: create an “Intent Console” that captures a user intent, fetches board context, triggers agent reasoning, and renders a transient task UI component in the canvas; tear down when done, leaving only stored artifacts.
5. Introduce connectors: add a mock connector registry (e.g., calendar, bank, wearable, docs) with local/sample data loaders and per-board enable/disable toggles; surface summaries to agents while keeping raw data private by default.
6. Persist artifacts: add UI to review/search decisions/constraints/preferences on the board; allow attaching artifacts to intents and saving outputs from ephemeral UIs back into the board store.

### Further Considerations
1. Data store choice: OK to start in-memory/file for dev, or prefer a lightweight hosted KV? Option A: in-memory; Option B: file; Option C: DB.
2. RAG scope: Use minimal embedding (e.g., JS cosine over stored text) or integrate an external embed API?
3. Agent outputs: Should agents emit UI spec JSON + advice, with code-gen optional, or keep pure textual guidance first?
