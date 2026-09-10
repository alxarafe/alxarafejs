# Módulos del sistema (diseño)

> **Estado: propuesta de diseño, NO implementado.** Este documento describe cómo alxarafejs podría
> extender el monorepo con módulos de negocio (contactos, CRM, facturación...) desarrollados fuera
> del núcleo y compuestos de forma dinámica (instalar / activar / desactivar / eliminar).

## 1. Idea central

Alxarafejs sigue el modelo **"núcleo + plugins"**:

| Directorio | Qué contiene | Naturaleza |
|---|---|---|
| `packages/` | **Plataforma**. `core`, `database`, `session`, `users`, `auth`, `email`. | Única verdad. El monorepo no funciona sin ellos. Una sola fuente de cada uno. |
| `modules/` | **Módulos de negocio opcionales**. `contacts`, `crm`, `billing`... | Extensiones. Independientes, con su propio ciclo de vida y su propia entrega (repo o registro). Se componen al activarlos. |

Semánticamente un módulo **se comporta como un paquete workspace más**, pero:

- no se considera parte del núcleo,
- puede **activarse y desactivarse** sin tocar el código de la plataforma,
- aporta configuración propia que debe adaptarse dinámicamente al activarse o retirarse, siendo lo más crítico el **schema de Prisma**.

La frontera es organizativa/semántica: a efectos de pnpm, `modules/*`
simplemente se añade a `pnpm-workspace.yaml`. Es el **ciclo de vida** y la
**configuración declarativa** lo que diferencia un módulo de un paquete normal.

## 2. Ciclo de vida de un módulo

Cuatro estados, dos "de instalación" y dos "de ejecución":

### Instalar (`module add`)

`pnpm alxarafe module add <name> [--from npm|archivo|git]`

1. Resuelve el artefacto (registro privado, tarball o repo git — ver §6).
2. Copia el paquete a `modules/<name>`.
3. Registra el módulo en el **registro de módulos** (`modules.lock.json`).
4. Sincroniza sus fragmentos de configuración (Prisma, `.env`) y, si viene
   **activado** por defecto, ejecuta el arranque de activación (§5).

### Activar / Desactivar (`module enable|disable`)

- **`enable <name>`**: monta lo que el módulo aporta (rutas, fragmento Prisma, `env`).
- **`disable <name>`**: deja de montarlo.

**Regla por defecto: desactivar NO borra datos.** Las tablas quedan en la base
de datos y el modelo sale del cliente Prisma (deja de ser consultable), pero
la reactivación es inmediata. Borrar tablas solo ocurre cuando se **elimina**
el módulo con la opción de "desmontar schema".

### Desinstalar (`module remove`)

`pnpm alxarafe module remove <name> [--drop-schema]`

1. Ejecuta las acciones de desactivación.
2. Opcionalmente genera una migración que suelta las tablas del módulo (`--drop-schema`).
3. Quita el paquete de `modules/` y lo borra del registro.

```
add ──► installed ──► enabled ◄──► disabled ◄──► remove
          │                          │
          └──────────────────────────┘   (que no borra tablas)
```

## 3. Estructura de un módulo

```
modules/contacts/
├── module.json           # MANIFEST: declaración de lo que el módulo aporta
├── package.json          # name: @alxarafe/contacts, build: tsc -b
├── tsconfig.json
├── prisma/
│   └── contact.prisma    # fragmento de schema (solo models/enums propios)
└── src/
    ├── contactModel.ts
    ├── contactRepository.ts
    ├── contactService.ts
    ├── contactController.ts
    ├── contactRouter.ts       # router Express + zod-to-openapi registry
    └── index.ts               # monta el router, guarda el registry
```

Un módulo replica el patrón de `@alxarafe/users`: modelo Zod/OpenAPI,
repositorio Prisma, servicio con `ServiceResponse`, controller, router y
registry. Depende de la plataforma (`core`, `database`, y solo si lo necesita,
`users` para `requireRole`/`requireAuth`), nunca "hacia abajo".

## 4. El manifest (`module.json`)

Es la **fuente de verdad declarativa**. Todo lo demás (Prisma, rutas, web, env)
se deriva de él, no se reescribe código al instalar.

```jsonc
{
  "name": "contacts",
  "version": "1.0.0",
  "description": "Gestión de contactos",
  "enabledDefault": true,                 // si se activa al instalarse

  "prisma": {
    "fragment": "prisma/contact.prisma",  // fragmento a componer
    "models": ["Contact"]                 // para validación de dependencias
  },

  "server": {
    "mountPath": "/contacts",             // app.use("/contacts", ...)
    "entry": "src/index.ts"               // exporta { contactsRouter, contactsRegistry }
  },

  "env": {
    "CONTACTS_MAX_PER_PAGE": { "default": "200" } // vars que se fusionan en .env
  },

  "dependsOn": ["users"],                 // módulos/paquetes que requieren estar activos
  "optionalPeer": ["crm"]                 // integraciones opcionales con otros módulos
}
```

### Convenciones (por hacerse cumplir en el installer/CI)

- El fragmento Prisma solo declara `model`/`enum` del módulo; nunca `generator` ni `datasource`.
- El nombre de modelo está prefijado (`Contact`, no `ContactPhones`) para evitar colisiones entre módulos.
- `mountPath` no puede chocar con rutas de la plataforma ni de otro módulo activo.
- Se exige cobertura de tests en el repo del módulo antes de publicarlo.

## 5. Adaptación dinámica de configuraciones

El principio: **configuración derivada del manifest, consumo declarativo, cero reescritura de código fuente**. Cada consumidor lee estado actualizado (del `modules.lock.json` o del `MODULES_ENABLED`) en tiempo de carga.

### a) Prisma (la pieza crítica)

Prisma soporta **schema multi-archivo** (GA desde v6.7): con `schema:` apuntando a
una **carpeta**, combina todos los `.prisma` de forma recursiva y las relaciones
cruzan archivos sin imports.

Diseño:

```
packages/database/prisma/
├── schema.prisma           # el que lleva generator (ya está así)
├── migrations/             # al mismo nivel que schema.prisma (YA está así)
└── models/                 # sincronizado por el installer
    ├── user.prisma         #   (fragmentos de la plataforma, hoy dentro de schema.prisma)
    └── contact.prisma      #   (fragmento del módulo, copiado/symlinkeado)
```

Cambios necesarios en el repo para soportarlo:

1. `prisma.config.ts`: `schema: "packages/database/prisma"` (carpeta, no fichero).
2. Mover los modelos de la plataforma a `models/*.prisma` (o mantenerlos en `schema.prisma`, ambas válidas; Prisma combina).
3. `migrations/` permanece donde está.

Efecto por acción:

| Acción | Qué hace el installer |
|---|---|
| `add` (activo) | copia/symlink `modules/contacts/prisma/contact.prisma` → `packages/database/prisma/models/contact.prisma`, `pnpm db:migrate`, `prisma generate` |
| `enable` | (re)crea el symlink/copia y re-genera (`prisma generate`); si el schema cambió, migración |
| `disable` | quita el fragmento de `models/` y re-genera el cliente (las tablas se quedan en BD) |
| `remove --drop-schema` | quita el fragmento + `prisma migrate dev` que suelta las tablas |

> Nota: Prisma solo lee ficheros dentro de la carpeta configurada; los `.eml`
> fragmentos de módulos desactivados deben estar fuera (o sin extensión) para
> no colarse en el cliente.

Relaciones entre fragmentos (módulo ↔ plataforma ↔ otro módulo) funcionan, pero `dependsOn`/`optionalPeer` del manifest protegen de desactivar un módulo del que otro depende.

### b) Routers de la API

`apps/api/src/server.ts` deja de importar routers "a mano" para los módulos y los deriva del registro:

```
1. leer modules.lock.json + MODULES_ENABLED
2. para cada módulo activo → import dinámico de module.json.server.entry
3. app.use(module.mountPath, módulo.router)
```

Los módulos de la plataforma (`/auth`, `/users`) siguen montados estáticamente como hoy.

### c) Env

A la instalación, el manifest `env` se fusiona en `.env` **solo si no existen** las claves (no se pisan valores del operador). `@alxarafe/core` ya valida env con Zod; cada módulo valida sus propias claves (gateway de Zod por módulo).

### d) Web (Angular)

El cliente (`apps/web`) consume el mismo registro: rutas lazy (`loadChildren`) y menús derivados de los módulos activos. La UI de un módulo desactivado desaparece sin recompilar nada.

### e) Registro de módulos: `modules.lock.json`

```jsonc
{
  "modules": [
    {
      "name": "contacts",
      "state": "enabled",          // enabled | disabled | installed
      "source": { "type": "tarball" | "git" | "local", "ref": "..." },
      "installedAt": "2026-09-10T12:00:00Z",
      "version": "1.0.0"
    }
  ]
}
```

La lista **activa** también se expone como `MODULES_ENABLED` en `.env` (sobrescribible a mano: desactivar "a fuego" sin tocar el lock). Ambos se reconcilian en el arranque.

## 6. Entrega del paquete (mecanismo `add`)

Tres fuentes posibles, decisión pendiente:

| Fuente | Instalación | Pros | Contras |
|---|---|---|---|
| **Registro privado** (GitHub Packages / Verdaccio) | `pnpm alxarafe module add contacts` por versión | semver limpio, reproducible | hay que operar el registro; el fragmento Prisma debe viajar en el tarball |
| **Git (tag)** | clona el repo y lo compone | historia propia, sin infraestructura | pinning por tag/commit; build previo al copiar |
| **Submodule** | `git submodule add` → ya es workspace | desarrollo 100% separado con su CI | se "trae" el módulo, no se "instala"; el lock y el submodule conviven |

Independientemente de la fuente, el **installer copia el paquete dentro de `modules/`** y muta únicamente: `modules.lock.json`, la carpeta `models/` de Prisma, `.env` (merge no destructivo) y —si el flujo lo requiere— `pnpm-workspace.yaml`. Nunca edita `server.ts`, `prisma.config.ts` ni código de la plataforma.

## 7. El installer: `alxarafe module` (por construir)

Dentro de un paquete `@alxarafe/cli` (o script en `apps/tooling`), exponer:

```
alxarafe module add      <name> [--source registry|git|file] [--no-enable]
alxarafe module remove   <name> [--drop-schema]
alxarafe module enable   <name>
alxarafe module disable  <name>
alxarafe module list            # estado de todos los módulos
alxarafe module validate <name> # comprueba manifest, colisiones, dependsOn
```

Flujo común de cada comando: **validate → mutate lock/env/prisma → migrate/generate → informar**.

## 8. Decisiones de diseño fijadas (recomendadas)

1. **`modules/` = extensiones, `packages/` = plataforma.** Separación semántica; ambas son workspaces.
2. **Desactivar NO borra tablas**; solo saca el modelo del cliente Prisma y deja de montar rutas. Borrar requiere `remove --drop-schema`.
3. **Configuración declarativa derivada del manifest**; el installer nunca reescribe código fuente.
4. **El fragmento Prisma de un módulo viaja con el módulo** y se compone en `packages/database/prisma/models/` vía multi-schema.
5. **`dependsOn` + `optionalPeer`** validan el grafo antes de activar (evita desactivar dependencias en uso).
6. **Merge de env no destructivo**: las claves del manifest solo se añaden si no existen.

## 9. Preguntas abiertas

- ¿Desplazamos ya los modelos de la plataforma a `models/*.prisma` o esperamos al primer módulo?
- ¿Registramos módulos desactivados con su fragmento "apagado" (reversible sin red) o lo sacamos del directorio? (Symlink se presta a desactivar rápido: se quita/recrea el symlink.)
- ¿Un módulo puede aportar fragmentos a **otros módulos** (p. ej. tablas puente en CRM) o solo al schema combinado?
- ¿Quién ejecuta el installer en equipos: el dev en local, hook de CI, o ambos?
- ¿El web (Angular) consume el registro en build-time (genera rutas) o en runtime (lazy por feature)?