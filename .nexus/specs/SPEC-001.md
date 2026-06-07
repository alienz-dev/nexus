---
id: SPEC-001
title: "Foundation: Project Setup and Bridge Adapters"
status: accepted
date: 2026-06-07
linked_issues: [NEX-001, NEX-002, NEX-003, NEX-004, NEX-005, NEX-006, NEX-007, NEX-008, NEX-009]
---

# SPEC-001: Foundation — Project Setup and Bridge Adapters

## Overview

Set up the nexus project foundation: TypeScript project scaffold, shared utilities, bridge adapters for all connected sources, SQLite entity store, content indexer with differential updates, and basic BM25 search.

## Data Models

### FeedItem (Normalized content from any source)
```typescript
interface FeedItem {
  id: string;           // Unique within source
  source: string;       // Source name
  title: string;
  content: string;
  url?: string;
  timestamp: string;    // ISO 8601
  score?: number;       // 0-1 relevance
  tags: string[];
  entities: string[];   // Extracted entity names
}
```

### Entity (Knowledge graph node)
```typescript
interface Entity {
  id: string;
  type: string;         // skill, company, role, person, concept
  name: string;
  properties: Record<string, unknown>;
  sources: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Relation (Knowledge graph edge)
```typescript
interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;         // requires, belongs_to, mentions
  weight: number;
  properties: Record<string, unknown>;
  createdAt: string;
}
```

### Fact (Temporally-valid assertion)
```typescript
interface Fact {
  id: string;
  entityId: string;
  predicate: string;
  value: unknown;
  validFrom: string;
  validTo?: string;     // null = still valid
  source: string;
  confidence: number;   // 0-1
}
```

## API Contracts

### Bridge Adapter Interface
```typescript
interface BridgeAdapter {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  fetch(since?: string): Promise<FeedItem[]>;
  count(): Promise<number>;
}
```

### Search Interface
```typescript
interface SearchResult {
  item: { id: string; type: string; content: string };
  score: number;
  source: "bm25" | "vector" | "graph";
}

// RRF merge: sum of 1/(k + rank) for each result set
```

## Implementation Order

1. Project scaffold (package.json, tsconfig, vitest, gitignore)
2. Shared utilities (db, config, logger, hash)
3. FeedItem types and bridge adapter interface
4. Individual bridge adapters (ai-feeds, job-hunter, email-hub, vault, RSS)
5. Entity store (SQLite)
6. Content indexer (MD5 differential)
7. BM25 search
8. CLI skeleton

## Testing Strategy

- Unit tests for hash utility (MD5)
- Integration tests for bridge adapters (with mock data)
- Integration tests for search (with seeded content_index)
- All tests run with `npm test` (vitest, threads pool)
