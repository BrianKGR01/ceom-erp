import { Banknote, CreditCard, Landmark, QrCode, Wallet } from "lucide-react";

// Metodos de pago son un catalogo libre por tenant (metodos_pago no tiene
// un enum de "tipo") — esta heuristica solo elige un icono decorativo a
// partir del nombre real, nunca inventa ni fuerza una categoria de dato.
export function MetodoPagoIcon({ nombre, className }: { nombre: string; className?: string }) {
  const n = nombre.trim().toLowerCase();
  if (n.includes("efectivo") || n.includes("cash")) return <Banknote className={className} />;
  if (n.includes("tarjeta") || n.includes("card")) return <CreditCard className={className} />;
  if (n.includes("transfer") || n.includes("banco")) return <Landmark className={className} />;
  if (n.includes("qr")) return <QrCode className={className} />;
  return <Wallet className={className} />;
}
