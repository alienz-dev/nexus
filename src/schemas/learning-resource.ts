/** Learning resource supertag — tracks courses, tutorials, and learning materials. */
import type { SchemaDef } from "./types.js";

export const LearningResourceSchema: SchemaDef = {
  name: "learning-resource",
  description: "A learning resource with progress tracking and relevance scoring",
  fields: [
    { name: "title", type: "text", required: true, description: "Resource title" },
    { name: "type", type: "select", required: true, options: ["course", "tutorial", "book", "video", "article", "documentation", "project"], description: "Resource type" },
    { name: "url", type: "url", description: "Resource URL" },
    { name: "progress", type: "number", description: "Completion percentage 0-100" },
    { name: "relevance", type: "number", description: "Relevance to current goals 0-10" },
    { name: "skills", type: "multi_select", description: "Skills this resource teaches" },
    { name: "started_at", type: "date", description: "When started" },
    { name: "completed_at", type: "date", description: "When completed" },
  ],
  queries: [
    { name: "in_progress", description: "Resources currently being worked on", query: "SELECT * FROM entities WHERE type = 'learning-resource' AND json_extract(properties, '$.progress') > 0 AND json_extract(properties, '$.progress') < 100" },
    { name: "high_relevance", description: "Most relevant resources", query: "SELECT * FROM entities WHERE type = 'learning-resource' ORDER BY json_extract(properties, '$.relevance') DESC LIMIT ?", parameters: ["limit"] },
  ],
  aiContext: "Learning resources are suggested by the path-planner agent based on skill gaps. Progress is updated manually or via integration with learning platforms.",
};
