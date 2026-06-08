/** Stub tests for bridge adapters. */
import { describe, it, expect } from "vitest";
import { RssBridge } from "../../src/ingest/rss-bridge.js";
import { VaultBridge } from "../../src/ingest/vault-bridge.js";
import { GithubStarsBridge } from "../../src/ingest/github-stars-bridge.js";
import * as registry from "../../src/ingest/registry.js";

describe("bridge adapter registry", () => {
  it("registers and retrieves adapters", () => {
    registry.clear();
    const bridge = new RssBridge("test-rss", []);
    registry.register(bridge);
    expect(registry.get("test-rss")).toBe(bridge);
  });

  it("lists all registered adapters", () => {
    registry.clear();
    registry.register(new RssBridge("a", []));
    registry.register(new RssBridge("b", []));
    expect(registry.list()).toHaveLength(2);
  });

  it("clears all adapters", () => {
    registry.clear();
    registry.register(new RssBridge("c", []));
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});

describe("RssBridge", () => {
  it("reports unavailable when no feeds configured", async () => {
    const bridge = new RssBridge("empty", []);
    expect(await bridge.isAvailable()).toBe(false);
  });

  it("reports available when feeds configured", async () => {
    const bridge = new RssBridge("test", ["https://example.com/feed"]);
    expect(await bridge.isAvailable()).toBe(true);
  });

  it("returns feed count", async () => {
    const bridge = new RssBridge("test", ["https://a.com", "https://b.com"]);
    expect(await bridge.count()).toBe(2);
  });
});

describe("VaultBridge", () => {
  it("reports unavailable for nonexistent directory", async () => {
    const bridge = new VaultBridge("/nonexistent/path");
    expect(await bridge.isAvailable()).toBe(false);
  });
});

describe("GithubStarsBridge", () => {
  it("reports unavailable when GITHUB_TOKEN is not set", async () => {
    const orig = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    const bridge = new GithubStarsBridge();
    expect(await bridge.isAvailable()).toBe(false);
    if (orig) process.env.GITHUB_TOKEN = orig;
  });

  it("reports available when GITHUB_TOKEN is set", async () => {
    const orig = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_test123";
    const bridge = new GithubStarsBridge();
    expect(await bridge.isAvailable()).toBe(true);
    if (orig) process.env.GITHUB_TOKEN = orig;
    else delete process.env.GITHUB_TOKEN;
  });
});
