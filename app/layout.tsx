import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  // file exists, the same way app/icon.tsx/apple-icon.tsx auto-wire their
  // own <link> tags with no metadata field needed for them either.
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
