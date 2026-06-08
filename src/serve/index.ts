/** Server entry point — starts the Hono API server. */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "../lib/config.js";
import { initDb } from "../lib/db.js";
import { EntityStore } from "../knowledge/store.js";
import { EntityResolver } from "../knowledge/resolver.js";
import { ContentIndexer } from "../knowledge/indexer.js";
import { UnifiedSearch } from "../knowledge/search.js";
import { GapDetector } from "../agents/gap-detector.js";
import * as ingest from "../ingest/index.js";

async function main() {
  const config = loadConfig();
  const db = initDb(config.database.main);

  const store = new EntityStore(db);
  const resolver = new EntityResolver(db);
  const indexer = new ContentIndexer(db);
  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
  const detector = new GapDetector(store, search, resolver);

  // Register bridge adapters
  const adapters: ingest.BridgeAdapter[] = [];
  for (const [name, src] of Object.entries(config.sources ?? {})) {
    if (!src.enabled) continue;
    if (name === "vault") {
      const bridge = new ingest.VaultBridge(src.path.replace("~", process.env.HOME ?? ""));
      adapters.push(bridge);
      ingest.register(bridge);
    }
  }

  if (config.rss?.feeds?.length) {
    const rssBridge = new ingest.RssBridge("rss", config.rss.feeds);
    adapters.push(rssBridge);
    ingest.register(rssBridge);
  }

  const app = createApp({ search, indexer, store, detector, resolver, adapters });
  const port = config.server?.port ?? 3777;
  const host = config.server?.host ?? "localhost";

  serve({ fetch: app.fetch, port, hostname: host }, (info: { port: number }) => {
    console.log(`Nexus PKMS server running at http://${host}:${info.port}`);
  });
}

main().catch(console.error);
