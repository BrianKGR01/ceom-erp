// Constantes del bucket compartido de Storage, sin ninguna dependencia de
// runtime de Next.js — separado de storage.ts (que sí importa
// crearClienteServidor, y por lo tanto next/headers) para que
// scripts/setup-storage.ts pueda importar estos valores sin arrastrar esa
// dependencia (mismo criterio ya documentado en
// docs/dev-practices/dev-practices.md sección 7.1 para crearClienteAdmin()).

export const BUCKET_TENANT_UPLOADS = "tenant-uploads";

export const TIPOS_IMAGEN_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const TAMANO_MAXIMO_IMAGEN_BYTES = 5 * 1024 * 1024; // 5MB

export type CarpetaSubida = "logos" | "productos";
