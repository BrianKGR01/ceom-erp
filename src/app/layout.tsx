import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Familia de titulos del design system v1.0 (seccion 03): Gogh ExtraBold
// para H1-H4, cifras de KPI y totales. La marca todavia no entrego los
// archivos de Gogh, asi que el sustituto real es Archivo ExtraBold; el
// stack declarado en globals.css pone "Gogh" primero para que entre sola
// cuando llegue el woff2, sin tocar componentes.
// El cuerpo de texto NO se carga por webfont: es Verdana, que ya viene con
// el sistema (design system seccion 03, familia de texto).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
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
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
