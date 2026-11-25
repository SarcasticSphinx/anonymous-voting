import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Outfit } from "next/font/google";
import Link from "next/link";
import Lines from "@/components/Lines";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
// Bangla glyphs. Not preloaded: the browser only downloads it when Bangla text is on screen.
const bangla = Anek_Bangla({ variable: "--font-bangla", subsets: ["bengali"], preload: false });

export const metadata: Metadata = {
  title: { default: "thapAI", template: "%s | thapAI" },
  description: "Anonymous voting. No one can see who voted for whom.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${bangla.variable}`}>
      <body>
        <Lines />
        <header className="shell no-print">
          <div className="topbar">
            <Link href="/" className="wordmark">thapAI</Link>
            <nav className="nav">
              <Link href="/polls">Past polls</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
