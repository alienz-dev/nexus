/** Status API route — GET /api/status */
import { Hono } from "hono";
import type { ContentIndexer } from "../../knowledge/indexer.js";
import type { BridgeAdapter } from "../../ingest/types.js";

export function createStatusRoutes(indexer: ContentIndexer, adapters: BridgeAdapter[]): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const sources = await Promise.all(
      adapters.map(async (a) => ({
        name: a.name,
        available: await a.isAvailable(),
        count: await a.count(),
      }))
    );

    return c.json({
      version: "0.2.0",
      phase: "Foundation",
      indexed: indexer.count(),
      sources,
    });
  });

  return app;
}
