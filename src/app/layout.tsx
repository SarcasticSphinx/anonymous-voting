import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Link from "next/link";
import Lines from "@/components/Lines";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ballotin", template: "%s | Ballotin" },
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
    <html lang="en" className={outfit.variable}>
      <body>
        <Lines />
        <header className="shell shell-wide no-print">
          <div className="topbar">
            <Link href="/" className="wordmark">Ballotin</Link>
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
