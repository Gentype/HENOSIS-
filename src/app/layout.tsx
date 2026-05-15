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
  title: "Henosis — Build a stunning website from one prompt",
  description:
    "Henosis turns a single prompt into a complete, production-ready website. Premium AI website builder.",
  metadataBase: new URL("https://henosis.app"),
  openGraph: {
    title: "Henosis",
    description: "Build a stunning website from one prompt.",
    type: "website",
  },
};

// CRITICAL: without this, mobile browsers render at desktop width (980 CSS px)
// and Tailwind's `sm:` breakpoints (>=640px) collapse to desktop layout, so
// the hamburger button gets hidden and only the desktop nav renders — making
// the site feel "unclickable" on a real phone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-black text-foreground">
        {children}
      </body>
    </html>
  );
}
