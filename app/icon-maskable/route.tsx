import { ImageResponse } from "next/og";
import { IconArtwork } from "@/lib/icon-mark";

// Android's maskable icon (app/manifest.ts's `purpose: "maskable"` entry),
// deliberately NOT one of app/icon.tsx's generateImageMetadata ids anymore.
//
// It used to be ("512-maskable"), and that's what caused a real, CI-only,
// intermittent bug: two or more of that file's sibling ids requested
// concurrently -- exactly what both the browser's own installability check
// and this app's e2e suite naturally do -- occasionally came back with a
// PNG of the *correct declared byte length* but corrupted content (fails
// to decode). Reproduced directly against a real production build and real
// browser, repeatedly, only under concurrency, never on an isolated
// request; the bytes are otherwise correct (right magic number, right IHDR,
// right IEND) up to whatever's silently going wrong in between. That
// profile -- right length, wrong content, only under concurrent access to
// sibling ids of one generateImageMetadata-driven route -- points at a
// Next.js 16.3.0/Turbopack bug in how it serves multiple ids of the same
// dynamic image-metadata route concurrently, not at anything in this app's
// own rendering code (lib/icon-mark.tsx's IconArtwork decodes correctly on
// every single-request or cross-file-concurrent trial run against it).
//
// A plain custom Route Handler is a structurally different code path from
// app/icon.tsx's generateImageMetadata array -- its own compiled module,
// no shared id list -- which is what actually avoids the bug rather than
// working around a specific symptom of it. app/apple-icon.tsx already
// proved this shape works correctly (it's never shared generateImageMetadata
// state with app/icon.tsx and has never shown this failure, concurrent with
// the other icon routes or not).
//
// lib/sw-strategy.ts's classifyRequest() has a dedicated `/icon-maskable`
// case (not just the `/icon/` prefix match) precisely because this route
// lives outside that prefix on purpose -- see that file's comment.
export const size = { width: 512, height: 512 };

export async function GET() {
  return new ImageResponse(<IconArtwork size={size.width} variant="maskable" />, { ...size });
}
