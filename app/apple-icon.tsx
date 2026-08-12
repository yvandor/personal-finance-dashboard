import { ImageResponse } from "next/og";
import { IconArtwork } from "@/lib/icon-mark";

// iOS home-screen icon (Add to Home Screen); 180x180 is the standard
// apple-touch-icon size. Renders the same mark as app/icon-192/route.tsx
// and app/icon-512/route.tsx, from the shared lib/icon-mark.tsx, in the
// "apple" variant: full bleed, no borderRadius of its own, because iOS
// masks whatever square is served here with its own superellipse and
// pre-rounding would show through as doubled, inconsistent corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconArtwork size={size.width} variant="apple" />, { ...size });
}
