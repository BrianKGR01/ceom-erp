// Esquema temporal de Fase 0, ahora vacio: la tabla setup_healthcheck se uso
// solo para verificar la conexion de Drizzle Kit contra Supabase Cloud y se
// elimino a proposito (ver migraciones 0000/0001). El esquema real de cada
// modulo se escribe en Fase 1, en src/modules/<modulo>/schema.ts, despues de
// leer su docs/modules/Modulo_XX.md correspondiente (regla 8 de AGENTS.md).
