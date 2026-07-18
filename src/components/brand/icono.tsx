import Image from "next/image";

// Wrapper delgado sobre public/icono-CEOM.svg — para sidebar colapsado,
// favicon y estados de carga (docs/design-system.md seccion 4).
export function Icono({ className }: { className?: string }) {
  return (
    <Image
      src="/icono-CEOM.svg"
      alt="CEOM"
      width={250}
      height={280}
      unoptimized
      className={className}
    />
  );
}
