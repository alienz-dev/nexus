/** Ingest layer — bridge adapters for connected sources. */
export type { BridgeAdapter, FeedItem } from "./types.js";
export { FeedItemSchema } from "./types.js";
export { register, get, list, listAvailable, clear } from "./registry.js";
export { VaultBridge } from "./vault-bridge.js";
export { RssBridge } from "./rss-bridge.js";
export { GithubStarsBridge } from "./github-stars-bridge.js";
export { RaindropBridge } from "./raindrop-bridge.js";
export { EmailHubBridge } from "./email-hub-bridge.js";
export { ProjectContextBridge } from "./project-context-bridge.js";
export { ProjectContextAnalyzer } from "./project-context-analyzer.js";
export type { ProjectContextConfig } from "./project-context-bridge.js";
export type { ProjectAnalysis } from "./project-context-analyzer.js";
export { AdoptionFeedback } from "./adoption-feedback.js";
export type { AdoptionFeedbackEntry } from "./adoption-feedback.js";
