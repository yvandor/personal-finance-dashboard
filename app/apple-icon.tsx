import { ImageResponse } from "next/og";

// iOS home-screen icon (Add to Home Screen), same placeholder styling as
// app/icon.tsx. 180x180 is the standard iOS apple-touch-icon size. iOS
// applies its own corner-rounding mask to whatever square is served here,
// so unlike app/icon.tsx this renders a plain square -- no borderRadius --
// to avoid doubled/inconsistent rounding.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const ACCENT = "#4f46e5";
const ACCENT_FOREGROUND = "#ffffff";

export default function AppleIcon() {
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
        }}
      >
        <span
          style={{
            fontSize: size.width * 0.58,
            fontWeight: 700,
            color: ACCENT_FOREGROUND,
            fontFamily: "sans-serif",
          }}
        >
          $
        </span>
      </div>
    ),
    { ...size },
  );
}
