/** Ingest layer — bridge adapters for connected sources. */
export type { BridgeAdapter, FeedItem } from "./types.js";
export { FeedItemSchema } from "./types.js";
export { register, get, list, listAvailable, clear } from "./registry.js";
export { VaultBridge } from "./vault-bridge.js";
export { RssBridge } from "./rss-bridge.js";
