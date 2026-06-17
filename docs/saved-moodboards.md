# Saved Mood Boards

## Frontend
- Components: components/SaveMoodboard.tsx, components/SavedMoodboardList.tsx, app/page.tsx.
- Saving: SaveMoodboard posts createArtifact (type moodAsset) with componentCode to /api/board/artifact.
- Listing/loading: SavedMoodboardList fetches /api/board, filters moodAsset artifacts, shows list with refresh; Load sends artifact to handler.
- Restore: handleLoadSavedMoodboard sets code to artifact.content and fetches matching intent (intentId) to set currentIntent.
- Note: loading a saved mood board restores the component code but does not automatically switch the active canvas segment.

## Backend
- /api/board/artifact handles create/update/delete; mood assets are stored in boardStore and indexed in vectorIndex.
- /api/board returns board with intents + artifacts; client filters moodAsset type.
- Persistence: board data stored in .data/board.json via boardStore.
