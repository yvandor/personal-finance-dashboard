import { ImageResponse } from "next/og";

// Placeholder app icon, procedurally generated -- no design assets exist in
// this repo yet (see public/ -- just create-next-app's default SVGs). A
// real icon can replace this file later without touching app/manifest.ts's
// `icons` array (it references this route by path, not by file contents)
// or anything else in the PWA slice.
//
// Two sizes via generateImageMetadata (192x192, 512x512) rather than one
// icon.tsx default size: app/manifest.ts's `icons` array wants both for
// Android's install prompt / adaptive-icon masking, and generating two real
// distinctly-sized images (rather than one image referenced twice under two
// different declared `sizes`) keeps the manifest's claims about the assets
// actually true.
const SIZES = {
  small: { width: 192, height: 192 },
  large: { width: 512, height: 512 },
} as const;

export function generateImageMetadata() {
  return [
    { id: "192", size: SIZES.small, contentType: "image/png" },
    { id: "512", size: SIZES.large, contentType: "image/png" },
  ];
}

// #4f46e5 / #ffffff -- this app's light-mode --accent / --accent-foreground
// tokens (app/globals.css). Deliberately not the dark-mode pair: a home
// screen icon has no ambient page background to auto-switch against, so it
// picks one fixed brand color the same way most installed-app icons do.
const ACCENT = "#4f46e5";
const ACCENT_FOREGROUND = "#ffffff";

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = await id;
  const { width, height } = iconId === "512" ? SIZES.large : SIZES.small;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ACCENT,
          // A little corner rounding reads as an app icon rather than a
          // plain color swatch, while staying well inside the "safe zone"
          // Android's adaptive-icon masking needs (see manifest's
          // maskable icon entry).
          borderRadius: width * 0.18,
        }}
      >
        <span
          style={{
            fontSize: width * 0.58,
            fontWeight: 700,
            color: ACCENT_FOREGROUND,
            fontFamily: "sans-serif",
          }}
        >
          $
        </span>
      </div>
    ),
    { width, height },
  );
}
