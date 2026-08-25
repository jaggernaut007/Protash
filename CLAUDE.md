@import AGENTS.md

## Claude-Specific Behaviours

### Subagent Routing
- Use the Explore subagent for read-only codebase search (5+ query steps)
- Use the Plan subagent before implementing 3+ file changes
- Handle simple single-file changes directly

### Context Management
- /clear between unrelated features or sessions
- Check PROGRESS.md at session start to orient
- Write summaries to PROGRESS.md when context feels crowded

### Hallucination Prevention
- Check docs/ for existing research before web search
- Pin library versions in all queries
- Verify all imports exist in package.json before adding

### Quality Gates
- Run build + test before committing
- Verify TypeScript compiles cleanly
