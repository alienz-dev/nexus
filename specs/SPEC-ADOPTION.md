---
id: SPEC-ADOPTION
title: Project Context & Adoption Detection
status: draft
version: 1
created: 2026-06-09
---

## Problem

When ai-feeds collects a signal (paper, tool, discussion), there's no way to know:
1. Does the target project already have this?
2. Is it already tracked as an issue?
3. Is it worth adopting?

Current approaches (keyword grep, URL dedup) are brittle and miss semantic matches.

## Solution

Add project context storage and adoption evaluation to nexus.

### 1. Project Context Store

Store what each project has/does in nexus's knowledge graph.

**New entity type: `project`**
```typescript
{
  type: "project",
  name: "dev-kit",
  properties: {
    path: "~/projects/dev-kit",
    description: "AI-native development toolkit",
    tech_stack: ["TypeScript", "vitest", "Claude Code"],
    adopted_patterns: ["SDD", "multi-agent orchestration", "wave execution"],
    enhancement_areas: ["checkpoint/resume", "visual regression"],
    maturity: "production"  // prototype | beta | production
  }
}
```

**New relation type: `has_capability`**
```typescript
{
  sourceId: "project:dev-kit",
  targetId: "skill:multi-agent-orchestration",
  type: "has_capability",
  weight: 0.9  // confidence level
}
```

### 2. Adoption Check API

**New endpoint: `POST /api/evaluate-adoption`**

Request:
```json
{
  "signal": "multi-agent checkpointing",
  "project": "dev-kit",
  "context": {
    "source": "arxiv",
    "score": 9,
    "abstract": "We present a checkpoint/resume system for multi-agent pipelines..."
  }
}
```

Response:
```json
{
  "project": "dev-kit",
  "signal": "multi-agent checkpointing",
  "evaluation": {
    "already_adopted": false,
    "already_tracked": true,
    "relevance": 0.85,
    "recommendation": "adopt",
    "confidence": 0.9
  },
  "evidence": {
    "code_search": {
      "matches": 0,
      "files": []
    },
    "git_history": {
      "commits": 0,
      "recent": false
    },
    "issue_search": {
      "matches": 1,
      "issues": ["dev-kit#42"]
    },
    "knowledge_graph": {
      "related_skills": ["multi-agent orchestration"],
      "gap": 0.3
    }
  },
  "reasoning": "dev-kit has multi-agent orchestration but no checkpoint/resume. The signal addresses crash recovery, which is a known enhancement area. Issue #42 already tracks this.",
  "suggested_action": "skip (already tracked)"
}
```

### 3. LLM Evaluation Prompt

```
You are evaluating whether a signal is worth adopting for a project.

Project: {{project_name}}
Description: {{project_description}}
Tech Stack: {{tech_stack}}
Adopted Patterns: {{adopted_patterns}}
Enhancement Areas: {{enhancement_areas}}

Signal: {{signal_title}}
Source: {{signal_source}}
Score: {{signal_score}}/10
Abstract: {{signal_abstract}}

Evidence:
- Code search: {{code_matches}} matches in {{code_files}}
- Git history: {{git_commits}} commits, last: {{git_last_commit}}
- Issue search: {{issue_matches}} matches: {{issue_list}}
- Knowledge graph: related skills: {{related_skills}}, gap: {{skill_gap}}

Question: Is this worth adopting? Is it already adopted?

Respond with JSON:
{
  "already_adopted": boolean,
  "already_tracked": boolean,
  "relevance": 0-1,
  "recommendation": "adopt" | "skip" | "monitor",
  "confidence": 0-1,
  "reasoning": "...",
  "suggested_action": "..."
}
```

### 4. Project Context Ingestion

**New bridge: `ProjectContextBridge`**

Ingests project context from:
1. `CLAUDE.md` — project description, conventions
2. `package.json` — dependencies, scripts
3. `README.md` — features, architecture
4. `specs/` — implemented features
5. `issues/` — tracked enhancements
6. Git history — recent work

```typescript
class ProjectContextBridge implements BridgeAdapter {
  name = "project-context";

  async fetch(since?: string): Promise<FeedItem[]> {
    const items: FeedItem[] = [];

    // Read CLAUDE.md
    const claudeMd = readFile(join(this.projectPath, "CLAUDE.md"));
    items.push({
      id: `${this.projectName}:claude-md`,
      source: "project-context",
      title: `${this.projectName} — CLAUDE.md`,
      content: claudeMd,
      timestamp: new Date().toISOString(),
      tags: ["project-context"],
      entities: [],
      links: [],
    });

    // Read specs
    const specs = glob(`${this.projectPath}/specs/*.md`);
    for (const spec of specs) {
      items.push({
        id: `${this.projectName}:spec:${basename(spec)}`,
        source: "project-context",
        title: `${this.projectName} — ${basename(spec)}`,
        content: readFile(spec),
        timestamp: new Date().toISOString(),
        tags: ["spec", "project-context"],
        entities: [],
        links: [],
      });
    }

    return items;
  }
}
```

### 5. Adoption Detection Flow

```
Signal arrives (paper/tool/discussion)
    ↓
1. Extract keywords from signal
    ↓
2. Query nexus knowledge graph for project context
    ↓
3. Run evidence collection:
   a. Code search: grep target repo for keywords
   b. Git history: git log --grep for keywords
   c. Issue search: issue-cli FTS5 search
   d. Knowledge graph: find related entities
    ↓
4. LLM evaluation with evidence
    ↓
5. Generate recommendation:
   - "adopt" → create issue
   - "skip" → log reason
   - "monitor" → track but don't act
```

## Implementation Plan

### Phase 1: Project Context Store (nexus)
- Add `project` entity type to knowledge graph
- Add `ProjectContextBridge` for ingesting project metadata
- Add `has_capability` relation type

### Phase 2: Adoption Check API (nexus)
- Add `POST /api/evaluate-adoption` endpoint
- Implement evidence collection (code search, git history, issue search)
- Implement LLM evaluation with structured output

### Phase 3: ai-feeds Integration
- Add `enhancement_targets` config to ai-feeds
- Create `processors/adoption-evaluator.ts`
- Integrate with issue-cli for issue creation

### Phase 4: Feedback Loop
- Track which recommendations were adopted
- Use adoption data to improve future recommendations
- Update project context as enhancements are implemented

## Verification

1. Store dev-kit project context in nexus
2. Feed a signal about "multi-agent checkpointing"
3. Verify adoption check returns correct evidence
4. Verify LLM evaluation is accurate
5. Verify issue creation works

## Dependencies

- nexus knowledge graph (existing)
- nexus LLM client (existing)
- issue-cli (existing)
- ai-feeds pipeline (existing)
