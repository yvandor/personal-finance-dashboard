import { ImageResponse } from "next/og";
import { IconArtwork } from "@/lib/icon-mark";

// force-dynamic for the same reason as app/icon.tsx: this route hits the
// same Next 16.3.0 Full Route Cache collision that served a 0-byte body
// with another route's cached headers on a repeat request, found via a real
// CI failure's network trace. See app/icon.tsx's comment for the full
// writeup -- not repeated here to avoid the two drifting apart.
export const dynamic = "force-dynamic";

// iOS home-screen icon (Add to Home Screen); 180x180 is the standard
// apple-touch-icon size. Renders the same mark as app/icon.tsx from the
// shared lib/icon-mark.tsx, in the "apple" variant: full bleed, no
// borderRadius of its own, because iOS masks whatever square is served here
// with its own superellipse and pre-rounding would show through as doubled,
// inconsistent corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconArtwork size={size.width} variant="apple" />, { ...size });
}
