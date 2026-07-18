import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default de Next.js es 1MB — insuficiente para las imagenes de hasta
    // 5MB que aceptan los dropzones de logo/producto
    // (src/lib/supabase/storage-config.ts, TAMANO_MAXIMO_IMAGEN_BYTES).
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
