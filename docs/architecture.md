# Arquitectura

## Visión general

Monorepo gestionado con **pnpm workspaces** (`pnpm-workspace.yaml` cubre `apps/*` y `packages/*`). Dos aplicaciones y seis librerías publicadas con el scope `@alxarafe/`.

- **Backend**: Express 5 + TypeScript, Prisma 7 con driver adapter `@prisma/adapter-pg` (PostgreSQL), sesiones Redis.
- **Frontend**: Angular 20 (standalone, signals, SCSS) con proxy de desarrollo hacia la API.
- **Calidad**: Biome (lint/formato), Vitest (tests), `tsup` (build de librerías) + `tsc` (build de la app).

## Estructura y responsabilidades

| Paquete | Rol |
|---|---|
| `@alxarafe/core` | Infraestructura transversal: `env` validado con Zod, `logger` (pino), middlewares (`rateLimiter`, `requestLogger`, `errorHandler`), `ServiceResponse`, helpers de paginación y parser de `$filter`, tokens, validación común y **gestor de módulos** (`ModuleManager`)
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

Cada librería compila de forma independiente con `tsup`, lo que garantiza límites claros entre dominios.

## Estrategia de compilación (ESM)

Todo el backend es **ESM** (`"type": "module"`). Dos perfiles distintos de `tsc`:

| Capa | Dev | Producción | `tsconfig` |
|---|---|---|---|
| `apps/api` | `tsx watch` | `tsc` + `node` (emit directo) | `module: NodeNext` |
| `packages/*` | `tsup --watch` | `tsup --dts` | `module: ESNext` + `moduleResolution: Bundler` |

- **Librerías (`packages/*`)**: `tsup` transpila con esbuild (rápido) y `--dts` genera las declaraciones vía `tsc`. El código fuente usa resolución `Bundler` (imports sin extensión); el emit ESM sale a `dist/` y se consume por `exports`.
- **App (`apps/api`)**: emite con `tsc` a `dist/` y se ejecuta con `node` nativo, por eso sus imports deben llevar extensión `.js` (`NodeNext`).
- `dist/` de los packages no se versiona; se reconstruye con `pnpm build`.

## Gestor de módulos

`@alxarafe/core` expone `ModuleManager`: escanea `packages/` y `modules/`, lee su
`module.json`, valida el grafo de dependencias y resuelve qué módulos están activos.

- **Descubrimiento**: cada carpeta con `module.json` es una unidad. `packages/` →
  *package* (plataforma, siempre activo); `modules/` → *module* (extensión activable).
- **Validación** (fallo rápido en `strict`): nombres duplicados, dependencias que no
  existen (`MODULE_DEPENDENCY_NOT_FOUND`), ciclos (`MODULE_DEPENDENCY_CYCLE`) y módulos
  activos con dependencias desactivadas (`MODULE_DEPENDENCY_DISABLED`).
- **Activación** (precedencia de mayor a menor): env → `config/modules.json`
  (fichero local, gitignored) → `enabledDefault` del manifest. Env:
  `ALXARAFE_MODULES_ENABLED` y
  `ALXARAFE_MODULES_DISABLED` (separados por coma). Los *packages* no se desactivan.
- **Carga en `apps/api`**: `createApp()` consulta `getEnabledFeatureModules()` e importa
  cada módulo activo **por ruta del sistema de archivos** (`import(pathToFileURL(mod.directory/server.entry))`,
  por defecto `dist/index.js`), montando el router exportado en `server.mountPath`.
  El monorepo no declara dependencia npm de los módulos; el acoplamiento es por
  directorio `modules/` vía `pnpm-workspace.yaml`. Un módulo desactivado **no se
  importa ni se ejecuta**.

El grafo de dependencias se testea en `packages/core/src/modules/moduleManager.test.ts`.

La gestión operativa de módulos (instalar, activar, desactivar, desinstalar)
vive en el paquete `@alxarafe/cli` (`pnpm alxarafe module ...`); los módulos se
entregan como **repos git propios clonados localmente** (nunca trackeados en el
núcleo: `modules/` está en `.gitignore`). Detalle: [modules.md](modules.md).

## Flujo de una petición

```
Navegador
   │  (cookie de sesión + X-CSRF-Token en mutaciones)
   ▼
Express app (apps/api/src/app.ts)
   │
   1. express.json / urlencoded          → parseo del body
   2. cors(credentials)                  → origen permitido
   3. helmet()                           → cabeceras de seguridad
   4. rateLimiter                        → límite por IP
   5. requestLogger                      → request-id + pino-http
   6. sessionMiddleware                  → sesión Redis (cookie) + CSRF token
   7. Router
       │  /health-check  /auth  /users  (+ /auth/dev solo en desarrollo)
       │  └─ Módulos de negocio activos (p. ej. /contacts), cargados por el gestor
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