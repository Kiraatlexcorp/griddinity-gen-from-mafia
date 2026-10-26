import type { Metadata } from "next";
import { Hubot_Sans, Mona_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const mona = Mona_Sans({
  subsets: ["latin"],
  variable: "--font-mona-sans",
  display: "swap",
});

const hubot = Hubot_Sans({
  subsets: ["latin"],
  variable: "--font-hubot-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gridfinity Studio",
  applicationName: "Gridfinity Studio",
  description:
    "Gridfinity Studio: generate Gridfinity bins, baseplates and frame-only grids with puzzle or clip connectors in the browser. Download STL or a Bambu-ready 3MF.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#800020" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${mona.variable} ${hubot.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Script id="acme-theme" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("acme-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`}
        </Script>
        {/* Cards always start open now; forget collapse state saved by older versions. */}
        <Script id="acme-sections" strategy="beforeInteractive">
          {`try{localStorage.removeItem("acme-sections")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
