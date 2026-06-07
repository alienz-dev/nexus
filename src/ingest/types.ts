/** Common types for content ingestion across all bridge adapters. */
import { z } from "zod";

/** Schema for a normalized feed item from any source. */
export const FeedItemSchema = z.object({
  id: z.string().describe("Unique identifier within the source"),
  source: z.string().describe("Source name (ai-feeds, job-hunter, vault, etc.)"),
  title: z.string(),
  content: z.string(),
  url: z.string().url().optional(),
  timestamp: z.string().datetime().describe("ISO 8601 timestamp"),
  score: z.number().optional().describe("Relevance/importance score 0-1"),
  tags: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]).describe("Extracted entity names"),
});

export type FeedItem = z.infer<typeof FeedItemSchema>;

/** Interface that all bridge adapters must implement. */
export interface BridgeAdapter {
  /** Human-readable source name. */
  readonly name: string;
  /** Check if the source is available (DB exists, directory accessible, etc.). */
  isAvailable(): Promise<boolean>;
  /** Fetch items since the given timestamp, or all if not provided. */
  fetch(since?: string): Promise<FeedItem[]>;
  /** Return the count of available items. */
  count(): Promise<number>;
}
