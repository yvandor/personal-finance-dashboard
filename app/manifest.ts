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
// icons: /icon-192, /icon-512, and /icon-maskable are three independent
// Route Handlers (app/icon-192/, app/icon-512/, app/icon-maskable/), not
// ids of a shared app/icon.tsx generateImageMetadata array the way this
// looked before -- that array was a real, CI-reproduced Next.js 16.3.0/
// Turbopack bug: concurrent requests for two or more of its ids
// intermittently came back with a PNG of the correct declared byte length
// but corrupted, undecodable content. Reproduced directly against a real
// production build, confirmed to affect any two sibling ids (not just
// three), and confirmed to not affect independent Route Handlers with no
// shared array -- see app/icon-192/route.tsx's header for the full
// writeup. Every icon this app serves is now its own standalone route for
// exactly that reason; don't reintroduce a generateImageMetadata array
// with more than one id.
//
// The maskable entry deliberately does NOT reuse /icon-512: an icon that
// satisfies Android's adaptive-icon mask and an icon that is displayed
// unmasked have opposite requirements (full-bleed safe-zone content vs.
// self-rounded corners with a larger mark), so pointing both purposes at
// one image guarantees one of them is wrong.
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
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
