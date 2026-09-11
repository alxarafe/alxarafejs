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
| [Módulos](modules.md) | **Implementado**: `modules/` como plugins, ciclo de vida (install/enable/disable/uninstall), manifest, composición de Prisma y gestión git (submodules) con el CLI `alxarafe module` |
| [Desarrollo](development.md) | Puesta en marcha, variables de entorno, scripts y buenas prácticas |

## Mapa de paquetes

```
alxarafejs/
├── apps/
│   ├── api/       # Aplicación backend: monta middleware, routers, Swagger, bootstrap
│   └── web/       # Aplicación frontend (Angular 20)
├── packages/
│   ├── core/       # Infraestructura compartida (env, logger, HTTP, tokens, validación, paginación, ModuleManager)
│   ├── database/   # Esquema Prisma y cliente PostgreSQL
│   ├── session/    # Sesiones Redis + protección CSRF
│   ├── users/      # Dominio de usuarios (modelo, repositorio, servicio, router, guards)
│   ├── auth/       # Dominio de autenticación (registro, login, emails, reset)
│   ├── email/      # Envío de correo (SMTP o transporte a fichero en dev)
│   └── cli/        # CLI de gestión: `pnpm alxarafe module ...` (list/validate/enable/disable/add/remove)
├── modules/        # Módulos de negocio opcionales (git submodules: modules/contacts)
└── config/
    └── modules.json # Activación de módulos (enabled/disabled)
```

Dependencia de paquetes (acíclica):

```
core → database → email / session → users → auth → api
```

Los módulos (`modules/`) dependen de la plataforma (p. ej. `contacts` →
`core`, `database`, `users`) pero la plataforma nunca depende de ellos:
se cargan dinámicamente por ruta en `apps/api`.