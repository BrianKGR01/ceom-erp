-- Custom SQL migration file, put your code below! --

-- Politicas RLS del bucket "tenant-uploads" (creado por
-- scripts/setup-storage.ts, no por esta migracion — Drizzle no modela
-- buckets de Storage, solo lo que vive en storage.objects). Mismo criterio
-- de aislamiento por tenant que el resto de la app (AGENTS.md regla 6):
-- cada objeto vive bajo una carpeta cuyo primer segmento de path es el
-- tenant_id, y storage.foldername() (helper nativo de Supabase Storage)
-- extrae ese segmento para compararlo contra current_tenant_id() — misma
-- funcion ya usada por crudPolicy() en las tablas de negocio (migracion
-- 0003), reutilizada tal cual, no una copia.
--
-- El bucket es publico para LECTURA anonima (logos/imagenes de producto no
-- son datos sensibles, y renderizarlos como <img src> no debe requerir una
-- URL firmada que expira) — estas policies gobiernan escritura
-- (INSERT/UPDATE/DELETE), que sí requiere estar autenticado y pertenecer al
-- tenant dueño de la carpeta. RLS ya viene habilitado por Supabase en
-- storage.objects por defecto en todo proyecto — no hace falta activarlo acá.

create policy "tenant_uploads_insert_own_tenant"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tenant-uploads'
  and (storage.foldername(name))[1] = (select current_tenant_id())::text
);

create policy "tenant_uploads_select_own_tenant"
on storage.objects for select
to authenticated
using (
  bucket_id = 'tenant-uploads'
  and (storage.foldername(name))[1] = (select current_tenant_id())::text
);

create policy "tenant_uploads_update_own_tenant"
on storage.objects for update
to authenticated
using (
  bucket_id = 'tenant-uploads'
  and (storage.foldername(name))[1] = (select current_tenant_id())::text
)
with check (
  bucket_id = 'tenant-uploads'
  and (storage.foldername(name))[1] = (select current_tenant_id())::text
);

create policy "tenant_uploads_delete_own_tenant"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tenant-uploads'
  and (storage.foldername(name))[1] = (select current_tenant_id())::text
);
