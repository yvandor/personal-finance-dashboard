import { ImageResponse } from "next/og";
import { IconArtwork } from "@/lib/icon-mark";

// Android's maskable icon (app/manifest.ts's `purpose: "maskable"` entry),
// one of four independent icon Route Handlers this app has, deliberately
// not a generateImageMetadata id sharing an array with any sibling -- see
// app/icon-192/route.tsx's header for the real, CI-reproduced Next.js
// 16.3.0/Turbopack bug that shape caused (not repeated here so the two
// don't drift apart).
//
// lib/sw-strategy.ts's classifyRequest() has a dedicated `/icon-maskable`
// case, exact-match, for the same reason app/icon-192 and app/icon-512 do.
export const size = { width: 512, height: 512 };

export async function GET() {
  return new ImageResponse(<IconArtwork size={size.width} variant="maskable" />, { ...size });
}
