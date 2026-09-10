# Documentación de Alxarafe JS

Documentación técnica completa del monorepo **alxarafejs**: backend modular con Express 5 + TypeScript, Prisma 7 (PostgreSQL), sesiones Redis y cliente Angular.

## Índice

| Documento | Contenido |
|---|---|
| [Arquitectura](architecture.md) | Estructura del monorepo, dependencias entre paquetes, flujo de una petición |
| [API](api.md) | Endpoints, formato de respuesta estándar, paginación y query options |
| [Autenticación](auth.md) | Sesiones, CSRF y flujos de registro/login/verificación/reset |
| [Base de datos](database.md) | Modelo de datos Prisma, migraciones y decisiones de diseño |
| [Seguridad](security.md) | Helmet, rate limiting, CORS, bcrypt, hashing de tokens, enumeración de usuarios |
| [Email](email.md) | Transportes SMTP / fichero dev, plantillas enviadas |
| [Cliente web](web.md) | Aplicación Angular 20, páginas, servicios, guards e interceptor |
| [Módulos](modules.md) | **Diseño (sin implementar)**: `modules/` como plugins, ciclo de vida, manifest, adaptación dinámica de Prisma |
| [Desarrollo](development.md) | Puesta en marcha, variables de entorno, scripts y buenas prácticas |

## Mapa de paquetes

```
alxarafejs/
├── apps/
│   ├── api/       # Aplicación backend: monta middleware, routers, Swagger, bootstrap
│   └── web/       # Aplicación frontend (Angular 20)
├── packages/
│   ├── core/       # Infraestructura compartida (env, logger, HTTP, tokens, validación, paginación)
│   ├── database/   # Esquema Prisma y cliente PostgreSQL
│   ├── session/    # Sesiones Redis + protección CSRF
│   ├── users/      # Dominio de usuarios (modelo, repositorio, servicio, router, guards)
│   ├── auth/       # Dominio de autenticación (registro, login, emails, reset)
│   └── email/      # Envío de correo (SMTP o transporte a fichero en dev)
```

Dependencia de paquetes (acíclica):

```
core → database → email / session → users → auth → api
```