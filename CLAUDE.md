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

### Code search (Nexus MCP)
- The nexus tools are deferred. Run ToolSearch with `select:mcp__nexus__index,mcp__nexus__search,mcp__nexus__map,mcp__nexus__find_symbol,mcp__nexus__graph,mcp__nexus__explain`.
- At session start, call `index` with the absolute path of the working folder.
- To find files or code, call `search` or `find_symbol` before Grep or Glob. Read only the files that nexus names.
- Before you change a shared symbol, call `graph` with `transitive=true`.
- The current tools are `status`, `index`, `map`, `search`, `find_symbol`, `graph`, `explain`, `analyze`, `memory` and `health`.
