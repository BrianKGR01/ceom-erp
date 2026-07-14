# CEOM-ERP — Roadmap

> **Qué es este documento:** el plan de construcción, de principio a fin, con casillas para ir marcando avance. Es un documento **vivo** — se actualiza a medida que se cierran fases, no se reescribe desde cero. La razón de cada decisión (por qué este stack, por qué este orden de módulos) vive en `docs/architecture/CEOM_Arquitectura.md`; acá solo está el plan de ejecución.
>
> Convención: `[ ]` pendiente · `[~]` en curso · `[x]` cerrado y verificado.

---

## Fase 0 — Setup del repositorio

- [x] Repo creado en GitHub, monorepo único (Next.js full-stack).
- [x] `AGENTS.md` en la raíz con las reglas globales.
- [ ] `CLAUDE.md` como symlink a `AGENTS.md` (`ln -s AGENTS.md CLAUDE.md`).
- [x] Estructura de `docs/` con `modules/`, `architecture/`, `dev-practices/` (pendiente de redactar), `production/` (pendiente), `roadmap/` (este archivo).
- [x] Proyecto Next.js inicializado (App Router, TypeScript) con `pnpm`.
- [x] Proyecto Supabase Cloud creado (entorno de desarrollo).
- [x] Drizzle configurado contra ese proyecto (`drizzle.config.ts`, conexión, primer `drizzle-kit generate` de prueba).
- [x] Vitest + Testing Library configurados, un test trivial corriendo en CI.
- [x] Playwright configurado, un test e2e trivial (ej. "la página de login carga").
- [x] GitHub Actions: workflow mínimo que corre `pnpm typecheck && pnpm lint && pnpm test` en cada PR.
- [ ] Proyecto conectado a Vercel (deploy de preview automático por PR) — pendiente: conexión manual desde el dashboard de Vercel (la hace el dueño del proyecto, no un agente).
- [x] `docs/dev-practices/` redactado (siguiente documento después de este roadmap).

**Criterio de salida de la Fase 0:** un PR de prueba (ej. "página de inicio en blanco") pasa CI, se previsualiza en Vercel, y un agente puede levantar el entorno local siguiendo solo `AGENTS.md` sin preguntas adicionales.

---

## Fase 1 — Desarrollo módulo por módulo (entorno de desarrollo: Supabase Cloud + Vercel)

Orden de construcción, basado en la matriz de dependencias de `CEOM_Arquitectura.md` (sección 7). Cada módulo se da por cerrado cuando pasa su "prueba de caja negra" ya definida en su `docs/modules/Modulo_XX.md`, y su `ANCLA.md` queda actualizado.

- [ ] **1. Identidad, Tenants, Roles, Autorización** (`Modulo_01`) — base literal de todo lo demás: `tenant_id`, usuario, rol, motor de autorización, RLS.
- [ ] **2. Suscripción / Panel Administrativo — versión mínima** (`Modulo_11`) — solo lo que el Módulo 1 ya referencia: `plan_id`, `estado_suscripcion`. El resto del panel administrativo puede esperar.
- [ ] **3. Patrimonio / Activos** (`Modulo_05`) — no depende de ningún otro módulo de negocio.
- [ ] **4. Proveedores / Compras** (`Modulo_08`) — tampoco depende de otro módulo de negocio. Construir ya con la jerarquía cerrada: Proveedores = directorio, nunca compite con una Orden de Compra.
- [ ] **5. Productos e Inventario** (`Modulo_02`) — depende de Proveedores (reventa directa). Verificar la prueba de caja negra en "modo punto de venta puro", sin nicho.
- [ ] **6. Módulo Operativo — Nicho 1 (Alimentos/Bebidas por Lotes)** (`Modulo_06`) — primer nicho del MVP, prioridad más alta (caso SanttiCampo).
- [ ] **7. Ventas + Clientes** (`Modulo_03`) — depende de Productos e Inventario. Incluye snapshot doble y Ajuste de Venta.
- [ ] **8. Egresos y Gastos** (`Modulo_04`) — depende opcionalmente de Proveedores.
- [ ] **9. Financiero** (`Modulo_07`) — depende de Ventas, Gastos y Proveedores/Compras, todos ya existentes en este punto.
- [ ] **10. Gateway de Consentimiento** — con el nivel de granularidad ya cerrado (por función expuesta, `CEOM_Arquitectura.md` sección 8.1).
- [ ] **11. Monitoreo Institucional + Panel Admin CEOM** (a nivel básico) — depende del Gateway.
- [ ] **12. Módulo Operativo — Nicho 4 (Comercio Minorista y Distribución)** (`Modulo_06`, segunda implementación de la interfaz "Operaciones") — incluye la lógica de Orden de Compra + landed cost.
- [ ] **13. Simulaciones** (`Modulo_09`).
- [ ] **14. Reportes** (`Modulo_10`) — capa de agregación de solo lectura sobre todo lo anterior; por diseño, va al final.

> **Nota:** este orden es el punto de partida validado en `CEOM_Arquitectura.md`. Si al construir un módulo aparece una dependencia no prevista, se ajusta el orden acá mismo y se anota por qué, para no perder el razonamiento.

**Criterio de salida de la Fase 1:** los 14 puntos anteriores en `[x]`, con sus tests pasando y sus `ANCLA.md` al día.

---

## Fase 2 — Integración y pruebas end-to-end

- [ ] Flujo completo Nicho 1: alta de tenant → carga de insumos → producción de un lote → venta → impacto en Financiero, verificado de punta a punta (no solo por módulo aislado).
- [ ] Flujo completo Nicho 4: alta de tenant → orden de compra → landed cost → venta → impacto en Financiero.
- [ ] Flujo completo Modo Básico: alta de tenant sin nicho → carga manual de producto → venta → Financiero.
- [ ] Flujo de consentimiento: institución solicita seguimiento → tenant aprueba función por función → el panel institucional muestra solo lo aprobado (con mocks del resto en `false`, para probar que la privacidad "por función" se respeta de verdad).
- [ ] Suite de Playwright cubriendo estos 4 flujos como tests e2e reales (no solo unitarios con mocks).
- [ ] Carga de datos de referencia (seed) representativa de un tenant real, para pruebas manuales y demos.

**Criterio de salida de la Fase 2:** los 4 flujos completos corren en CI sin intervención manual.

---

## Fase 3 — Endurecimiento (seguridad, backups, observabilidad)

- [ ] Auditoría de políticas RLS: cada tabla de negocio tiene su política y un test que confirma que un tenant no puede leer datos de otro.
- [ ] Revisión de permisos especiales (`vender_sin_stock`, `importar_historico`, `gestionar_eventos`) — confirmar que están bloqueados por defecto y auditados.
- [ ] Manejo de errores y logging estructurado en Server Actions / Route Handlers.
- [ ] Definir estrategia de backups (frecuencia, retención, dónde se guardan) — se detalla en `docs/production/` cuando se redacte.
- [ ] Rate limiting / protección básica en endpoints públicos (login, invitación).
- [ ] Revisión de variables de entorno y secretos (nada de claves de servicio en el cliente).
- [ ] Pull request de "auditoría de seguridad" revisado explícitamente por vos (no solo por el agente), antes de avanzar a producción.

**Criterio de salida de la Fase 3:** checklist de seguridad completo y revisado por vos, no solo generado.

---

## Fase 4 — Provisión del VPS y self-host de Supabase

Detalle completo en `docs/production/` (a redactar). Acá solo el resumen de alto nivel:

- [ ] VPS Contabo contratado (mínimo recomendado: 4 vCPU / 8 GB RAM para correr Supabase self-hosted + frontend).
- [ ] Docker + Docker Compose instalados.
- [ ] Supabase self-hosted desplegado vía Docker en el VPS.
- [ ] Traefik configurado con TLS (Let's Encrypt) para el dominio de Supabase self-hosted y el del frontend.
- [ ] Backups automatizados configurados **antes** de mover cualquier dato real.
- [ ] Frontend Next.js desplegado en el mismo VPS (o confirmar si se mantiene en Vercel para producción — decisión a revisar en `docs/production/`).

**Criterio de salida de la Fase 4:** un Supabase self-hosted vacío, funcionando, con TLS y backups verificados — sin datos reales todavía.

---

## Fase 5 — Migración de datos y corte (cutover)

- [ ] `pg_dump` del esquema y datos desde Supabase Cloud.
- [ ] Migración del schema `auth` con `JWT_SECRET` coincidente entre ambos entornos.
- [ ] Migración de Storage (los archivos no viajan con `pg_dump`, se migran aparte por bucket).
- [ ] Verificación de conteos de filas por tabla, post-migración.
- [ ] Ventana de corte planificada (mantenimiento breve) y comunicada.
- [ ] DNS / variables de entorno apuntando al VPS.
- [ ] Rollback plan explícito por si el corte falla (volver a Supabase Cloud sin pérdida de datos).

**Criterio de salida de la Fase 5:** CEOM-ERP corriendo en producción sobre el VPS, con el entorno de Supabase Cloud + Vercel apagado o degradado a solo staging.

---

## Fase 6 — Operación

- [ ] Monitoreo básico (¿están los contenedores `healthy`? ¿responde el endpoint?).
- [ ] Rutina de backups verificada periódicamente (no solo configurada — probada con una restauración real).
- [ ] Proceso de actualización de versión de Supabase self-hosted documentado.
- [ ] Canal para reportar incidentes / bugs de producción.

---

## Cómo se actualiza este documento

- Marcar casillas a medida que se cierran, no al final de la fase.
- Si el orden de un módulo cambia respecto a lo planeado, anotarlo en la Fase 1 con una línea de motivo — no borrar el original silenciosamente.
- Cuando se redacten `docs/dev-practices/` y `docs/production/`, este roadmap pasa a referenciarlos en vez de repetir su contenido.