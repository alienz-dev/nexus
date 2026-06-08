/** Bridge adapter for Raindrop.io — bookmarks and highlights as curated knowledge. */
import type { BridgeAdapter, FeedItem } from "./types.js";

interface RaindropItem {
  _id: number;
  title: string;
  excerpt?: string;
  note?: string;
  link: string;
  tags: string[];
  created: string;
  highlights?: Array<{ text: string; note?: string }>;
  collection?: { $id: number };
}

interface RaindropResponse {
  items: RaindropItem[];
  count: number;
}

export class RaindropBridge implements BridgeAdapter {
  readonly name = "raindrop";
  private token: string;

  constructor() {
    this.token = process.env.RAINDROP_TOKEN ?? "";
  }

  async isAvailable(): Promise<boolean> {
    return this.token.length > 0;
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    if (!this.token) return [];

    const items: FeedItem[] = [];
    let page = 0;
    const perPage = 50;

    while (true) {
      const url = `https://api.raindrop.io/rest/v1/raindrops/0?page=${page}&perpage=${perPage}&sort=-created`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Raindrop API error ${res.status}: ${body}`);
      }

      const data = (await res.json()) as RaindropResponse;
      if (!data.items || data.items.length === 0) break;

      for (const item of data.items) {
        // Filter by since if provided
        if (since) {
          const created = new Date(item.created).getTime();
          const sinceTime = new Date(since).getTime();
          if (created <= sinceTime) continue;
        }

        // Build content from note, excerpt, and highlights
        const contentParts: string[] = [];
        if (item.note) contentParts.push(item.note);
        if (item.excerpt) contentParts.push(item.excerpt);
        if (item.highlights?.length) {
          for (const h of item.highlights) {
            contentParts.push(`> ${h.text}`);
            if (h.note) contentParts.push(`  Note: ${h.note}`);
          }
        }

        items.push({
          id: `raindrop:${item._id}`,
          source: "raindrop",
          title: item.title,
          content: contentParts.join("\n\n").slice(0, 5000),
          url: item.link,
          timestamp: item.created,
          tags: item.tags ?? [],
          entities: [],
          links: [],
        });
      }

      // If we got fewer than perPage, we've reached the end
      if (data.items.length < perPage) break;
      page++;
    }

    return items;
  }

  async count(): Promise<number> {
    if (!this.token) return 0;

    const res = await fetch("https://api.raindrop.io/rest/v1/raindrops/0?perpage=1", {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) return 0;

    const data = (await res.json()) as RaindropResponse;
    return data.count ?? 0;
  }
}
