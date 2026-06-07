/** Stub tests for bridge adapters. */
import { describe, it, expect } from "vitest";
import { RssBridge } from "../../src/ingest/rss-bridge.js";
import { AiFeedsBridge } from "../../src/ingest/ai-feeds-bridge.js";
import { JobHunterBridge } from "../../src/ingest/job-hunter-bridge.js";
import { EmailHubBridge } from "../../src/ingest/email-hub-bridge.js";
import { VaultBridge } from "../../src/ingest/vault-bridge.js";
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

describe("AiFeedsBridge", () => {
  it("reports unavailable when DB missing", async () => {
    const bridge = new AiFeedsBridge("/nonexistent", "db.sqlite");
    expect(await bridge.isAvailable()).toBe(false);
  });
});

describe("JobHunterBridge", () => {
  it("reports unavailable when DB missing", async () => {
    const bridge = new JobHunterBridge("/nonexistent", "data.sqlite");
    expect(await bridge.isAvailable()).toBe(false);
  });
});

describe("EmailHubBridge", () => {
  it("reports unavailable when DB missing", async () => {
    const bridge = new EmailHubBridge("/nonexistent", "state.sqlite");
    expect(await bridge.isAvailable()).toBe(false);
  });
});

describe("VaultBridge", () => {
  it("reports unavailable for nonexistent directory", async () => {
    const bridge = new VaultBridge("/nonexistent/path");
    expect(await bridge.isAvailable()).toBe(false);
  });
});
