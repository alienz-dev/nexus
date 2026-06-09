/** nexus ask — conversational Q&A over the knowledge base. */
import chalk from "../../lib/chalk.js";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { EntityResolver } from "../../knowledge/resolver.js";
import { UnifiedSearch } from "../../knowledge/search.js";
import { LanceVectorStore } from "../../knowledge/vectors.js";
import { AgentMemory } from "../../knowledge/memory.js";

export async function askCommand(question: string): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const resolver = new EntityResolver(db);
  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
  const memory = new AgentMemory(db);

  console.log(chalk.bold(`\nNexus: "${question}"\n`));
  console.log(chalk.gray("─".repeat(50)));

  // 1. Search for relevant content
  const results = await search.search({ query: question, limit: 5 });

  if (results.length === 0) {
    console.log(chalk.yellow("No relevant content found in your knowledge base."));
    console.log(chalk.dim("Try running `nexus ingest` to add more content."));
    closeDb(db);
    return;
  }

  // 2. Get related entities
  const entities = store.findByType("skill");
  const questionLower = question.toLowerCase();
  const relatedEntities = entities.filter((e) =>
    questionLower.includes(e.name.toLowerCase()) || e.name.toLowerCase().split(" ").some((w) => questionLower.includes(w))
  );

  // 3. Get relevant memories
  const memories = memory.recall(question, 3);

  // 4. Build context for answer
  console.log(chalk.bold("📚 Relevant content:"));
  for (const r of results) {
    const preview = r.item.content.slice(0, 150).replace(/\n/g, " ");
    console.log(`  ${chalk.green(r.item.id.split(":")[0])} [${r.source}] ${preview}...`);
  }

  if (relatedEntities.length > 0) {
    console.log(chalk.bold("\n🏷️  Related entities:"));
    for (const e of relatedEntities.slice(0, 5)) {
      console.log(`  ${chalk.cyan(e.name)} [${e.type}]`);
    }
  }

  if (memories.length > 0) {
    console.log(chalk.bold("\n🧠 Memories:"));
    for (const m of memories) {
      console.log(`  ${chalk.dim(m.content.slice(0, 100))}`);
    }
  }

  // 5. Generate a simple synthesis
  console.log(chalk.bold("\n💡 Synthesis:"));
  const sources = [...new Set(results.map((r) => r.item.id.split(":")[0]))];
  console.log(`  Found ${results.length} relevant items from ${sources.join(", ")}.`);
  if (relatedEntities.length > 0) {
    console.log(`  Related skills: ${relatedEntities.map((e) => e.name).join(", ")}.`);
  }
  console.log(chalk.dim("\n  (Full LLM-powered synthesis requires configuring an API key in nexus.yaml)"));

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
