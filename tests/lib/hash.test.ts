/** Tests for MD5 hashing utility. */
import { describe, it, expect } from "vitest";
import { md5, md5Buffer } from "../../src/lib/hash.js";

describe("md5", () => {
  it("returns consistent hash for same input", () => {
    const a = md5("hello world");
    const b = md5("hello world");
    expect(a).toBe(b);
  });

  it("returns different hash for different input", () => {
    const a = md5("hello");
    const b = md5("world");
    expect(a).not.toBe(b);
  });

  it("returns 32-character hex string", () => {
    const hash = md5("test");
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("handles empty string", () => {
    const hash = md5("");
    expect(hash).toHaveLength(32);
  });

  it("handles unicode content", () => {
    const hash = md5("日本語テスト");
    expect(hash).toHaveLength(32);
  });
});

describe("md5Buffer", () => {
  it("returns consistent hash for same buffer", () => {
    const buf = Buffer.from("hello world");
    expect(md5Buffer(buf)).toBe(md5("hello world"));
  });
});
