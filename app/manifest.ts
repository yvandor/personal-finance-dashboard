import type { MetadataRoute } from "next";

// Next's file-convention manifest route -- this file's existence alone
// auto-injects <link rel="manifest" href="/manifest.webmanifest"> into
// app/layout.tsx's <head>, no edit to that file needed (see its own comment
// on the `metadata` export).
//
// background_color/theme_color mirror app/globals.css's light-mode
// --accent (#4f46e5) -- a manifest has no media-query variant, so this
// picks the same single fixed color app/icon.tsx's placeholder icon uses,
// consistent with app/layout.tsx's viewport.themeColor light-mode entry.
//
// icons: reference app/icon.tsx's two generateImageMetadata sizes
// (/icon/192, /icon/512 -- see that file's `id` handling) plus one
// maskable-purpose entry at 512x512 for Android's adaptive-icon masking
// (maskable icons need extra safe-zone padding around the visible glyph;
// app/icon.tsx's borderRadius-only placeholder is a close-enough
// approximation for this placeholder-icon slice, not a pixel-perfect
// maskable-safe-zone icon -- fine to revisit whenever the real icon
// design lands).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finance Dashboard",
    short_name: "Finance",
    description: "Personal finance dashboard — manual transaction tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#4f46e5",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
