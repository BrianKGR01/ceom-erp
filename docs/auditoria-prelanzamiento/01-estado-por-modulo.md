# Estado por módulo — docs vs. código (2026-07-29)

> Parte de la [auditoría de prelanzamiento, 2ª edición](README.md). Cada módulo se comparó contra
> su `docs/modules/Modulo_XX.md`, su `ANCLA.md` y el código real de `src/modules/`. Convención de
> estados: **✅ cumple** (lo documentado está implementado), **🟡 parcial**, **🔴 abierto** (brecha
> conocida sin cerrar), **🆕 nuevo** (defecto que ningún doc registraba hasta hoy).
> Los H-XX refieren a `docs/manual/hallazgos.md`; los DA-XX a `docs/deuda-aplazada.md`;
> los G-XX/X-XX/D-N a [`antiguo/08-instituciones-punta-a-punta.md`](antiguo/08-instituciones-punta-a-punta.md).

---

## 1. Identidad + Suscripción (Módulos 1 y 11-planes) — ~87%

**Lo verificado cerrado:** H-02 completo (ABM de sucursales con tope `planes.maxSucursales`
server-side, freeze atómico en downgrade con la Principal protegida, consolidación sin huérfanos —
`identidad/actions.ts:523-631`, `repository.ts:292-342`, tests dedicados). Motor de autorización
conforme al spec (orden Gateway→ceom_admin→cross-tenant→estado→Owner→matriz, capacidades con
bypass de Owner). RLS declarada en las 7 tablas + `planes`. Onboarding con nicho de un solo
sentido. El layout de `/admin` ahora sí gatea `ceom_admin` (mejora que `AUDITORIA-AUTORIZACION.md`
§3 todavía niega).

| Hallazgo | Estado | Evidencia |
|---|---|---|
| H-33 — designar Owner por `ceom_admin` no existe; único 🔴 real. Agravante verificado: en tenant vencido ni el Owner presente puede transferir (`requireEscrituraHabilitada` en `transferirOwner`) | 🔴 crítico | `identidad/actions.ts:974-987`; diseño aprobado sin implementar en `docs/decisiones/recuperacion-de-acceso.md` §5-B/§11.6 |
| H-45/O5 — la suscripción no vence sola ni avisa; `activa` con fecha de pago vencida sigue operando; rutina manual sin documentar | 🔴 alta | `identidad/actions.ts:61,643-663`; sin `vercel.json`, sin cron |
| 🆕 Config de plan **letra muerta**: `/admin/planes` edita gracia e invitación por plan, pero `calcularEstadoAcceso` usa siempre la constante 3 y nadie lee `duracionInvitacionDias` (los 9 call sites verificados). El manual del equipo CEOM afirma lo contrario | 🔴 alta | `identidad/actions.ts:53-72`, `constants.ts:22`; `suscripcion/schema.ts:49-54` |
| H-35 — cero roles por defecto (grilla vacía al alta); bloquea además el filtrado por sucursal (`usuarios.sucursalId` deliberadamente inactivo, correcto) | 🔴 media | `identidad/repository.ts:231-268`; decisión D3 pendiente |
| H-14 — alta de otro `ceom_admin` solo por script | 🔴 media | solo `scripts/seed-admin.ts`; `/admin` sin pantalla de equipo |
| D1 — precio del plan Básico sigue en 0 (verificado en la base viva por SQL) | 🔴 media | migración `0007`; `suscripcion/ANCLA.md:42-45` |
| 🆕 Deriva documental: `obtenerTenantParaVeedor` cambió de contrato (cobertura por sucursal, X-02/D-9) sin actualizar el ANCLA; `Modulo_01`/`Modulo_11` aún describen `incluye_sucursales` (ya no existe); el ANCLA de Suscripción dice que `modulosVeedorPermitidos` "nadie lo consume" (falso: es el atributo con más efecto del sistema) | 🟡 media | `identidad/actions.ts:200-237` vs `ANCLA.md:76-80` |
| 🆕 `crearRolPersonalizado`/`actualizarPermisosRol` aceptan filas `modulo='identidad'` (invariante documentada sin forzar; inerte hoy) | 🆕 baja | `identidad/actions.ts:1071-1113` vs `schema.ts:66-77` |

## 2. Productos e Inventario + Ventas (Módulos 2 y 3) — ~82%

**Lo verificado cerrado:** el backend más fiel a su doc de todo el sistema. Ledger de stock
genuinamente append-only (saldo recalculado en la misma transacción, transferencias en par
atómico). Snapshot doble congelado antes de crear la Venta. H-15 cerrado de punta a punta
(columna + 2 escritores + 3 agregados + ranking + aviso en POS + guard por AST). H-24 cerrado
(comisión → gasto real `variable_no_productivo` referenciado a la venta). H-02 aplicado (sucursal
validada y congelada rechazada **antes** de crear la Venta). Importación histórica conforme a §6.2.
RLS en las 13 tablas.

| Hallazgo | Estado | Evidencia |
|---|---|---|
| H-26 — un ajuste de venta no cambia total ni estado de cobro: venta anulada queda "pendiente de cobro" para siempre (verificado adversarialmente; Proveedores ya resolvió el mismo problema con H-31 y Ventas no tiene equivalente) | 🔴 alta | `ventas/repository.ts:197-203,243-260,285-307`; `ficha-cliente.tsx:101,296-302` |
| H-37 — el POS no muestra stock y los `avisosStock` que la ruta devuelve nadie los consume (verificado: siempre fue así y está registrado; no es agravación) | 🔴 media | `pos-cliente.tsx:193-197`; `ventas/actions.ts` (ruta) `:66-75` |
| 🆕 La regla "no vender sin stock" **no bloquea la Venta**: se confirma con snapshot, deuda y comisión aunque el descuento de stock rebote (sin permiso de inventario o sin capacidad) — combinado con el descarte de avisos, es invisible | 🟡 alta | `ventas/actions.ts:543-574`; `productos/actions.ts:608-631` |
| 🆕 `registrarVenta` no valida evento/canal/cliente contra el tenant: acepta evento **cerrado** (regla §4.1 solo en UI) y **escribe** `ultima_compra_en` de un cliente de otro tenant (escritura cross-tenant real; M1 solo registraba la lectura de comisión) | 🆕 media | `ventas/actions.ts:531-541,470-474`; `repository.ts:221-233` |
| 🆕 El gasto de comisión se fecha en **día UTC**: una venta de POS de 20:00–24:00 (Bolivia) cae al día siguiente y puede cruzar de mes — familia H-49, en escritura | 🆕 media | `gastos/actions.ts:517-520` |
| H-28/DA-07 — stock mínimo sin UI de carga (backend completo) | 🔴 media | `productos/actions.ts:382-400`, cero callers en `src/app` |
| H-25/D4 — costo de reventa se pisa con la última compra; política sin declarar | 🔴 media | `productos/repository.ts:342-345` |
| 🔴 Pre-carga de canales desde el onboarding sin cablear (la justificación "no hay onboarding" venció hace tandas) | 🔴 media | `identidad/schema.ts:109`; `ventas/ANCLA.md:137-139` |
| 🆕 Menores: resultado de devolución de stock de un ajuste descartado por la ruta; `consolidarStockDeSucursal` no valida sucursal destino del tenant (solo `ceom_admin`); `salida_merma` es enum inalcanzable con etiqueta muerta; M2 (`importarVentaHistorica` sin validar FKs anidados, ni siquiera sucursal congelada) | 🆕/🔴 baja-media | `ventas/actions.ts:696-707`; `productos/actions.ts:719-743`; `ventas/actions.ts:866-877` |

## 3. Patrimonio + Gastos + Financiero (Módulos 5, 4 y 7) — ~88%

**Lo verificado cerrado:** H-27 completo (cuota de pasivo → gasto real, flecha invertida
Patrimonio→Gastos, categoría autoprovisionada, test de valor exacto). Guard anti-código-muerto:
cada `generarGasto*` exige llamador de producción o el test falla. H-15 en Financiero
(`ingresosSinCostoConocido`, margen `null` en vez de 100%). D-10 (`MARCADORES_ESTADO_RESULTADOS`
exportado por el módulo dueño, proyección tipada). H-49 con la exclusión deliberada de Gastos
documentada. Depreciación, saldo derivado, refinanciación con trazabilidad: conformes al doc.

| Hallazgo | Estado | Evidencia |
|---|---|---|
| DA-04 — **sin scheduler**: `GastoRecurrente` y cuota periódica nunca se disparan solos (las funciones existen; falta solo el cron — y Vercel ya está conectado). Es una sola pieza que resuelve H-10, DA-04 y la transición de H-45 | 🔴 alta | sin `vercel.json` ni `src/app/api`; botón manual en `recurrentes-cliente.tsx:263` |
| 🆕 `flujoCaja` cuenta pagos de gastos **soft-eliminados** (caja y resultado divergen en silencio: `sumarPagosGastoPeriodo` no filtra `eliminado_en`, su gemela sí) | 🆕 media | `gastos/repository.ts:314-334` vs `:339-359` |
| 🆕 `registrarPagoPasivo` no valida a nivel módulo monto>0, sobrepago ni estado del pasivo (solo la UI y el zod de ruta; la lección de H-30 se aplicó en Gastos y acá no) — importa porque el scheduler futuro llamará este contrato | 🆕 media | `patrimonio/actions.ts:505-539` |
| Los 5 pagos históricos de pasivo (Bs 10.700) siguen fuera del resultado — decisión del dueño pendiente, documentada | 🔴 media | `antiguo/06-costo-ausente-y-cuota-de-pasivo.md` §A.7 |
| Backstop RLS: Gastos sigue con `db` crudo (planificado, no olvido) | 🟡 media | `gastos/repository.ts:2`; `contexto.test.ts:22` |
| Docs de módulo desactualizados: `Modulo_07` sin el 5º término (H-31) ni marcadores H-15; `Modulo_04` sin categorías autoprovisionadas ni gates cruzados (los ANCLA sí están al día) | 🟡 baja | `Modulo_07_financiero.md:39-56` vs `financiero/actions.ts:57-158` |

## 4. Proveedores + Nicho 1 + Nicho 4 (Módulos 8 y 6) — ~85%

**Lo verificado cerrado:** H-31 de punta a punta (monto efectivo, reversión parcial con
`cantidad_devuelta`, costo extra al resultado solo en dirección de costo, RLS de Gateway en
`compras_ajuste`). Landed cost y orden de compra (estado `pedido`/`recibido`) implementados según
la dirección de diseño. Freeze de sucursal completo con tests (incluido el caso compra-pedido
creada antes del congelamiento). Producción con costo real + merma y acreditación cross-módulo
real. Nicho 4 conforme a su ANCLA (asimetría deliberada).

| Hallazgo | Estado | Evidencia |
|---|---|---|
| DA-24/C4 — **la UI descarta `entradaStock`**: una compra puede quedar "recibido" con la entrada de stock fallada sin ninguna señal. Disparador realista verificado: un usuario con permisos solo-proveedores lo produce en **cada** compra (la entrada exige permiso `operativo:crear` o `inventario:crear`) | 🔴 alta | ruta `proveedores/actions.ts:108-110,125-128` descarta lo que el módulo expone en `:422,457-463` |
| 🆕 Mismo patrón en producción: `acreditacionOk` se devuelve y el cliente lo ignora — insumos descontados, producto sin acreditar, usuario ve éxito | 🆕 media | ruta `produccion/actions.ts:267`; `nueva-produccion-cliente.tsx:134-139` |
| 🆕 Costo promedio ponderado de insumos pondera con stock de **una sola sucursal** contra un costo global — distorsión real ahora que multi-sucursal existe (H-02) | 🆕 media | `nicho-1/repository.ts:197-238` |
| H-34 — capacidad de producción: los 2 campos que la fórmula exige (`disponibilidadHorariaSemanal`, `tiempoEstimadoPorCicloMinutos`) no existen en ninguna capa de UI; la pantalla sigue inservible por interfaz | 🔴 media | `activo-form.tsx` sin campos; `nicho-1/actions.ts:64-80` |
| RLS: Nicho 1 sin policies de Gateway ni migración a `comoUsuario()` — riesgo latente documentado del plan (3 pestañas del portal dependen de él) | 🔴 media | solo `crudPolicy` en `nicho-1/schema.ts`; `PLAN-RLS-BACKSTOP.md` |
| 🆕 Menores: ficha de proveedor suma montos originales ignorando ajustes (H-31 no llegó ahí); vencimiento de insumo se calcula desde "ahora" en día UTC (doc dice `fecha_compra`); movimientos `salida_produccion` sin `referencia_id`; DA-10 (índice único de vinculaciones) con la condición del ANCLA ya vencida; comentario obsoleto "sin caller real"; `Modulo_08.md` declara "fuera de alcance" lo que está implementado hace semanas | 🆕 baja | `proveedores/repository.ts:55-72`; `nicho-1/actions.ts:278-282`; `nicho-1/repository.ts:441-453` |

## 5. Consentimiento + Monitoreo Institucional + Panel Admin CEOM — ~70%

**Lo verificado cerrado (tandas 3.1, 3.2, 3.3a, 3.3b — función por función):** canje autenticado
H-42 con transacción y `UPDATE` condicional (G-02/G-03), TTL 30 días (D-7), límite de 10
intentos/15 min con tabla `intentos_canje` (G-04), tercer estado `modulo_no_aplica` (G-14), error
por pestaña (G-15), proyección verificada por tipos (X-03/D-10), marcador H-15 al portal (X-01),
cobertura por sucursal declarada (X-02/D-9), y registro de acceso institucional D-1 completo
(falla cerrado, visible para el negocio en "Quién miró" y para la propia institución). El test
dorado SQL↔TS de vigencia (D-5) existe.

| Hallazgo | Estado | Evidencia |
|---|---|---|
| 🆕 **El Panel Admin CEOM re-proyecta a mano y descarta el marcador H-15** — el gemelo de X-01/X-03 en `/admin`, en violación de las reglas #9/#10 de `CLAUDE.md` (que lo nombran explícitamente como tercero). Además conserva el patrón G-15: cualquier error deja la pestaña en "Cargando..." eterno, y un nicho_4 muestra "Sin producciones" en vez de "no aplica" (G-14) | 🆕 alta | `panel-admin-ceom/actions.ts:127-156`; `admin/tenants/[tenantId]/ficha-cliente.tsx:602-626` |
| Tanda 3.4 abierta: revocar no toca la cartera (G-05/D-3 decidida, no implementada), `fecha_fin` decorativa (G-06), borrado de institución a medio morir (G-07/D-6 — no revoca aprobaciones ni libera el correo) | 🔴 alta | `consentimiento/actions.ts:400-411,501-518`; `repository.ts:52-59` |
| Tanda 3.5 parcial: la RLS de `instituciones` sigue `USING(true)` sin REVOKE de columna — cualquier sesión autenticada lee la tabla entera (correos, `auth_user_id`, incluidas borradas) vía PostgREST (G-13/D-2, decidida sin ejecutar); G-16 (doble identidad) sin chequeo | 🔴 alta | `consentimiento/schema.ts:73-77` |
| G-12 — el backstop de RLS del Gateway cubre solo Proveedores: 3 de 4 pestañas del portal corren con bypass total, apoyadas solo en `tieneConsentimiento()` de TS ("el próximo incremento de seguridad", declarado y sin avance) | 🔴 alta | `gatewayVigenciaBypassPolicy` solo en `proveedores/schema.ts` |
| 🆕 La RLS de `logs_acceso_institucion` da al tenant `modify`/`delete` sobre su **propio log de auditoría** (D-1 pedía solo lectura; bastaría policy de solo SELECT) | 🆕 media | `consentimiento/schema.ts:335-339`; migración `0049` |
| 🆕 `aprobarSolicitud` no exige estado `pendiente` (regla solo en UI, mismo patrón que G-09); D-4 parte 2 pendiente (`generarCodigoAcceso` no valida contra el nicho); un código vencido sigue figurando "activo" para el Owner | 🆕 media/baja | `consentimiento/actions.ts:351-370,454-497,532-544` |
| `intentos_canje` crece sin límite y la retención de 24 meses de logs no tiene job — el "antes de producción" del propio schema ya se incumplió | 🔴 media | `consentimiento/schema.ts:265-271` |
| Docs detrás del código: la tabla de tandas del doc 08 marca 3.3 "Pendiente" (está mergeada), el ANCLA de monitoreo-institucional no registra el cambio de contrato (motivo, cobertura, falla-cerrado), y el de panel-admin-ceom **contradice** al código (dice que no audita, y audita) | 🟡 media | `antiguo/08:742-749`; `monitoreo-institucional/ANCLA.md:122`; `panel-admin-ceom/ANCLA.md:22,51-55` |

## 6. Simulaciones + Reportes (Módulos 9 y 10) — ~86%

**Lo verificado cerrado:** motor único `unidadesParaCubrir` con `null` para margen no positivo;
costo automático por defecto con override no persistente (lección del prototipo); comparativo
multi-SKU con umbral y exclusión de sin-costo; las 8 vistas de Reportes sin tablas propias;
H-49 de punta a punta (bucket por día local, sello "el día no terminó", anti-regresión);
H-15 respetado hasta la pantalla en 4 de 5 superficies.

| Hallazgo | Estado | Evidencia |
|---|---|---|
| H-15 se pierde en la tarjeta "Productos más vendidos" del Dashboard: `margenPct ?? 0` pinta "no sé" como "0%" afirmado — la primera pantalla que ve el usuario | 🟡 media | `dashboard-resumen.tsx:292,308` |
| DA-05/H-20 — exportación PDF/Excel: sigue siendo el único compromiso documental del MVP sin una línea de código | 🔴 media | grep vacío en `src/modules/reportes/` |
| DA-06 — regla 2 de M10 parcial: 5 de 8 funciones sin `sucursalId` y 3 tarjetas del Dashboard ignoran el filtro **sin aviso** — con H-02 cerrado esto pasó de hipotético a defecto activo | 🔴 media | `ventas/actions.ts:948-1043`; `dashboard-resumen.tsx:129-155` |
| 🆕 Validación de simulaciones muerta: los schemas zod de `validation.ts` no se usan; `margenDeseadoPct=100` divide por cero por POST directo; el umbral persiste cualquier valor | 🆕 media | `simulaciones/validation.ts` sin imports; `actions.ts:119-120,265-275` |
| 🆕 Historial de Simulaciones formatea el período con huso del navegador (se muestra corrido un día) — la clase de defecto que H-49 barrió, en una pantalla que quedó fuera del inventario | 🆕 baja | `historial-cliente.tsx:43-48` |
| Menores: punto de equilibrio consolida costos fijos del tenant entero (documentado); caso borde "costo fijo 0" sin la aclaración de UI prometida; regla H-15 duplicada en 3 lugares (comentada, hoy coincide); Dashboard pinta estado vacío cuando la fuente devolvió **error** (conflación "no hay" / "no pude ver") | 🔴/🟡 baja | `financiero/actions.ts:266-270`; `dashboard-resumen.tsx:87-96` |

---

## Síntesis transversal de los módulos

1. **La familia de defectos más repetida es nueva y tiene nombre: "el aviso se calcula y se
   descarta".** `avisosStock` (POS), `entradaStock` (compras), `acreditacionOk` (producción),
   `ajusteStock` (ajustes de venta): en los 4 casos el módulo detecta el fallo, la capa de ruta o
   el cliente lo tira, y el usuario ve éxito. Un solo criterio de fix (propagar y mostrar, como ya
   hace `registrarCompraDeAjusteAction`) cierra los cuatro.
2. **La familia H-49 no terminó:** el arreglo de lectura es sólido, pero quedaron 3 escrituras/
   presentaciones con día UTC (fecha del gasto de comisión, vencimiento de insumo, historial de
   simulaciones).
3. **H-02 abrió una segunda ola:** costo ponderado por sucursal, DA-06 en el Dashboard, punto de
   equilibrio consolidado — defectos que eran teóricos con una sucursal y hoy son alcanzables.
4. **Los contratos les ganaron a los docs:** los ANCLA están mayormente al día; los
   `docs/modules/` (la fuente que `CLAUDE.md` manda leer primero) tienen 3 con contratos viejos
   (M04, M07, M08) y 2 con campos inexistentes (M01, M11).
