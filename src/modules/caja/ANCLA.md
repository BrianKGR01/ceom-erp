# ANCLA — Módulo: Caja y turnos

> Roadmap Cafiatto, Fase 4 (`docs/roadmap/roadmap-cafiatto.md`). Especificación funcional: `cafiato/CEOM_Flujo_Operativo_Cafiatto.pdf` §15-20.
> **Módulo del Core, agnóstico al rubro.** Apagado por defecto: sin fila en `configuracion_caja` el negocio no usa caja y nada se exige.

## Contrato (`actions.ts`)
- **Conceptos:** Caja = punto de cobro. Turno = período en que alguien responde por ella (varios vendedores pueden vender dentro del mismo turno).
  Venta = transacción dentro del turno. Una sola caja abierta por caja (índice único parcial).
- **Fórmula única del cajón:** `efectivo esperado = fondo inicial + efectivo cobrado + entradas − salidas` (`calcularEfectivoEsperado`).
  "Efectivo cobrado" = cobros del turno con métodos de pago marcados `es_efectivo`.
- `configurarCaja` activa/apaga (crea una "Caja Principal" por sucursal). `obtenerConfiguracionCaja`, `estadoDeCajas`.
- `turnoParaOperar(solicitante, tenantId, sucursalId)` → `{ turnoId | null }`: caja apagada → null; turno abierto → su id; sin turno y `exigir_turno` → error
  "Para vender o cobrar, primero abrí el turno de la caja.". **Lo llama la capa de acciones de Ventas** (`ventas/actions.ts` de la ruta), no el módulo Ventas.
- `abrirTurno`, `registrarMovimientoCaja` (entrada/salida con motivo; una salida mayor al esperado se rechaza), `cerrarTurno`, `listarTurnos`, `fichaTurno`.
- **Cierre:** guarda una FOTO (ventas, totales por medio, esperado, contado, diferencia, observaciones) y el turno cerrado se lee de esa foto, no se recalcula. Una diferencia **no
  modifica las ventas**: queda registrada, y exige una observación que la explique. El cierre es una transición única (`UPDATE ... WHERE estado='abierto'`).
- Movimientos de caja: **append-only** (regla 3); un error se corrige con otro movimiento contrario.

## Permisos (sin módulo propio: el enum `modulo_permiso` se reutiliza en muchos sitios)
`ventas:crear` — abrir/cerrar turno, movimientos, ver el turno abierto. `ventas:anular_ajustar` — activar/configurar, historial, diferencias, ver turnos ajenos.
`fichaTurno`: quien lo abrió o un supervisor.

## Dependencias (sin ciclos)
Caja → Ventas (`consultarCobrosDeTurno`, `listarVentasDeTurno`) e Identidad. **Ventas no importa Caja**: guarda `ventas.turno_id` y `pagos_venta.turno_id` (sin FK) que le pasa la capa de acciones.
El turno de un cobro es el turno donde SE COBRÓ, que puede no ser el de la venta (venta fiada).

## Tablas (migración 0058, RLS en el mismo archivo)
`configuracion_caja`, `cajas`, `turnos_caja` (numeración correlativa por negocio con advisory lock), `movimientos_caja`. Migración 0057: `ventas.turno_id`, `pagos_venta.turno_id`,
`metodos_pago.es_efectivo` (+ `UPDATE` que marca como efectivo los métodos llamados "Efectivo"/"Cash").

## UI
`/app/caja` (activar, abrir, movimientos, cerrar con diferencia en vivo), `/app/caja/historial` (filtros abierto/cerrado/con-sin diferencia), `/app/caja/turnos/[id]` (detalle y "ver ventas del turno").
Vender muestra el turno o avisa que falta abrirlo. Métodos de pago: casilla "Es efectivo".

## Límites conocidos
- Una caja por sucursal en la práctica (si hubiera varias abiertas, Vender usa la más antigua). Las devoluciones en efectivo de un ajuste de venta no descuentan solas: se cargan como "salida".
- El total vendido es el de las líneas, sin restar ajustes (H-26). Los cobros, que son lo que importa al cajón, son exactos.
- No hay todavía "excepción administrativa" para vender sin turno (se apaga con `exigir_turno`).

## Última actualización: 2026-10-16 — Fase 4 creada. Tests: `caja.test.ts`, `caja-ventas.test.ts`, `pos-cliente.test.tsx`.
