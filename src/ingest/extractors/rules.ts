/** Rule-based entity extraction — uses known taxonomies and pattern matching.
 *  Handles ~70% of cases for free without LLM calls. */

export interface ExtractedEntity {
  name: string;
  type: "skill" | "company" | "role" | "technology" | "concept" | "person";
  confidence: number;
  source: "rules";
}

/** Common programming languages and frameworks. */
const TECH_SKILLS = new Set([
  "python", "javascript", "typescript", "rust", "go", "golang", "java", "c++", "c#",
  "ruby", "php", "swift", "kotlin", "scala", "haskell", "elixir", "clojure", "lua",
  "react", "vue", "angular", "svelte", "nextjs", "next.js", "nuxt", "remix",
  "nodejs", "node.js", "deno", "bun", "express", "fastapi", "django", "flask",
  "spring", "rails", "laravel", "actix", "axum", "gin", "fiber",
  "postgresql", "mysql", "sqlite", "mongodb", "redis", "elasticsearch", "dynamodb",
  "docker", "kubernetes", "terraform", "ansible", "aws", "azure", "gcp",
  "graphql", "rest", "grpc", "websocket", "kafka", "rabbitmq",
  "pytorch", "tensorflow", "jax", "scikit-learn", "pandas", "numpy",
  "langchain", "llamaindex", "openai", "anthropic", "huggingface",
  "git", "github", "gitlab", "ci/cd", "jenkins", "github actions",
  "linux", "bash", "vim", "neovim", "emacs", "vscode",
  "figma", "sketch", "tailwind", "css", "html", "sass",
]);

/** Common company names in tech. */
const KNOWN_COMPANIES = new Set([
  "google", "microsoft", "amazon", "apple", "meta", "facebook", "netflix", "tesla",
  "nvidia", "openai", "anthropic", "deepmind", "hugging face", "huggingface",
  "stripe", "shopify", "salesforce", "oracle", "ibm", "intel", "amd",
  "uber", "airbnb", "twitter", "x corp", "linkedin", "github", "gitlab",
  "atlassian", "confluence", "jira", "slack", "discord", "zoom",
  "databricks", "snowflake", "confluent", "elastic", "datadog",
  "cloudflare", "vercel", "netlify", "fly.io", "railway",
  "supabase", "firebase", "planetscale", "turso", "neon",
  "bytedance", "tiktok", "alibaba", "tencent", "baidu", "xiaomi",
  "samsung", "sony", "huawei", "oppo", "vivo",
]);

/** Common job roles. */
const KNOWN_ROLES = new Set([
  "software engineer", "software developer", "frontend developer", "backend developer",
  "full stack developer", "fullstack developer", "devops engineer", "sre",
  "data scientist", "data engineer", "data analyst", "machine learning engineer",
  "ml engineer", "ai engineer", "research scientist", "research engineer",
  "product manager", "project manager", "engineering manager", "tech lead",
  "architect", "solution architect", "system architect",
  "qa engineer", "test engineer", "security engineer", "platform engineer",
  "designer", "ux designer", "ui designer", "product designer",
  "technical writer", "developer advocate", "developer relations",
]);

/** Extract entities from text using rule-based matching. */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const lower = text.toLowerCase();

  // Extract skills
  for (const skill of TECH_SKILLS) {
    if (lower.includes(skill) && !seen.has(skill)) {
      seen.add(skill);
      entities.push({ name: skill, type: "skill", confidence: 0.9, source: "rules" });
    }
  }

  // Extract companies
  for (const company of KNOWN_COMPANIES) {
    if (lower.includes(company) && !seen.has(company)) {
      seen.add(company);
      entities.push({ name: company, type: "company", confidence: 0.85, source: "rules" });
    }
  }

  // Extract roles
  for (const role of KNOWN_ROLES) {
    if (lower.includes(role) && !seen.has(role)) {
      seen.add(role);
      entities.push({ name: role, type: "role", confidence: 0.8, source: "rules" });
    }
  }

  return entities;
}

/** Calculate overall confidence for rule-based extraction on this text. */
export function ruleConfidence(entities: ExtractedEntity[]): number {
  if (entities.length === 0) return 0;
  // More entities found = higher confidence that rules covered this text well
  return Math.min(0.9, entities.length * 0.15);
}
