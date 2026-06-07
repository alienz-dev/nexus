/** Skill supertag — represents a technical or soft skill with proficiency tracking. */
import type { SchemaDef } from "./types.js";

export const SkillSchema: SchemaDef = {
  name: "skill",
  description: "A technical or soft skill with proficiency level and market demand tracking",
  fields: [
    { name: "name", type: "text", required: true, description: "Skill name" },
    { name: "category", type: "select", required: true, options: ["language", "framework", "tool", "concept", "soft_skill", "domain"], description: "Skill category" },
    { name: "level", type: "number", required: true, description: "Proficiency level 0-10" },
    { name: "demand", type: "number", description: "Market demand score 0-10" },
    { name: "sources", type: "multi_select", description: "Where this skill was observed" },
    { name: "last_used", type: "date", description: "Last time this skill was actively used" },
    { name: "evidence", type: "text", description: "Evidence supporting the skill level assessment" },
  ],
  queries: [
    { name: "top_skills", description: "Highest proficiency skills", query: "SELECT * FROM entities WHERE type = 'skill' ORDER BY json_extract(properties, '$.level') DESC LIMIT ?", parameters: ["limit"] },
    { name: "skill_gaps", description: "Skills with high demand but low proficiency", query: "SELECT * FROM entities WHERE type = 'skill' AND json_extract(properties, '$.demand') > json_extract(properties, '$.level') ORDER BY (json_extract(properties, '$.demand') - json_extract(properties, '$.level')) DESC" },
  ],
  aiContext: "Skills are extracted from job listings, project work, and learning activities. Level is self-assessed or inferred from usage frequency.",
};
