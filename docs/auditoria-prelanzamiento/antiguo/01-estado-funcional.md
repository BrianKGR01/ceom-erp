# Estado funcional — qué hace el producto hoy y qué le falta

> Parte de la [auditoría de prelanzamiento](README.md) del 2026-07-27. Este documento responde:
> ¿qué recibe cada actor hoy, contra qué se prometió, y cuáles son los defectos funcionales que
> siguen abiertos? Cada afirmación sobre "sigue abierto / ya se corrigió" se re-verificó contra el
> código de `dev` en la fecha de esta auditoría — no se copió de documentos anteriores.

---

## 1. Lo que está construido y funciona

### 1.1 Backend — Fase 1 cerrada de verdad

Los 14 ítems del roadmap están `[x]` con tests de integración contra base real y `ANCLA.md` al día
(`docs/roadmap/roadmap.md`). No es un "cerrado" nominal: el historial muestra que cada módulo pasó
por una prueba de caja negra definida en su `docs/modules/Modulo_XX.md`, y las integraciones
cross-módulo más delicadas existen y están probadas:

- **Producción (Nicho 1) acredita stock y costo reales en Productos** — la cadena Insumo → Receta →
  Producción → stock está verificada end-to-end.
- **Ventas descuenta stock real y congela doble snapshot** (precio y costo) por línea.
- **`recibirCompra()` dispara la entrada de stock real** (reventa e insumos), con landed cost.
- **El Gateway de Consentimiento resiste**: revocar un código o una aprobación corta el acceso en la
  base de inmediato (verificado por los dos caminos de revocación, según
  `src/modules/consentimiento/ANCLA.md`).

### 1.2 UI — el inventario completo, con verificación en navegador

119/119 pantallas/modales construidos (`docs/ui/pantallas.md`), cada tanda verificada end-to-end en
navegador contra el tenant de prueba. Las 3 superficies existen y tienen gate server-side real:

| Superficie | Estado |
|---|---|
| `/app` (Owner/Colaborador) | Completa: onboarding, catálogo, POS, ventas, gastos, compras, patrimonio, producción, simulaciones, reportes, mi-negocio (colaboradores/roles/capacidades/plan) |
| `/admin` (equipo CEOM) | Completa: tenants (alta/ficha/plan/estado), planes, instituciones, logs de acceso, manual de usuario integrado |
| `/portal` (institución) | Canje de código, magic link de reingreso (verificado con click real de email), cartera, ficha de negocio con solo lo aprobado |

Además: **landing pública** en `/` con lenguaje visual propio, y **recuperación de contraseña**
completa (H-05, cerrado el 2026-07-23 con el tramo de auth por correo).

### 1.3 Documentación de usuario

`docs/manual/` — 20 capítulos cubriendo los 3 actores, servidos dentro del producto en
`/admin/manual`. Incluye glosario y una honestidad poco común: los capítulos citan los hallazgos
abiertos (H-XX) donde el producto se queda corto, con las circunvalaciones manuales documentadas.

---

## 2. Los defectos críticos abiertos — re-verificados hoy

De los 6 hallazgos 🔴 de `docs/manual/hallazgos.md`, **3 están corregidos y 3 siguen abiertos.**
Estado verificado contra `src/` el 2026-07-27:

| ID | Hallazgo | Estado hoy | Evidencia de la re-verificación |
|---|---|---|---|
| H-30 | Signo del ajuste de venta sin validar | ✅ **Corregido** (PR #19) | `errorSignoAjuste()` + `.refine()` en `src/modules/ventas/validation.ts:102-126` — los tipos reductores exigen monto negativo |
| H-24 | La comisión se calcula, se guarda y no llega a ningún lado | ✅ **Corregido** | `registrarVenta` llama a `generarGastoComisionVenta` al confirmar la venta (`ventas/actions.ts`); el gasto resta en `estadoResultados` y sale en `flujoCaja`. Verificado con valores exactos en `financiero.test.ts` |
| H-31 | Una compra de ajuste no tiene ningún efecto observable | ✅ **Corregido** | El ajuste mueve `montoTotalEfectivo`/`estado_pago`, revierte stock (parcial + aviso si ya se vendió), se ve en el listado de compras y llega al estado de resultados en la dirección de costo |
| H-33 | Si el dueño no está disponible, el negocio no se puede recuperar | 🔴 **Abierto** (mitigado en parte) | No existe ninguna acción `designar/reasignar Owner` para `ceom_admin`. La recuperación de contraseña (H-05, ya construida) resuelve el caso "perdió la clave", pero no "el dueño se fue" |
| H-42 | Una institución no puede canjear un segundo código | 🔴 **Abierto** | `src/app/portal/actions.ts:23` sigue exigiendo `institucionNueva` obligatoria; no hay camino con `institucionId` de una sesión existente |
| H-02 | No existe forma de crear una sucursal (y hay funciones que asumen varias) | 🔴 **Abierto** | Cero ocurrencias de `crearSucursal` en `src/`; las únicas inserciones a `sucursales` siguen en el alta de tenant y en tests |

**Por qué estos pesan más que el resto del backlog:**

- **H-24 y H-31 rompían la promesa central del producto** (principio rector #2: "todo dato operativo
  termina en un número financiero, sin doble transcripción"). Un negocio con canal de 20% de
  comisión veía una ganancia 20% mayor que la real, sin ninguna señal. Una compra anulada dejaba
  stock y costo intactos tras confirmarle al usuario que se corrigió. Eran defectos **silenciosos y
  en la dirección optimista** — la clase que destruye la confianza cuando se descubre. **Ya están
  corregidos.** De la misma familia siguen abiertos H-27 (cuotas de pasivo sin gasto) y H-15
  (productos sin costo cargado), los dos en la misma dirección optimista.
- **H-33 es el único agujero operativo sin salida**: la única recuperación es escribir la base a
  mano. Con clientes reales, esto es un incidente de soporte garantizado.
- **H-42 bloquea el caso más probable del actor institucional** (una incubadora con 10 códigos), y
  falla de la peor forma: error genérico de Next.js sin explicación, o una segunda institución
  fantasma imposible de unir a la primera.
- **H-02 es una decisión, no solo un bug**: o se construye el ABM de sucursales, o se ocultan los
  botones de transferencia y el atributo "Múltiples sucursales" del plan que hoy prometen algo
  imposible.

## 3. Defectos importantes (🟠) que conviene cerrar antes del piloto

Verificados como abiertos hoy, en orden de daño estimado:

| ID | Qué pasa | Por qué importa para el lanzamiento |
|---|---|---|
| DA-06 / H-16 | El filtro de sucursal del Dashboard filtra 2 de 5 tarjetas, sin avisar | Dato silenciosamente incorrecto que el usuario activó a propósito. Con una sola sucursal (H-02) casi no se nota — se agrava si se construyen sucursales |
| H-26 | Un ajuste no cambia el total ni el estado de cobro de la venta | Cuentas por cobrar incluyen ventas anuladas, para siempre |
| H-25 | El costo de reventa se pisa con la última compra (no promedia) | Política de costeo válida pero **no declarada**; contradice el promedio ponderado de insumos. Decidirla y documentarla, o cambiarla |
| H-37 | El POS no muestra stock ni avisa al sobrevender | El vendedor se entera del error después de confirmar |
| H-35 / OBS-09 | Cero roles predefinidos: la grilla arranca en blanco | Empuja al Owner a "darle todo a todos". Hay propuesta lista en `docs/manual/propuesta-roles-por-defecto.md`, en espera de decisión |
| H-45 | La suscripción no vence sola, no cobra y no avisa | Sostenible a mano para un piloto chico; hay que documentar la rutina manual del equipo |
| H-43 | El correo de una institución es opcional, pero sin correo no puede entrar nunca | Un aviso en la ficha o el campo requerido — arreglo chico |
| H-08 | El menú no se adapta al rubro ni a permisos | Un colaborador ve navegación que le va a rebotar server-side |
| H-14 | No hay pantalla para dar de alta otro `ceom_admin` | Hoy: solo por script (`seed-admin.ts`). Sostenible en piloto, incómodo después |
| H-34 | Capacidad de producción: la pantalla nunca puede mostrar datos | Los campos que necesita no están en ningún formulario — o se agregan al form de bienes, o se quita la pantalla |
| DA-08/DA-09 | "Quitar logo/imagen" no borra nada | Fix chico y conocido, documentado en ambos ANCLA |
| DA-17 | Editar comisión de un evento abierto: acción y wrapper construidos, ningún `.tsx` lo usa | La última capa de un trabajo ya hecho |
| DA-24 (Proveedores) | `entradaStock` de una compra recibida: nadie lee el resultado | Una compra puede quedar `recibido` con la entrada de stock fallada, sin que nadie se entere — es el único de los 3 gaps de atomicidad cuya condición de detección es falsa |

Los hallazgos 🟡/⚪ restantes (28 en `hallazgos.md`, más el detalle de `AUDITORIA-UI-UX.md` y
`observaciones-de-uso.md`) no bloquean un piloto; están priorizados en
[04-camino-al-lanzamiento.md](04-camino-al-lanzamiento.md).

## 4. Lo prometido vs. lo construido — alcance del MVP

Contra el alcance declarado en `docs/architecture/CEOM_Arquitectura.md` §2:

| Compromiso del MVP | Estado |
|---|---|
| Core completo (Identidad, Productos, Ventas, Gastos, Proveedores, Patrimonio, Financiero, Reportes) | ✅ Construido |
| Nicho 1 — Alimentos/Bebidas por Lotes | ✅ Construido |
| Nicho 4 — Comercio Minorista y Distribución | ✅ Construido (alcance mínimo confirmado a propósito) |
| Modo Básico | ✅ Construido |
| Gateway de Consentimiento + Panel Institucional + Panel Admin CEOM | ✅ Construido (con H-42/H-43 abiertos y los 3 pendientes veedor-seguros de DA-21) |
| Exportación PDF/Excel de reportes (Modulo_10 §6) | ❌ No construido (DA-05/H-20) — el doc del módulo lo promete con co-branding |
| Postergado a conciencia (WhatsApp, Tuki IA, EDU, Nichos 2/3/5) | ✅ Correctamente fuera — nada de esto se necesita para lanzar |

**Único compromiso documental del MVP sin cumplir: la exportación de reportes.** Todo lo demás que
falta es de las fases post-construcción (integración, endurecimiento, producción) o decisiones de
producto nuevas — no alcance olvidado de la Fase 1.

## 5. Decisiones de producto pendientes (nadie más puede tomarlas)

Estas no son deuda técnica — son preguntas al dueño del producto, y varias bloquean trabajo:

1. **Precio del plan Básico** (DA-18): hoy el cliente ve "Bs 0" en Mi Plan. Sin precio no hay
   lanzamiento comercial.
2. **Sucursales** (H-02): ¿ABM en el MVP, o se ocultan las funciones que las prometen?
3. **Roles por defecto** (H-35): la propuesta está escrita; falta un sí/no.
4. **Política de costeo de reventa** (H-25): ¿último precio (declarado) o promedio ponderado?
5. **Estado "pausada"** (H-46): hoy equivale a `bloqueado` sin gracia. ¿Es lo que se quiere?
6. **Downgrade y consentimientos** (H-47): bajar de plan no revoca lo ya compartido. ¿Debe hacerlo?
7. **Alcance institucional del piloto**: si el piloto no incluye instituciones, H-42/H-43/DA-21
   pueden esperar; si las incluye, H-42 es P0.
