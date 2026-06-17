# Customer Journey (Current Build)

1) Arrive on page
- Sees Intent Console (left) and empty Canvas with prompt to submit intent.
- Chooses a target segment (1–4) to place the generated mood asset.

2) Capture intent
- Enters intent + confirms the current target segment/domain → Submit.
- Behind the scenes: intent is created on the board, context artifacts are searched, connectors summarized, intent assessed via /api/intent.

3) Generate mood asset
- Assessment feeds /api/mood-asset → code is generated, reviewed by coding agents, and if approved it renders on the Canvas.
- User can toggle Day/Night for presentation.

4) Refine
- With an asset present, user adds a refinement note → re-runs /api/mood-asset with refinement → updated asset renders if approved.

5) Save
- Click “Save Mood” to persist the current component as a moodAsset artifact linked to the current intent.

6) Retrieve
- Open “Saved Mood Boards” list → click Load to bring code back into the Canvas and restore the associated intent (title/domain context) if available.
- The loaded mood asset appears in the current active canvas segment; the app does not automatically switch segments.

7) Reset
- Use the “✨ New Board” button to reset the board state, clear current intents/artifacts, and start fresh.

7) Continue or repeat
- User can refine again, save another version, or start a new intent.
