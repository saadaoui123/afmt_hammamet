import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices auto-hébergées (mêmes familles qu'avant, licence OFL) : le build ne dépend plus de Google Fonts.
const manrope = localFont({
  src: "./fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
});
const space = localFont({
  src: "./fonts/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IFMT Hammamet — Emplois du Temps (Direction : Ines Khrifech)",
  description:
    "Application de construction automatique du planning pédagogique de l'Institut de Formation dans les Métiers du Tourisme (IFMT) de Hammamet. Direction des études : Ines Khrifech.",
  icons: {
    icon: "/images/logo-ifmt.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${space.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
