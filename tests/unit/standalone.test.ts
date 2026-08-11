import { afterEach, describe, expect, it, vi } from "vitest";
import { isStandalone } from "@/lib/standalone";

// This suite runs under vitest.config.mts's "node" environment (no jsdom),
// so `window`/`navigator` don't exist unless a test stubs them in --
// exercising both "real browser" branches below and the SSR/non-browser
// guard (the environment's own default, no stubbing needed) for free.
describe("isStandalone", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false outside a browser (no window/navigator, e.g. SSR)", () => {
    expect(isStandalone()).toBe(false);
  });

  it("returns true when the display-mode: standalone media query matches", () => {
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: query === "(display-mode: standalone)",
      }),
    });
    vi.stubGlobal("navigator", {});

    expect(isStandalone()).toBe(true);
  });

  it("returns true for the iOS-Safari-only navigator.standalone flag even when display-mode doesn't match", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal("navigator", { standalone: true });

    expect(isStandalone()).toBe(true);
  });

  it("returns false when neither signal indicates standalone (an ordinary browser tab)", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal("navigator", { standalone: false });

    expect(isStandalone()).toBe(false);
  });

  it("returns false when navigator.standalone is simply absent (non-iOS browsers)", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal("navigator", {});

    expect(isStandalone()).toBe(false);
  });

  it("doesn't throw when window.matchMedia itself is unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { standalone: false });

    expect(isStandalone()).toBe(false);
  });
});
