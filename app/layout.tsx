import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "Personal finance dashboard — manual transaction tracking.",
  // No explicit `manifest:` field here -- Next's app/manifest.ts file
  // convention auto-injects the <link rel="manifest"> tag itself once that
  // file exists.
  //
  // `icons` is fully explicit here, INCLUDING `apple`, even though
  // app/apple-icon.tsx is still a real file-convention route Next
  // auto-generates a URL for. An explicit `metadata.icons` object replaces
  // Next's file-convention icon auto-injection wholesale rather than merging
  // with it -- found the hard way, via a real CI failure, when adding only
  // `icon` here silently dropped the `<link rel="apple-touch-icon">` tag
  // app/apple-icon.tsx used to get for free. `icon` itself is explicit
  // because app/icon-192/route.tsx and app/icon-512/route.tsx are plain
  // custom Route Handlers, not app/icon.tsx's former special-convention
  // generateImageMetadata file (removed after a real, CI-reproduced Next.js
  // 16.3.0/Turbopack bug -- see app/icon-192/route.tsx's header for the full
  // writeup), so Next has no file to auto-discover an `<link rel="icon">`
  // from either. Net effect: every icon link this app's <head> needs is
  // listed here, once, rather than split between automatic and explicit
  // wiring.
  icons: {
    icon: [
      { url: "/icon-192", sizes: "192x192", type: "image/png" },
      { url: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  // "default" (not "black-translucent"): the status bar overlaps the app's
  // own content only under black-translucent, which is exactly the case
  // app/globals.css's safe-area insets exist to handle correctly -- picking
  // "default" here means iOS reserves the status-bar strip itself and this
  // app's safe-area padding is a deliberate belt-and-suspenders layer, not
  // the only thing standing between content and the notch.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finance",
  },
};

// viewport-fit=cover is what makes env(safe-area-inset-*) resolve to
// nonzero values at all in standalone (Add to Home Screen) mode -- without
// it, iOS letterboxes the page inside the safe area itself and every inset
// reads as 0. themeColor drives the iOS status-bar/task-switcher tint and
// the Android PWA toolbar color; the two entries mirror this app's own
// light/dark --accent tokens (app/globals.css) so neither mode looks like
// an unstyled default.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#818cf8" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
