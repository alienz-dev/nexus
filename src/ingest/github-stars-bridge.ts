/** Bridge adapter for GitHub starred repositories — skill signals from stars. */
import type { BridgeAdapter, FeedItem } from "./types.js";

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics: string[];
  starred_at?: string;
}

export class GithubStarsBridge implements BridgeAdapter {
  readonly name = "github-stars";
  private token: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN ?? "";
  }

  async isAvailable(): Promise<boolean> {
    return this.token.length > 0;
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    if (!this.token) return [];

    const items: FeedItem[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const url = new URL("https://api.github.com/user/starred");
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.star+json", // includes starred_at
        "X-GitHub-Api-Version": "2022-11-28",
      };

      const res = await fetch(url.toString(), { headers });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GitHub API error ${res.status}: ${body}`);
      }

      const repos = (await res.json()) as GitHubRepo[];
      if (repos.length === 0) break;

      for (const repo of repos) {
        // Filter by since if provided
        if (since && repo.starred_at) {
          const starredAt = new Date(repo.starred_at).getTime();
          const sinceTime = new Date(since).getTime();
          if (starredAt <= sinceTime) continue;
        }

        const content = [
          repo.description ?? "",
          repo.language ? `Language: ${repo.language}` : "",
          repo.topics?.length ? `Topics: ${repo.topics.join(", ")}` : "",
        ].filter(Boolean).join("\n");

        items.push({
          id: `github:${repo.full_name}`,
          source: "github-stars",
          title: repo.full_name,
          content,
          url: repo.html_url,
          timestamp: repo.starred_at ?? new Date().toISOString(),
          tags: repo.topics ?? [],
          entities: [],
          links: [],
        });
      }

      // If we got fewer than perPage, we've reached the end
      if (repos.length < perPage) break;
      page++;
    }

    return items;
  }

  async count(): Promise<number> {
    if (!this.token) return 0;

    // Use the Link header to get the last page number
    const res = await fetch("https://api.github.com/user/starred?per_page=1", {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.star+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) return 0;

    const link = res.headers.get("link") ?? "";
    const match = link.match(/page=(\d+)>; rel="last"/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
