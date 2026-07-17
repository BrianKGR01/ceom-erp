import { crearClienteServidor } from "./server";
import {
  BUCKET_TENANT_UPLOADS,
  TAMANO_MAXIMO_IMAGEN_BYTES,
  TIPOS_IMAGEN_PERMITIDOS,
  type CarpetaSubida,
} from "./storage-config";

// Storage de archivos (AGENTS.md, stack): supabase-js se usa solo para
// Auth/Storage/Realtime, nunca para queries de negocio — este archivo es el
// unico punto de contacto con Supabase Storage de toda la app. Un solo
// bucket compartido ("tenant-uploads"), con el tenant_id como primer
// segmento del path — es lo que la RLS de storage.objects usa para aislar
// por tenant (drizzle/migrations/0024_storage_tenant_uploads_rls.sql,
// reutiliza current_tenant_id() tal cual, no una copia). El bucket en si lo
// crea `scripts/setup-storage.ts` (Drizzle no modela buckets, solo lo que
// vive en storage.objects) — las constantes compartidas viven en
// storage-config.ts, sin dependencia de next/headers, para que ese script
// las pueda importar sin arrastrar este archivo (ver ese script).
//
// Publico para LECTURA (getPublicUrl da una URL permanente, sin expirar) —
// decision deliberada: lo que se sube hoy (logo de negocio, foto de
// producto) no es dato sensible, y se renderiza en <img src> dentro de la
// propia UI del tenant. Un bucket privado con URLs firmadas resolveria un
// problema que no existe todavia (nada de lo que sube hoy necesita
// expirar o esconderse) a cambio de tener que regenerar la URL cada vez
// que se muestra la imagen. Si en el futuro se sube algo sensible (ej. un
// documento de verificacion), eso va a un bucket nuevo y privado — no se
// reutiliza este.
export { BUCKET_TENANT_UPLOADS, TIPOS_IMAGEN_PERMITIDOS, TAMANO_MAXIMO_IMAGEN_BYTES };
export type { CarpetaSubida };

export type ResultadoSubida =
  | { ok: true; data: { path: string; url: string } }
  | { ok: false; error: string };

function extensionDe(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Sube una imagen al bucket compartido, bajo `{tenantId}/{carpeta}/{nombre
 * unico}`. El primer segmento del path SIEMPRE tiene que ser el tenantId
 * real del solicitante — nunca se arma a mano fuera de esta funcion, para
 * no romper el supuesto que la RLS de storage.objects da por sentado.
 *
 * Usa el cliente de Supabase atado a la sesion del usuario (nunca el
 * cliente admin/service-role) para que la subida pase por esa RLS como
 * segunda capa de defensa real — el llamador (Server Action) ya valido
 * permisos a nivel de aplicacion (tienePermiso/esOwner) antes de llegar
 * aca, mismo criterio que el resto de la app con las tablas de negocio
 * (AGENTS.md regla 6).
 *
 * Validacion server-side de tipo/tamano — nunca confiar solo en la
 * validacion del cliente (que existe unicamente para dar feedback rapido
 * antes de subir el archivo).
 */
export async function subirImagen(
  tenantId: string,
  carpeta: CarpetaSubida,
  file: File
): Promise<ResultadoSubida> {
  if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.type as (typeof TIPOS_IMAGEN_PERMITIDOS)[number])) {
    return { ok: false, error: "Solo se aceptan imágenes PNG, JPG o WEBP." };
  }
  if (file.size > TAMANO_MAXIMO_IMAGEN_BYTES) {
    return { ok: false, error: "La imagen no puede pesar más de 5MB." };
  }

  const path = `${tenantId}/${carpeta}/${crypto.randomUUID()}.${extensionDe(file.type)}`;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.storage
    .from(BUCKET_TENANT_UPLOADS)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return { ok: false, error: `No se pudo subir el archivo: ${error.message}` };
  }

  const { data } = supabase.storage.from(BUCKET_TENANT_UPLOADS).getPublicUrl(path);
  return { ok: true, data: { path, url: data.publicUrl } };
}

/**
 * Borra un archivo previo del bucket — se llama al reemplazar un logo o una
 * imagen de producto, para no acumular huérfanos. Nunca lanza: si el
 * borrado falla, el archivo viejo queda huérfano pero no bloquea guardar
 * el nuevo (la operación principal ya es la que importa).
 */
export async function eliminarImagen(path: string): Promise<void> {
  try {
    const supabase = await crearClienteServidor();
    await supabase.storage.from(BUCKET_TENANT_UPLOADS).remove([path]);
  } catch {
    // Best-effort — ver comentario de la funcion.
  }
}

/**
 * Extrae el path relativo al bucket desde una URL pública ya guardada (ej.
 * `tenants.logoUrl`, `productos.imagenUrl`) — así se puede borrar el
 * archivo viejo al subir uno nuevo sin tener que persistir el path aparte
 * de la URL.
 */
export function pathDesdeUrlPublica(url: string): string | null {
  const marcador = `/storage/v1/object/public/${BUCKET_TENANT_UPLOADS}/`;
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return decodeURIComponent(url.slice(indice + marcador.length));
}
