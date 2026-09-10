# Arquitectura

## Visión general

Monorepo gestionado con **pnpm workspaces** (`pnpm-workspace.yaml` cubre `apps/*` y `packages/*`). Dos aplicaciones y seis librerías publicadas con el scope `@alxarafe/`.

- **Backend**: Express 5 + TypeScript, Prisma 7 con driver adapter `@prisma/adapter-pg` (PostgreSQL), sesiones Redis.
- **Frontend**: Angular 20 (standalone, signals, SCSS) con proxy de desarrollo hacia la API.
- **Calidad**: Biome (lint/formato), Vitest (tests), `tsc -b` (build por proyectos).

## Estructura y responsabilidades

| Paquete | Rol |
|---|---|
| `@alxarafe/core` | Infraestructura transversal: `env` validado con Zod, `logger` (pino), middlewares (`rateLimiter`, `requestLogger`, `errorHandler`), `ServiceResponse`, helpers de paginación y parser de `$filter`, tokens y validación común |
| `@alxarafe/database` | Schema Prisma (`User`, `EmailVerificationToken`, `PasswordResetToken`) y cliente PostgreSQL |
| `@alxarafe/session` | Middleware `express-session` con store Redis + `csrfProtection` (patrón double-submit) |
| `@alxarafe/users` | Dominio de usuarios: modelo Zod/OpenAPI, repositorio, servicio con paginación/filtrado, controller y guards (`requireAuth`, `requireRole`) |
| `@alxarafe/auth` | Autenticación: registro, login, logout, verificación de email, reseteo de contraseña, endpoint de CSRF; router + OpenAPI registry + dev router |
| `@alxarafe/email` | `nodemailer` con transporte SMTP o transporte de desarrollo que escribe `.eml` en `./emails` |
| `@alxarafe/api` | Aplicación: compone middlewares, monta routers, sirve Swagger UI y arranca el servidor |
| `@alxarafe/web` | Cliente Angular 20 |

## Regla de dependencias

Las dependencias entre paquetes son **acíclicas**:

```
core → database → email / session → users → auth → api
```

Cada paquete compila de forma independiente con `tsc -b` (project references), lo que garantiza límites claros entre dominios.

## Flujo de una petición

```
Navegador
   │  (cookie de sesión + X-CSRF-Token en mutaciones)
   ▼
Express app (apps/api/src/server.ts)
   │
   1. express.json / urlencoded          → parseo del body
   2. cors(credentials)                  → origen permitido
   3. helmet()                           → cabeceras de seguridad
   4. rateLimiter                        → límite por IP
   5. requestLogger                      → request-id + pino-http
   6. sessionMiddleware                  → sesión Redis (cookie) + CSRF token
   7. Router
       │  /health-check  /auth  /users  (+ /auth/dev solo en desarrollo)
       │  └─ guards → validateRequest(Zod) → controller → service → repository
   8. openAPIRouter                      → Swagger UI y /swagger.json
   9. errorHandler                       → 404 + registro de errores
```

Los **servicios** devuelven `ServiceResponse` (nunca lanzan para errores de negocio); el **controller** solo hace `res.status(sr.statusCode).send(sr)`. Esto uniformiza el contrato de la API.

## Contrato de respuesta (envelope)

Toda respuesta de la API usa el envelope `ServiceResponse`:

```typescript
interface ServiceResponse<T> {
  success: boolean;
  message: string;
  responseObject: T;   // cuerpo del dominio: entidad, lista paginada o null
  statusCode: number;
}
```

Véase [api.md](api.md) para el detalle del contrato, y [users](../packages/users/) como referencia del patrón *router → controller → service → repository*.