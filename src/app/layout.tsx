import type { Metadata } from "next";
import { Poppins, Quicksand } from "next/font/google";
import "./globals.css";

// Cuerpo de texto por defecto en toda la interfaz (docs/design-system.md
// seccion 3).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Acentos puntuales (citas, tips, callouts) — uso ocasional, no estructural.
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "CEOM",
  description: "ERP modular para emprendimientos",
  icons: {
    // Icono oficial (public/icono-CEOM.svg), sin recrear.
    icon: "/icono-CEOM.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
