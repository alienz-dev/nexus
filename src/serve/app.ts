/** Hono app setup with all routes. */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { UnifiedSearch } from "../knowledge/search.js";
import type { ContentIndexer } from "../knowledge/indexer.js";
import type { EntityStore } from "../knowledge/store.js";
import type { GapDetector } from "../agents/gap-detector.js";
import type { BridgeAdapter } from "../ingest/types.js";
import { createSearchRoutes } from "./routes/search.js";
import { createGapRoutes } from "./routes/gaps.js";
import { createDigestRoutes } from "./routes/digest.js";
import { createStatusRoutes } from "./routes/status.js";

export interface AppContext {
  search: UnifiedSearch;
  indexer: ContentIndexer;
  store: EntityStore;
  detector: GapDetector;
  adapters: BridgeAdapter[];
}

/** Create and configure the Hono application. */
export function createApp(ctx: AppContext): Hono {
  const app = new Hono();

  // Middleware
  app.use("*", cors());
  app.use("*", logger());

  // Routes
  app.route("/api/search", createSearchRoutes(ctx.search));
  app.route("/api/gaps", createGapRoutes(ctx.detector));
  app.route("/api/digest", createDigestRoutes(ctx.indexer));
  app.route("/api/status", createStatusRoutes(ctx.indexer, ctx.adapters));

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}
