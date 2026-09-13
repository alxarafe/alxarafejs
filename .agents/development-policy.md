# Política de desarrollo de Alxarafe JS

Reglas adicionales del proyecto (complementa `AGENTS.md`). Cada decisión declara **qué**
se decidió, **por qué** y **cómo se verifica**. Solo es política lo que está decidido;
las decisiones de arquitectura pendientes se registran en `docs/deuda-tecnica.md` y
no se implementan sin decidirlas antes.

Cuando se cite un módulo como ejemplo, se nombra por su **repositorio publicado**
(p. ej. `git@github.com:alxarafe/alxarafejs-contacts.git`), nunca por una ruta local:
una instalación limpia del núcleo no trae módulos.

## 1. El núcleo se instala sin módulos

- **Decisión.** Un clon de `alxarafejs` trae solo el núcleo (`apps/`, `packages/`,
  `config/`). `modules/` se materializa después, por desarrollador, vía
  `pnpm alxarafe module add <nombre> --from <repo-git>`.
- **Por qué.** El núcleo debe poder construirse, probarse y ejecutarse sin ninguna
  extensión; los módulos son opcionales y de terceros.
- **Verificación.** Un clon limpio (sin `.env`, sin módulos, sin `dist/`) completa la
  cadena de la sección 2.

## 2. Cadena reproducible (prioridad 1)

- **Decisión.** Cualquier pipeline (local, CI, Docker) arranca de un checkout limpio
  y ejecuta, en orden: instalación congelada (`--frozen-lockfile`), `prisma generate`,
  lint, tests, build e imagen.
- **Por qué.** Si el resultado depende de un clon con módulos, de `dist/` previos o de
  artefactos locales, deja de ser reproducible y auditable.
- **Verificación.** Dos builds consecutivos en directorios vacíos producen el mismo
  resultado sin estado local.

## 3. Fronteras por paquete (hexagonal proporcional)

- **Decisión.** En cada paquete, el servicio (lógica de aplicación) depende de
  **puertos** (interfaces), no de adaptadores. Prisma, Express, Redis y SMTP viven
  solo en adaptadores y se componen en el punto de entrada de cada pieza.
- **Por qué.** La lógica no debe arrastrar infraestructura concreta y debe poder
  probarse con dobles.
- **Criterio anti-sobre-ingeniería.** Un puerto se crea solo cuando existe variación
  (≥2 adaptadores o tests con fakes). Un único adaptador sin fakes → clase directa,
  sin interfaz.
- **Verificación.** En un servicio no debe aparecer `import { prisma }`, `express` o
  `redis`; las dependencias se reciben por constructor.

## 4. Los módulos cumplen el mismo contrato

- **Decisión.** Todo módulo se materializa localmente (nunca como submódulo), declara
  su manifest (nombre, dependencias, entrada HTTP, fragmento Prisma) y aplica la
  misma frontera puerto/adaptador que los paquetes.
- **Por qué.** El núcleo valida manifiestos y carga por ruta; un contrato uniforme
  hace verificables los módulos sin acoplarlos al núcleo.
- **Verificación.** `pnpm alxarafe module validate` y tests con repositorio inyectable.

## 5. Seguridad transversal

- **Decisión.** Las políticas de seguridad (CSRF, autenticación, rate limit,
  validación) se instalan en el núcleo del pipeline HTTP, no por módulo, para que
  ninguna extensión pueda omitirlas por descuido.
- **Estado.** CSRF solo está activo bajo `/auth`; su aplicación global es pendiente.

## 6. Frontend (apps/web)

### Versión de Angular

- **Decisión.** El frontend usa la major **activa** de Angular. Hoy: v22
  (migrado desde v20 el 12-sep-2026; v20 quedaba sin soporte el 28-nov-2026).
  Las migraciones se hacen con `ng update` una major a la vez y se
  verifican con build y tests antes de cerrarlas.
- **Por qué.** Quedarse en una major cercana a su EOL arrastra un framework
  declarado fuera de soporte y sin parches de seguridad.
- **Verificación.** `apps/web/package.json` apunta a la major activa;
  `pnpm --filter @alxarafe/web build` y `ng test` pasan tras cada migración.

### CRUD declarativo

- **Decisión.** Los CRUD del frontend se generan desde un descriptor
  `ResourceConfig` (vía `ResourceService`, `CrudListComponent` y
  `CrudFormComponent` en `core/resources/`). Un recurso nuevo se **declara**
  (ruta, columnas y campos del formulario); las páginas a mano quedan solo
  para UIs a medida (login, dashboards).
- **Por qué.** Es la contraparte clienta de resource-controller: renderer
  único, y el costo de un recurso nuevo es declararlo, no duplicar
  tabla + formulario.
- **Verificación.** Listado, formulario y paginación salen del descriptor
  sin lógica propia por página.

### Tests del frontend

- **Decisión.** Los tests de `apps/web` son Jasmine/Karma colocalizados
  (`src/**/*.spec.ts`) y se ejecutan con `ng test`; no forman parte del
  vitest de raíz (que solo incluye `*.test.ts`). La lógica pura se extrae
  en funciones (p. ej. `buildFormGroup`) y se testea sin DOM.
- **Por qué.** Karma es el runner que configura Angular CLI; el vitest de
  raíz no detecta `*.spec.ts` y mezclar ambos es confuso.
- **Verificación.** `ng test --watch=false --browsers=ChromeHeadless` pasa.

## 7. Tests

- **Decisión.** Las pruebas unitarias del núcleo viven colocalizadas junto al
  código (`src/*.test.ts`) y las ejecuta el vitest de raíz (`pnpm test`). La
  lógica de integración —más de una pieza, infraestructura real o recursos
  efímeros— vive en `tests/` de la pieza correspondiente y no forma parte del
  vitest por defecto. El frontend es la excepción (Jasmine/Karma, sección 6).
- **Por qué.** Unitarias cerca del código hacen que el fallo señale la pieza
  concreta; integración separada porque requiere contexto (BD real, picos,
  fakes de red) y un coste distinto.
- **Verificación.** `pnpm test` pasa en un checkout limpio (sin `dist/`) sin
  construir antes: vitest resuelve los paquetes workspace (`@alxarafe/*`) a su
  fuente (`packages/*/src/index.ts`) vía `resolve.alias` en `vite.config.mts`.

## 8. Módulos: artefactos solo en `modules/` y en la caché

- **Decisión.** Un módulo solo aporta código a su repositorio
  (`modules/<nombre>/`): fragmento Prisma, historia propia de migraciones
  (`database/prisma/migrations/`, mirror `prisma/migrations/`) y frontend. El
  núcleo no trackea ningún artefacto de módulo. Las piezas que Prisma necesita
  se ensamblan en una caché local fuera de git (`.cache/`), regenerada
  por completo por `module sync` al añadir, activar, desactivar o actualizar un
  módulo: núcleo con prefijo `00-`, módulos `01-`, `02-`, … en orden de
  `dependsOn`.
- **Por qué.** Hay una BD y un esquema; Prisma no admite historias de migración
  múltiples. La caché es un artefacto derivado, reproducible y sin estado
  residual. Mecánica completa y pruebas en `docs/migrations.md`.
- **Verificación.** El despliegue usa `module sync` + `prisma migrate deploy`
  sobre la caché. Un `git grep -iE '<nombre-de-módulo>'` sobre archivos
  trackeados fuera de `docs/` y `.agents/` no devuelve código ni lockfile.

## 9. Decisiones de arquitectura pendientes

No implementar ninguna sin acordarla antes con el usuario. La lista viva y su
razonamiento viven en `docs/deuda-tecnica.md` (sección "Decisiones de
arquitectura pendientes"): ownership de datos, hosting y URL pública del
frontend, descriptor de campos derivado del contrato OpenAPI/Zod del servidor y
composición del frontend de módulos en `apps/web`.