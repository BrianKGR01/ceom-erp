# ANCLA — Módulo Operativo: Nicho 4 (Comercio Minorista y Distribución)

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: implementa la interfaz "Módulo Operativo" (Strategy
  Pattern, `CEOM_Arquitectura.md` sección 5.1) para el Nicho 4 — pero, a
  diferencia de Nicho 1, **no tiene entidades propias**. Landed Cost y
  Orden de Compra viven en Proveedores (Módulo 8, `Compra.estado` +
  `Compra.costoAdicionalTraslado`); "Productos de compra-venta sin receta"
  ya está cubierto por `tipo_origen_producto=reventa_simple` (Módulo 2, ya
  existente antes de esta tarea). Lo único genuinamente específico de este
  nicho es la consulta de capacidad de almacenamiento.
- NO hace: no modela Insumo/Receta/Producción — este nicho no produce, solo
  revende terminado. No decide el costo unitario de una compra (eso es
  Proveedores). No es dueño de ningún dato — es 100% consulta.
- Entradas que consume: `tienePermiso()` de Identidad (gate por
  `"operativo"` × acción — mismo permiso interno que Nicho 1, el catálogo
  `modulo_permiso` no distingue nichos). `consultarCapacidad()` de
  Patrimonio (Módulo 5, solo lectura, caja negra). `consultarStockTotal-
  PorSucursal()` de Productos e Inventario (Módulo 2, nueva en esta tarea).
  `calcularPorcentajeCapacidadUsada()` de Operativo Nicho 1 (pura,
  reutilizada — no se duplica).
- Salidas que expone (`actions.ts`): `consultarCapacidadAlmacenamientoUsada`.

## Estado actual
- [x] `consultarCapacidadAlmacenamientoUsada(solicitante, tenantId,
      activoId, sucursalId)` — cruza `capacidadAlmacenamientoCantidad` del
      Activo (Patrimonio) contra el stock real de Productos e Inventario en
      esa sucursal. `sucursalId` se recibe explícito (no se deriva de
      `activo.sucursalId`, que puede ser `null` = "aplica a todo el
      negocio") — mismo criterio que `consultarStock()` de Módulo 2.
- [x] Tests: `nicho-4.test.ts` (integración contra Supabase Cloud real) —
      caso básico (capacidad definida, stock real vía
      `registrarAjusteManualStock`) y caso borde (`capacidadAlmacenamiento-
      Cantidad=null` → `porcentajeUsado=null`, mismo criterio que Nicho 1).
- [ ] No hay ninguna función de Órdenes de Compra ni Landed Cost acá — viven
      enteramente en `proveedores/actions.ts` (`registrarCompra` con
      `estado`, `recibirCompra`, `costoAdicionalTraslado`). Si en algún
      momento se decide que Nicho 4 necesita su propia vista/agregación de
      "compras pendientes de recibir", va acá, pero hoy no existe.
- [ ] Caso `activo.sucursalId = null` ("aplica a todo el negocio") no está
      resuelto — la función exige `sucursalId` explícito y no suma across
      todas las sucursales del tenant. No bloquea el caso real esperado
      (una sucursal con depósito definido), pero queda documentado.
- [x] **UI construida (2026-07-20): widget "Capacidad de Almacenamiento Usada"** en el
      Dashboard/Home de `/app` (`src/app/app/(shell)/dashboard-resumen.tsx`, junto a "Merma
      registrada") — no es una sección de navegación propia, mismo criterio ya documentado acá
      arriba ("este nicho no tiene entidades propias"). Sin gap de backend: `actions.ts` no cambió.
      El server (`obtenerCapacidadAlmacenamientoWidget()`, nuevo en
      `src/app/app/(shell)/inicio-actions.ts`) elige el primer Activo activo (no dado de baja) con
      `capacidadAlmacenamientoCantidad` definida (si ninguno la tiene, usa el primero igual, para
      mostrar "sin capacidad definida" en vez de esconder el widget) y la sucursal `esPrincipal`.
      Si el tenant no tiene ningún Activo activo, el widget no se renderiza. **No se gatea por
      `tenant.nichoId === "nicho_4"`** — mismo criterio de toda la app (`app-shell.tsx` no oculta
      nav por nicho). Verificado en navegador los 3 estados: datos reales, capacidad `null`, y sin
      Activo. Detalle completo en `docs/ui/pantallas.md` sección 12.

## Dónde está cada cosa
- Sin `schema.ts` ni `repository.ts` — este módulo no tiene tablas propias
  (mismo patrón que Financiero).
- Server actions: `src/modules/operativo/nichos/nicho-4/actions.ts`
- Tests: `src/modules/operativo/nichos/nicho-4/nicho-4.test.ts`
- Sin migración propia — las tablas que este ítem del roadmap tocó
  (`compras`) son de Proveedores, ver `proveedores/ANCLA.md`.

## Decisiones tomadas que un agente no debe revertir
- **Landed Cost y Orden de Compra NO viven acá** — decisión confirmada
  explícitamente con el usuario antes de implementar: `Modulo_08.md`
  sección 6 ya proponía extender `Compra` (Proveedores) en vez de crear
  entidades nuevas, y esa dirección se adoptó tal cual. No "traer" esa
  lógica a este módulo por consistencia con Nicho 1 — el diseño es
  intencionalmente asimétrico acá.
- **No hay simetría completa de Strategy Pattern con Nicho 1** — Nicho 1
  expone CRUD de Insumo/Receta/Producción; Nicho 4 no tiene equivalente
  porque ese dominio no existe en este nicho (no produce). Solo se
  comparte lo que es genuinamente agnóstico de nicho
  (`calcularPorcentajeCapacidadUsada`). Confirmado con el usuario antes de
  implementar — no es un olvido de la regla de `dev-practices.md` sección 3.
- **`sucursalId` explícito, no derivado del Activo** — `activos.sucursalId`
  puede ser `null`; en vez de resolver ese caso con lógica adicional
  (sumar todas las sucursales del tenant), se pasa la responsabilidad al
  caller, igual que ya hace `consultarStock()` en Módulo 2. Si el caso
  `null` se vuelve necesario, es una extensión futura, no un bug.

## Última actualización: 2026-07-20 — UI del widget "Capacidad de Almacenamiento Usada" construida en el Dashboard de `/app`, cierra el módulo por completo. Actualización previa: 2026-07-15 — implementación inicial (Fase 1, roadmap ítem #12)
