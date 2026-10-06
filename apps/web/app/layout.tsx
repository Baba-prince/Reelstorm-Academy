import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "REELSTORM ACADEMY — Production OS Factory",
  description:
    "Not a course. A production OS for YouTubers, music artists, and advert outlets. Script or YouTube reference → ARCHIVE5 → 30-min master.",
  openGraph: {
    title: "REELSTORM ACADEMY",
    description: "Your story. Your studio. Your empire.",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="font-body antialiased selection:bg-violet selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
