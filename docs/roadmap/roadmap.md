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

- [x] **1. Identidad, Tenants, Roles, Autorización** (`Modulo_01`) — base literal de todo lo demás: `tenant_id`, usuario, rol, motor de autorización, RLS. Backend cerrado (schema+RLS+motor de autorización+Server Actions+tests, ver `src/modules/identidad/ANCLA.md`). Pantallas de onboarding del Owner (Configurar negocio, Elegir rubro/nicho, checklist de bienvenida) construidas y verificadas end-to-end — cerró los gaps de `actualizarTenant()`/`asignarNicho()`/tracking de onboarding documentados en `docs/ui/pantallas.md`. La FK de `plan_id` ya se resolvió (ítem 2). Pantallas de gestión de colaboradores/roles/capacidades especiales quedan para más adelante (no bloquean el camino dorado, ver `docs/ui/pantallas.md`).
- [x] **2. Suscripción / Panel Administrativo — versión mínima** (`Modulo_11`) — catálogo de Planes (`src/modules/suscripcion/`) con FK real desde `tenants.plan_id`, plan "Básico" sembrado (precio placeholder en 0, pendiente de definir el valor real), `crearTenant()` de Identidad ya lo valida/defaultea. El resto del Módulo 11 (Panel Admin CEOM, Instituciones, Gateway, Código de Acceso) queda para el ítem #10 de este roadmap, ver `src/modules/suscripcion/ANCLA.md`.
- [x] **3. Patrimonio / Activos** (`Modulo_05`) — `Activo`, `Pasivo` y `Pago de Pasivo` (`src/modules/patrimonio/`), depreciación y saldo derivados bajo demanda, refinanciación con trazabilidad, gateado por el motor de autorización real (`"patrimonio"` ya está en el catálogo de permisos, a diferencia de Identidad). Pendiente documentado: `proveedor_id` sin FK (Módulo 8 no existe), y la generación automática de Gasto/Pago hacia Costos y Gastos (Módulo 4) — ver `src/modules/patrimonio/ANCLA.md`.
- [x] **4. Proveedores / Compras** (`Modulo_08`) — `Proveedor`, `Compra`, `Pago de Compra` y `Compra de Ajuste` (`src/modules/proveedores/`), costo unitario derivado, estado de pago pendiente/parcial/pagado, corrección vía Compra de Ajuste (nunca se edita la Compra). Se amplió el catálogo de permisos con `"proveedores"` (mismo criterio que `"patrimonio"`). Pendiente documentado: `item_id` sin FK (Módulos 2/6 no existen), evento `compra_registrada` sin consumidores todavía, Landed Cost/Órdenes de Compra formales quedan para Nicho 4 — ver `src/modules/proveedores/ANCLA.md`.
- [x] **5. Productos e Inventario** (`Modulo_02`) — `Categoria de Producto`, `CategoriaSugerida`, `Producto`, `Stock` (por sucursal) y `Movimiento de Stock` (`src/modules/productos/`), ledger append-only con `cantidad_actual` recalculado por transacción, permisos separados `"productos"`/`"inventario"` (ambos ya estaban en el enum de Módulo 1), `vender_sin_stock` real. Verificada la prueba de caja negra en "modo punto de venta puro", sin nicho. Pendiente documentado: `enviarProductoAOperaciones` no valida Nicho activo (Identidad no expone esa consulta todavía), `compras.item_id` (Proveedores) sigue sin FK a propósito — ver `src/modules/productos/ANCLA.md`.
- [x] **6. Módulo Operativo — Nicho 1 (Alimentos/Bebidas por Lotes)** (`Modulo_06`) — `Insumo`, `Movimiento de Insumo`, `StockInsumo`, `Receta`, `Receta-Insumo`, `Vinculación Producto-Receta`, `Producción` y `Producción de Ajuste` (`src/modules/operativo/nichos/nicho-1/`), costo promedio ponderado real, costo operativo con merma incorporada, Capacidad Operativa de solo lectura. `registrarProduccion` acredita de verdad stock/costo en Productos e Inventario (primera integración cross-módulo real vía `actions.ts`). Pendiente documentado: gap de atomicidad cruzada entre la transacción de insumos y la acreditación en Módulo 2 (aceptado a propósito), `registrarEntradaCompraInsumo` sin caller real (Proveedores no dispara `compra_registrada` todavía) — ver `src/modules/operativo/nichos/nicho-1/ANCLA.md`.
- [x] **7. Ventas + Clientes** (`Modulo_03`) — `Cliente`, `CanalVenta`, `MetodoPago`, `Evento`, `Venta` (sin `eliminado_en`), `Detalle de Venta`, `Ajuste de Venta` y `Pago de Venta` (`src/modules/ventas/`), snapshot doble real, comisión automática por canal/evento persistida en la Venta. `registrarVenta`/`registrarAjusteVenta` descuentan/devuelven stock real en Productos e Inventario. `importarVentaHistorica` (sección 6.2) implementada completa. Pendiente documentado: comisión sin consumidor real (Módulo 4 no existe), gap de atomicidad cruzada con Módulo 2 (aceptado) — ver `src/modules/ventas/ANCLA.md`.
- [x] **8. Egresos y Gastos** (`Modulo_04`) — `CategoriaGasto`, `CategoriaGastoSugerida`, `GastoRecurrente`, `Gasto` y `Pago de Gasto` (`src/modules/gastos/`), reutiliza el enum `frecuencia_cuota` de Patrimonio en vez de duplicarlo. `generarGastoCuotaPasivo`/`generarGastoComisionVenta` cierran de verdad dos pendientes cruzados: decrementan el saldo real de un Pasivo (Patrimonio) y consumen la comisión ya persistida en una Venta (Ventas). Pendiente documentado: sin scheduler real que dispare la auto-generación periódicamente, pre-carga de categorías default fuera de alcance (sin onboarding UI) — ver `src/modules/gastos/ANCLA.md`.
- [x] **9. Financiero** (`Modulo_07`) — `src/modules/financiero/`, **sin tablas propias** (solo `actions.ts`): `flujoCaja` (base caja), `estadoResultados` (base devengado), `margenPorProducto`, `costoFijoTotal` (reutiliza `consultarTotalCostosFijos` de Módulo 4 sin duplicar). Requirió agregar agregados de solo lectura por período a Ventas/Gastos/Proveedores (`consultarIngresosPeriodo`, `consultarPagosVentaEnPeriodo`, `consultarAjustesVentaEnPeriodo`, `consultarPagosGastoEnPeriodo`, `consultarTotalGastosEnPeriodo`, `consultarPagosCompraEnPeriodo`), ninguno con tablas ni comportamiento nuevo. Ver `src/modules/financiero/ANCLA.md`.
- [x] **10. Gateway de Consentimiento** — `Institución`, `Cartera Institucional`, `Solicitud de Seguimiento`, `Aprobación de Tenant`, `Código de Acceso` y `LogAccesoAdminCEOM` (`src/modules/consentimiento/`). Granularidad por `moduloVeedorEnum` (financiero/operativo/inventario_operativo, ya existente en Suscripción), no por función individual — decisión del plan, ver `src/modules/consentimiento/ANCLA.md`. `tieneConsentimiento()` es el Gateway real; `generarCodigoAcceso` valida de verdad contra el plan del tenant (cerró un gap documentado desde Módulo 2/6: se agregó `obtenerTenantPorId`/`obtenerEstadoAccesoTenant` a Identidad). Pendiente documentado: sin hook automático de `LogAccesoAdminCEOM` desde el resto de los módulos.
- [x] **11. Monitoreo Institucional + Panel Admin CEOM** (a nivel básico) — dos módulos separados por distinto consumidor: `src/modules/monitoreo-institucional/` (Institución externa, gateado por `tieneConsentimiento()`; requirió agregar `obtenerTenantParaVeedor`/`solicitanteGateway` a Identidad y `listarCarteraPropia` al Gateway) y `src/modules/panel-admin-ceom/` (`ceom_admin`, gate directo por rol, no pasa por el Gateway; requirió agregar `listarTenants` a Identidad). `panel-admin-ceom` cierra parcialmente el hook pendiente de `registrarAccesoAdminCeom` desde Módulo 10 (acotado a sus propias lecturas). Pendiente documentado: % onboarding completado y % retención de "salud agregada" (Módulo_11 sección 2.2) sin implementar — no hay datos reales todavía; varias consultas de detalle (capacidad operativa, stock de insumo, margen por producto) quedaron fuera por necesitar IDs que ningún módulo veedor-seguro expone hoy (`activoId`, `sucursalId`, `productoId`) — ver `src/modules/monitoreo-institucional/ANCLA.md` y `src/modules/panel-admin-ceom/ANCLA.md`.
- [x] **12. Módulo Operativo — Nicho 4 (Comercio Minorista y Distribución)** — sin `docs/modules/Modulo_XX.md` propio (a diferencia de los otros 10 ítems); el diseño vivía solo como "dirección de diseño, no cerrada" en `Modulo_08_proveedores_compras.md` sección 6, cerrada recién en esta tarea con el usuario. Landed Cost y Orden de Compra se implementaron **extendiendo Proveedores** (Módulo 8), no como entidades nuevas: `Compra` ganó `estado` (`pedido`/`recibido`) + `costoAdicionalTraslado`, y `recibirCompra()` dispara de verdad `registrarEntradaCompraReventa`/`registrarEntradaCompraInsumo` — cierra el pendiente de `compra_registrada` documentado desde Módulo 2/6/8. También se cerró `compras.item_id` sin FK (ahora `insumoId`/`productoId` tipados + CHECK). `src/modules/operativo/nichos/nicho-4/` quedó mínimo (solo `consultarCapacidadAlmacenamientoUsada`, sin simetría completa de Strategy Pattern con Nicho 1 porque el dominio no tiene el mismo shape — decisión confirmada, no un olvido). Ver `src/modules/proveedores/ANCLA.md` y `src/modules/operativo/nichos/nicho-4/ANCLA.md`.
- [x] **13. Simulaciones** (`Modulo_09`) — `src/modules/simulaciones/`, Simular Precio + Punto de Equilibrio fusionados bajo un mismo módulo con un único motor matemático (`unidadesParaCubrir`). Costo automático por defecto (nunca manual por defecto — lección explícita del prototipo anterior). Requirió agregar `consultarUnidadesVendidasPeriodo` a Ventas (rotación por producto/período, no existía). Comparativo multi-SKU: decisión confirmada con el usuario de que el "precio sugerido" por fila usa el margen % promedio del catálogo (el doc no lo especificaba). Ver `src/modules/simulaciones/ANCLA.md`.
- [x] **14. Reportes** (`Modulo_10`) — `src/modules/reportes/`, capa de agregación de solo lectura sobre todo lo anterior, cero tablas propias, cero lógica de negocio propia (principio rector explícito del doc). De las 8 vistas, 5 ya existían (Financiero, Gastos, y `consultarMermaPeriodo` — este último ya se había construido en Módulo 6 anticipando exactamente esta adenda); solo hicieron falta 3 funciones nuevas en Ventas (`rankingProductos`, `historicoVentas`, `margenPorCanalYProducto`). Exportación PDF/Excel (sección 6 del doc) queda explícitamente fuera de esta tarea — depende de UI, que todavía no existe. Ver `src/modules/reportes/ANCLA.md`.

> **Nota:** este orden es el punto de partida validado en `CEOM_Arquitectura.md`. Si al construir un módulo aparece una dependencia no prevista, se ajusta el orden acá mismo y se anota por qué, para no perder el razonamiento.

**Criterio de salida de la Fase 1:** los 14 puntos anteriores en `[x]`, con sus tests pasando y sus `ANCLA.md` al día. **Estado real (2026-07-16): 14 de 14 en `[x]`** — backend + tests completos en los 14, y el ítem #1 (Identidad) cerró también sus pantallas de onboarding (ver arriba). **Fase 1 cerrada.**

**Construcción de UI (no es una fase numerada aparte — vive dentro/después de esta Fase 1):** el inventario completo de pantallas, con seguimiento de cuáles están construidas y el orden sugerido para las que faltan, vive en `docs/ui/pantallas.md`. Resumen: el "camino dorado" (Login → Onboarding → Catálogo → Punto de Venta → Dashboard) está 4/5 construido; falta el Dashboard/Resumen Ejecutivo (Módulo 14) para cerrarlo. Las ~97 pantallas/modales restantes (de 116 trackeados) se construyen por tandas, cada una con referencia visual del usuario antes de implementar — ver la sección "Próxima tanda sugerida" de ese documento.

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