/** Client adapters for ai-feeds and job-hunter feedback integration. */
export { NexusScoringClient } from "./ai-feeds-client.js";
export type { ScoringSignals as AiFeedsScoringSignals, GapSkill, TrendingSkill } from "./ai-feeds-client.js";
export { NexusFitClient } from "./job-hunter-client.js";
export type { ScoringSignals as JobHunterScoringSignals } from "./job-hunter-client.js";
