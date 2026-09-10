# Alxarafe JS — Monorepo

Backend modular con Express 5 y TypeScript + cliente Angular. Documentación completa en [`docs/`](docs/README.md).

## Estructura

```
├── apps/
│   ├── api/            # Aplicación: monta middleware + routers + swagger + bootstrap
│   └── web/            # Cliente web (Angular 20)
├── packages/
│   ├── core/           # Infraestructura compartida (env, logger, HTTP, tokens, validación, paginación)
│   ├── database/       # Esquema Prisma y cliente de base de datos (PostgreSQL)
│   ├── email/          # Envío de correo (SMTP o transporte a fichero en dev)
│   ├── session/        # Sesiones Redis + protección CSRF
│   ├── users/          # Dominio de usuarios (modelo, repositorio, servicio, router, guards)
│   └── auth/           # Dominio de autenticación (registro, login, emails, reset)
```

Cada paquete se publica de forma independiente (`@alxarafe/core`, `@alxarafe/auth`, …) y sigue la regla de dependencias acíclicas: `core → database → email/session → users → auth → api`.

## Documentación

| Documento | Contenido |
|---|---|
| [Arquitectura](docs/architecture.md) | Estructura, dependencias, flujo de una petición, contrato de respuesta |
| [API](docs/api.md) | Endpoints, envelope estándar, paginación y query options |
| [Autenticación](docs/auth.md) | Sesiones, CSRF y flujos de registro/login/verificación/reset |
| [Base de datos](docs/database.md) | Modelo Prisma y decisiones de diseño |
| [Seguridad](docs/security.md) | Helmet, rate limiting, CORS, bcrypt, anti-enumeración |
| [Email](docs/email.md) | Transportes SMTP / fichero dev |
| [Cliente web](docs/web.md) | Angular: rutas, servicios, guards, interceptor |
| [Desarrollo](docs/development.md) | Puesta en marcha, variables de entorno, scripts, convenciones |

## Requisitos

- Node.js ≥ 23 (ver `.tool-versions`)
- PostgreSQL y Redis en ejecución (ver `.env.example`)

## Puesta en marcha

```bash
pnpm install        # instala dependencias y genera el cliente Prisma
cp .env.example .env
pnpm db:migrate     # crea/esquema de la base de datos
pnpm start:dev      # arranca el servidor de desarrollo
```

## Scripts

| Script            | Descripción                                        |
| ----------------- | -------------------------------------------------- |
| `pnpm start:dev`  | Servidor de desarrollo (tsx watch)                 |
| `pnpm build`      | Compila todos los paquetes (orden topológico)      |
| `pnpm start:prod` | Ejecuta la compilación de producción               |
| `pnpm test`       | Tests (vitest)                                     |
| `pnpm check`      | Lint y formato (Biome)                             |
| `pnpm db:*`       | Comandos de Prisma (migrate, push, studio, deploy) |

## API

Entorno de desarrollo: `http://localhost:8080`. La API sigue un **envelope estándar** (`ServiceResponse`) y los listados son **paginados** (estilo OData):

```
GET /users?$top=10&$skip=20&$count=true&$filter=role eq 'ADMIN'&$orderby=name asc
```

- `GET /health-check` — Estado del servicio
- `GET /` — Swagger UI (`/swagger.json` para el espec raw)
- `POST /auth/register|login|logout|verify-email|forgot-password|reset-password`
- `GET /auth/me|csrf`, `POST /auth/resend-verification`
- `GET /users`, `GET /users/:id` (requieren sesión)

Detalle de contratos, paginación y query options en [docs/api.md](docs/api.md).

En `NODE_ENV=development`, `GET /auth/dev/email-tokens?email=...&purpose=verify|reset` extrae el token del último correo generado en `./emails`.

## Email en desarrollo

Con `SMTP_HOST` vacío, los correos se escriben como ficheros `.eml` en `./emails` para inspeccionarlos sin servidor SMTP.

## Licencia

MIT