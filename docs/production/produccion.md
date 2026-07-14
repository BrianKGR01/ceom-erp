# CEOM-ERP — Producción (VPS + Supabase self-hosted)

> **Qué es este documento:** el runbook técnico de la Fase 4, 5 y 6 del roadmap (`docs/roadmap/roadmap.md`). Cubre desde contratar el VPS hasta operar en producción. **No es para ejecutar todavía** — se activa recién cuando el roadmap llegue a la Fase 4 (Core + los dos nichos del MVP ya construidos y probados en el entorno de desarrollo). Documentarlo ahora evita que, llegado el momento, se tomen decisiones de infraestructura apuradas.

---

## 1. Filosofía de esta fase

Dos entornos que en algún momento van a correr **el mismo stack** (Next.js + Supabase), pero con una diferencia central: en desarrollo, Supabase es un servicio gestionado (Supabase Cloud); en producción, es un conjunto de contenedores Docker que administrás vos mismo en el VPS. Esa diferencia es exactamente la razón por la que en `CEOM_Arquitectura.md` (sección 6.2) se eligió Drizzle con migraciones en SQL plano: las mismas migraciones corren en los dos.

Lo que **no** es igual entre entornos y hay que tratar con cuidado en esta fase:
- Backups, TLS, actualizaciones de versión: en Supabase Cloud son invisibles (Supabase los gestiona); en self-hosted, son responsabilidad tuya desde el primer día.
- La versión de Postgres puede diferir: Supabase Cloud suele correr una versión más nueva que la que trae por defecto el self-hosted — se valida esto explícitamente antes de migrar (sección 6).

---

## 2. Especificación del VPS

| Recurso | Mínimo aceptable | Recomendado para producción real |
|---|---|---|
| vCPU | 2 | **4** |
| RAM | 4 GB | **8 GB** |
| Disco | 60 GB SSD | 100+ GB SSD (dejar margen para backups locales antes de subirlos fuera del servidor) |
| Sistema operativo | Ubuntu 24.04 LTS | igual |

El stack de Supabase self-hosted corre entre 11 y 13 contenedores (Postgres, GoTrue/Auth, PostgREST, Realtime, Storage, imgproxy, postgres-meta, Studio, Kong, Edge Functions, y opcionalmente Logflare/Vector para analítica). Sumale el contenedor del frontend Next.js y Traefik. Con 2 vCPU / 4 GB alcanza para validar que todo funciona, pero no es el tamaño con el que se recomienda operar de cara al público — subir a 4 vCPU / 8 GB es el ajuste más barato y más importante de toda esta fase.

**Nota de resource-trimming:** si el VPS contratado queda ajustado de recursos, los servicios de analítica (Logflare, Vector) y de transformación de imágenes (imgproxy) se pueden deshabilitar sin perder ninguna funcionalidad del ERP — no forman parte de lo que CEOM necesita operar.

---

## 3. Preparación del servidor (antes de tocar Supabase)

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Docker + Docker Compose (repo oficial de Docker, no el paquete de Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# cerrar sesión y volver a entrar para que el grupo tome efecto

# Firewall — solo lo estrictamente necesario
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# SSH: deshabilitar login por password, solo llaves (editar /etc/ssh/sshd_config)
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart sshd

# fail2ban, como capa adicional contra fuerza bruta sobre SSH
sudo apt install -y fail2ban
```

**Checklist de esta sección:**
- [ ] Usuario no-root con acceso a Docker, no trabajar como root de forma rutinaria.
- [ ] SSH solo por llave, `fail2ban` activo.
- [ ] Firewall (`ufw`) activo, solo 22/80/443 abiertos hacia afuera.
- [ ] Dominio (o subdominio) apuntando al VPS, antes de seguir (hace falta para el TLS de Traefik).

---

## 4. Despliegue de Supabase self-hosted

```bash
# Clonar el repo oficial (siempre el oficial, nunca un fork sin auditar)
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

cp .env.example .env

# CRÍTICO: nunca arrancar con los valores de .env.example — son públicos y conocidos.
# El propio repo trae un generador de secretos:
sh ./utils/generate-keys.sh
```

Editar `.env` con, como mínimo:
- `POSTGRES_PASSWORD` — solo letras y números (caracteres especiales rompen el parseo del connection string en algunos servicios).
- `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` — regenerados por `generate-keys.sh`, nunca los de ejemplo.
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — credenciales de Studio, el panel de administración de este Supabase.
- `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` — apuntando al dominio real, no a `localhost`.
- SMTP para el envío de emails de Auth (confirmación, recuperación de contraseña) — Supabase recomienda un proveedor tipo AWS SES por costo/confiabilidad.

```bash
docker compose up -d
docker compose logs -f    # confirmar que todos los servicios llegan a "healthy"
```

**Regla de seguridad no negociable:** en `docker-compose.yml`, **solo Kong** (el API Gateway, puerto 8000/8443) se expone hacia afuera. Nunca publicar directamente los puertos de Postgres, GoTrue, PostgREST, etc. — todo pasa por Kong.

**Checklist de esta sección:**
- [ ] `.env` con secretos generados, nunca los de ejemplo.
- [ ] Solo Kong expuesto; el resto de los servicios solo accesibles dentro de la red interna de Docker.
- [ ] Los 11-13 contenedores en estado `healthy` (`docker compose ps`).
- [ ] Studio accesible solo detrás de las credenciales de `DASHBOARD_USERNAME`/`PASSWORD` (y, después de la sección 5, detrás de TLS).

---

## 5. Reverse proxy con Traefik + TLS

Supabase mantiene un ejemplo oficial de self-hosting con Traefik como reverse proxy — es la referencia a seguir en vez de improvisar la configuración desde cero. Traefik se encarga de:
- Terminar TLS con certificados de Let's Encrypt, renovados automáticamente.
- Enrutar `api.tudominio.com` → Kong (Supabase) y `app.tudominio.com` → el contenedor del frontend Next.js.

**Checklist de esta sección:**
- [ ] Traefik corriendo como su propio servicio Docker, con acceso a la red de Supabase y a la del frontend.
- [ ] Certificados de Let's Encrypt emitidos y renovándose automáticamente (verificar con `docker compose logs traefik`).
- [ ] `curl -I https://api.tudominio.com/auth/v1/health` responde `200` sobre HTTPS.
- [ ] Puerto 80 solo redirige a 443 (no queda nada servido en texto plano).

---

## 6. Frontend: ¿self-hosted en el VPS, o se queda en Vercel?

Esta es una decisión que conviene tomar explícitamente en esta fase, no dar por sentada:

| Opción | A favor | En contra |
|---|---|---|
| **Frontend en el mismo VPS** (Docker + Traefik) | Todo bajo un mismo techo, coherente con el objetivo de independencia total planteado desde el principio | Sumás un contenedor más para monitorear, y perdés el CDN/edge de Vercel |
| **Frontend se queda en Vercel, solo el backend migra al VPS** | Vercel sigue dando CDN, preview deployments y despliegue instantáneo sin mantenimiento | El objetivo final ("todo en mi VPS") queda parcialmente sin cumplir; y el dato de latencia Vercel↔VPS pasa a importar |

El objetivo que planteaste desde el inicio es tener todo en el VPS — así que la ruta por defecto de este documento es **self-hostear también el frontend** (build de producción de Next.js, corriendo en un contenedor Docker propio, detrás del mismo Traefik). Si en el momento de llegar a esta fase preferís mantener el frontend en Vercel por practicidad, es una desviación válida — pero conviene decidirlo a conciencia, no por default.

---

## 7. Backups (se configuran antes de migrar cualquier dato real — no después)

### 7.1 Base de datos

```bash
#!/bin/bash
# backup-db.sh
BACKUP_DIR="/opt/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump \
  -U postgres --clean --if-exists --no-owner \
  postgres > "${BACKUP_DIR}/ceom_${TIMESTAMP}.sql"

# Retener solo los últimos 14 backups locales
find "$BACKUP_DIR" -name "ceom_*.sql" -mtime +14 -delete
```

Programado por `cron` (ej. diario a las 3 AM), y **copiado fuera del VPS** (a un bucket S3-compatible barato, o al mismo Backblaze B2 que ya usan para Storage) — un backup que vive solo en el mismo servidor que falla no es un backup.

### 7.2 Storage (archivos)

Los archivos de Supabase Storage no viajan con `pg_dump` — se respaldan aparte (los metadatos sí están en la base, pero los binarios están en el bucket). Si Storage ya usa Backblaze B2 como backend (según lo definido en Módulo 1), el propio B2 puede tener versionado/retención configurado directamente ahí, sin necesidad de un script adicional.

### 7.3 Prueba de restauración

Un backup que nunca se restauró no está probado. Calendarizar una restauración de prueba (ej. mensual, en un contenedor descartable) como tarea recurrente — no un checkbox de "una sola vez".

**Checklist de esta sección:**
- [ ] Backup de base de datos automatizado (cron) y corriendo.
- [ ] Copia fuera del VPS (no solo local).
- [ ] Backup/versionado de Storage confirmado.
- [ ] Al menos una restauración de prueba ya ejecutada con éxito, antes de mover datos reales.

---

## 8. Migración de datos: Supabase Cloud (dev) → Self-hosted (producción)

Este es el paso más delicado de todo el runbook — se sigue el camino oficial documentado por Supabase (`supabase db dump`), no un `pg_dump` genérico, porque el CLI ya sabe qué excluir/incluir correctamente.

### 8.1 Verificación previa

- **Versión de Postgres:** Supabase Cloud suele correr una versión más nueva (ej. 17) que la que trae el self-hosted por defecto (15). Antes de migrar, confirmar la versión del proyecto Cloud y, si difieren, iniciar el self-hosted ya con la misma versión mayor — evita columnas/tablas de Auth o Storage que no existan todavía del lado self-hosted.
- **Roles con contraseña propia:** si se crearon roles custom con `LOGIN` en el proyecto Cloud, sus contraseñas **no** viajan en el dump — hay que recrearlas manualmente.

### 8.2 Extracción (desde una máquina con el Supabase CLI, apuntando al proyecto Cloud)

```bash
supabase db dump --db-url "[CONNECTION_STRING_CLOUD]" -f roles.sql --role-only
supabase db dump --db-url "[CONNECTION_STRING_CLOUD]" -f schema.sql
supabase db dump --db-url "[CONNECTION_STRING_CLOUD]" -f data.sql --use-copy --data-only
```

### 8.3 Restauración (contra el Postgres self-hosted del VPS)

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "postgres://postgres:[POSTGRES_PASSWORD]@[dominio-vps]:5432/postgres"
```

`session_replication_role = replica` desactiva temporalmente triggers y validación de foreign keys durante la carga masiva de datos — necesario porque los datos se insertan fuera de orden de dependencias; se reactiva solo al terminar la transacción.

### 8.4 Problemas conocidos y cómo se resuelven (documentados por la propia comunidad de Supabase)

| Síntoma | Causa | Solución |
|---|---|---|
| Falla por tablas/columnas que no existen (ej. `auth.oauth_clients`, columnas nuevas en `auth.flow_state`) | El proyecto Cloud corre una versión de Auth más nueva que la imagen self-hosted | Actualizar la imagen de GoTrue del self-hosted a una versión compatible, o comentar esas líneas `COPY ... FROM stdin;` puntuales del dump si no se usan esas funciones (OAuth social, por ejemplo) |
| `auth.uid()` no existe después de migrar | El schema `auth` no se incluyó completo en el dump | Volver a exportar con `--schema=auth` explícito |
| Login roto después de la migración | `JWT_SECRET` no coincide entre Auth Cloud y Auth self-hosted | Esto es **esperado** — no es un error, ver 8.5 |
| Contraseñas de roles custom no funcionan | No se exportan por diseño | Recrearlas manualmente contra el self-hosted |

### 8.5 Consecuencia ineludible: todas las sesiones de usuario se invalidan

El `JWT_SECRET` del entorno self-hosted es distinto al de Supabase Cloud — por diseño, no por error. Esto significa que **todos los usuarios existentes van a tener que volver a iniciar sesión** después del corte. Esto se planifica y se comunica de antemano (sección 9), no se descubre el día del corte.

---

## 9. Migración de Storage (buckets)

Los binarios de Storage se migran aparte del `pg_dump` — se descargan del bucket de origen y se vuelven a subir al backend de destino (mismo Backblaze B2, o el bucket local del self-hosted, según lo que se defina). Confirmar después de la migración que los metadatos de `storage.objects` (que sí vinieron en el dump de datos) referencian rutas que efectivamente existen en el nuevo backend.

---

## 10. Día del corte (cutover)

- [ ] Ventana de mantenimiento planificada y comunicada (aunque sea a un solo cliente piloto en esta etapa).
- [ ] Congelar escritura en el entorno de desarrollo (Supabase Cloud) — nadie genera datos nuevos mientras se migra.
- [ ] Ejecutar 8.2 → 8.3 → verificación de conteo de filas por tabla (comparar contra el origen).
- [ ] Migrar Storage (sección 9).
- [ ] Reconfigurar proveedores de login social (Google, etc.) con las nuevas URLs de redirect apuntando al dominio self-hosted, si corresponde.
- [ ] Apuntar DNS / variables de entorno del frontend al VPS.
- [ ] Avisar a los usuarios existentes que deberán volver a iniciar sesión.
- [ ] **Plan de rollback:** el entorno de Supabase Cloud no se apaga ni se borra hasta confirmar, con datos reales circulando unos días en el VPS, que todo funciona — recién ahí se degrada a solo staging.

---

## 11. Operación continua (Fase 6)

- Actualizar versiones de las imágenes de Supabase self-hosted siguiendo el changelog oficial — nunca actualizar a ciegas ni todos los servicios a la vez.
- Monitoreo básico: healthchecks de Kong/Auth/Storage vía un endpoint simple (`/auth/v1/health`, `/storage/v1/status`), revisado periódicamente (cron + alerta, o un servicio externo de uptime).
- Restauración de prueba periódica (no solo backup — sección 7.3), para que "tenemos backups" siga siendo cierto con el tiempo.
- Documentar cada incidente de producción y su resolución — este mismo archivo es el lugar para ir sumando ese historial con el tiempo.