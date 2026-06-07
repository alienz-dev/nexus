# Nexus PKMS — Workspace Rules

## Read/Write Permissions

### Read-Only (do not modify during sessions)
- .agents/knowledge/* — agent knowledge files
- .nexus/constitution.yml — FSM gate definitions
- nexus.yaml — configuration (unless explicitly asked)
- DECISIONS.md — architecture decision records

### Writable (can modify during implementation)
- src/** — source code
- tests/** — test files
- .nexus/issues/** — issue files (status updates)
- .nexus/specs/** — spec files
- .nexus/test-map.json — test mapping
- STATUS.md — project status

## Post-Run Checklist

After completing any implementation task:
1. Run `npm test` — all tests must pass
2. Run `npm run typecheck` — no type errors
3. Update STATUS.md if new features are working
4. Update issue status in .nexus/issues/ if applicable
5. Commit with descriptive message

## Conventions

- ESM imports (import/export, not require)
- Zod schemas for runtime validation
- JSDoc comments on all exported functions
- Match existing patterns from ai-feeds/job-hunter
- Use `node:` prefix for built-in modules
