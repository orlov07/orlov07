import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "SETRA — Inteligência em cada ponto",
  description: "Placar inteligente para Beach Tennis com confirmação humana.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#090b0a", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={manrope.variable}>{children}<PwaRegister/></body></html>;
}
