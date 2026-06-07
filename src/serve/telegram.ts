/** Telegram digest — daily/weekly summary delivery via Telegram Bot API. */
import type { ContentIndexer } from "../knowledge/indexer.js";
import type { EntityStore } from "../knowledge/store.js";
import type { EntityResolver } from "../knowledge/resolver.js";
import type { UnifiedSearch } from "../knowledge/search.js";
import type { GapDetector } from "../agents/gap-detector.js";

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

/** Send a message via Telegram Bot API. */
async function sendMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Generate a daily digest message. */
export async function generateDailyDigest(
  indexer: ContentIndexer,
  store: EntityStore,
  resolver: EntityResolver,
  search: UnifiedSearch
): Promise<string> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const total = indexer.count();
  const entities = store.findByType("skill").length;
  const canonical = resolver.count();

  // Get recent search highlights
  const highlights = search.bm25Search("AI machine learning", 3);

  let msg = `📊 *Nexus Daily Digest*\n`;
  msg += `_${now.toISOString().split("T")[0]}_\n\n`;
  msg += `📈 *Stats*\n`;
  msg += `• Content indexed: ${total}\n`;
  msg += `• Entities: ${entities}\n`;
  msg += `• Canonical: ${canonical}\n\n`;

  if (highlights.length > 0) {
    msg += `🔍 *Highlights*\n`;
    for (const h of highlights) {
      const preview = h.item.content.slice(0, 80).replace(/\n/g, " ");
      msg += `• ${preview}...\n`;
    }
  }

  return msg;
}

/** Generate a weekly digest message with gap analysis. */
export async function generateWeeklyDigest(
  indexer: ContentIndexer,
  store: EntityStore,
  resolver: EntityResolver,
  detector: GapDetector
): Promise<string> {
  const total = indexer.count();
  const entities = store.findByType("skill").length;
  const { gaps, result } = await detector.detect();

  let msg = `📊 *Nexus Weekly Digest*\n`;
  msg += `_${new Date().toISOString().split("T")[0]}_\n\n`;
  msg += `📈 *Stats*\n`;
  msg += `• Content indexed: ${total}\n`;
  msg += `• Skill entities: ${entities}\n`;
  msg += `• Canonical entities: ${resolver.count()}\n\n`;

  if (gaps.length > 0) {
    msg += `⚠️ *Top Skill Gaps*\n`;
    for (const gap of gaps.slice(0, 5)) {
      msg += `• ${gap.skill}: gap ${gap.gap.toFixed(1)} (demand: ${gap.demandLevel.toFixed(1)})\n`;
    }
    msg += `\n`;
  } else {
    msg += `✅ No skill gaps detected\n\n`;
  }

  msg += `⏱ Generated in ${result.durationMs}ms`;

  return msg;
}

/** Send daily digest via Telegram. */
export async function sendDailyDigest(
  config: TelegramConfig,
  indexer: ContentIndexer,
  store: EntityStore,
  resolver: EntityResolver,
  search: UnifiedSearch
): Promise<boolean> {
  if (!config.enabled) return false;
  const msg = await generateDailyDigest(indexer, store, resolver, search);
  return sendMessage(config.botToken, config.chatId, msg);
}

/** Send weekly digest via Telegram. */
export async function sendWeeklyDigest(
  config: TelegramConfig,
  indexer: ContentIndexer,
  store: EntityStore,
  resolver: EntityResolver,
  detector: GapDetector
): Promise<boolean> {
  if (!config.enabled) return false;
  const msg = await generateWeeklyDigest(indexer, store, resolver, detector);
  return sendMessage(config.botToken, config.chatId, msg);
}
