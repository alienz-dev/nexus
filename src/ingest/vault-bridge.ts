/** Bridge adapter for the Obsidian vault — reads markdown files with YAML frontmatter. */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import matter from "gray-matter";
import type { BridgeAdapter, FeedItem } from "./types.js";

export class VaultBridge implements BridgeAdapter {
  readonly name = "vault";
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const s = await stat(this.vaultPath);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    const files = await this.walkDir(this.vaultPath, since);
    const items: FeedItem[] = [];

    for (const filePath of files) {
      try {
        const raw = await readFile(filePath, "utf-8");
        const { data, content } = matter(raw);
        const relPath = relative(this.vaultPath, filePath);
        const title = data.title ?? data.aliases?.[0] ?? relPath.replace(/\.md$/, "");
        const tags: string[] = Array.isArray(data.tags) ? data.tags : [];

        // Normalize timestamp — gray-matter parses YAML dates as Date objects
        const rawTimestamp = data["last-updated"] ?? data.date ?? null;
        const timestamp = rawTimestamp instanceof Date
          ? rawTimestamp.toISOString()
          : typeof rawTimestamp === "string"
            ? rawTimestamp
            : new Date().toISOString();

        // Extract wikilinks: [[Note]], [[Note|alias]], [[Note#heading]], [[Note^block]]
        const wikilinks = this.extractWikilinks(content);

        items.push({
          id: relPath,
          source: "vault",
          title,
          content: content.slice(0, 5000),
          url: undefined,
          timestamp,
          score: undefined,
          tags,
          entities: [],
          links: wikilinks,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return items;
  }

  async count(): Promise<number> {
    const files = await this.walkDir(this.vaultPath);
    return files.length;
  }

  /** Extract wikilinks from markdown content. */
  private extractWikilinks(content: string): string[] {
    const links: string[] = [];
    const regex = /!?\[\[([^\]]+?)\]\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const raw = match[1];
      // Normalize: [[Note|alias]] → Note, [[Note#heading]] → Note, [[Note^block]] → Note
      const target = raw.split("|")[0].split("#")[0].split("^")[0].trim();
      if (target && !links.includes(target)) {
        links.push(target);
      }
    }
    return links;
  }

  /** Recursively walk directory for .md files, optionally filtered by mtime. */
  private async walkDir(dir: string, since?: string): Promise<string[]> {
    const results: string[] = [];
    const sinceTime = since ? new Date(since).getTime() : 0;

    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name.startsWith(".")) continue; // skip hidden
      if (entry.name === "node_modules") continue;

      if (entry.isDirectory()) {
        results.push(...(await this.walkDir(fullPath, since)));
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        if (since) {
          const s = await stat(fullPath);
          if (s.mtimeMs <= sinceTime) continue;
        }
        results.push(fullPath);
      }
    }
    return results;
  }
}
