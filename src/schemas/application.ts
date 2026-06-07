/** Application supertag — tracks job application lifecycle. */
import type { SchemaDef } from "./types.js";

export const ApplicationSchema: SchemaDef = {
  name: "application",
  description: "A job application with status tracking, dates, and notes",
  fields: [
    { name: "company", type: "relation", required: true, description: "Related company entity" },
    { name: "role", type: "relation", required: true, description: "Related role entity" },
    { name: "status", type: "select", required: true, options: ["researching", "applied", "screening", "interviewing", "offer", "rejected", "withdrawn", "accepted"], description: "Application status" },
    { name: "applied_date", type: "date", description: "Date applied" },
    { name: "response_date", type: "date", description: "Date of first response" },
    { name: "notes", type: "text", description: "Application notes and observations" },
    { name: "source", type: "text", description: "Where the listing was found" },
  ],
  queries: [
    { name: "active_applications", description: "Currently active applications", query: "SELECT * FROM entities WHERE type = 'application' AND json_extract(properties, '$.status') NOT IN ('rejected', 'withdrawn', 'accepted')" },
    { name: "application_timeline", description: "Applications ordered by date", query: "SELECT * FROM entities WHERE type = 'application' ORDER BY json_extract(properties, '$.applied_date') DESC" },
  ],
  aiContext: "Applications track the full lifecycle from research to acceptance. Status transitions are logged as facts with timestamps.",
};
