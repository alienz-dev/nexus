/**
 * nexus project — manage project context in the knowledge graph.
 *
 * Commands:
 *   nexus project list                    — list all registered projects
 *   nexus project show <name>             — show project details and capabilities
 *   nexus project add <name> --path <p>   — register a project
 *   nexus project capabilities <name>     — list project capabilities
 */

import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { ProjectContextAnalyzer } from "../../ingest/project-context-analyzer.js";
import { ProjectContextBridge } from "../../ingest/project-context-bridge.js";
import type { ProjectContextConfig } from "../../ingest/project-context-bridge.js";

export interface ProjectCommandOptions {
  action: "list" | "show" | "add" | "capabilities" | "ingest";
  name?: string;
  path?: string;
  description?: string;
  techStack?: string;
  adoptedPatterns?: string;
  enhancementAreas?: string;
  maturity?: string;
}

export async function projectCommand(options: ProjectCommandOptions): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const analyzer = new ProjectContextAnalyzer(store, {
    debug: () => {},
    info: (msg: string) => console.log(chalk.blue("[INFO]"), msg),
    warn: (msg: string) => console.log(chalk.yellow("[WARN]"), msg),
    error: (msg: string) => console.error(chalk.red("[ERROR]"), msg),
  });

  try {
    switch (options.action) {
      case "list":
        await listProjects(analyzer);
        break;
      case "show":
        if (!options.name) {
          console.error(chalk.red("Error: --name is required for 'show'"));
          process.exit(1);
        }
        await showProject(analyzer, options.name);
        break;
      case "add":
        if (!options.name || !options.path) {
          console.error(chalk.red("Error: --name and --path are required for 'add'"));
          process.exit(1);
        }
        await addProject(analyzer, options);
        break;
      case "capabilities":
        if (!options.name) {
          console.error(chalk.red("Error: --name is required for 'capabilities'"));
          process.exit(1);
        }
        await listCapabilities(analyzer, options.name);
        break;
      case "ingest":
        if (!options.name || !options.path) {
          console.error(chalk.red("Error: --name and --path are required for 'ingest'"));
          process.exit(1);
        }
        await ingestProject(analyzer, options);
        break;
    }
  } finally {
    closeDb(db);
  }
}

async function listProjects(analyzer: ProjectContextAnalyzer): Promise<void> {
  const projects = analyzer.getAllProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow("No projects registered."));
    console.log(chalk.dim("Use: nexus project add <name> --path <path>"));
    return;
  }

  console.log(chalk.bold("Registered Projects:"));
  console.log("");

  for (const project of projects) {
    const props = project.properties as Record<string, unknown>;
    const maturity = props.maturity as string ?? "unknown";
    const description = props.description as string ?? "";

    console.log(`  ${chalk.bold(project.name)} (${chalk.dim(maturity)})`);
    if (description) {
      console.log(`    ${chalk.dim(description)}`);
    }
    console.log(`    Path: ${chalk.dim(props.path as string ?? "unknown")}`);
    console.log("");
  }
}

async function showProject(analyzer: ProjectContextAnalyzer, name: string): Promise<void> {
  const project = analyzer.getProject(name);
  if (!project) {
    console.error(chalk.red(`Project not found: ${name}`));
    process.exit(1);
  }

  const props = project.properties as Record<string, unknown>;
  const capabilities = analyzer.getCapabilities(name);

  console.log(chalk.bold(`Project: ${name}`));
  console.log("");
  console.log(`  Path: ${chalk.dim(props.path as string ?? "unknown")}`);
  console.log(`  Description: ${chalk.dim(props.description as string ?? "none")}`);
  console.log(`  Maturity: ${chalk.dim(props.maturity as string ?? "unknown")}`);
  console.log("");

  const techStack = props.tech_stack as string[] ?? [];
  if (techStack.length > 0) {
    console.log(chalk.bold("  Tech Stack:"));
    for (const tech of techStack) {
      console.log(`    - ${tech}`);
    }
    console.log("");
  }

  const adoptedPatterns = props.adopted_patterns as string[] ?? [];
  if (adoptedPatterns.length > 0) {
    console.log(chalk.bold("  Adopted Patterns:"));
    for (const pattern of adoptedPatterns) {
      console.log(`    - ${pattern}`);
    }
    console.log("");
  }

  const enhancementAreas = props.enhancement_areas as string[] ?? [];
  if (enhancementAreas.length > 0) {
    console.log(chalk.bold("  Enhancement Areas:"));
    for (const area of enhancementAreas) {
      console.log(`    - ${area}`);
    }
    console.log("");
  }

  if (capabilities.length > 0) {
    console.log(chalk.bold("  Capabilities:"));
    for (const cap of capabilities) {
      console.log(`    - ${cap.name}`);
    }
    console.log("");
  }
}

async function addProject(analyzer: ProjectContextAnalyzer, options: ProjectCommandOptions): Promise<void> {
  const config: ProjectContextConfig = {
    name: options.name!,
    path: options.path!,
    description: options.description,
    techStack: options.techStack ? options.techStack.split(",").map(s => s.trim()) : undefined,
    adoptedPatterns: options.adoptedPatterns ? options.adoptedPatterns.split(",").map(s => s.trim()) : undefined,
    enhancementAreas: options.enhancementAreas ? options.enhancementAreas.split(",").map(s => s.trim()) : undefined,
    maturity: (options.maturity as "prototype" | "beta" | "production") ?? "prototype",
  };

  const analysis = analyzer.analyzeProject(config);

  console.log(chalk.green(`✓ Registered project: ${config.name}`));
  console.log(`  Path: ${config.path}`);
  console.log(`  Capabilities: ${analysis.capabilities.length}`);
  console.log(`  Tech Stack: ${analysis.techStack.join(", ") || "none"}`);
}

async function listCapabilities(analyzer: ProjectContextAnalyzer, name: string): Promise<void> {
  const project = analyzer.getProject(name);
  if (!project) {
    console.error(chalk.red(`Project not found: ${name}`));
    process.exit(1);
  }

  const capabilities = analyzer.getCapabilities(name);

  if (capabilities.length === 0) {
    console.log(chalk.yellow(`No capabilities found for: ${name}`));
    return;
  }

  console.log(chalk.bold(`Capabilities for ${name}:`));
  console.log("");

  for (const cap of capabilities) {
    const props = cap.properties as Record<string, unknown>;
    const level = props.level as number ?? 0;
    console.log(`  - ${cap.name} (level: ${level})`);
  }
}

async function ingestProject(analyzer: ProjectContextAnalyzer, options: ProjectCommandOptions): Promise<void> {
  const config: ProjectContextConfig = {
    name: options.name!,
    path: options.path!,
    description: options.description,
    techStack: options.techStack ? options.techStack.split(",").map(s => s.trim()) : undefined,
    adoptedPatterns: options.adoptedPatterns ? options.adoptedPatterns.split(",").map(s => s.trim()) : undefined,
    enhancementAreas: options.enhancementAreas ? options.enhancementAreas.split(",").map(s => s.trim()) : undefined,
    maturity: (options.maturity as "prototype" | "beta" | "production") ?? "prototype",
  };

  // Register project
  const analysis = analyzer.analyzeProject(config);

  // Ingest project context
  const bridge = new ProjectContextBridge(config, {
    debug: () => {},
    info: (msg: string) => console.log(chalk.blue("[INFO]"), msg),
    warn: (msg: string) => console.log(chalk.yellow("[WARN]"), msg),
    error: (msg: string) => console.error(chalk.red("[ERROR]"), msg),
  });

  const items = await bridge.fetch();

  console.log(chalk.green(`✓ Ingested project: ${config.name}`));
  console.log(`  Items: ${items.length}`);
  console.log(`  Capabilities: ${analysis.capabilities.length}`);
}
