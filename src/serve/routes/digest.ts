/** Digest API route — GET /api/digest?period=daily|weekly */
import { Hono } from "hono";
import type { ContentIndexer } from "../../knowledge/indexer.js";

export function createDigestRoutes(indexer: ContentIndexer): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const period = c.req.query("period") ?? "daily";
    const now = new Date();
    let since: Date;

    if (period === "weekly") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const total = indexer.count();
    // Placeholder: would filter by timestamp in production
    return c.json({
      period,
      since: since.toISOString(),
      totalIndexed: total,
      message: `Digest for ${period} period (placeholder — full implementation pending)`,
    });
  });

  return app;
}
