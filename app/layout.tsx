import type { Metadata } from "next";
import { Public_Sans, Manrope } from "next/font/google";
import "@/styles/globals.css";
import { CountryProvider } from "@/context/CountryContext";

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", weight: ["400", "500", "600", "700"] });
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Piezify",
  description: "Marketplace de repuestos automotrices",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${publicSans.className} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const saved=localStorage.getItem('piezify-theme');const theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme}catch{}` }} />
      </head>
      <body>
        <CountryProvider>
          {children}
        </CountryProvider>
      </body>
    </html>
  );
}
