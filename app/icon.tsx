import { ImageResponse } from "next/og";
import { IconArtwork, type IconVariant } from "@/lib/icon-mark";

// The app's generated icon routes. The artwork itself lives in
// lib/icon-mark.tsx, shared with app/apple-icon.tsx -- see that module's
// header for why the mark is drawn from divs instead of a text glyph.
//
// Three entries via generateImageMetadata rather than one icon.tsx default
// size. 192 and 512 are what app/manifest.ts's `icons` array needs for
// Android's install prompt, and generating two genuinely distinct images
// (rather than one image referenced twice under two different declared
// `sizes`) keeps the manifest's claims about the assets actually true.
//
// "512-maskable" is not a third size -- it is the same 512px canvas
// carrying a different drawing. An icon that satisfies Android's
// adaptive-icon mask must be full bleed with its mark inside an 80% safe
// zone, which is the direct opposite of what the unmasked `purpose: "any"`
// icon wants (its own corner rounding, and a mark big enough to not look
// lost). Serving one image for both purposes means one of them is wrong;
// the cost of serving both correctly is this one extra entry plus one src
// string in app/manifest.ts.
//
// Adding an id here needs no service-worker change, which is the only
// reason it is a safe thing to do casually: lib/sw-strategy.ts (and the
// hand-written copy of its rules in public/sw.js) classifies the entire
// `/icon/` path prefix as a cacheable static asset, so a new id is covered
// the day it exists. Nothing about the network-only default for financial
// routes is involved here.
const ICONS = {
  "192": { size: 192, variant: "any" },
  "512": { size: 512, variant: "any" },
  "512-maskable": { size: 512, variant: "maskable" },
} as const satisfies Record<string, { size: number; variant: IconVariant }>;

export function generateImageMetadata() {
  return Object.entries(ICONS).map(([id, { size }]) => ({
    id,
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = String(await id) as keyof typeof ICONS;
  // Falls back to the smallest icon for an id Next never generated, same as
  // the previous implementation's ternary did: a hand-typed or stale /icon
  // URL should not be a 500.
  const { size, variant } = ICONS[iconId] ?? ICONS["192"];
  return new ImageResponse(<IconArtwork size={size} variant={variant} />, {
    width: size,
    height: size,
  });
}
