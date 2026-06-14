import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "JAAD CLOUD — JAAD",
  description: "نظام نقاط البيع والمحاسبة السحابي جاد — JAAD CLOUD & accounting.",
  openGraph: {
    title: "JAAD CLOUD — JAAD",
    description: "نظام نقاط البيع والمحاسبة السحابي جاد — JAAD CLOUD & accounting.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "JAAD CLOUD — JAAD",
    description: "نظام نقاط البيع والمحاسبة السحابي جاد — JAAD CLOUD & accounting.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3E2A1F",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
