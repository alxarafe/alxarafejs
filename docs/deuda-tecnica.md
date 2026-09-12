# Deuda técnica de Alxarafe JS

Registro vivo de las deudas técnicas conocidas del proyecto. Se actualiza a
medida que se localizan nuevas deudas o se resuelven las existentes.

**Estado**: `Abierta` = pendiente; `Aceptada` = asumida de forma consciente
(suele ir con una nota de por qué); `En curso` = se está pagando; `Resuelta`.

**Cómo se añade**: al localizar una deuda, añadir una fila con evidencia
(fichero:línea) y prioridad. Una deuda sin evidencia reproducible no es deuda:
es opinión. Cuando se decide **no** pagarla, cambia a `Aceptada` y se explica.

## Registro

| ID | Prioridad | Estado | Área | Deuda | Evidencia |
|----|-----------|--------|------|-------|-----------|
| TD-01 | P0 | Resuelta | Reproducibilidad | Un clon limpio no instalaba ni compilaba: el lockfile referenciaba `modules/contacts` y `@alxarafe/database` re-exportaba modelos que solo existen con el módulo materializado. **Resuelta 12-sep-2026**: re-exports eliminados, fallback de `DATABASE_URL` en `prisma.config.ts` y `env.ts`, aliases vitest a `src/`, cadena limpia verde (install→test→build) sin `.env` ni módulos | `packages/database/src/index.ts`; `prisma.config.ts`; `packages/core/src/config/env.ts`; `vite.config.mts` |
| TD-02 | P0 | Resuelta | CLI / Seguridad | La CLI ejecutaba shell con interpolación de argumentos (`execSync`) y sin validar nombre ni confinar la ruta dentro de `modules/`. **Resuelta 12-sep-2026**: validación `[a-z][a-z0-9_-]*` en los 4 comandos, `runArgs` con `spawnSync` sin shell (clone / `--filter` / `db:migrate`), allowlist de URLs git, chequeo de directorio en rutas locales y tests de validadores | `packages/cli/src/helpers.ts`; `packages/cli/src/module.ts`; `packages/cli/src/__tests__/cli-helpers.test.ts` |
| TD-03 | P0 | Abierta | Seguridad | CSRF solo está montado bajo `/auth`; las mutaciones de los módulos no lo requieren | `packages/auth/src/authRouter.ts:94`; `apps/api/src/app.ts:52-53` |
| TD-04 | P0 | En curso | Config / Runtime | Producción no falla de forma segura: `SESSION_SECRET` con default, SMTP cae a disco en silencio, faltan `PUBLIC_WEB_URL` y `TRUST_PROXY`. **En curso 12-sep-2026**: runtime subido a Node 24 LTS (`.tool-versions`, `engines`, Docker, CI); queda el resto y alinear `@types/node` (sigue `^22`) | `packages/core/src/config/env.ts:26`; `packages/email/src/index.ts:61`; `Dockerfile:2,30` |
| TD-05 | P1 | Abierta | Autorización | No hay modelo de ownership/tenancy; `requireRole` existe sin uso; cualquier sesión válida lista usuarios y muta todos los contactos | `packages/users/src/guards.ts:44`; `modules/contacts/src/contactRouter.ts` |
| TD-06 | P1 | Abierta | Contrato | `validateRequest` valida con Zod pero descarta el dato parseado; los controllers siguen usando `req.body`/`req.params` sin normalizar | `packages/core/src/utils/httpHandlers.ts:9` |
| TD-07 | P2 | Abierta | API | El rate limiter usa `windowMs = 15 * 60 * COMMON_RATE_LIMIT_WINDOW_MS`; con el default de 1000 ms documentado como ventana de 1 s, la ventana real es 15 min | `packages/core/src/middleware/rateLimiter.ts:10` |
| TD-08 | P1 | Abierta | Web / Auth | Los enlaces de email apuntan a `HOST:PORT` y a rutas (`/verify-email`, `/reset-password`) que el frontend no tiene; `appBaseUrl` usa el bind en vez de una URL pública | `packages/auth/src/authService.ts:13,140,190` |
| TD-09 | P1 | Abierta | Auth | Registro crea cuenta antes de enviar el correo (si SMTP falla queda cuenta huérfana y el reintento da 409); verificación/reset no atómicos; la anti-enumeración de forgot se rompe si el envío falla | `packages/auth/src/authService.ts:31-57,124-156` |
| TD-10 | P1 | Abierta | Email / Tests | `EMAILS_DIR` no lo respeta el emisor: `@alxarafe/email` escribe siempre en `<cwd>/emails`, mientras el runner Bruno lee de `EMAILS_DIR` | `packages/email/src/index.ts:14`; `packages/auth/src/authDevRouter.ts:10` |
| TD-11 | P1 | Abierta | Datos | Sin estrategia reproducible de migraciones de módulos: `add` solo hace `prisma generate`; `remove --drop-schema` genera una migración local | `packages/cli/src/module.ts:200-203,246-252` |
| TD-12 | P1 | En curso | Tests / CI | Los 65 tests cubren core y contacts; faltan tests de auth, users, session, CSRF, CLI, Prisma real, startup y shutdown. **En curso 12-sep-2026**: se añadió `.github/workflows/ci.yml` (cadena limpia) y se fijó el runner web (Jasmine/Karma con `ng test`, sección 6 de la política); queda cubrir los huecos de cobertura | `vite.config.mts`; `.github/workflows/ci.yml` |
| TD-13 | P1 | Abierta | Runtime | `app.listen` arranca antes de confirmar `redisClient.connect()` (sin `catch`); health solo comprueba que Express responde; el manejador final rompe el envelope; shutdown fuerza `process.exit` | `apps/api/src/index.ts:10-29`; `apps/api/src/healthCheckRouter.ts:16-18` |
| TD-14 | P2 | Abierta | Contacts | Casteos `as Promise<...>` silencian posibles divergencias con los tipos Prisma generados | `modules/contacts/src/contactRepository.ts:84,88,96,110,123,145` |
| TD-15 | P2 | Aceptada | Contacts | El puerto `ContactRepository` filtra tipos Prisma en su firma. **Aceptada**: pasó el criterio anti-abstracción (un solo adaptador); pagarla = definir DTOs propios y desacoplar el servicio, solo si aparece un segundo adaptador | `modules/contacts/src/contactRepository.ts:67` |
| TD-16 | P2 | Abierta | Contacts | Los tests usan `as never` para el repositorio falso; habría que tiparlo contra la interfaz `ContactRepository` para eliminar el desajuste | `modules/contacts/src/__tests__/contactService.test.ts:73` |
| TD-17 | P2 | Abierta | Config | `HOST` se documenta como bind pero no se pasa a `app.listen`; a la vez se reutiliza para construir URLs públicas | `apps/api/src/index.ts:14`; `docs/development.md:52` |
| TD-18 | P2 | Abierta | Docs | Deriva doc-código: `web.md` afirma que no se usa Zone.js (está en polyfills), `database.md` sitúa `prisma.config.ts` en `packages/database`, `README` recomienda `pnpm install` antes de crear `.env`, y la doc antigua "nunca submódulos" convive con la política nueva | `docs/web.md:3`; `docs/database.md:4`; `README.md:43-44` |
| TD-19 | P2 | Abierta | DevEx | `start:dev` observa solo `apps/api/src/index.ts`; los imports workspace resuelven `dist/` previos de los packages, por lo que cambios en fuentes no se reconstruyen | `package.json` (`start:dev`) |
| TD-20 | P2 | Abierta | Docker / Supply chain | Sin `.dockerignore`; la imagen copia árboles completos de `apps/` y `packages/`; base fijada a tag EOL y no a digest; sin `HEALTHCHECK`, SBOM, firma ni escaneo | `Dockerfile` |

## Fuente

La mayor parte de los ítems proviene de la auditoría externa
[`docs/codex.md`](codex.md) (2026-09-12), **verificada contra el código** al
incorporarse a esta lista. TD-14, TD-15 y TD-16 proceden del piloto de
fronteras puerto/adaptador de `contacts` (septiembre de 2026).