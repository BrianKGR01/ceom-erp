# AGENTS.md — CEOM-ERP

## Qué es esto
ERP modular para emprendimientos: un Core financiero/comercial agnóstico al rubro +
Módulos Operativos Conmutables por nicho (uno activo por tenant). El diseño completo
—qué hace cada módulo, sus entradas/salidas, sus reglas de negocio— vive en
`docs/modules/Modulo_01...11.md`. El porqué de la arquitectura, los patrones aplicados
y la matriz de dependencias viven en `docs/architecture/CEOM_Arquitectura.md`.
**Lee el módulo y la arquitectura antes de tocar código por primera vez — no lo
reconstruyas por inferencia.**

## Stack (no lo cambies sin decirlo explícitamente)
- Next.js (App Router) + TypeScript, Server Actions / Route Handlers.
- Base de datos: PostgreSQL vía Supabase. Auth: Supabase Auth (GoTrue). Storage:
  Supabase Storage (backend Backblaze B2).
- Capa de acceso a datos: **Drizzle ORM + Drizzle Kit**. `supabase-js` se usa
  únicamente para Auth, Storage y Realtime — nunca para queries de negocio.
- Gestor de paquetes: **pnpm** — nunca `npm` ni `yarn`.
- Testing: **Vitest** + Testing Library (unitarios/integración), **Playwright** (e2e).
- Reverse proxy en producción: Traefik. CI: GitHub Actions.
- Detalle completo de cada decisión: `docs/dev-practices/`.

## Comandos
- Instalar: `pnpm install`
- Dev: `pnpm dev`
- Tests unitarios: `pnpm test` — deben pasar antes de dar una tarea por terminada
- Tests e2e: `pnpm test:e2e`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Generar migración: `pnpm drizzle-kit generate`
- Aplicar migración (local/dev): `pnpm drizzle-kit migrate`
- Estudio de datos (debug visual): `pnpm drizzle-kit studio`

*(Si el repo aún no tiene alguno de estos scripts configurado en `package.json`,
créalo siguiendo esta convención de nombres — no inventes otros.)*

## Reglas de arquitectura (no negociables — ver justificación completa en
docs/architecture/CEOM_Arquitectura.md)

1. **El Core nunca contiene lógica de un rubro/nicho.** Esa lógica vive solo en
   `src/modules/operativo/nichos/<nicho>/`. Si estás tocando un módulo del Core
   (Identidad, Productos, Ventas, Financiero, etc.) y la tarea pide algo específico
   de un rubro, detente y pregunta — probablemente pertenece a un nicho, no al Core.
2. **Cada módulo es una caja negra.** Solo se comunica con otros módulos a través de
   las funciones ya documentadas como "salidas que expone" en su
   `docs/modules/Modulo_XX.md` y en su `ANCLA.md`. Nunca importar el repository o las
   tablas de otro módulo directamente — siempre a través de su capa pública.
3. **Ledger append-only.** Stock, Ventas y Financiero nunca editan un saldo con
   `UPDATE` — insertan un movimiento nuevo y el saldo se deriva. Si vas a "corregir"
   un valor, la corrección es un nuevo registro con motivo, nunca una edición directa.
4. **Snapshot en Ventas.** Toda línea de venta congela `precio_venta_snapshot` y
   `costo_unitario_snapshot` en el momento de la transacción. No recalcules ventas
   pasadas cuando cambie el precio o costo vigente de un producto.
5. **Soft delete siempre** (`eliminado_en`). Nunca `DELETE` físico salvo que se pida
   explícitamente.
6. **Multi-tenant por RLS + `tenant_id`.** Toda tabla de negocio lleva `tenant_id` y
   toda query lo filtra, reforzado con políticas RLS declaradas junto al esquema de
   Drizzle (`crudPolicy()`) — nunca confíes solo en el filtro de la aplicación.
7. **El Gateway de Consentimiento es el único punto de autorización** para que un
   tercero (institución, Panel Admin CEOM) vea datos de un tenant. Ningún módulo
   implementa su propia lógica de "¿tengo permiso?" — todos preguntan al Gateway,
   que autoriza por función expuesta (ver `docs/architecture/CEOM_Arquitectura.md`,
   sección 8.1), no por módulo completo.
8. **Antes de escribir código en un módulo**, lee su `docs/modules/Modulo_XX.md` y su
   `src/modules/<módulo>/ANCLA.md` si ya existe.

## Qué NO hacer nunca
- No tocar migraciones ya aplicadas en `drizzle/migrations/` — solo generar nuevas.
- No introducir una librería nueva sin decirlo antes de instalarla.
- No modificar el contrato de un módulo (sus entradas/salidas documentadas) sin
  actualizar también su `ANCLA.md` y avisarlo explícitamente en el resumen de la tarea.
- No escribir una política de RLS "para después" — si la tabla maneja datos de un
  tenant, la política se escribe en el mismo cambio que crea la tabla.

## Definición de "terminado"
- Los tests del módulo pasan (`pnpm test`), y typecheck/lint también.
- `ANCLA.md` del módulo actualizado (estado, dónde está cada cosa, última fecha).
- Si se tocó el contrato de un módulo, se revisó el impacto contra la matriz de
  dependencias en `docs/architecture/CEOM_Arquitectura.md`, sección 7.

## Mapa de documentación
| Necesitás                                                       | Vas a                                    |
| -----------------------------------------------------------------| ------------------------------------------|
| Qué hace un módulo, sus reglas de negocio                       | `docs/modules/Modulo_XX.md`              |
| Por qué está diseñado así, patrones, dependencias               | `docs/architecture/CEOM_Arquitectura.md` |
| Cómo trabajar (flujo con agentes, convenciones de código)       | `docs/dev-practices/`                    |
| Cómo self-hostear / desplegar a producción                      | `docs/production/`                       |
| Orden de construcción de los módulos                            | `docs/roadmap/`                          |
| Estado actual y contrato resumido de un módulo ya en desarrollo | `src/modules/<módulo>/ANCLA.md`          |