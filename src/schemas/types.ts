/** Tana-style supertag schema definitions. */
import { z } from "zod";

/** A field definition within a schema. */
export interface FieldDef {
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "url" | "boolean" | "relation";
  required?: boolean;
  options?: string[];
  description?: string;
}

/** A saved query that can be run against the schema. */
export interface SavedQuery {
  name: string;
  description: string;
  query: string;
  parameters?: string[];
}

/** A complete schema definition (Tana-style supertag). */
export interface SchemaDef {
  name: string;
  description: string;
  fields: FieldDef[];
  queries?: SavedQuery[];
  aiContext?: string;
}

/** Zod schemas for runtime validation. */
export const FieldDefSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "number", "date", "select", "multi_select", "url", "boolean", "relation"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const SavedQuerySchema = z.object({
  name: z.string(),
  description: z.string(),
  query: z.string(),
  parameters: z.array(z.string()).optional(),
});

export const SchemaDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(FieldDefSchema),
  queries: z.array(SavedQuerySchema).optional(),
  aiContext: z.string().optional(),
});
