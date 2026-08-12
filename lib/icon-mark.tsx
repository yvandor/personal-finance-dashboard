// The one drawing of this app's icon, shared by every generated icon route
// (app/icon.tsx's /icon/192 and /icon/512, app/icon-maskable/route.tsx's
// /icon-maskable, and app/apple-icon.tsx's /apple-icon -- four separate
// route files, not variants of one; see app/icon-maskable/route.tsx's
// header for why maskable specifically isn't a generateImageMetadata id of
// app/icon.tsx). Kept in one module rather than copied per route file so
// the four rendered variants cannot drift into being four slightly
// different logos -- the only things that legitimately differ between them
// are the canvas size and how much safe-zone padding the destination
// platform demands, both of which are parameters below.
//
// Drawn entirely from <div>s, never from a text glyph. ImageResponse
// renders through Satori, which embeds a single default font at a single
// weight, so `fontWeight: 700` on a "$" silently renders at normal weight
// -- which is most of why the previous placeholder icon read as thin and
// unfinished. Geometry renders identically at 180px and at 512px, on every
// platform, with no font file to load, embed, or keep under
// ImageResponse's 500KB bundle budget.
//
// Satori supports only flexbox and a subset of CSS (no grid, no
// pseudo-elements, no filters). Anything added here must stay inside that
// subset -- see node_modules/next/dist/docs/01-app/03-api-reference/
// 04-functions/image-response.md.

// #4f46e5 / #ffffff are this app's light-mode --accent /
// --accent-foreground tokens (app/globals.css). Deliberately not the
// dark-mode pair: a home-screen icon has no ambient page background to
// auto-switch against, so it picks one fixed brand color the way installed
// app icons generally do. The two extra gradient stops are the adjacent
// indigo shades the accent itself comes from, so the depth reads as
// shading of the brand color rather than as a second color entering the
// palette.
const ACCENT = "#4f46e5";
const ACCENT_LIGHT = "#6366f1";
const ACCENT_DEEP = "#4338ca";
const ACCENT_FOREGROUND = "#ffffff";

// Three ascending bars on a shared baseline -- a growth/chart mark, which
// is what this app actually is: a dashboard over manually tracked
// transactions. Every value is a fraction of the mark box (never a pixel
// count) so the identical proportions survive every canvas size. The
// opacity ramp is what makes the three bars read as one ascending series
// rather than three unrelated shapes; the tallest is fully opaque so the
// mark still has a confident focal point at home-screen sizes.
const BARS = [
  { height: 0.46, opacity: 0.62 },
  { height: 0.72, opacity: 0.8 },
  { height: 1, opacity: 1 },
] as const;

// Three bars at 0.22 of the mark box leave two gaps of 0.17 -- bars wider
// than their gaps, which keeps the group reading as a solid mark instead of
// three stripes once it is scaled down to a ~48px home-screen tile.
const BAR_WIDTH = 0.22;

const VARIANTS = {
  // Displayed exactly as served: Android's `purpose: "any"` entries,
  // desktop PWA install surfaces, browser UI. Nothing masks it, so it
  // carries its own app-icon corner rounding and can afford a larger mark.
  any: { cornerRadius: 0.22, markScale: 0.62 },

  // Android adaptive-icon masking (`purpose: "maskable"`). Full bleed, and
  // specifically NOT self-rounded: the OS clips this to a circle, squircle
  // or rounded square itself, and artwork that pre-rounds its own corners
  // shows a ring of dead space inside that mask. In exchange the mark must
  // survive the most aggressive mask shape, so it stays inside the spec's
  // safe zone -- a centred circle of 80% of the canvas. The largest square
  // that fits inside that circle has a side of 0.8 / sqrt(2) = 0.5657 of
  // the canvas, and the bars fill their mark box in both axes (full width,
  // and the tallest bar is the full height), so 0.56 is the real bound
  // here, not a guess with margin bolted on. No mask shape can clip it.
  maskable: { cornerRadius: 0, markScale: 0.56 },

  // iOS "Add to Home Screen". iOS applies its own superellipse mask to
  // whatever square is served, so this is full bleed too, for the same
  // doubled-rounding reason as above. That mask crops far less than
  // Android's circle, so the mark sits between the other two variants.
  apple: { cornerRadius: 0, markScale: 0.58 },
} as const;

export type IconVariant = keyof typeof VARIANTS;

export function IconArtwork({ size, variant }: { size: number; variant: IconVariant }) {
  const { cornerRadius, markScale } = VARIANTS[variant];
  const mark = size * markScale;
  const barWidth = mark * BAR_WIDTH;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // backgroundColor as well as the gradient: if Satori ever fails to
        // parse the gradient, the icon degrades to the flat brand color
        // rather than to transparent-on-black.
        backgroundColor: ACCENT,
        // 135deg puts the lightest stop at the top-left, where a viewer
        // reads a light source from, so this reads as shading rather than
        // as an obvious two-tone diagonal split.
        backgroundImage: `linear-gradient(135deg, ${ACCENT_LIGHT} 0%, ${ACCENT} 52%, ${ACCENT_DEEP} 100%)`,
        borderRadius: size * cornerRadius,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: mark,
          height: mark,
        }}
      >
        {BARS.map((bar) => (
          <div
            key={bar.height}
            style={{
              width: barWidth,
              height: mark * bar.height,
              borderRadius: barWidth / 2,
              backgroundColor: ACCENT_FOREGROUND,
              opacity: bar.opacity,
              // A single soft shadow lifts the bars off the gradient. Kept
              // deliberately low-contrast: at home-screen size a heavier
              // shadow turns into a grey halo rather than depth.
              boxShadow: `0 ${size * 0.008}px ${size * 0.028}px rgba(15, 23, 42, 0.28)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
