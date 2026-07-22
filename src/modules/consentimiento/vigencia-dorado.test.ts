import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { borrarUsuariosAuth, limpiarConAuthGarantizada } from "@/test-utils/limpieza";
import {
  aprobarSolicitud,
  crearInstitucion,
  crearSolicitudSeguimiento,
  revocarConsentimiento,
  tieneConsentimiento,
} from "./actions";
import { aprobacionesTenant, instituciones, solicitudesSeguimiento } from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

// Round-trips reales contra el pooler de sa-east-1 (§8.3 del plan de RLS ya
// midió ~250-850ms por round-trip) -- varios escenarios encadenan 6-8 de
// ellos (crear solicitud + aprobar + consultar TS + consultar SQL, por
// escenario). Mismo criterio que consentimiento.test.ts.
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

/**
 * Test dorado (docs/security/PLAN-RLS-BACKSTOP.md §16.4, §7 decisión 3 del
 * plan original — pedido en la Etapa 4.b, nunca diseñado hasta ahora).
 *
 * Corre el MISMO conjunto de escenarios sintéticos contra dos caminos
 * independientes que responden preguntas RELACIONADAS pero no idénticas:
 *   - TS: `tieneConsentimiento(institucionId, tenantId, modulo)` — el
 *     contrato completo, por institución puntual (`consentimiento/actions.ts`).
 *   - SQL: `tenant_tiene_consentimiento_vigente(tenantId, modulo)` — el
 *     backstop GRUESO de 4.b.0 (`0038_tenant_tiene_consentimiento_vigente_function.sql`),
 *     por tenant+módulo, sin distinguir institución (§16.9.1 — 4.b.1, que sí
 *     distingue institución, está deliberadamente diferido, §16.11 decisión 2).
 *
 * Por esa diferencia de alcance, los escenarios se dividen en dos grupos:
 *   1. COMPARACIÓN DORADA — un solo par institución-tenant en juego, tenant
 *      "activo". Acá SÍ tienen que coincidir siempre: si divergen, o el SQL
 *      tiene un bug de re-derivación, o el TS lo tiene, y este test es la
 *      única forma de detectar cuál.
 *   2. BRECHAS DOCUMENTADAS — casos donde la divergencia es ESPERADA porque
 *      4.b.0 es deliberadamente más grueso que `tieneConsentimiento()`
 *      (bloqueo de tenant, multi-institución). No son escenarios "en rojo"
 *      — afirman la brecha explícitamente, para que quede visible y con
 *      test si alguna vez alguien intenta angostarla sin querer (o si 4.b.1
 *      la cierra a propósito, este test es el que hay que actualizar).
 */
describe.skipIf(!hasCredenciales)("Vigencia de consentimiento — test dorado TS vs SQL (Etapa 4.b.0)", () => {
  let admin: ReturnType<typeof crearClienteAdmin>;
  const sufijo = Date.now();
  const prefijoTenant = `Vigencia Dorado ${sufijo}`;
  const prefijoInstitucion = `Institucion Vigencia Dorado ${sufijo}`;
  let ownerId: string;
  let ownerReal: UsuarioConRol;
  let tenantDelOwnerId: string;

  beforeAll(async () => {
    admin = crearClienteAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: `vigencia-dorado-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("setup fallo: createUser");
    ownerId = data.user.id;

    // Un solo Owner real, reusado como aprobador (aprobaciones_tenant.aprobado_por,
    // FK real que exige una fila de usuarios existente) en TODOS los
    // escenarios -- cada escenario recibe su PROPIO tenant (ver
    // crearTenantDeEscenario), así que lo que varía por escenario es
    // `{ ...ownerReal, tenantId }`, nunca una fila de usuarios nueva. Esto es
    // lo que hace que cada escenario del Grupo 1 quede realmente aislado: sin
    // esto, todos compartían el mismo tenantId y una aprobación vigente de un
    // escenario anterior contaminaba el chequeo GRUESO (por tenant, no por
    // institución) de los escenarios siguientes -- exactamente el bug que
    // este archivo encontró en su primera corrida real, antes de este
    // rediseño (ver el commit de esta etapa para el "antes" documentado).
    const { tenant: tenantDelOwner } = await identidadRepo.crearTenantConOwner({
      tenant: {
        // Mismo prefijo que crearTenantDeEscenario() (`${prefijoTenant} ...`)
        // a propósito: el afterAll limpia TODO por patrón de nombre, no por
        // lista de ids acumulados -- evita 30+ round-trips secuenciales en
        // la limpieza (el primer diseño de este archivo excedía el
        // hookTimeout default de vitest, 10s, por eso).
        nombreNegocio: `${prefijoTenant} Owner`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Vigencia Dorado",
      ownerEmail: `vigencia-dorado-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantDelOwnerId = tenantDelOwner.id;
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    if (!owner) throw new Error("setup fallo: obtenerUsuarioConRolPorId");
    ownerReal = owner;
  });

  afterAll(async () => {
    // Limpieza por PATRÓN de nombre, no por lista de ids acumulados -- una
    // sola query por tabla sin importar cuántos escenarios corrieron (7
    // round-trips totales, no ~30+). Orden por FK: solicitudes_seguimiento
    // referencia tanto tenant_id COMO institucion_id -- tiene que salir
    // ANTES de intentar borrar cualquiera de los dos padres (bug real
    // encontrado en la primera corrida de este archivo: borrar
    // instituciones antes reventaba con 23503).
    await limpiarConAuthGarantizada(
      async () => {
        const tenantsDeEsteArchivo = db
          .select({ id: tenants.id })
          .from(tenants)
          .where(like(tenants.nombreNegocio, `${prefijoTenant}%`));
        const institucionesDeEsteArchivo = db
          .select({ id: instituciones.id })
          .from(instituciones)
          .where(like(instituciones.nombre, `${prefijoInstitucion}%`));

        await db.delete(solicitudesSeguimiento).where(inArray(solicitudesSeguimiento.tenantId, tenantsDeEsteArchivo));
        await db
          .delete(aprobacionesTenant)
          .where(inArray(aprobacionesTenant.institucionId, institucionesDeEsteArchivo));
        await db.delete(instituciones).where(like(instituciones.nombre, `${prefijoInstitucion}%`));
        await db.delete(aprobacionesTenant).where(inArray(aprobacionesTenant.tenantId, tenantsDeEsteArchivo));
        // Solo tenantDelOwnerId tiene filas reales de usuarios/roles/sucursales
        // (crearTenantConOwner las siembra) -- los demás tenants de este archivo
        // son inserts crudos de solo la tabla tenants (crearTenantDeEscenario),
        // sin Owner real detrás -- nada que limpiar ahí salvo el tenant mismo.
        await db.delete(usuarios).where(eq(usuarios.tenantId, tenantDelOwnerId));
        await db.delete(roles).where(eq(roles.tenantId, tenantDelOwnerId));
        await db.delete(sucursales).where(eq(sucursales.tenantId, tenantDelOwnerId));
        await db.delete(tenants).where(like(tenants.nombreNegocio, `${prefijoTenant}%`));
      },
      () => borrarUsuariosAuth(admin, [ownerId])
    );
  });

  /** Llama directo a la función SQL candidata — sin pasar por RLS/policy,
   * mismo criterio que llamar directo a `tieneConsentimiento()`: se está
   * probando la REGLA, no el mecanismo de autorización que la envuelve
   * después (eso lo prueban los tests de aislamiento, §16.10). */
  async function consultarFuncionSqlDirecto(
    tenant: string,
    modulo: "financiero" | "operativo" | "inventario_operativo"
  ): Promise<boolean> {
    const [fila] = await db.execute<{ vigente: boolean }>(
      sql`select public.tenant_tiene_consentimiento_vigente(${tenant}::uuid, ${modulo}::modulo_veedor) as vigente`
    );
    return fila.vigente;
  }

  /** Tenant desechable, propio de un escenario — insert directo (sin
   * `crearTenantConOwner`, que crea un Owner/auth.users nuevo por llamada,
   * el costo real que hacía timeoutear la versión anterior de este archivo).
   * El "Owner" de este tenant, a los efectos de `aprobarSolicitud()`, es
   * `ownerReal` con el `tenantId` pisado — `requiereOwnerDelTenant()`
   * (`consentimiento/actions.ts`) solo compara en memoria
   * `solicitante.esOwner && solicitante.tenantId === tenantId`, nunca vuelve
   * a leer la fila de `usuarios` — mismo criterio ya usado en todo el
   * proyecto para solicitantes sintéticos (`{ rolId: ROL_CEOM_ADMIN_ID, rol:
   * { esRolSistema: true } }`, sin fila real, en decenas de tests). El único
   * campo que SÍ tiene que ser real es `solicitante.id` (FK de
   * `aprobado_por`) — por eso viene de `ownerReal`, no se inventa. */
  async function crearTenantDeEscenario(nombre: string): Promise<{
    tenantId: string;
    solicitante: UsuarioConRol;
  }> {
    const [tenant] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `${prefijoTenant} ${nombre}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    return { tenantId: tenant.id, solicitante: { ...ownerReal, tenantId: tenant.id } };
  }

  async function crearInstitucionDePrueba(sufijoPropio: string) {
    const institucion = await crearInstitucion(
      { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
      { nombre: `${prefijoInstitucion} ${sufijoPropio}`, tipo: "incubadora" }
    );
    if (!institucion.ok) throw new Error("setup fallo: crearInstitucion");
    return institucion.data.institucionId;
  }

  async function aprobar(
    solicitante: UsuarioConRol,
    institucionId: string,
    tenantId: string,
    modulos: Array<"financiero" | "operativo" | "inventario_operativo">
  ) {
    const solicitud = await crearSolicitudSeguimiento(
      { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
      { institucionId, tenantId, modulosSolicitados: modulos }
    );
    if (!solicitud.ok) throw new Error("setup fallo: crearSolicitudSeguimiento");
    const aprobacion = await aprobarSolicitud(solicitante, solicitud.data.solicitudId, {
      modulosAprobados: modulos,
    });
    if (!aprobacion.ok) throw new Error("setup fallo: aprobarSolicitud");
    return aprobacion.data.aprobacionId;
  }

  describe("Grupo 1 — comparación dorada (un solo par institución-tenant, tienen que coincidir SIEMPRE)", () => {
    it("escenario: aprobación vigente, módulo incluido -> true en ambos", async () => {
      const { tenantId, solicitante } = await crearTenantDeEscenario("caso1");
      const institucionId = await crearInstitucionDePrueba("caso1");
      await aprobar(solicitante, institucionId, tenantId, ["financiero"]);

      const resultadoTs = await tieneConsentimiento(institucionId, tenantId, "financiero");
      const resultadoSql = await consultarFuncionSqlDirecto(tenantId, "financiero");

      expect(resultadoTs).toBe(true);
      expect(resultadoSql).toBe(true);
      expect(resultadoSql).toBe(resultadoTs);
    });

    it("escenario: aprobación vigente, módulo NO incluido -> false en ambos", async () => {
      const { tenantId, solicitante } = await crearTenantDeEscenario("caso2");
      const institucionId = await crearInstitucionDePrueba("caso2");
      await aprobar(solicitante, institucionId, tenantId, ["financiero"]);

      const resultadoTs = await tieneConsentimiento(institucionId, tenantId, "operativo");
      const resultadoSql = await consultarFuncionSqlDirecto(tenantId, "operativo");

      expect(resultadoTs).toBe(false);
      expect(resultadoSql).toBe(false);
      expect(resultadoSql).toBe(resultadoTs);
    });

    it("escenario: única aprobación revocada -> false en ambos ('revocada mata')", async () => {
      const { tenantId, solicitante } = await crearTenantDeEscenario("caso3");
      const institucionId = await crearInstitucionDePrueba("caso3");
      const aprobacionId = await aprobar(solicitante, institucionId, tenantId, ["financiero"]);
      const revocacion = await revocarConsentimiento(solicitante, aprobacionId);
      if (!revocacion.ok) throw new Error("setup fallo: revocarConsentimiento");

      const resultadoTs = await tieneConsentimiento(institucionId, tenantId, "financiero");
      const resultadoSql = await consultarFuncionSqlDirecto(tenantId, "financiero");

      expect(resultadoTs).toBe(false);
      expect(resultadoSql).toBe(false);
      expect(resultadoSql).toBe(resultadoTs);
    });

    it("escenario: ninguna aprobación existe -> false en ambos", async () => {
      const { tenantId } = await crearTenantDeEscenario("caso4");
      const institucionId = await crearInstitucionDePrueba("caso4");

      const resultadoTs = await tieneConsentimiento(institucionId, tenantId, "financiero");
      const resultadoSql = await consultarFuncionSqlDirecto(tenantId, "financiero");

      expect(resultadoTs).toBe(false);
      expect(resultadoSql).toBe(false);
      expect(resultadoSql).toBe(resultadoTs);
    });

    it("escenario: aprobar de nuevo (la más reciente reemplaza) -> ambos ven SOLO el alcance de la nueva", async () => {
      const { tenantId, solicitante } = await crearTenantDeEscenario("caso5");
      const institucionId = await crearInstitucionDePrueba("caso5");
      await aprobar(solicitante, institucionId, tenantId, ["financiero"]);
      // repository.ts:crearAprobacionTenant() revoca la anterior antes de
      // insertar (SS16.9.3, indice unico parcial) -- la vieja deja de contar
      // para AMBOS lados sin que nadie la revoque a mano.
      await aprobar(solicitante, institucionId, tenantId, ["operativo"]);

      const tsFinanciero = await tieneConsentimiento(institucionId, tenantId, "financiero");
      const sqlFinanciero = await consultarFuncionSqlDirecto(tenantId, "financiero");
      const tsOperativo = await tieneConsentimiento(institucionId, tenantId, "operativo");
      const sqlOperativo = await consultarFuncionSqlDirecto(tenantId, "operativo");

      expect(tsFinanciero).toBe(false);
      expect(sqlFinanciero).toBe(false);
      expect(tsOperativo).toBe(true);
      expect(sqlOperativo).toBe(true);
    });
  });

  describe("Grupo 2 — brechas documentadas (divergencia ESPERADA, alcance deliberado de 4.b.0, §16.9.1/§16.9.2)", () => {
    it("brecha aceptada: tenant bloqueado NO lo sabe tenant_tiene_consentimiento_vigente() -- solo tieneConsentimiento() lo chequea", async () => {
      const { tenantId, solicitante } = await crearTenantDeEscenario("caso6");
      const institucionId = await crearInstitucionDePrueba("caso6");
      await aprobar(solicitante, institucionId, tenantId, ["financiero"]);

      await db
        .update(tenants)
        .set({ estadoSuscripcion: "vencida", fechaProximoPago: "2020-01-01" })
        .where(eq(tenants.id, tenantId));

      const resultadoTs = await tieneConsentimiento(institucionId, tenantId, "financiero");
      const resultadoSql = await consultarFuncionSqlDirecto(tenantId, "financiero");

      // Divergen A PROPOSITO: el bloqueo de tenant es una decision 100% de
      // aplicacion (estado_acceso nunca es un concepto de RLS en este plan,
      // mismo criterio que current_tenant_id()/crudPolicy() -- ni siquiera el
      // aislamiento tenant-propio lo modela). Si esta aserción empieza a
      // fallar porque alguien "arregló" tenant_tiene_consentimiento_vigente()
      // para que también mire estado_acceso, está bien -- pero hay que
      // actualizar ESTE test a propósito, no dejar que falle en silencio.
      expect(resultadoTs).toBe(false);
      expect(resultadoSql).toBe(true);
    });

    it("brecha aceptada: multi-institución -- SQL grueso no distingue CUÁL institución tiene el consentimiento vigente", async () => {
      const { tenantId, solicitante } = await crearTenantDeEscenario("caso7");
      const institucionConAcceso = await crearInstitucionDePrueba("caso7-con-acceso");
      const institucionSinAcceso = await crearInstitucionDePrueba("caso7-sin-acceso");
      await aprobar(solicitante, institucionConAcceso, tenantId, ["financiero"]);
      // institucionSinAcceso nunca pide ni recibe aprobación -- mismo tenant,
      // mismo módulo, otra institución.

      const tsConAcceso = await tieneConsentimiento(institucionConAcceso, tenantId, "financiero");
      const tsSinAcceso = await tieneConsentimiento(institucionSinAcceso, tenantId, "financiero");
      const sqlGrueso = await consultarFuncionSqlDirecto(tenantId, "financiero");

      expect(tsConAcceso).toBe(true);
      expect(tsSinAcceso).toBe(false);
      // El backstop grueso de 4.b.0 no sabe que institucionSinAcceso está
      // preguntando -- solo sabe "¿ALGUNA institución tiene acceso vigente a
      // este tenant+módulo?", y la respuesta a ESA pregunta es sí (porque
      // institucionConAcceso sí lo tiene). Esto es exactamente lo que 4.b.1
      // (diferido, §16.9.2/§16.11 decisión 2) cerraría si se implementa —
      // hasta entonces, la protección real contra "institución equivocada"
      // sigue siendo 100% tieneConsentimiento() en TypeScript.
      expect(sqlGrueso).toBe(true);
    });
  });

  describe("Grupo 3 — mecanismo anti-olvido (falla si la función SQL cambió sin que nadie revise este archivo)", () => {
    it(
      "snapshot de tenant_tiene_consentimiento_vigente(): si este test falla, la función cambió -- " +
        "revisar si Grupo 1/2 necesitan un escenario nuevo ANTES de actualizar el snapshot",
      async () => {
        const [fila] = await db.execute<{ def: string }>(
          sql`select pg_get_functiondef('public.tenant_tiene_consentimiento_vigente(uuid, public.modulo_veedor)'::regprocedure) as def`
        );
        expect(fila.def).toBe(
          "CREATE OR REPLACE FUNCTION public.tenant_tiene_consentimiento_vigente(tenant_objetivo uuid, modulo modulo_veedor)\n" +
            " RETURNS boolean\n" +
            " LANGUAGE sql\n" +
            " STABLE SECURITY DEFINER\n" +
            " SET search_path TO 'public', 'pg_temp'\n" +
            "AS $function$\n" +
            "  select exists (\n" +
            "    select 1 from public.aprobaciones_tenant a\n" +
            "    where a.tenant_id = tenant_objetivo\n" +
            "      and a.revocado_en is null\n" +
            "      and modulo = any(a.modulos_aprobados)\n" +
            "  )\n" +
            "$function$\n"
        );
      }
    );
  });
});
