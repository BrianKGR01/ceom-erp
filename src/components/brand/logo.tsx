import Image from "next/image";

// Wrapper delgado sobre public/logo-CEOM.svg — el SVG se usa tal cual existe
// (docs/design-system.md seccion 4, regla explicita: no recrear el icono).
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-CEOM.svg"
      alt="CEOM"
      width={720}
      height={405}
      priority
      unoptimized
      className={className}
    />
  );
}
