/** Gaps API route — GET /api/gaps */
import { Hono } from "hono";
import type { GapDetector } from "../../agents/gap-detector.js";

export function createGapRoutes(detector: GapDetector): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const { gaps, result } = await detector.detect();
    return c.json({ gaps, count: gaps.length, durationMs: result.durationMs });
  });

  return app;
}
