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
// icons: reference app/icon.tsx's three generateImageMetadata entries (see
// that file's `id` handling). /icon/192 and /icon/512 are the unmasked
// `purpose: "any"` artwork; /icon/512-maskable is a separate drawing on the
// same 512px canvas, full bleed with its mark held inside Android's 80%
// adaptive-icon safe zone. The maskable entry deliberately does NOT reuse
// /icon/512: an icon that satisfies the mask and an icon that is displayed
// unmasked have opposite requirements, so pointing both purposes at one
// image guarantees one of them is wrong (it used to point here, approximated
// by the old placeholder's corner rounding).
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
      { src: "/icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
