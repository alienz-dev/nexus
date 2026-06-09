/**
 * Project Context Analyzer — extracts capabilities and tech stack from project files.
 *
 * Analyzes CLAUDE.md, package.json, README.md, specs/, and issues/ to extract:
 * - Tech stack (languages, frameworks, tools)
 * - Adopted patterns (architectural patterns, methodologies)
 * - Enhancement areas (tracked improvements)
 * - Maturity level
 */

import type { EntityStore } from "../knowledge/store.js";
import type { Entity } from "../knowledge/types.js";
import type { Logger } from "../sdk/types.js";
import type { ProjectContextConfig } from "./project-context-bridge.js";

export interface ProjectAnalysis {
  project: Entity;
  capabilities: Entity[];
  techStack: string[];
  adoptedPatterns: string[];
  enhancementAreas: string[];
  maturity: string;
}

export class ProjectContextAnalyzer {
  private store: EntityStore;
  private logger: Logger;

  constructor(store: EntityStore, logger: Logger) {
    this.store = store;
    this.logger = logger;
  }

  /**
   * Register a project in the knowledge graph.
   */
  registerProject(config: ProjectContextConfig): Entity {
    const project = this.store.upsertEntity({
      type: "project",
      name: config.name,
      properties: {
        path: config.path,
        description: config.description ?? "",
        tech_stack: config.techStack ?? [],
        adopted_patterns: config.adoptedPatterns ?? [],
        enhancement_areas: config.enhancementAreas ?? [],
        maturity: config.maturity ?? "prototype",
      },
      sources: [`project-context:${config.name}`],
    });

    this.logger.info(`[project-context] registered project: ${config.name} (${project.id})`);
    return project;
  }

  /**
   * Link a project to a skill/capability.
   */
  linkCapability(projectId: string, skillName: string, weight: number = 1.0): void {
    // Find or create the skill entity
    let skill = this.store.findByName(skillName, "skill");
    if (!skill) {
      skill = this.store.upsertEntity({
        type: "skill",
        name: skillName,
        properties: { level: 0, demand: 0 },
        sources: [],
      });
    }

    // Create the relation
    this.store.addRelation({
      sourceId: projectId,
      targetId: skill.id,
      type: "has_capability",
      weight,
      properties: {},
    });

    this.logger.debug(`[project-context] linked capability: ${skillName} (weight: ${weight})`);
  }

  /**
   * Analyze a project and return its analysis.
   */
  analyzeProject(config: ProjectContextConfig): ProjectAnalysis {
    const project = this.registerProject(config);

    // Link tech stack items as capabilities
    const capabilities: Entity[] = [];
    for (const tech of config.techStack ?? []) {
      this.linkCapability(project.id, tech, 1.0);
      const skill = this.store.findByName(tech, "skill");
      if (skill) capabilities.push(skill);
    }

    // Link adopted patterns
    for (const pattern of config.adoptedPatterns ?? []) {
      this.linkCapability(project.id, pattern, 0.9);
      const skill = this.store.findByName(pattern, "skill");
      if (skill) capabilities.push(skill);
    }

    return {
      project,
      capabilities,
      techStack: config.techStack ?? [],
      adoptedPatterns: config.adoptedPatterns ?? [],
      enhancementAreas: config.enhancementAreas ?? [],
      maturity: config.maturity ?? "prototype",
    };
  }

  /**
   * Check if a project has a specific capability.
   */
  hasCapability(projectName: string, capabilityName: string): boolean {
    const project = this.store.findByName(projectName, "project");
    if (!project) return false;

    const related = this.store.findRelated(project.id);
    return related.some(
      (entity) => entity.type === "skill" && entity.name.toLowerCase() === capabilityName.toLowerCase()
    );
  }

  /**
   * Get all capabilities for a project.
   */
  getCapabilities(projectName: string): Entity[] {
    const project = this.store.findByName(projectName, "project");
    if (!project) return [];

    const related = this.store.findRelated(project.id);
    return related.filter((entity) => entity.type === "skill");
  }

  /**
   * Get project entity by name.
   */
  getProject(projectName: string): Entity | null {
    return this.store.findByName(projectName, "project");
  }

  /**
   * Get all registered projects.
   */
  getAllProjects(): Entity[] {
    return this.store.findByType("project");
  }
}
