import { describe, expect, it } from "vitest";
import { classifyRequest } from "@/lib/sw-strategy";

describe("classifyRequest -- static (cache-first, versioned by build id)", () => {
  it("classifies Next's content-hashed static assets as static", () => {
    expect(classifyRequest("/_next/static/chunks/main-abc123.js")).toBe("static");
    expect(classifyRequest("/_next/static/css/app-def456.css")).toBe("static");
    expect(classifyRequest("/_next/static/media/font.woff2")).toBe("static");
  });

  it("classifies the manifest route as static", () => {
    expect(classifyRequest("/manifest.webmanifest")).toBe("static");
  });

  it("classifies icon routes as static, including a cache-busting query string", () => {
    expect(classifyRequest("/icon")).toBe("static");
    expect(classifyRequest("/icon?abc123")).toBe("static");
    expect(classifyRequest("/icon/small")).toBe("static");
  });

  it("classifies the apple-icon route as static, including a cache-busting query string", () => {
    expect(classifyRequest("/apple-icon")).toBe("static");
    expect(classifyRequest("/apple-icon?abc123")).toBe("static");
  });

  it("classifies favicon.ico as static", () => {
    expect(classifyRequest("/favicon.ico")).toBe("static");
  });

  it("works with absolute URLs, not just bare paths", () => {
    expect(classifyRequest("https://example.com/_next/static/chunks/main-abc123.js")).toBe("static");
    expect(classifyRequest("https://example.com/manifest.webmanifest")).toBe("static");
  });
});

describe("classifyRequest -- network-only (every navigation, no exceptions)", () => {
  it("classifies every page path as network-only", () => {
    expect(classifyRequest("/")).toBe("network-only");
    expect(classifyRequest("/dashboard")).toBe("network-only");
    expect(classifyRequest("/transactions")).toBe("network-only");
    expect(classifyRequest("/budgets")).toBe("network-only");
    expect(classifyRequest("/bills")).toBe("network-only");
    expect(classifyRequest("/income")).toBe("network-only");
    expect(classifyRequest("/goals")).toBe("network-only");
    expect(classifyRequest("/categories")).toBe("network-only");
    expect(classifyRequest("/history")).toBe("network-only");
    expect(classifyRequest("/offline")).toBe("network-only");
  });

  it("classifies a page path with query params/hash as network-only", () => {
    expect(classifyRequest("/transactions?period=last-3-months")).toBe("network-only");
    expect(classifyRequest("/dashboard#top")).toBe("network-only");
  });

  it("defaults unknown/unrecognized paths to network-only (default-safe)", () => {
    expect(classifyRequest("/api/whatever")).toBe("network-only");
    expect(classifyRequest("/_next/data/build-id/dashboard.json")).toBe("network-only");
    expect(classifyRequest("/random-file.png")).toBe("network-only");
    expect(classifyRequest("/_next/image?url=%2Ffoo.png&w=256&q=75")).toBe("network-only");
  });

  it("treats an unparseable URL as network-only rather than throwing", () => {
    expect(classifyRequest("not a url")).toBe("network-only");
  });

  it("does not treat a path merely starting with '/icon' or '/apple-icon' as a prefix match beyond the route boundary", () => {
    // Guards against an overly loose `startsWith("/icon")` (no slash) that
    // would also match an unrelated path like /icons/some-other-thing.
    expect(classifyRequest("/icons/unrelated.png")).toBe("network-only");
    expect(classifyRequest("/apple-icons/unrelated.png")).toBe("network-only");
  });
});
