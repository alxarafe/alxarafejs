# Migraciones y caché de módulos

> **Estado:** política **decidida y ratificada** (12-sep-2026), validada con
> prototipo. Sustituye a la materialización actual por la que los módulos
> dejaban sus migraciones en la historia del núcleo (`docs/modules.md` §5a) y
> corrige TD-11. La integración del tooling en la CLI sigue pendiente (sección 7).

## 1. El problema

Hay **una sola base de datos** PostgreSQL y un esquema Prisma que se ensambla
con piezas del núcleo y de los módulos activos. Los módulos son opcionales, de
terceros y no deben dejar rastro en el repositorio del núcleo.

Hoy las migraciones de un módulo caen **dentro de la historia del núcleo**
(`packages/database/prisma/migrations`), que es el único destino que conoce
`prisma migrate dev`. Para evitar commitearlas existen reglas ad hoc en
`.gitignore:19-21`, y aun así una migración de módulo
(`20260912132910_contacts_is_customer`) llegó a commitearse. Falta un mecanismo
donde **cada módulo posea su propia historia de migraciones**.

## 2. La propuesta: caché de módulos

Una carpeta **gitignored** (`.cache/`) es el único punto por el que los
módulos entregan artefactos al núcleo. No se edita a mano: se **borra y se
regenera por completo** en cada activación/desactivación/actualización de
módulos. Así, su contenido es una función pura de (estado del núcleo + módulos
activos + commits de sus repos). Nunca hay estado residual.

```
.cache/
  manifest.json          # trazabilidad: qué se construyó, de qué repo@commit
  prisma/                # esquema multiarchivo: schema.prisma + models/<módulo>.prisma
  migrations/            # historia fusionada y ordenada, base de `prisma migrate deploy`
  web/                   # (futuro) frontend de los módulos, misma mecánica
```

### 2.1 Qué se copia a `migrations/` y en qué orden

Prisma aplica las migraciones en **orden lexicográfico de nombre**. La caché
aprovecha esa propiedad: al copiar, se renombran las carpetas con un prefijo que
impone el orden real.

1. **Núcleo** → prefijo `00-` (se copia `packages/database/prisma/migrations`
   completa, incluido `migration_lock.toml`).
2. **Módulos activos** → prefijo `01-`, `02-`, … en el orden que resuelve un
   orden topológico sobre `dependsOn` (los `dependsOn` que apuntan a paquetes
   del núcleo como `core`, `database`, `users` se ignoran). Ciclos → error.

Cada módulo guarda su historia en `modules/<nombre>/database/prisma/migrations/`
(mirror: `modules/<nombre>/prisma/migrations/`), con su `migration.sql` y su
`migration_lock.toml`. Al fusionarse, el lockfile de los módulos se descarta: en
la caché solo queda el del esquema unificado.

Resultado: `00-core…`, `01-alpha…`, `02-beta…`; `prisma migrate deploy` sobre la
caché aplica primero el núcleo y luego cada módulo sin chocar.

### 2.2 Regeneración y determinismo

- Gatillos: `module add`, `module enable`, `module disable`, `module remove`,
  `module update <nombre>` (tras pull) y un paso del pipeline (`postinstall` y
  un paso de CI/despliegue antes de `prisma generate`/`migrate deploy`).
- **Estricto**: un módulo marcado `enabled` en `config/modules.json` pero ausente
  en `modules/` hace fallar el sync con un mensaje claro. Nada se silencia.
- **Explícito, no implícito**: `module sync` no se ejecuta dentro de `prisma
  migrate dev`; si se regenerase en mitad de una sesión dev se perdería una
  migración recién generada que aún no se ha atribuido a su repo (sección 3).

## 3. Ciclo de vida de una migración en un módulo

```
autor del módulo                       núcleo (recibidor)
─────────────────                      ─────────────────────
1. module sync                     →   caché con esquema + historia fusionados
2. prisma migrate dev              →   escribe migración nueva en caché/migrations
3. module attribute <migración.sql>    atribuye tablas → dueño (core o módulo)
4. se copia la migración nueva          a modules/<nombre>/database/prisma/migrations/
5. module sync                     →   caché regenerada; la migración ya no está "suelta"
```

El paso 3 (`module attribute`) lee el SQL y detecta las tablas que toca
(`CREATE/ALTER/DROP TABLE`, `CREATE INDEX … ON`, `REFERENCES`). Compara contra
el esquema ensamblado en caché (`models/*.prisma` + `schema.prisma`) y devuelve
un dueño **único**; si una migración toca tablas de dos dueños se marca como
mezcla para que el autor la parta.

## 4. Despliegue y pruebas

- **Despliegue real**: `module sync` → `prisma migrate deploy` (el
  `migrations.path` de `prisma.config.ts:10` apunta a la caché).
- **Tests/integración**: se sigue usando `prisma db push` contra la misma caché
  (`scripts/bruno-db.sh:16`), sin tocar la historia.
- **Desactivar un módulo**: `module disable` regenera la caché sin su historia y
  deja un `*_drop_*_schema` en la historia del propio módulo para retirar sus
  tablas (hoy esa responsabilidad está en el núcleo: `.gitignore:21`).

## 5. Reutilización de la caché: una mecánica, muchos artefactos

El motor es genérico: resuelve los módulos activos una vez (topo-sort, estricto,
commits) y construye **cada** artefacto cacheado con la misma mecánica (borrar,
copiar en orden, registrar en `manifest.json`). Un artefacto nuevo es solo un
objeto `{ name, dir, build(ctx) }`:

| Artefacto | Contenido | Núcleo | Por módulo (en orden) |
|-----------|-----------|--------|------------------------|
| `migrations` | historia fusionada | `00-*` | `01-*`, `02-*`, … |
| `prisma` | esquema multiarchivo | `schema.prisma` | `models/<name>.prisma` |
| `web` (ejemplo) | frontend de módulos | — | `web/<name>/` |

El `ctx` ofrece `root`, `active` (ordenados), `dst`, `prefix(i)`, `rel()`,
`add(source, file)`. Nuevas piezas (emails, assets estáticos…) se añaden igual,
sin tocar el motor.

## 6. Qué se gana y qué se renuncia

- **Gana**: cero referencias a módulos en el núcleo trackeado; `.gitignore:19-21`
  se sustituye por una regla única de caché; determinismo y trazabilidad
  (`manifest.json`); un solo patrón para migrations, schema, frontend y lo que
  venga.
- **Se renuncia**: `prisma migrate dev` del núcleo ya no ve las tablas de
  módulos en su shadow DB (hoy se evita con `db push`); la atribución de nuevas
  migraciones requiere el paso 3-4 de la sección 3; la ordenación global depende
  del prefijo de la caché, no de los timestamps de repos independientes.

## 7. Estado de la implementación

- **Validado** con prototipo (`.cache/cache-prototype/`): `sync.mjs` +
  `attribute.mjs` + motor genérico `lib/cache-core.mjs` + artefactos en
  `lib/artifacts.mjs`. Probar la ordenación:
  `MODULES_DIR=…/fixtures/modules CONFIG_PATH=…/fixtures/config.json
  CACHE_DIR=…/fixtures/cache node sync.mjs`
  → `00-core`, `01-…alpha`, `02-…beta`.
- **Pendiente de integrar**: comandos `module sync` y
  `module attribute` en `@alxarafe/cli`; apuntar `prisma.config.ts` a la caché;
  regla única de caché en `.gitignore`; tests del runner.