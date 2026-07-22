// IDs fijos de datos de sistema, sembrados en
// drizzle/migrations/0005_seed_ceom_ops_tenant.sql — no cambiar sin generar
// una migracion que actualice ambos lados.
export const CEOM_OPS_TENANT_ID = "4ee580bc-14d8-49a4-b8c9-468569467f2f";
export const ROL_OWNER_ID = "17eb761e-9cd1-43bd-9590-b5e9d8657b43";
export const ROL_CEOM_ADMIN_ID = "c1027307-fc75-4517-b2af-9687234c694d";

// Identidad real y acotada del Gateway de Consentimiento (Etapa 4.a del
// backstop de RLS, docs/security/PLAN-RLS-BACKSTOP.md §13/§14, Opcion A' --
// sembrados en drizzle/migrations/0034_gateway_sistema_seed.sql). Rol
// PROPIO, deliberadamente distinto de ROL_CEOM_ADMIN_ID: es lo que separa
// el bypass de RLS del Gateway (es_gateway_sistema(), filtra por este id
// puntual) del de un ceom_admin humano (es_ceom_admin(), filtra por rol) --
// ver el comentario "REGLA DURA" junto a tienePermiso() en actions.ts. No
// cambiar sin generar una migracion que actualice ambos lados.
export const ROL_GATEWAY_SISTEMA_ID = "a3f1c9d2-8b47-4e6a-9c3d-1f2e3a4b5c6d";
export const GATEWAY_SISTEMA_USUARIO_ID = "b4e2d0a3-9c58-4f7b-8d4e-2a3b4c5d6e7f";

// Modulo_01 seccion 12: valores default, ajustables a futuro desde el Panel
// Administrativo CEOM (Modulo 11) sin requerir cambio de codigo.
export const DURACION_INVITACION_DIAS = 7;
export const DURACION_ETAPA_SOLO_LECTURA_DIAS = 3;
