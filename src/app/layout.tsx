import type { Metadata } from "next";
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
