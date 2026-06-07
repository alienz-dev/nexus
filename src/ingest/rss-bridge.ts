/** Generic RSS/Atom feed reader — for direct feeds and RSSHub endpoints. */
import type { BridgeAdapter, FeedItem } from "./types.js";

export class RssBridge implements BridgeAdapter {
  readonly name: string;
  private feeds: string[];

  constructor(name: string, feeds: string[]) {
    this.name = name;
    this.feeds = feeds;
  }

  async isAvailable(): Promise<boolean> {
    return this.feeds.length > 0;
  }

  async fetch(_since?: string): Promise<FeedItem[]> {
    const items: FeedItem[] = [];

    for (const feedUrl of this.feeds) {
      try {
        const response = await fetch(feedUrl, {
          headers: { "User-Agent": "nexus-pkms/0.1.0" },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) continue;

        const text = await response.text();
        const parsed = this.parseFeed(text, feedUrl);
        items.push(...parsed);
      } catch {
        // Skip unreachable feeds
      }
    }

    return items;
  }

  async count(): Promise<number> {
    return this.feeds.length;
  }

  /** Basic XML-based RSS/Atom parser (no external dependency). */
  private parseFeed(xml: string, feedUrl: string): FeedItem[] {
    const items: FeedItem[] = [];
    const isAtom = xml.includes("<feed") && xml.includes("<entry");

    if (isAtom) {
      const entries = xml.split("<entry>").slice(1);
      for (const entry of entries) {
        const title = this.extractTag(entry, "title") ?? "";
        const link = this.extractAttr(entry, "link", "href") ?? this.extractTag(entry, "link") ?? "";
        const content = this.extractTag(entry, "content") ?? this.extractTag(entry, "summary") ?? "";
        const updated = this.extractTag(entry, "updated") ?? this.extractTag(entry, "published") ?? new Date().toISOString();

        items.push({
          id: link || `${feedUrl}:${items.length}`,
          source: this.name,
          title,
          content: this.stripHtml(content),
          url: link || undefined,
          timestamp: updated,
          tags: [],
          entities: [],
        });
      }
    } else {
      const entries = xml.split("<item>").slice(1);
      for (const entry of entries) {
        const title = this.extractTag(entry, "title") ?? "";
        const link = this.extractTag(entry, "link") ?? "";
        const description = this.extractTag(entry, "description") ?? "";
        const pubDate = this.extractTag(entry, "pubDate") ?? new Date().toISOString();
        const categories = this.extractAllTags(entry, "category");

        items.push({
          id: link || `${feedUrl}:${items.length}`,
          source: this.name,
          title,
          content: this.stripHtml(description),
          url: link || undefined,
          timestamp: pubDate,
          tags: categories,
          entities: [],
        });
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? match[1].trim() : null;
  }

  private extractAttr(xml: string, tag: string, attr: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`));
    return match ? match[1].trim() : null;
  }

  private extractAllTags(xml: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
    const results: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      results.push(match[1].trim());
    }
    return results;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
  }
}
