// Siembra el escenario COMPLETO del subsistema de Instituciones / Gateway de
// Consentimiento (Etapa 3, tanda 3.1). Ningun seed previo creaba una sola
// institucion, un solo codigo de acceso ni una sola aprobacion:
// `pnpm seed:demo` puebla UN tenant con datos de negocio y no toca nada de
// consentimiento. Consecuencia medida sobre la base de desarrollo antes de
// escribir este script (docs/auditoria-prelanzamiento/08-instituciones-punta-a-punta.md §6):
//
//   - 7 instituciones vivas, MAXIMO 1 negocio en cartera cada una -> el caso
//     del piloto (una incubadora con varios emprendimientos) nunca existio.
//   - 0 instituciones con auth_user_id -> NADIE podia entrar al portal
//     autenticado; la cartera y las 4 pestañas eran inalcanzables.
//   - El unico tenant con sucursales multiples y el unico con ventas sin
//     costo no los seguia NINGUNA institucion; el unico tenant con cartera
//     no tenia ninguna de las dos condiciones. Los dos defectos que ese
//     cruce esconde (X-01, X-02) eran literalmente inobservables.
//
// Por eso este script no siembra "el caso feliz": siembra el caso del piloto
// MAS los estados degenerados, que son los que esconden los bugs. Sembrar
// solo el escenario completo seria reconstruir el punto ciego que el propio
// diagnostico denuncia.
//
// Usa las funciones de negocio reales de cada modulo (nunca INSERT crudo),
// mismo criterio que seed-demo-data.ts y seed-tenant.ts. Las dos unicas
// excepciones estan marcadas con "EXCEPCION" y justificadas donde ocurren.
//
// Uso:
//   pnpm seed:instituciones <emailCeomAdmin> [--force]
//
// Sin --force, aborta si el escenario ya existe (idempotente por deteccion,
// no por upsert: correrlo dos veces sin --force no duplica nada).

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { client as pgClient, db } from "@/db/client";
import {
  agregarTenantACartera,
  aprobarSolicitud,
  canjearCodigoAcceso,
  crearInstitucion,
  crearSolicitudSeguimiento,
  generarCodigoAcceso,
  revocarConsentimiento,
  revocarCodigoAcceso,
  vincularInstitucionAutenticada,
} from "@/modules/consentimiento/actions";
import * as consentimientoRepo from "@/modules/consentimiento/repository";
import { instituciones } from "@/modules/consentimiento/schema";
import { sembrarCategoriasGastoDefault } from "@/modules/gastos/actions";
import { asignarNicho, cambiarPlanTenant, crearSucursal } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, usuarios } from "@/modules/identidad/schema";
import {
  actualizarComposicionReceta,
  crearInsumo,
  crearReceta,
  listarInsumos,
  listarProducciones,
  registrarEntradaCompraInsumo,
  registrarProduccion,
  vincularProductoAReceta,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { crearActivo } from "@/modules/patrimonio/actions";
import {
  crearCategoria,
  crearProducto,
  listarProductos,
  registrarAjusteManualStock,
  registrarEntradaCompraReventa,
} from "@/modules/productos/actions";
import { crearPlan, listarPlanes } from "@/modules/suscripcion/actions";
import { crearCanalVenta, crearMetodoPago, registrarVenta } from "@/modules/ventas/actions";

// Contraseña unica de todo lo que siembra este script — datos de desarrollo,
// nunca de produccion. Se imprime al final para poder entrar de verdad.
const PASSWORD_DEMO = "SeedDemo123!";
const SUFIJO = "(demo)";

const DIA_MS = 24 * 60 * 60 * 1000;
function haceNDias(n: number) {
  return new Date(Date.now() - n * DIA_MS).toISOString();
}
function fechaHaceNDias(n: number) {
  return new Date(Date.now() - n * DIA_MS).toISOString().slice(0, 10);
}

type UsuarioConRol = NonNullable<
  Awaited<ReturnType<typeof identidadRepo.obtenerUsuarioConRolPorId>>
>;

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Crea (o reutiliza) un usuario de Supabase Auth con contraseña conocida y
 * correo ya confirmado.
 *
 * EXCEPCION 1 al "usar siempre la funcion de negocio real": el alta real de
 * un tenant (`crearTenant()`) invita al Owner por correo
 * (`inviteUserByEmail`), y un seed no puede depender de una bandeja de
 * entrada — es justamente el punto ciego que este script existe para cerrar.
 * Ademas, 4 invitaciones seguidas agotan el limite de envio del SMTP por
 * defecto de Supabase. Mismo criterio y mismo cliente admin minimo que
 * seed-admin.ts.
 */
async function asegurarAuthUser(email: string): Promise<string> {
  const admin = adminSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD_DEMO,
    email_confirm: true,
  });
  if (!error && data.user) return data.user.id;

  // Ya existia (re-corrida con --force): resolverlo por listado paginado.
  let pagina = 1;
  for (;;) {
    const { data: lista, error: errorLista } = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: 200,
    });
    if (errorLista) throw new Error(`listUsers(${email}): ${errorLista.message}`);
    const encontrado = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (encontrado) return encontrado.id;
    if (lista.users.length < 200) break;
    pagina++;
  }
  throw new Error(`No se pudo crear ni encontrar el usuario de Auth ${email}: ${error?.message}`);
}

/**
 * Crea un tenant con su Owner, sin invitacion por correo.
 *
 * EXCEPCION 2: llama a `repo.crearTenantConOwner()` en vez de a
 * `crearTenant()` por el motivo de arriba. Todo lo demas del alta real se
 * replica a proposito (plan, sucursal Principal, rol Owner, categorias de
 * gasto default — DA-01, el mismo paso que hace `/admin/tenants/nuevo`), para
 * que un tenant sembrado no arranque distinto de uno real.
 */
async function asegurarTenant(
  ceomAdmin: UsuarioConRol,
  input: { nombreNegocio: string; emailOwner: string; nombreOwner: string; planId: string }
): Promise<{ owner: UsuarioConRol; tenantId: string; sucursalPrincipalId: string; nuevo: boolean }> {
  const [existente] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, input.emailOwner))
    .limit(1);

  if (existente) {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(existente.id);
    if (!owner) throw new Error(`No se pudo resolver el owner ${input.emailOwner}.`);
    const sucursales = await identidadRepo.listarSucursalesPorTenant(owner.tenantId);
    const principal = sucursales.find((s) => s.esPrincipal) ?? sucursales[0];
    return {
      owner,
      tenantId: owner.tenantId,
      sucursalPrincipalId: principal.id,
      nuevo: false,
    };
  }

  const authUserId = await asegurarAuthUser(input.emailOwner);
  const { tenant, sucursal, usuarioOwner } = await identidadRepo.crearTenantConOwner({
    tenant: {
      nombreNegocio: input.nombreNegocio,
      monedaPrincipal: "BOB",
      canalesVenta: [],
      planId: input.planId,
      estadoSuscripcion: "activa",
      fechaInicioSuscripcion: fechaHaceNDias(60),
      creadoPor: ceomAdmin.id,
    },
    ownerId: authUserId,
    ownerNombreCompleto: input.nombreOwner,
    ownerEmail: input.emailOwner,
    rolOwnerId: ROL_OWNER_ID,
    creadoPor: ceomAdmin.id,
  });

  const owner = await identidadRepo.obtenerUsuarioConRolPorId(usuarioOwner.id);
  if (!owner) throw new Error(`No se pudo resolver el owner recien creado ${input.emailOwner}.`);

  const siembra = await sembrarCategoriasGastoDefault(ceomAdmin, tenant.id);
  if (!siembra.ok) throw new Error(`sembrarCategoriasGastoDefault: ${siembra.error}`);

  return { owner, tenantId: tenant.id, sucursalPrincipalId: sucursal.id, nuevo: true };
}

function exigir<T>(resultado: { ok: true; data: T } | { ok: false; error: string }, contexto: string): T {
  if (!resultado.ok) throw new Error(`${contexto}: ${resultado.error}`);
  return resultado.data;
}

/**
 * "¿Hay que poblar este negocio?" — se pregunta por los DATOS, no por si el
 * tenant se acaba de crear. Si el script falla a mitad (paso, y ya pasó: la
 * primera corrida creó los 4 tenants y murió en la producción), una segunda
 * corrida tiene que poder completar lo que falta en vez de saltearlo por
 * "este tenant ya existía". Mismo criterio de guarda que seed-demo-data.ts.
 */
async function necesitaDatos(t: { owner: UsuarioConRol; tenantId: string }): Promise<boolean> {
  const productos = await listarProductos(t.owner, t.tenantId);
  return productos.ok && productos.data.length === 0;
}

// --- Limpieza previa: la fila de G-16 sembrada por accidente ----------------

/**
 * `docs/auditoria-prelanzamiento/08-instituciones-punta-a-punta.md` §4.5:
 * existe una Institucion con el correo del OPERADOR de CEOM
 * (`admin@ceom.lat`) y una aprobacion vigente. Es una trampa real: el dia que
 * esa persona pida un enlace magico desde /portal, el vinculo perezoso ata su
 * `auth.users` —el mismo con el que entra a /admin— a una Institucion, y
 * queda con los dos sombreros a la vez.
 *
 * Se limpia en tres pasos y en este orden, sin fingir que G-07 ya esta
 * arreglado: revocar la aprobacion (deja de ver datos), dar de baja su
 * cartera, y recien despues borrar la institucion **liberando el correo**
 * (hoy el indice unico parcial no excluye `eliminado_en`, asi que sin
 * limpiarlo la direccion quedaria bloqueada para siempre — G-07).
 *
 * Idempotente: si la fila ya no esta, no hace nada.
 */
async function limpiarInstitucionDelOperador(): Promise<string[]> {
  const hechos: string[] = [];
  const CORREOS_DE_OPERADOR = ["admin@ceom.lat"];

  for (const correo of CORREOS_DE_OPERADOR) {
    const [fila] = await db
      .select()
      .from(instituciones)
      .where(eq(instituciones.email, correo))
      .limit(1);
    if (!fila) continue;

    // Revocar toda aprobacion vigente de esa institucion, por tenant.
    const cartera = await consentimientoRepo.listarCarteraPorInstitucion(fila.id);
    for (const filaCartera of cartera) {
      const aprobacion = await consentimientoRepo.obtenerAprobacionVigente(
        filaCartera.tenantId,
        fila.id
      );
      if (aprobacion && !aprobacion.revocadoEn) {
        await consentimientoRepo.revocarAprobacion(aprobacion.id);
        hechos.push(`revocada la aprobación de "${fila.nombre}" sobre el tenant ${filaCartera.tenantId}`);
      }
      await consentimientoRepo.quitarDeCarteraSoft(filaCartera.id);
    }

    // Liberar el correo ANTES del soft delete (ver comentario de arriba).
    await consentimientoRepo.actualizarInstitucion(fila.id, { email: null });
    await consentimientoRepo.eliminarInstitucionSoft(fila.id);
    hechos.push(`institución "${fila.nombre}" dada de baja y el correo ${correo} liberado`);
  }

  return hechos;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const emailCeomAdmin = args.find((a) => !a.startsWith("--"));

  if (!emailCeomAdmin) {
    console.error("Uso: pnpm seed:instituciones <emailCeomAdmin> [--force]");
    process.exitCode = 1;
    return;
  }

  for (const variable of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "DATABASE_URL"]) {
    if (!process.env[variable]) {
      console.error(`Falta ${variable} en .env.local — ver .env.example.`);
      process.exitCode = 1;
      return;
    }
  }

  const filas = await db
    .select({ usuario: usuarios, rol: roles })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(eq(usuarios.email, emailCeomAdmin))
    .limit(1);
  const filaAdmin = filas[0];
  if (!filaAdmin) {
    console.error(
      `No existe un usuario con email ${emailCeomAdmin} — corré primero \`pnpm seed:admin ${emailCeomAdmin}\`.`
    );
    process.exitCode = 1;
    return;
  }
  if (filaAdmin.usuario.rolId !== ROL_CEOM_ADMIN_ID) {
    console.error(`${emailCeomAdmin} existe pero no tiene rol CEOM Admin.`);
    process.exitCode = 1;
    return;
  }
  const ceomAdmin: UsuarioConRol = { ...filaAdmin.usuario, rol: filaAdmin.rol };

  const yaSembrado = await consentimientoRepo.obtenerInstitucionPorEmail(
    "incubadora@ceom-erp.test"
  );
  if (yaSembrado && !force) {
    console.error(
      "El escenario de instituciones ya está sembrado (existe 'incubadora@ceom-erp.test').\n" +
        "Corré con --force si querés agregar otra pasada encima."
    );
    process.exitCode = 1;
    return;
  }

  // --- 0. Limpieza de la fila de G-16 -------------------------------------
  const limpiezas = await limpiarInstitucionDelOperador();
  for (const hecho of limpiezas) console.log(`🧹 ${hecho}`);
  if (limpiezas.length === 0) console.log("🧹 Sin instituciones con correo de operador que limpiar.");

  // --- 1. Planes -----------------------------------------------------------
  // Hacen falta dos: uno que permita 2 sucursales y otro que permita 1, para
  // poder ejecutar el downgrade REAL que congela una sucursal (X-02). Los
  // planes existentes no sirven: el unico con maxSucursales > 1 de la base de
  // desarrollo tiene `modulos_veedor_permitidos = {}`, asi que su tenant no
  // podria compartir nada con una institucion.
  const planes = await listarPlanes({ soloActivos: true });
  const MODULOS_VEEDOR = ["financiero", "operativo", "inventario_operativo"] as const;

  async function asegurarPlan(nombre: string, maxSucursales: number): Promise<string> {
    const existente = planes.find((p) => p.nombre === nombre);
    if (existente) return existente.id;
    const creado = exigir(
      await crearPlan(ceomAdmin, {
        nombre,
        maxSucursales,
        modulosVeedorPermitidos: [...MODULOS_VEEDOR],
        precioMensual: maxSucursales > 1 ? 250 : 120,
        moneda: "BOB",
      }),
      `crearPlan(${nombre})`
    );
    return creado.planId;
  }

  const planUnaSucursal = await asegurarPlan(`Demo Instituciones — 1 sucursal ${SUFIJO}`, 1);
  const planDosSucursales = await asegurarPlan(`Demo Instituciones — 2 sucursales ${SUFIJO}`, 2);
  console.log("✓ 2 planes demo listos (1 y 2 sucursales, los 3 módulos veedor habilitados).");

  // --- 2. Los cuatro negocios ---------------------------------------------
  //
  // Cada uno existe para exponer un estado distinto. Ninguno es decorativo.
  //
  //   A — Panificadora Aurora  (nicho_1) : el negocio "sano". Ventas con costo
  //                                        completo, insumos y una produccion
  //                                        real -> las 4 pestañas con datos.
  //   B — Tienda Bertoni       (nicho_4) : X-01 (la MITAD de sus ingresos no
  //                                        tiene costo cargado) + G-14
  //                                        (consiente "operativo" siendo de un
  //                                        nicho que no produce).
  //   C — Cafeteria Cruz       (nicho_1) : X-02 (dos sucursales con ventas en
  //                                        las dos, y despues un downgrade
  //                                        real que congela la segunda).
  //   D — Ferreteria Dalmiro   (nicho_4) : el negocio que NO autorizo a nadie.
  //                                        Es la afirmacion negativa del e2e.

  const A = await asegurarTenant(ceomAdmin, {
    nombreNegocio: `Panificadora Aurora ${SUFIJO}`,
    emailOwner: "aurora@ceom-erp.test",
    nombreOwner: "Aurora Salazar",
    planId: planUnaSucursal,
  });
  const B = await asegurarTenant(ceomAdmin, {
    nombreNegocio: `Tienda Bertoni ${SUFIJO}`,
    emailOwner: "bertoni@ceom-erp.test",
    nombreOwner: "Bruno Bertoni",
    planId: planUnaSucursal,
  });
  const C = await asegurarTenant(ceomAdmin, {
    nombreNegocio: `Cafetería Cruz ${SUFIJO}`,
    emailOwner: "cruz@ceom-erp.test",
    nombreOwner: "Camila Cruz",
    planId: planDosSucursales,
  });
  const D = await asegurarTenant(ceomAdmin, {
    nombreNegocio: `Ferretería Dalmiro ${SUFIJO}`,
    emailOwner: "dalmiro@ceom-erp.test",
    nombreOwner: "Dalmiro Ortiz",
    planId: planUnaSucursal,
  });
  console.log("✓ 4 negocios listos (Aurora, Bertoni, Cruz, Dalmiro).");

  for (const [tenant, nicho] of [
    [A, "nicho_1"],
    [B, "nicho_4"],
    [C, "nicho_1"],
    [D, "nicho_4"],
  ] as const) {
    // Por el estado real, no por `nuevo`: `asignarNicho` es de un solo
    // sentido (Modulo_01 §5) y rechaza el segundo intento, así que hay que
    // preguntar si ya tiene nicho en vez de asumirlo por la corrida.
    const fila = await identidadRepo.obtenerTenantPorId(tenant.tenantId);
    if (fila?.nichoId) continue;
    const resultado = await asignarNicho(tenant.owner, nicho);
    if (!resultado.ok) throw new Error(`asignarNicho(${nicho}): ${resultado.error}`);
  }
  console.log("✓ Nichos asignados (A y C → nicho_1; B y D → nicho_4).");

  // --- 3. Datos de negocio, por negocio ------------------------------------

  async function canalYMetodo(t: typeof A) {
    const canal = exigir(
      await crearCanalVenta(t.owner, t.tenantId, { nombre: "Mostrador" }),
      "crearCanalVenta"
    );
    const metodo = exigir(
      await crearMetodoPago(t.owner, t.tenantId, { nombre: "Efectivo" }),
      "crearMetodoPago"
    );
    return { canalVentaId: canal.canalVentaId, metodoPagoId: metodo.metodoPagoId };
  }

  // ---- A: el negocio sano -------------------------------------------------
  if (await necesitaDatos(A)) {
    const { canalVentaId, metodoPagoId } = await canalYMetodo(A);
    const categoria = exigir(
      await crearCategoria(A.owner, A.tenantId, { nombre: "Panadería" }),
      "crearCategoria(A)"
    );

    // Precio 20, costo 8, 10 unidades vendidas => ingresos 200, costos 80.
    const pan = exigir(
      await crearProducto(A.owner, A.tenantId, {
        categoriaId: categoria.categoriaId,
        nombre: "Pan de campo",
        unidadVenta: "unidad",
        precioVenta: 20,
        costoOperativoVigente: 8,
        tipoOrigenProducto: "manual",
        origenCosto: "manual",
      }),
      "crearProducto(A/pan)"
    );
    exigir(
      await registrarEntradaCompraReventa(A.owner, A.tenantId, {
        productoId: pan.productoId,
        sucursalId: A.sucursalPrincipalId,
        cantidad: 40,
        costoCompra: 8,
      }),
      "stock inicial(A)"
    );
    exigir(
      await registrarVenta(A.owner, A.tenantId, {
        sucursalId: A.sucursalPrincipalId,
        canalVentaId,
        fechaVenta: haceNDias(5),
        lineas: [{ productoId: pan.productoId, cantidad: 10 }],
        pagoInicial: { metodoPagoId, monto: 200 },
      }),
      "registrarVenta(A)"
    );
    console.log("✓ A (Aurora): ventas 200 / costos 80.");
  }

  // ---- A (2ª mitad): insumos, receta y una producción real ----------------
  //
  // Guarda propia, separada de la de arriba: es el único negocio del
  // escenario donde la pestaña "Producción" del portal tiene filas de
  // verdad, y sin ella "Sin producciones registradas" sería indistinguible
  // entre A (nicho_1 sin actividad) y B (nicho_4, que no puede producir) —
  // que es justamente el defecto G-14 que hay que poder ver lado a lado.
  //
  // Está separada porque este bloque ya falló una vez a mitad de camino
  // (fechaProduccion esperaba YYYY-MM-DD y recibía un instante ISO) y dejó a
  // A con producto y venta pero sin producción. Con una sola guarda por
  // tenant, la re-corrida saltaba todo el negocio y el estado quedaba
  // incompleto en silencio — exactamente la clase de punto ciego que este
  // script existe para eliminar.
  const produccionesA = await listarProducciones(A.owner, A.tenantId);
  if (produccionesA.ok && produccionesA.data.length === 0) {
    const productosA = exigir(await listarProductos(A.owner, A.tenantId), "listarProductos(A)");
    const pan = productosA.find((p) => p.nombre === "Pan de campo");
    if (!pan) throw new Error("No se encontró el producto 'Pan de campo' de A.");

    const insumosA = exigir(await listarInsumos(A.owner, A.tenantId), "listarInsumos(A)");
    const harinaExistente = insumosA.find((i) => i.nombre === "Harina 000");
    const harina = harinaExistente
      ? { insumoId: harinaExistente.id }
      : exigir(
          await crearInsumo(A.owner, A.tenantId, { nombre: "Harina 000", unidadMedida: "kg" }),
          "crearInsumo(A/harina)"
        );
    exigir(
      await registrarEntradaCompraInsumo(A.owner, A.tenantId, {
        insumoId: harina.insumoId,
        sucursalId: A.sucursalPrincipalId,
        cantidad: 100,
        costoCompra: 6,
      }),
      "entrada de insumo(A)"
    );
    const receta = exigir(
      await crearReceta(A.owner, A.tenantId, {
        nombre: "Masa base de pan",
        rendimientoPorLote: 20,
        unidadRendimiento: "unidad",
      }),
      "crearReceta(A)"
    );
    exigir(
      await actualizarComposicionReceta(A.owner, receta.recetaId, [
        { insumoId: harina.insumoId, cantidadPorLote: 10 },
      ]),
      "actualizarComposicionReceta(A)"
    );
    exigir(
      await vincularProductoAReceta(A.owner, A.tenantId, {
        productoId: pan.id,
        recetaId: receta.recetaId,
        cantidadBaseConsumidaPorUnidad: 1,
      }),
      "vincularProductoAReceta(A)"
    );
    const horno = exigir(
      await crearActivo(A.owner, A.tenantId, {
        nombre: "Horno rotativo",
        tipo: "equipo_productivo",
        sucursalId: A.sucursalPrincipalId,
        valorCompra: 12000,
        fechaAdquisicion: fechaHaceNDias(400),
      }),
      "crearActivo(A)"
    );
    exigir(
      await registrarProduccion(A.owner, A.tenantId, {
        productoId: pan.id,
        sucursalId: A.sucursalPrincipalId,
        activoId: horno.activoId,
        fechaProduccion: fechaHaceNDias(4),
        cantidadLotesProducidos: 2,
        cantidadRealObtenida: 38,
      }),
      "registrarProduccion(A)"
    );
    console.log("✓ A (Aurora): 1 insumo, 1 receta y 1 producción real.");
  }

  // ---- B: X-01 (la mitad de los ingresos sin costo) + G-14 ---------------
  if (await necesitaDatos(B)) {
    const { canalVentaId, metodoPagoId } = await canalYMetodo(B);
    const categoria = exigir(
      await crearCategoria(B.owner, B.tenantId, { nombre: "Accesorios" }),
      "crearCategoria(B)"
    );

    // Numeros elegidos para que el marcador de H-15 sea legible de un
    // vistazo: EXACTAMENTE la mitad de los ingresos no tiene costo cargado.
    //   Cable HDMI : 3 x 60 = 180  (con costo 25/u -> costos 75)
    //   Cargador   : 2 x 90 = 180  (SIN costo -> ingresosSinCostoConocido 180)
    //   ingresos 360 · costos 75 · ingresosSinCostoConocido 180
    const cable = exigir(
      await crearProducto(B.owner, B.tenantId, {
        categoriaId: categoria.categoriaId,
        nombre: "Cable HDMI 2m",
        unidadVenta: "unidad",
        precioVenta: 60,
        costoOperativoVigente: 25,
        tipoOrigenProducto: "reventa_simple",
        origenCosto: "manual",
      }),
      "crearProducto(B/cable)"
    );
    const cargador = exigir(
      await crearProducto(B.owner, B.tenantId, {
        categoriaId: categoria.categoriaId,
        nombre: "Cargador USB-C 20W",
        unidadVenta: "unidad",
        precioVenta: 90,
        tipoOrigenProducto: "reventa_simple",
        origenCosto: "manual",
      }),
      "crearProducto(B/cargador)"
    );
    exigir(
      await registrarEntradaCompraReventa(B.owner, B.tenantId, {
        productoId: cable.productoId,
        sucursalId: B.sucursalPrincipalId,
        cantidad: 20,
        costoCompra: 25,
      }),
      "stock cable(B)"
    );
    // Ajuste manual, NO compra de reventa: `registrarEntradaCompraReventa`
    // escribiria `costo_operativo_vigente` y anularia el caso que este
    // producto existe para reproducir (mismo criterio que seed-demo-data.ts).
    exigir(
      await registrarAjusteManualStock(B.owner, B.tenantId, {
        productoId: cargador.productoId,
        sucursalId: B.sucursalPrincipalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 20,
        motivo: "Carga inicial sin costo (demo X-01)",
      }),
      "stock cargador(B)"
    );
    exigir(
      await registrarVenta(B.owner, B.tenantId, {
        sucursalId: B.sucursalPrincipalId,
        canalVentaId,
        fechaVenta: haceNDias(6),
        lineas: [
          { productoId: cable.productoId, cantidad: 3 },
          { productoId: cargador.productoId, cantidad: 2 },
        ],
        pagoInicial: { metodoPagoId, monto: 360 },
      }),
      "registrarVenta(B)"
    );
    console.log(
      "✓ B (Bertoni): ingresos 360, costos 75, ingresosSinCostoConocido 180 — la mitad sin costo (X-01)."
    );
  }

  // ---- C: X-02 (sucursal congelada por downgrade real) -------------------
  if (await necesitaDatos(C)) {
    const { canalVentaId, metodoPagoId } = await canalYMetodo(C);
    const categoria = exigir(
      await crearCategoria(C.owner, C.tenantId, { nombre: "Cafetería" }),
      "crearCategoria(C)"
    );
    const cafe = exigir(
      await crearProducto(C.owner, C.tenantId, {
        categoriaId: categoria.categoriaId,
        nombre: "Café filtrado",
        unidadVenta: "unidad",
        precioVenta: 10,
        costoOperativoVigente: 4,
        tipoOrigenProducto: "manual",
        origenCosto: "manual",
      }),
      "crearProducto(C)"
    );

    const sucursalSur = exigir(
      await crearSucursal(C.owner, C.tenantId, { nombre: "Sucursal Sur" }),
      "crearSucursal(C)"
    );

    for (const [sucursalId, cantidad] of [
      [C.sucursalPrincipalId, 50],
      [sucursalSur.sucursalId, 30],
    ] as const) {
      exigir(
        await registrarEntradaCompraReventa(C.owner, C.tenantId, {
          productoId: cafe.productoId,
          sucursalId,
          cantidad,
          costoCompra: 4,
        }),
        "stock(C)"
      );
    }

    // Ventas en LAS DOS sucursales: 50 x 10 = 500 en Principal, 30 x 10 = 300
    // en Sur. Total consolidado 800 — que es lo que va a seguir viendo la
    // institucion despues del downgrade, sobre un negocio que ya solo puede
    // registrar en una de las dos.
    for (const [sucursalId, cantidad, dias] of [
      [C.sucursalPrincipalId, 50, 8],
      [sucursalSur.sucursalId, 30, 7],
    ] as const) {
      exigir(
        await registrarVenta(C.owner, C.tenantId, {
          sucursalId,
          canalVentaId,
          fechaVenta: haceNDias(dias),
          lineas: [{ productoId: cafe.productoId, cantidad }],
          pagoInicial: { metodoPagoId, monto: cantidad * 10 },
        }),
        "registrarVenta(C)"
      );
    }

    // El downgrade REAL — no un UPDATE a mano sobre `congelada_en`. Congela
    // "Sucursal Sur" por el mismo camino que lo haria /admin.
    const cambio = exigir(
      await cambiarPlanTenant(ceomAdmin, C.tenantId, planUnaSucursal),
      "cambiarPlanTenant(C)"
    );
    if (cambio.sucursalesCongeladas.length !== 1) {
      throw new Error(
        `El downgrade de C debía congelar exactamente 1 sucursal, congeló ${cambio.sucursalesCongeladas.length}.`
      );
    }
    console.log(
      "✓ C (Cruz): ventas 500 (Principal) + 300 (Sur) = 800; downgrade real → Sucursal Sur congelada (X-02)."
    );
  }

  // ---- D: el negocio que no autorizó a nadie -----------------------------
  if (await necesitaDatos(D)) {
    const { canalVentaId, metodoPagoId } = await canalYMetodo(D);
    const categoria = exigir(
      await crearCategoria(D.owner, D.tenantId, { nombre: "Ferretería" }),
      "crearCategoria(D)"
    );
    const martillo = exigir(
      await crearProducto(D.owner, D.tenantId, {
        categoriaId: categoria.categoriaId,
        nombre: "Martillo carpintero",
        unidadVenta: "unidad",
        precioVenta: 75,
        costoOperativoVigente: 40,
        tipoOrigenProducto: "reventa_simple",
        origenCosto: "manual",
      }),
      "crearProducto(D)"
    );
    exigir(
      await registrarEntradaCompraReventa(D.owner, D.tenantId, {
        productoId: martillo.productoId,
        sucursalId: D.sucursalPrincipalId,
        cantidad: 10,
        costoCompra: 40,
      }),
      "stock(D)"
    );
    // 7 x 75 = 525. Es un numero que NINGUNA institucion debe ver: si aparece
    // en la cartera de alguien, hay una fuga de aislamiento.
    exigir(
      await registrarVenta(D.owner, D.tenantId, {
        sucursalId: D.sucursalPrincipalId,
        canalVentaId,
        fechaVenta: haceNDias(3),
        lineas: [{ productoId: martillo.productoId, cantidad: 7 }],
        pagoInicial: { metodoPagoId, monto: 525 },
      }),
      "registrarVenta(D)"
    );
    console.log("✓ D (Dalmiro): ventas 525 — sin consentir a nadie (afirmación negativa del e2e).");
  }

  // --- 4. Las instituciones y sus vínculos ---------------------------------
  //
  // Guardado por existencia, no por `--force`: si la Incubadora ya está, este
  // bloque NO se puede repetir. El segundo `canjearCodigoAcceso()` con el
  // mismo correo revienta con la violación de unicidad de H-42, sin capturar
  // — el propio defecto que la Etapa 3 existe para cerrar. Cuando la tanda 3.2
  // lo arregle, esta guarda puede relajarse.
  const incubadoraPrevia = await consentimientoRepo.obtenerInstitucionPorEmail(
    "incubadora@ceom-erp.test"
  );
  if (!incubadoraPrevia) {
    //
    //   I1 Incubadora Andina  : el caso del piloto — 3 negocios en cartera,
    //                           con auth_user_id VINCULADO (entra al portal).
    //   I2 Universidad del Sur: 1 negocio (A, el MISMO que I1) con módulos
    //                           DISTINTOS — es la única forma de probar de
    //                           verdad el aislamiento entre instituciones.
    //                           Tiene correo pero NUNCA entró: auth_user_id
    //                           null, el estado que hoy tienen las 7 de la base.
    //   I3 Fundación Tejido   : SIN CORREO (H-43) — existe, tiene cartera, y no
    //                           puede entrar al portal. Nada se lo advierte.

    // I1 nace canjeando un código, que es el camino real del actor.
    const codigoA = exigir(
      await generarCodigoAcceso(A.owner, A.tenantId, {
        modulosHabilitados: ["financiero", "operativo", "inventario_operativo"],
      }),
      "generarCodigoAcceso(A → I1)"
    );
    const canje = exigir(
      await canjearCodigoAcceso({
        codigo: codigoA.codigo,
        institucionNueva: {
          nombre: `Incubadora Andina ${SUFIJO}`,
          tipo: "incubadora",
          email: "incubadora@ceom-erp.test",
          contacto: "+591 700 00001",
        },
      }),
      "canjearCodigoAcceso(I1)"
    );
    const incubadoraId = canje.institucionId;

    // Los negocios B y C entran a la cartera de I1 por el camino 2 (CEOM), que
    // es la circunvalación documentada de H-42: hoy una institución YA
    // registrada no puede canjear un segundo código. En cuanto la tanda 3.2
    // habilite el canje autenticado, estos dos negocios se pueden volver a
    // sembrar por el camino 1 y este bloque se simplifica.
    for (const [tenant, modulos] of [
      [B, ["financiero", "operativo"]],
      [C, ["financiero"]],
    ] as const) {
      exigir(
        await agregarTenantACartera(ceomAdmin, {
          institucionId: incubadoraId,
          tenantId: tenant.tenantId,
          cohorte: "Cohorte 2026-A",
          fechaInicio: fechaHaceNDias(30),
        }),
        "agregarTenantACartera(I1)"
      );
      const solicitud = exigir(
        await crearSolicitudSeguimiento(ceomAdmin, {
          institucionId: incubadoraId,
          tenantId: tenant.tenantId,
          modulosSolicitados: [...modulos],
        }),
        "crearSolicitudSeguimiento(I1)"
      );
      exigir(
        await aprobarSolicitud(tenant.owner, solicitud.solicitudId, {
          modulosAprobados: [...modulos],
        }),
        "aprobarSolicitud(I1)"
      );
    }
    console.log("✓ I1 (Incubadora Andina): 3 negocios en cartera — A, B y C.");

    // I2 — el mismo negocio A que I1, pero solo "financiero". La afirmación que
    // hoy NADIE prueba: dos instituciones sobre el mismo negocio, cada una
    // viendo lo suyo y nada de la otra (G-11).
    const universidadId = exigir(
      await crearInstitucion(ceomAdmin, {
        nombre: `Universidad del Sur ${SUFIJO}`,
        tipo: "universidad",
        email: "universidad@ceom-erp.test",
        contacto: "+591 700 00002",
      }),
      "crearInstitucion(I2)"
    ).institucionId;
    exigir(
      await agregarTenantACartera(ceomAdmin, {
        institucionId: universidadId,
        tenantId: A.tenantId,
        cohorte: "Convenio 2026",
        fechaInicio: fechaHaceNDias(20),
      }),
      "agregarTenantACartera(I2)"
    );
    const solicitudU = exigir(
      await crearSolicitudSeguimiento(ceomAdmin, {
        institucionId: universidadId,
        tenantId: A.tenantId,
        modulosSolicitados: ["financiero"],
      }),
      "crearSolicitudSeguimiento(I2)"
    );
    exigir(
      await aprobarSolicitud(A.owner, solicitudU.solicitudId, { modulosAprobados: ["financiero"] }),
      "aprobarSolicitud(I2)"
    );
    console.log("✓ I2 (Universidad del Sur): solo A, solo 'financiero' — sin auth_user_id (nunca entró).");

    // I3 — SIN correo (H-43). Existe, tiene cartera, y no puede entrar.
    const fundacionId = exigir(
      await crearInstitucion(ceomAdmin, {
        nombre: `Fundación Tejido ${SUFIJO}`,
        tipo: "organizacion",
        contacto: "+591 700 00003",
      }),
      "crearInstitucion(I3)"
    ).institucionId;
    exigir(
      await agregarTenantACartera(ceomAdmin, {
        institucionId: fundacionId,
        tenantId: B.tenantId,
        fechaInicio: fechaHaceNDias(45),
      }),
      "agregarTenantACartera(I3)"
    );
    const solicitudF = exigir(
      await crearSolicitudSeguimiento(ceomAdmin, {
        institucionId: fundacionId,
        tenantId: B.tenantId,
        modulosSolicitados: ["financiero"],
      }),
      "crearSolicitudSeguimiento(I3)"
    );
    const aprobacionF = exigir(
      await aprobarSolicitud(B.owner, solicitudF.solicitudId, { modulosAprobados: ["financiero"] }),
      "aprobarSolicitud(I3)"
    );
    // ...y se la revoca: deja la cartera VIVA sin aprobación vigente (G-05),
    // el estado que hoy ya existe en la base por accidente y que ninguna
    // pantalla explica.
    exigir(
      await revocarConsentimiento(B.owner, aprobacionF.aprobacionId),
      "revocarConsentimiento(I3)"
    );
    console.log("✓ I3 (Fundación Tejido): sin correo (H-43) y con acceso revocado pero cartera viva (G-05).");

    // --- 5. Códigos en los tres estados --------------------------------------
    const codigoActivo = exigir(
      await generarCodigoAcceso(A.owner, A.tenantId, { modulosHabilitados: ["financiero"] }),
      "generarCodigoAcceso(activo)"
    );
    const codigoARevocar = exigir(
      await generarCodigoAcceso(D.owner, D.tenantId, { modulosHabilitados: ["financiero"] }),
      "generarCodigoAcceso(a revocar)"
    );
    exigir(
      await revocarCodigoAcceso(D.owner, codigoARevocar.codigoAccesoId),
      "revocarCodigoAcceso"
    );
    console.log(
      `✓ Códigos en los 3 estados: ${codigoA.codigo} (canjeado), ${codigoActivo.codigo} (activo), ${codigoARevocar.codigo} (revocado).`
    );

  } else {
    console.log("↩︎ Instituciones y códigos ya sembrados — se saltan (ver H-42).");
  }

  // --- 6. Identidad de portal para I1 --------------------------------------
  // El vínculo se hace por la MISMA función que usa el callback del enlace
  // mágico (`vincularInstitucionAutenticada`), no con un UPDATE a mano: si
  // ese camino se rompe, este seed se rompe con él.
  const authIncubadora = await asegurarAuthUser("incubadora@ceom-erp.test");
  const vinculada = await vincularInstitucionAutenticada(
    "incubadora@ceom-erp.test",
    authIncubadora
  );
  if (!vinculada) throw new Error("No se pudo vincular la identidad de portal de la Incubadora.");
  console.log("✓ I1 vinculada a Supabase Auth — el portal autenticado ya es alcanzable.");

  // --- Resumen -------------------------------------------------------------
  console.log(`
────────────────────────────────────────────────────────────────────────
ESCENARIO DE INSTITUCIONES SEMBRADO
────────────────────────────────────────────────────────────────────────

Contraseña de todo lo sembrado: ${PASSWORD_DEMO}

NEGOCIOS
  Panificadora Aurora   aurora@ceom-erp.test    nicho_1  ingresos 200, costos 80
  Tienda Bertoni        bertoni@ceom-erp.test   nicho_4  ingresos 360, costos 75,
                                                         SIN COSTO 180  ← X-01
  Cafetería Cruz        cruz@ceom-erp.test      nicho_1  ingresos 800 (500 + 300),
                                                         1 de 2 sucursales congelada ← X-02
  Ferretería Dalmiro    dalmiro@ceom-erp.test   nicho_4  ingresos 525 — NADIE debe verlo

INSTITUCIONES
  Incubadora Andina     incubadora@ceom-erp.test   cartera: Aurora, Bertoni, Cruz
                          · Aurora  → financiero + operativo + inventario_operativo
                          · Bertoni → financiero + operativo   ← G-14 (nicho_4 "produciendo")
                          · Cruz    → financiero               ← X-02
                          · ENTRA AL PORTAL (auth_user_id vinculado)
  Universidad del Sur   universidad@ceom-erp.test  cartera: Aurora — solo financiero
                          · el MISMO negocio que la Incubadora, con menos módulos ← G-11
                          · sin auth_user_id: no puede entrar todavía
  Fundación Tejido      (sin correo)               cartera: Bertoni, acceso REVOCADO
                          · H-43: existe y no puede entrar, nada lo advierte
                          · G-05: sigue viendo el negocio en su cartera

CÓMO ENTRAR AL PORTAL COMO LA INCUBADORA (sin bandeja de correo real)
  1. Ir a /login e ingresar incubadora@ceom-erp.test / ${PASSWORD_DEMO}
  2. Va a mostrar "Tu cuenta no está completamente configurada todavía".
     Es esperado: /login busca una fila en \`usuarios\` y una Institución no
     la tiene. La SESIÓN YA QUEDÓ ABIERTA igual (signInWithPassword corre
     antes de ese chequeo).
  3. Navegar a /portal — ahí sí resuelve como Institución y muestra la cartera.

  El enlace mágico real sigue siendo el único camino de producción; esto es
  solo para QA sin depender de un correo (ver consentimiento/ANCLA.md sobre
  por qué generateLink() no sirve para simularlo).
────────────────────────────────────────────────────────────────────────
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end();
  });
