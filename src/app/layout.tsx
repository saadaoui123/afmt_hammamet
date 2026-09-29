import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

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
