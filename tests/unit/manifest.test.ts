import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { size as icon192Size } from "@/app/icon-192/route";
import { size as icon512Size } from "@/app/icon-512/route";
import { size as maskableSize } from "@/app/icon-maskable/route";

// app/manifest.ts is a plain function returning a MetadataRoute.Manifest
// object -- no request/route context involved -- so it's unit-testable
// directly, the same way tests/unit exercises lib/*'s other pure functions.
describe("manifest", () => {
  it("declares the required installability fields", () => {
    const result = manifest();
    expect(result.name).toBe("Finance Dashboard");
    expect(result.short_name).toBe("Finance");
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
  });

  it("uses the light-mode --accent token (#4f46e5) for background/theme color", () => {
    const result = manifest();
    expect(result.background_color).toBe("#4f46e5");
    expect(result.theme_color).toBe("#4f46e5");
  });

  it("includes 192x192 and 512x512 icons", () => {
    const result = manifest();
    const sizes = (result.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("marks at least one icon as maskable for Android's adaptive-icon masking", () => {
    const result = manifest();
    const maskable = (result.icons ?? []).some((icon) => icon.purpose === "maskable");
    expect(maskable).toBe(true);
  });

  it("every icon entry has a src, sizes, and type", () => {
    const result = manifest();
    for (const icon of result.icons ?? []) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  // The manifest's icon srcs and sizes are hand-written strings/literals
  // that have to line up with what each icon route actually serves;
  // nothing in the build checks that, so a renamed route or a changed
  // export const size leaves a manifest that parses perfectly and installs
  // an app with a missing or mis-declared icon. Cross-checking against each
  // route's own exported `size` here catches it in the unit suite, with no
  // server or browser -- e2e/pwa.spec.ts then confirms the routes actually
  // serve the right bytes.
  //
  // Three separate routes, not one generateImageMetadata array with three
  // ids: that array shape was a real, CI-reproduced Next.js 16.3.0/
  // Turbopack bug (concurrent requests for two or more of its ids
  // intermittently came back with a PNG of the correct declared byte length
  // but corrupted, undecodable content) -- see app/icon-192/route.tsx's
  // header for the full writeup. Don't collapse these back into a shared
  // array or a loop over a lookup table; three explicit checks against
  // three explicit imports is what keeps that mistake from being trivial to
  // reintroduce.
  it("points the 192 icon at its own route with the right declared size", () => {
    const icon = (manifest().icons ?? []).find((i) => i.sizes === "192x192" && i.purpose !== "maskable");
    expect(icon).toBeDefined();
    expect(icon!.src).toBe("/icon-192");
    expect(icon!.sizes).toBe(`${icon192Size.width}x${icon192Size.height}`);
  });

  it("points the 512 icon at its own route with the right declared size", () => {
    const icon = (manifest().icons ?? []).find((i) => i.sizes === "512x512" && i.purpose !== "maskable");
    expect(icon).toBeDefined();
    expect(icon!.src).toBe("/icon-512");
    expect(icon!.sizes).toBe(`${icon512Size.width}x${icon512Size.height}`);
  });

  it("points the maskable icon at its own route with the right declared size", () => {
    const maskable = (manifest().icons ?? []).find((icon) => icon.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable!.src).toBe("/icon-maskable");
    expect(maskable!.sizes).toBe(`${maskableSize.width}x${maskableSize.height}`);
  });

  // Regression guard for the v1.6 icon work: a maskable icon must be full
  // bleed with its mark inside Android's 80% safe zone, and an unmasked
  // `purpose: "any"` icon wants its own corner rounding and a larger mark.
  // One image cannot satisfy both, so these two purposes must never be
  // collapsed back onto a single src (they were, before this release --
  // /icon/512 served both). See lib/icon-mark.tsx's VARIANTS.
  it("serves the maskable purpose from its own icon route, not the unmasked 512", () => {
    const icons = manifest().icons ?? [];
    const maskable = icons.find((icon) => icon.purpose === "maskable");
    const unmasked = icons.filter((icon) => icon.purpose !== "maskable").map((icon) => icon.src);

    expect(maskable).toBeDefined();
    expect(unmasked).not.toContain(maskable!.src);
  });
});
