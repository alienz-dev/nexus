/** Company supertag — represents a company with industry, culture, and review data. */
import type { SchemaDef } from "./types.js";

export const CompanySchema: SchemaDef = {
  name: "company",
  description: "A company entity with industry context, reviews, and culture information",
  fields: [
    { name: "name", type: "text", required: true, description: "Company name" },
    { name: "industry", type: "select", options: ["tech", "finance", "healthcare", "education", "retail", "consulting", "other"], description: "Primary industry" },
    { name: "size", type: "select", options: ["startup", "small", "medium", "large", "enterprise"], description: "Company size" },
    { name: "reviews", type: "text", description: "Aggregated review notes" },
    { name: "culture", type: "text", description: "Culture description and observations" },
    { name: "website", type: "url", description: "Company website" },
    { name: "applied", type: "boolean", description: "Whether we've applied here" },
  ],
  queries: [
    { name: "applied_companies", description: "Companies we've applied to", query: "SELECT * FROM entities WHERE type = 'company' AND json_extract(properties, '$.applied') = 1" },
  ],
  aiContext: "Companies are primarily sourced from job listings and research. Culture notes come from reviews and interview experiences.",
};
