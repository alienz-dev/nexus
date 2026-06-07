/** Schema registry — Tana-style supertag type definitions. */
export type { SchemaDef, FieldDef, SavedQuery } from "./types.js";
export { SchemaDefSchema, FieldDefSchema, SavedQuerySchema } from "./types.js";
export { SkillSchema } from "./skill.js";
export { CompanySchema } from "./company.js";
export { RoleSchema } from "./role.js";
export { ApplicationSchema } from "./application.js";
export { LearningResourceSchema } from "./learning-resource.js";

import { SkillSchema } from "./skill.js";
import { CompanySchema } from "./company.js";
import { RoleSchema } from "./role.js";
import { ApplicationSchema } from "./application.js";
import { LearningResourceSchema } from "./learning-resource.js";
import type { SchemaDef } from "./types.js";

/** All registered schemas. */
export const schemas: SchemaDef[] = [
  SkillSchema,
  CompanySchema,
  RoleSchema,
  ApplicationSchema,
  LearningResourceSchema,
];

/** Get a schema by name. */
export function getSchema(name: string): SchemaDef | undefined {
  return schemas.find((s) => s.name === name);
}
