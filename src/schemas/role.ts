/** Role supertag — represents a job role with requirements and salary data. */
import type { SchemaDef } from "./types.js";

export const RoleSchema: SchemaDef = {
  name: "role",
  description: "A job role with required skills, level expectations, and salary range",
  fields: [
    { name: "title", type: "text", required: true, description: "Role title" },
    { name: "level", type: "select", required: true, options: ["intern", "junior", "mid", "senior", "staff", "principal", "lead", "manager"], description: "Seniority level" },
    { name: "skills_required", type: "multi_select", required: true, description: "Required skills" },
    { name: "salary_min", type: "number", description: "Minimum salary" },
    { name: "salary_max", type: "number", description: "Maximum salary" },
    { name: "salary_currency", type: "text", description: "Salary currency (USD, EUR, etc.)" },
    { name: "remote", type: "select", options: ["remote", "hybrid", "onsite"], description: "Work arrangement" },
  ],
  queries: [
    { name: "matching_roles", description: "Roles matching current skill set", query: "SELECT * FROM entities WHERE type = 'role'" },
  ],
  aiContext: "Roles are extracted from job listings. Skills required are cross-referenced with the skill schema for gap analysis.",
};
