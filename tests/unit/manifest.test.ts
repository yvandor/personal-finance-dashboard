import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

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
});
