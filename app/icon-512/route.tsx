import { ImageResponse } from "next/og";
import { IconArtwork } from "@/lib/icon-mark";

// The other of two independent routes for this app's unmasked
// `purpose: "any"` icon -- see app/icon-192/route.tsx for the full writeup
// on why this is a standalone Route Handler rather than a second id of one
// generateImageMetadata array.
export const size = { width: 512, height: 512 };

export async function GET() {
  return new ImageResponse(<IconArtwork size={size.width} variant="any" />, { ...size });
}
