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
  title: "Gridfinity Studio by ACMIE",
  applicationName: "Gridfinity Studio by ACMIE",
  description:
    "Gridfinity Studio by ACMIE: generate Gridfinity bins, baseplates and frame-only grids with puzzle or clip connectors in the browser. Download STL or a Bambu-ready 3MF.",
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
      className={`${mona.variable} ${hubot.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Script id="acme-theme" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("acme-theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`}
        </Script>
        {/* Hide cards the visitor collapsed before React hydrates, so they never flash open. SectionCard removes its rule once it renders closed. */}
        <Script id="acme-sections" strategy="beforeInteractive">
          {`try{var o=JSON.parse(localStorage.getItem("acme-sections")||"{}"),c="";for(var k in o)if(o[k]===false&&/^[a-z0-9-]+$/.test(k))c+='[data-section="'+k+'"] [data-slot=collapsible-content]{display:none}[data-section="'+k+'"] [data-chevron]{rotate:-90deg}';if(c){var s=document.createElement("style");s.id="acme-sections-pre";s.textContent=c;document.head.appendChild(s)}}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
