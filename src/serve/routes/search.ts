/** Search API route — GET /api/search?q=... */
import { Hono } from "hono";
import type { UnifiedSearch } from "../../knowledge/search.js";

export function createSearchRoutes(search: UnifiedSearch): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const q = c.req.query("q");
    const limit = parseInt(c.req.query("limit") ?? "20", 10);

    if (!q) {
      return c.json({ error: "Missing query parameter 'q'" }, 400);
    }

    const results = await search.search({ query: q, limit });
    return c.json({ query: q, results, count: results.length });
  });

  return app;
}
