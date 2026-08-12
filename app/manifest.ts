import type { MetadataRoute } from "next";

// Next's file-convention manifest route -- this file's existence alone
// auto-injects <link rel="manifest" href="/manifest.webmanifest"> into
// app/layout.tsx's <head>, no edit to that file needed (see its own comment
// on the `metadata` export).
//
// background_color/theme_color mirror app/globals.css's light-mode
// --accent (#4f46e5) -- a manifest has no media-query variant, so this
// picks the same single fixed color lib/icon-mark.tsx's artwork is built
// on, consistent with app/layout.tsx's viewport.themeColor light-mode entry.
//
// icons: /icon/192 and /icon/512 reference app/icon.tsx's two
// generateImageMetadata entries (see that file's `id` handling) -- the
// unmasked `purpose: "any"` artwork. /icon-maskable is a separate route
// (app/icon-maskable/route.tsx), NOT a third id of app/icon.tsx: it's a
// different drawing on the same 512px canvas, full bleed with its mark held
// inside Android's 80% adaptive-icon safe zone, and it lives outside
// app/icon.tsx specifically to avoid a real Next.js concurrency bug that
// file's own comment documents -- see that route's header before adding a
// fourth generateImageMetadata id here instead of a new route. The maskable
// entry deliberately does NOT reuse /icon/512 either way: an icon that
// satisfies the mask and an icon that is displayed unmasked have opposite
// requirements, so pointing both purposes at one image guarantees one of
// them is wrong.
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
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
