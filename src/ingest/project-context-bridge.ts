/**
 * Project Context Bridge — ingests project metadata into the knowledge graph.
 *
 * Reads project context from:
 * - CLAUDE.md (project description, conventions)
 * - package.json (dependencies, scripts)
 * - README.md (features, architecture)
 * - specs/ (implemented features)
 * - issues/ (tracked enhancements)
 * - Git history (recent work)
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import type { BridgeAdapter, FeedItem } from "./types.js";
import type { Logger } from "../sdk/types.js";

export interface ProjectContextConfig {
  name: string;
  path: string;
  description?: string;
  techStack?: string[];
  adoptedPatterns?: string[];
  enhancementAreas?: string[];
  maturity?: "prototype" | "beta" | "production";
}

export class ProjectContextBridge implements BridgeAdapter {
  readonly name: string;
  private config: ProjectContextConfig;
  private logger: Logger;

  constructor(config: ProjectContextConfig, logger: Logger) {
    this.name = `project-context:${config.name}`;
    this.config = config;
    this.logger = logger;
  }

  async isAvailable(): Promise<boolean> {
    return existsSync(this.config.path);
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    if (!await this.isAvailable()) {
      this.logger.warn(`Project path not found: ${this.config.path}`);
      return [];
    }

    const items: FeedItem[] = [];
    const now = new Date().toISOString();

    // 1. Read CLAUDE.md
    const claudeMd = this.safeReadFile(join(this.config.path, "CLAUDE.md"));
    if (claudeMd) {
      items.push({
        id: `${this.config.name}:claude-md`,
        source: "project-context",
        title: `${this.config.name} — CLAUDE.md`,
        content: claudeMd.slice(0, 5000),
        timestamp: now,
        tags: ["project-context", "conventions"],
        entities: [],
        links: [],
      });
    }

    // 2. Read README.md
    const readme = this.safeReadFile(join(this.config.path, "README.md"));
    if (readme) {
      items.push({
        id: `${this.config.name}:readme`,
        source: "project-context",
        title: `${this.config.name} — README.md`,
        content: readme.slice(0, 5000),
        timestamp: now,
        tags: ["project-context", "documentation"],
        entities: [],
        links: [],
      });
    }

    // 3. Read package.json
    const packageJson = this.safeReadFile(join(this.config.path, "package.json"));
    if (packageJson) {
      items.push({
        id: `${this.config.name}:package-json`,
        source: "project-context",
        title: `${this.config.name} — package.json`,
        content: packageJson.slice(0, 3000),
        timestamp: now,
        tags: ["project-context", "dependencies"],
        entities: [],
        links: [],
      });
    }

    // 4. Read specs/
    const specsDir = join(this.config.path, "specs");
    if (existsSync(specsDir)) {
      const specFiles = this.safeListFiles(specsDir, ".md");
      for (const file of specFiles) {
        const content = this.safeReadFile(join(specsDir, file));
        if (content) {
          items.push({
            id: `${this.config.name}:spec:${file.replace(".md", "")}`,
            source: "project-context",
            title: `${this.config.name} — spec: ${file}`,
            content: content.slice(0, 5000),
            timestamp: now,
            tags: ["project-context", "spec"],
            entities: [],
            links: [],
          });
        }
      }
    }

    // 5. Read issues/
    const issuesDir = join(this.config.path, "issues");
    if (existsSync(issuesDir)) {
      const issueFiles = this.safeListFiles(issuesDir, ".md");
      for (const file of issueFiles) {
        if (file === "TEMPLATE.md" || file === "BACKLOG.md") continue;
        const content = this.safeReadFile(join(issuesDir, file));
        if (content) {
          items.push({
            id: `${this.config.name}:issue:${file.replace(".md", "")}`,
            source: "project-context",
            title: `${this.config.name} — issue: ${file}`,
            content: content.slice(0, 3000),
            timestamp: now,
            tags: ["project-context", "issue"],
            entities: [],
            links: [],
          });
        }
      }
    }

    // 6. Get recent git commits
    const gitLog = this.getRecentGitLog(this.config.path, 20);
    if (gitLog) {
      items.push({
        id: `${this.config.name}:git-log`,
        source: "project-context",
        title: `${this.config.name} — recent git history`,
        content: gitLog,
        timestamp: now,
        tags: ["project-context", "git-history"],
        entities: [],
        links: [],
      });
    }

    // 7. Project metadata
    const metadata = this.buildProjectMetadata();
    items.push({
      id: `${this.config.name}:metadata`,
      source: "project-context",
      title: `${this.config.name} — project metadata`,
      content: metadata,
      timestamp: now,
      tags: ["project-context", "metadata"],
      entities: [],
      links: [],
    });

    this.logger.info(`[project-context] ingested ${items.length} items from ${this.config.name}`);
    return items;
  }

  async count(): Promise<number> {
    if (!await this.isAvailable()) return 0;
    let count = 0;
    if (existsSync(join(this.config.path, "CLAUDE.md"))) count++;
    if (existsSync(join(this.config.path, "README.md"))) count++;
    if (existsSync(join(this.config.path, "package.json"))) count++;
    const specsDir = join(this.config.path, "specs");
    if (existsSync(specsDir)) count += this.safeListFiles(specsDir, ".md").length;
    const issuesDir = join(this.config.path, "issues");
    if (existsSync(issuesDir)) count += this.safeListFiles(issuesDir, ".md").length;
    count++; // metadata
    count++; // git log
    return count;
  }

  private buildProjectMetadata(): string {
    const lines: string[] = [];
    lines.push(`# Project: ${this.config.name}`);
    lines.push(`Path: ${this.config.path}`);
    if (this.config.description) lines.push(`Description: ${this.config.description}`);
    if (this.config.techStack) lines.push(`Tech Stack: ${this.config.techStack.join(", ")}`);
    if (this.config.adoptedPatterns) lines.push(`Adopted Patterns: ${this.config.adoptedPatterns.join(", ")}`);
    if (this.config.enhancementAreas) lines.push(`Enhancement Areas: ${this.config.enhancementAreas.join(", ")}`);
    if (this.config.maturity) lines.push(`Maturity: ${this.config.maturity}`);
    return lines.join("\n");
  }

  private safeReadFile(path: string): string | null {
    try {
      if (!existsSync(path)) return null;
      return readFileSync(path, "utf-8");
    } catch {
      return null;
    }
  }

  private safeListFiles(dir: string, ext: string): string[] {
    try {
      return readdirSync(dir).filter(f => f.endsWith(ext) && statSync(join(dir, f)).isFile());
    } catch {
      return [];
    }
  }

  private getRecentGitLog(repoPath: string, count: number): string | null {
    try {
      const result = execSync(
        `git -C "${repoPath}" log --oneline -${count} --no-merges`,
        { encoding: "utf-8", timeout: 5000 }
      );
      return result.trim();
    } catch {
      return null;
    }
  }
}
