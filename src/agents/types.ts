/** Agent orchestration types for Mastra-based agents. */
import { z } from "zod";

/** Configuration for an agent. */
export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string().optional(),
  systemPrompt: z.string(),
  tools: z.array(z.string()).default([]),
  maxSteps: z.number().default(10),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/** A single step in an agent workflow. */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/** Result from an agent execution. */
export const AgentResultSchema = z.object({
  agentName: z.string(),
  success: z.boolean(),
  steps: z.array(WorkflowStepSchema),
  output: z.unknown(),
  error: z.string().optional(),
  durationMs: z.number(),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;
