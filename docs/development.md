# Desarrollo

## Requisitos

- **Node.js ≥ 23** (ver `.tool-versions`).
- **pnpm** `12.4.1` (`packageManager`).
- **PostgreSQL** en `localhost:5433` y **Redis** en `localhost:6379` (por defecto en `.env`).

## Puesta en marcha

```bash
pnpm install              # instala dependencias y genera el cliente Prisma (postinstall)
cp .env.example .env      # ajusta conexiones/servicios si hace falta
pnpm db:migrate           # crea/esquematiza la base de datos
pnpm start:dev            # API en http://localhost:8080 (tsx watch)
```

Cliente (opcional):

```bash
pnpm --filter @alxarafe/web start   # http://localhost:4200, proxy /api → 8080
```

## Variables de entorno (`.env`)

| Variable | Default | Uso |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` \| `test`; en producción no se monta `/auth/dev` |
| `PORT` / `HOST` | `8080` / `localhost` | Bind del servidor y base para URLs de email |
| `CORS_ORIGIN` | `http://localhost:8080` | Origen permitido para CORS con credenciales |
| `COMMON_RATE_LIMIT_WINDOW_MS` | `1000` | Ventana del rate limiter |
| `COMMON_RATE_LIMIT_MAX_REQUESTS` | `20` | Máx. peticiones por ventana/IP |
| `DATABASE_URL` | `postgresql://alxarafe:alxarafe@localhost:5433/alxarafejs` | Leída por `prisma.config.ts` (adapter de Prisma 7) |
| `REDIS_URL` | `redis://localhost:6379` | Store de sesiones |
| `SESSION_SECRET` | dev-only | Secreto de sesión (≥16 chars, cambiar en prod) |
| `SESSION_NAME` | `sid` | Nombre de la cookie |
| `SESSION_TTL_SECONDS` | `604800` | TTL de sesión (7 días) |
| `SMTP_HOST` | *(vacío)* | Si está vacío → correos a `./emails` en vez de SMTP |
| `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | `587` / — / — | SMTP con autenticación opcional |
| `EMAIL_FROM` | `no-reply@alxarafe.com` | Remitente de todos los correos |

## Scripts (raíz)

| Script | Descripción |
|---|---|
| `pnpm start:dev` | API en dev (tsx watch, recarga en caliente) |
| `pnpm build` | Compila librerías con `tsup --dts` y la API con `tsc -b` (`-r run build`) |
| `pnpm start:prod` | Ejecuta la compilación de producción (`node apps/api/dist/index.js`) |
| `pnpm test` | Vitest (passWithNoTests) |
| `pnpm test:cov` | Cobertura |
| `pnpm check` | Biome lint + formato (`--write`) |
| `pnpm db:generate` / `db:migrate` / `db:push` / `db:deploy` / `db:studio` | Comandos Prisma |
| `pnpm --filter @alxarafe/web ...` | Build/start/test del cliente |

## Test

- Framework **Vitest** + `supertest` para la API.
- Los tests actuales cubren: helpers de paginación (`$top/$skip/$count`, `nextLink`/`previousLink`), parser `$filter` y el endpoint de health.
- Se testean los paquetes de forma unitaria; los casos E2E que necesiten Redis/DB se marcan/handicapan para CI (ver suites existentes).

## Convenciones

1. **Envelope estándar**: los servicios devuelven `ServiceResponse`; los controllers solo `res.status(sr.statusCode).send(sr)`. No escribir respuestas ad-hoc en el router.
2. **Paginación**: listas → `PaginatedList` con `data` + `pagination` (helpers de `@alxarafe/core`).
3. **Dependencias acíclicas**: `core → database → email/session → users → auth → api`. No importar "hacia arriba".
4. **Validación con Zod** en el router antes de entrar al servicio (`validateRequest`).
5. **Biome** como formatter/linter: la raíz excluye `apps/web`.
6. **Nada de secrets** en código ni commits; usar `.env` (`.env.example` versionado, `.env` ignorado).

## Documentación

- `docs/` (este índice) es la referencia canónica. Mantenerla sincronizada al cambiar contratos (envelope, endpoints, query options, flujos de auth).