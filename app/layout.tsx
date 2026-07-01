import type { Metadata } from "next";
import "@/styles/globals.css";
import { CountryProvider } from "@/context/CountryContext";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Repuestito",
  description: "Marketplace de repuestos automotrices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <CountryProvider>
          <Header />
          {children}
        </CountryProvider>
      </body>
    </html>
  );
}
