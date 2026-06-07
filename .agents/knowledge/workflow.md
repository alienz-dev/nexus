# Nexus PKMS — TDD Workflow Reference

## Issue Lifecycle (FSM)

```
open → specced → tests_written → red_verified → implementing → green → reviewing → closed
```

### 1. Open
- Issue created with description and acceptance criteria
- No code, no tests, no spec yet

### 2. Specced
- Technical spec written in .nexus/specs/
- Covers implementation approach, data models, API contracts

### 3. Tests Written
- Test file created with test cases covering acceptance criteria
- Tests are stubs (not yet implemented)

### 4. Red Verified
- Tests run and FAIL (red phase of TDD)
- Confirms tests are actually testing something

### 5. Implementing
- Code written to make tests pass
- One logical change at a time

### 6. Green
- All tests PASS
- Implementation matches spec

### 7. Reviewing
- Code review (self or peer)
- Check for edge cases, error handling, performance

### 8. Closed
- Issue complete, merged to main
- Documentation updated if needed

## Commands

```bash
# Run tests
npm test

# Type check
npm run typecheck

# CLI
npx nexus status
npx nexus search "query"
npx nexus ingest
npx nexus gaps
```
