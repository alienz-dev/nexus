/** Ingest layer — bridge adapters for all connected sources. */
export type { BridgeAdapter, FeedItem } from "./types.js";
export { FeedItemSchema } from "./types.js";
export { register, get, list, listAvailable, clear } from "./registry.js";
export { AiFeedsBridge } from "./ai-feeds-bridge.js";
export { JobHunterBridge } from "./job-hunter-bridge.js";
export { EmailHubBridge } from "./email-hub-bridge.js";
export { VaultBridge } from "./vault-bridge.js";
export { RssBridge } from "./rss-bridge.js";
