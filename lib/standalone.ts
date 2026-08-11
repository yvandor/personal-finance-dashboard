// Detects whether the app is currently running "installed" -- launched from
// an iPhone/Android home-screen icon (Add to Home Screen / PWA install)
// rather than as an ordinary browser tab. Not wired into any UI yet in this
// slice (there's no "Add to Home Screen" prompt to hide) -- this exists so a
// future install-prompt/banner component has a single, already-tested place
// to ask the question rather than re-deriving it inline.
//
// Two independent signals, either of which counts as standalone:
//   - `display-mode: standalone` -- the standard media feature (Chrome,
//     Edge, and modern Safari desktop/iOS all support matching against it
//     once installed) -- see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode.
//   - `navigator.standalone` -- an iOS-Safari-only, non-standard boolean
//     that predates `display-mode` support and still gets set independently
//     on iOS. Not in the standard DOM lib types (TypeScript's `Navigator`
//     interface has no `standalone` property), so reading it needs a narrow
//     cast rather than either failing to compile or widening `navigator`
//     itself to `any` (which would silently drop type-checking on every
//     other `navigator.*` access at the call site).
export function isStandalone(): boolean {
  // SSR/non-browser guard: `window`/`navigator` don't exist during a
  // Server Component render or in a Node test environment without jsdom.
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const matchesDisplayModeStandalone =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;

  // Cast only the one non-standard property, not the whole `navigator`
  // object, so every other property on it stays fully type-checked.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return matchesDisplayModeStandalone || iosStandalone;
}
