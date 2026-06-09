# Agent System

## Overview

The agent system provides autonomous knowledge graph operations: gap detection, consolidation, learning path planning, and auditing. Agents operate on the entity store and search index without requiring LLM calls (rule-based logic).

## Architecture

```
┌─────────────────────────────────────────────────┐
│  CLI Commands                                    │
│  nexus gaps | nexus audit | nexus memory         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Agents                                          │
│  GapDetector | Consolidator | PathPlanner        │
│  KnowledgeAuditor                                │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Knowledge Layer                                 │
│  EntityStore | UnifiedSearch | EntityResolver    │
│  KnowledgeGraph | AgentMemory                    │
└─────────────────────────────────────────────────┘
```

## Agents

### GapDetector

Compares skills in the knowledge graph against job market demand.

**How it works:**
1. Loads all `skill` entities from the entity store
2. Deduplicates using the canonical resolver
3. For each skill, searches job listings via BM25
4. Normalizes demand count to a 0-10 scale
5. Reports skills where demand exceeds current level

**CLI:** `nexus gaps`

```typescript
import { GapDetector } from "./agents/gap-detector.js";

const detector = new GapDetector(store, search, resolver);
const { gaps, result } = await detector.detect();

for (const gap of gaps) {
  console.log(`${gap.skill}: current=${gap.currentLevel}, demand=${gap.demandLevel}, gap=${gap.gap}`);
}
```

**Output format:**
```typescript
interface SkillGap {
  skill: string;        // Canonical skill name
  currentLevel: number; // Current proficiency (0-10)
  demandLevel: number;  // Market demand (0-10)
  gap: number;          // demandLevel - currentLevel
  sources: string[];    // Where the skill was found
}
```

### Consolidator

Merges duplicate entities in the knowledge graph.

**How it works:**
1. Groups entities by canonical name (via resolver)
2. For each group, picks the entity with the most sources as primary
3. Merges properties from duplicates into primary
4. Re-writes relations to point to primary
5. Deletes duplicate entities

**CLI:** `nexus audit` (consolidation is part of the audit workflow)

```typescript
import { Consolidator } from "./agents/consolidator.js";

const consolidator = new Consolidator(store, resolver);
const result = await consolidator.consolidate();
// result.merged — number of duplicates merged
// result.kept — number of unique entities kept
```

### PathPlanner

Generates learning paths between current skills and target goals.

**How it works:**
1. Takes a target skill/role and current skill set
2. Searches the knowledge graph for prerequisite relationships
3. Builds a directed graph of skill dependencies
4. Finds shortest path from current skills to target
5. Returns ordered learning steps with estimated time

**CLI:** `nexus gaps` (includes path suggestions)

```typescript
import { PathPlanner } from "./agents/path-planner.js";

const planner = new PathPlanner(store, search);
const path = await planner.plan("Machine Learning", ["Python", "Statistics"]);

for (const step of path.steps) {
  console.log(`${step.skill} — ${step.reason} (${step.estimatedHours}h)`);
}
```

**Output format:**
```typescript
interface LearningPath {
  target: string;
  steps: LearningStep[];
  totalHours: number;
}

interface LearningStep {
  skill: string;
  reason: string;
  estimatedHours: number;
  prerequisites: string[];
  resources: string[];
}
```

### KnowledgeAuditor

Finds health issues in the knowledge graph.

**Checks:**
- **Orphans** — entities with no relations to other entities
- **Duplicates** — entities with the same canonical name
- **Stale facts** — facts with `valid_to` in the past
- **Missing properties** — entities missing expected fields for their type
- **Broken relations** — relations pointing to non-existent entities

**CLI:** `nexus audit`

```typescript
import { KnowledgeAuditor } from "./agents/auditor.js";

const auditor = new KnowledgeAuditor(store, search);
const audit = await auditor.audit();

console.log(`Orphans: ${audit.orphans.length}`);
console.log(`Duplicates: ${audit.duplicates.length}`);
console.log(`Stale facts: ${audit.staleFacts.length}`);
```

**Output format:**
```typescript
interface AuditResult {
  orphans: AuditFinding[];
  duplicates: AuditFinding[];
  staleFacts: AuditFinding[];
  missingProperties: AuditFinding[];
  brokenRelations: AuditFinding[];
  summary: {
    totalEntities: number;
    totalRelations: number;
    totalFacts: number;
    healthScore: number; // 0-100
  };
}

interface AuditFinding {
  entity?: Entity;
  description: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}
```

## Memory System

The `AgentMemory` class provides Cognee-style memory management for long-running agents.

### Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| **Remember** | `remember(content, context, importance, tags)` | Store new information |
| **Recall** | `recall(query, limit)` | Search memories by keyword |
| **Forget** | `forget(id)` | Delete a memory |
| **Improve** | `improve(id, updates)` | Update content, importance, or tags |
| **List** | `list(limit)` | Get all memories sorted by importance |
| **Decay** | `decay(factor)` | Reduce importance of old memories |

### Memory Schema

```typescript
interface Memory {
  id: string;           // "mem:{timestamp}:{random}"
  content: string;      // The memory content
  context: string;      // Where this memory came from
  importance: number;   // 0-1, higher = more important
  accessCount: number;  // Times recalled
  lastAccessed: string; // ISO timestamp
  createdAt: string;    // ISO timestamp
  tags: string[];       // Categorization tags
}
```

### CLI

```bash
# Store a memory
nexus memory -r "User prefers TypeScript over JavaScript"

# Search memories
nexus memory -q "language preference"

# List all memories
nexus memory -l
```

### Decay

Old, rarely-accessed memories gradually lose importance:

```typescript
// Reduces importance by 5% for memories not accessed in 7+ days
memory.decay(0.95);
```

This prevents the memory store from growing unboundedly while preserving frequently-used memories.

## Agent Result Type

All agents return a standardized result:

```typescript
interface AgentResult {
  agentName: string;    // e.g., "gap-detector"
  success: boolean;     // Whether the agent completed successfully
  steps: AgentStep[];   // Execution trace
  output: unknown;      // Agent-specific output
  durationMs: number;   // Execution time
}
```

## Extending the Agent System

See the [Developer Guide](developer-guide.md#adding-a-new-agent) for how to create custom agents.

### Best Practices

1. **Keep agents rule-based** — avoid LLM calls in agent logic for predictability
2. **Use the entity store** — agents should read/write through `EntityStore`, not directly to SQLite
3. **Return `AgentResult`** — standardized output for CLI and API consumption
4. **Handle missing data gracefully** — the knowledge graph may be empty or incomplete
5. **Log steps** — populate `AgentResult.steps` for debugging and audit trails
