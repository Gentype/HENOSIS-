import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the session server-side once per request and hand it to
  // SessionProvider as `initialSession`. Without this, `useSession()` starts
  // out "loading" → "unauthenticated" on the first client render even when a
  // valid cookie is present, causing the user to see "Not signed in" for a
  // tick before the client refetch resolves. Passing the SSR session removes
  // the race entirely.
  const session = await auth();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-black text-foreground">
        <Providers initialSession={session}>{children}</Providers>
      </body>
    </html>
  );
}
