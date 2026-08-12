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

  it("classifies the apple-icon route as static, including a cache-busting query string", () => {
    expect(classifyRequest("/apple-icon")).toBe("static");
    expect(classifyRequest("/apple-icon?abc123")).toBe("static");
  });

  it("classifies favicon.ico as static", () => {
    expect(classifyRequest("/favicon.ico")).toBe("static");
  });

  // app/icon-192/, app/icon-512/, and app/icon-maskable/route.tsx -- three
  // independent routes, deliberately not ids of a shared
  // generateImageMetadata array (see app/icon-192/route.tsx's header: that
  // array shape let concurrent requests for two or more of its ids
  // intermittently corrupt responses under Next.js 16.3.0/Turbopack). Exact
  // match only -- none of these routes takes an id or sub-path.
  it("classifies the icon-192, icon-512, and icon-maskable routes as static", () => {
    expect(classifyRequest("/icon-192")).toBe("static");
    expect(classifyRequest("/icon-512")).toBe("static");
    expect(classifyRequest("/icon-maskable")).toBe("static");
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

  it("does not treat a path merely starting with '/apple-icon' as a prefix match beyond the route boundary", () => {
    expect(classifyRequest("/apple-icons/unrelated.png")).toBe("network-only");
  });

  it("does not treat a path merely starting with '/icon-192', '/icon-512', or '/icon-maskable' as a prefix match", () => {
    // Every icon route is an exact match now (see the "static" describe
    // block above) -- none of them takes an id, sub-path, or query string,
    // so none of them should match on prefix either.
    expect(classifyRequest("/icon-1920")).toBe("network-only");
    expect(classifyRequest("/icon-5120")).toBe("network-only");
    expect(classifyRequest("/icon-maskable-fake")).toBe("network-only");
    expect(classifyRequest("/icon-maskables")).toBe("network-only");
    expect(classifyRequest("/icon")).toBe("network-only");
    expect(classifyRequest("/icons/unrelated.png")).toBe("network-only");
  });
});
