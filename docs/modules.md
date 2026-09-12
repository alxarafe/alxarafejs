# Módulos del sistema

> **Estado:** implementado: `ModuleManager` en `@alxarafe/core` (descubrimiento,
> validación de dependencias, activación por config/env), `@alxarafe/cli`
> (listado, validación, enable/disable, add/remove), primer módulo
> `@alxarafe/contacts` clonado localmente (nunca trackeado en el núcleo), y
> carga dinámica de routers por ruta en `apps/api`. Pendiente:
> `modules.lock.json`, ajuste del schema Prisma en enable/disable (symlink se
> crea/borra solo en add/remove), merge de variables env del manifest y
> adaptación web.

## 1. Idea central

Alxarafejs sigue el modelo **"núcleo + plugins"**:

| Directorio | Qué contiene | Naturaleza |
|---|---|---|
| `packages/` | **Plataforma.** `core`, `database`, `session`, `users`, `auth`, `email`. | Única verdad. El monorepo no funciona sin ellos. |
| `modules/` | **Módulos de negocio opcionales.** `contacts`, `crm`, `billing`... | Extensiones independientes. Cada una con su propio repo y ciclo de vida. Se materializan **localmente** en `modules/` (ignorado en git) al instalarse y se activan/desactivan vía CLI. |

Un módulo **se comporta como un paquete workspace más** (pnpm resuelve sus
dependencias) pero su ciclo de vida se gestiona de forma declarativa:

- Se entiende un módulo con su propio repo (habitualmente GitHub), **clonado
  localmente** en `modules/<nombre>`. Ese directorio **nunca se trackea** en
  el núcleo: `modules/*` está en `.gitignore` y los enlaces (fragment Prisma,
  migraciones) son artefactos locales que se crean al instalar.
- Se **activa y desactiva** sin tocar el código fuente de la plataforma.
- Su schema Prisma se compone automáticamente al estar su fragmento
  en `packages/database/prisma/models/`.

La frontera es organizativa/semántica: `modules/*` entra en
`pnpm-workspace.yaml` igual que `packages/*`, pero un módulo puede
desmontarse completo sin afectar al resto.

---

## 2. Ciclo de vida

Cuatro comandos, cuatro estados:

### Instalar (`module add`)

```bash
pnpm alxarafe module add <nombre> --from <git-url|ruta> [--no-enable]
```

1. Materializa el módulo en `modules/<nombre>` mediante **clonado git** (URL
   ssh/https o local con `file://`) o **copia directa** (ruta local). El
   directorio queda **local y sin trackear**: `modules/*` está en `.gitignore`
   del núcleo.
2. Lee y valida `module.json` (nombre del manifest = nombre del módulo).
3. Si el manifest declara `prisma`, crea un symlink en
   `packages/database/prisma/models/<nombre>.prisma` apuntando al fragmento
   del módulo.
4. Salvo `--no-enable`, registra el módulo como activo en
   `config/modules.json` (fichero **local**, ignorado en git).
5. Ejecuta `pnpm install` (para resolver las dependencias del nuevo módulo).
6. Compila el módulo (`pnpm --filter <pkgName> run build`) — el loader
   runtime necesita el `dist/`.
7. Ejecuta `prisma generate` para componer el cliente con el nuevo fragmento.

Si falla cualquier paso tras materializar, se revierte (se borra el directorio
y el registro en config).

### Activar / Desactivar (`module enable` / `module disable`)

```bash
pnpm alxarafe module enable <nombre>
pnpm alxarafe module disable <nombre>
```

- **`enable`**: añade el nombre a `enabled` en `config/modules.json` (y lo
  elimina de `disabled`).
- **`disable`**: añade el nombre a `disabled` y lo elimina de `enabled`.

Ambos validan la coherencia del grafo tras el cambio: si desactivar un módulo
dejaría un módulo activo sin dependencias, se revierte el cambio y se informa
del error (`MODULE_DEPENDENCY_DISABLED`).

**Regla:** desactivar **no borra datos**. Las tablas permanecen en la base de
datos y el fragmento Prisma permanece enlazado. La desactivación solo afecta al
montaje de rutas: el loader de `apps/api` no importa el módulo desactivado.

**Nota de implementación actual:** el symlink Prisma solo se crea y borra en
`add` / `remove`. El enable/disable únicamente edita la activación. Un módulo
desactivado sigue teniendo su modelo presente en el cliente Prisma; solo
desaparece de las rutas HTTP.

### Desinstalar (`module remove`)

```bash
pnpm alxarafe module remove <nombre> [--drop-schema]
```

1. Borra el directorio `modules/<nombre>` (siempre es un clon local; nunca hay
   submódulo trackeado que deshacer).
2. Elimina `packages/database/prisma/models/<nombre>.prisma` (con `force`,
   también si el enlace apunta a un destino inexistente).
3. Limpia `config/modules.json` (elimina el nombre de ambas listas).
4. Ejecuta `prisma generate` (el cliente Prisma se regenera sin el modelo).
5. Si se indicó `--drop-schema`, ejecuta
   `prisma migrate dev --name drop_<nombre>_schema` para crear una migración
   que elimina las tablas.
6. Ejecuta `pnpm install` para desvincular el workspace.

**Precaución:** no se puede desinstalar un módulo si otro módulo activo lo
tiene como dependencia en `dependsOn`. El comando aborta informando de qué
módulos lo necesitan.

### Estado

```
add ──► installed ──► enabled ◄──► disabled ◄──► remove
          │                          │
          └──────────────────────────┘  (desactivar no borra tablas)
```

---

## 3. Estructura de un módulo

```
modules/contacts/                 # clon local (git clone), NUNCA trackeado en el núcleo
├── module.json                   # MANIFEST: declaración de lo que el módulo aporta
├── package.json                  # name: @alxarafe/contacts, build: tsup --dts
├── tsconfig.json
├── prisma/
│   └── contact.prisma            # fragmento de schema (solo models/enums propios)
└── src/
    ├── contactController.ts
    ├── contactModel.ts
    ├── contactRepository.ts
    ├── contactRouter.ts          # Express router + OpenAPIRegistry
    ├── contactService.ts
    └── index.ts                  # monta el router, exporta registry
```

El archivo `dist/` se genera con `pnpm --filter @alxarafe/contacts run build`
(tsup) y **no se versiona en el repo del módulo** (.gitignore). El loader de
`apps/api` importa `dist/index.js`.

---

## 4. El manifest (`module.json`)

Es la **fuente de verdad declarativa**. Todo lo demás se deriva de él.

### Esquema estricto

Solo se permiten estos campos (el validador Zod usa `.strict()`):

```jsonc
{
  "name": "contacts",                              // REQUIRED — debe coincidir con el nombre de directorio
  "version": "1.0.0",                              // REQUIRED
  "description": "Gestión de contactos",           // OPTIONAL
  "enabledDefault": true,                          // OPTIONAL (default: true)
  "dependsOn": ["core", "database", "users"],      // OPTIONAL (default: [])
  "prisma": {                                      // OPTIONAL — si el módulo aporta fragmento Prisma
    "fragment": "prisma/contact.prisma",           //   ruta relativa al módulo con el .prisma
    "models": ["Contact", "Address", "ChannelType", "Channel"]  //   modelos del módulo (para docs)
  },
  "server": {                                      // OPTIONAL — si el módulo monta un router HTTP
    "mountPath": "/contacts",                      //   app.use(mountPath, router)
    "entry": "dist/index.js",                      //   OPTIONAL (default: dist/index.js) — archivo a importar en runtime
    "routerExport": "contactRouter",               //   OPTIONAL (default: "router") — nombre del export del Express Router
    "registryExport": "contactRegistry"            //   OPTIONAL — nombre del export del OpenAPIRegistry
  }
}
```

### Ejemplo real (contacts)

```jsonc
{
  "name": "contacts",
  "version": "0.1.0",
  "description": "Agenda de contactos: personas con direcciones y canales de contacto",
  "enabledDefault": true,
  "dependsOn": ["core", "database", "users"],
  "prisma": {
    "fragment": "prisma/contact.prisma",
    "models": ["Contact", "Address", "ChannelType", "Channel"]
  },
  "server": {
    "mountPath": "/contacts",
    "entry": "dist/index.js",
    "routerExport": "contactRouter",
    "registryExport": "contactRegistry"
  }
}
```

### Convenciones

- `name` del manifest **debe ser igual** al nombre del directorio (y al
  nombre del submodule).
- El fragmento Prisma solo declara `model`/`enum` propios; nunca `generator`
  ni `datasource`.
- `mountPath` no puede colisionar con rutas de la plataforma ni de otro módulo
  activo.
- El `entry` se resuelve relativo al directorio del módulo: se usan paths
  internos al módulo (`dist/index.js`); el monorepo **nunca depende del
  paquete npm** del módulo.

---

## 5. Adaptación dinámica de configuraciones

### a) Prisma (schema multi-archivo)

Prisma combina recursivamente todos los `.prisma` de la carpeta configurada
en `prisma.config.ts` (carpeta, no fichero único — disponible desde Prisma 6.7).

```
packages/database/prisma/
├── schema.prisma           # generator + datasource (plataforma)
├── migrations/
│   └── 20260910190000_init/   # SOLO migraciones de la plataforma
└── models/                 # artefactos LOCALES de los módulos instalados (ignorados en git)
    └── contact.prisma      # symlink → ../../../../modules/contacts/prisma/contact.prisma
```

> **Un módulo NO deja rastro en el repositorio del núcleo.** El symlink de la
> carpeta `models/` y las migraciones que el módulo aporta o genera son
> artefactos **locales**, creados por `alxarafe module add/remove`, e
> ignorados por `.gitignore` (`packages/database/prisma/models/*`,
> migraciones de módulo y `*_drop_*_schema/`). Un módulo —que puede ser de
> terceros— solo aporta código a su propio repo (`modules/<nombre>/`); nunca
> escribe en `packages/` ni en el git del núcleo.
> La fusión de migraciones y schema para despliegue se formaliza en
> [`docs/migrations.md`](migrations.md) (caché de módulos); el symlink que aquí
> se describe es el mecanismo local actual, a sustituir por la caché cuando se
> integre en la CLI.

| Acción | Qué ocurre (todo LOCAL, ignora al git) |
|---|---|
| `module add` (con prisma) | Crea symlink `models/<nombre>.prisma` + `prisma generate` |
| `module enable` | Solo modifica config/modules.json —local, ignorado— (el fragmento Prisma permanece) |
| `module disable` | Solo modifica config/modules.json —local, ignorado— (el modelo Prisma permanece en el cliente) |
| `module remove` | Borra symlink + `prisma generate` (el modelo desaparece del cliente) |
| `module remove --drop-schema` | Lo anterior + genera migración `*_drop_<nombre>_schema` (ignorada en git) |

> Pendiente: que `enable`/`disable` también togglen el symlink y ejecuten
> `prisma generate` para que el cliente Prisma se adapte al 100%.

Relaciones entre fragmentos (módulo ↔ plataforma) funcionan porque Prisma
multi-schema resuelve las relaciones cruzadas. `dependsOn` protege de
desactivar la plataforma que un módulo necesita.

### b) Routers de la API

`apps/api/src/app.ts` carga dinámicamente los módulos activos por **ruta de
archivo**, no por nombre de paquete:

```
ModuleManager.getEnabledFeatureModules()
  → por cada módulo:
    1. resolver entry = modules/<nombre>/<server.entry> (dist/index.js)
    2. import(pathToFileURL(entry))
    3. app.use(server.mountPath, entry[server.routerExport])
```

El monorepo **no declara dependencia npm** de ningún módulo; el acoplamiento
es puramente por directorio (`modules/`) y por el manifest.

### c) Configuración de activación

La activación se almacena en `config/modules.json`. Este fichero es **local**
(está en `.gitignore`): cada desarrollador declara así los módulos que tiene
materializados. Si no existe, el manager actúa sin módulos activos.

```jsonc
// config/modules.json  (nunca se commitea)
{
  "enabled": ["contacts"],
  "disabled": []
}
```

Prioridad (de mayor a menor):

1. Variables de entorno `ALXARAFE_MODULES_ENABLED` /
   `ALXARAFE_MODULES_DISABLED` (separados por coma).
2. `config/modules.json` (local).
3. `enabledDefault` del manifest.

Los **packages** (`packages/*`) siempre están activos; no se pueden desactivar.

> Pendiente: `modules.lock.json` para registrar versión instalada, fuente y
> marca temporal. Actualmente `config/modules.json` (local) solo almacena
> enabled/disabled.

### d) Env del manifest (pendiente)

El manifest puede declarar variables de entorno propias que se fusionarían en
`.env` de forma no destructiva (solo si no existen). Esto aún no está
implementado; cada módulo valida sus propias variables al arrancar.

---

## 6. Entrega del módulo (repo propio, clonado local)

Cada módulo tiene **su propio repositorio en GitHub**. El núcleo **nunca**
registra submódulos ni trackea `modules/`: el directorio se crea localmente
con `alxarafe module add` (clonado git o copia) y está en `.gitignore`.

> **Por qué no submódulos:** un `git submodule add` escribe `.gitmodules` y
> ancla un gitlink (`160000`) en el índice, rastro que git añade **a pesar**
> de cualquier `.gitignore`. Como un módulo puede ser de terceros y es
> opcional, el núcleo debe poder estar **sin él**: `modules/` vacío en git.
> Por eso la materialización es siempre un clon local no trackeado.

### Publicar un módulo

```bash
# 1. Crear el repo en GitHub (vacío)

# 2. Dentro del módulo (carpeta con module.json, package.json, src/, prisma/):
cd modules/<nombre>
git init -b main
git add -A
git commit -m "feat: <nombre> module source"
git remote add origin git@github.com:alxarafe/alxarafejs-<nombre>.git
git push -u origin main
```

El `.gitignore` del módulo debe ignorar `node_modules/`, `dist/` y `.env`.

### Instalar un módulo en el monorepo

```bash
# Desde la raíz del monorepo (la carpeta modules/ no existe hasta este paso):
pnpm alxarafe module add <nombre> --from git@github.com:alxarafe/alxarafejs-<nombre>.git
```

Esto **solo** crea `modules/<nombre>/` como clon local (ignorado en git),
enlaza el fragment Prisma, lo activa en `config/modules.json` (local,
ignorado) y compila. No toca `.gitmodules` ni el índice: `git status` sigue
limpio.

### Arrancar un clon sin módulos

```bash
git clone git@github.com:alxarafe/alxarafejs.git   # NADA de modules/ (viene vacío)
pnpm install
# Cuando quieras un módulo concreto:
pnpm alxarafe module add contacts --from git@github.com:alxarafe/alxarafejs-contacts.git
```

> El estado de activación es **por desarrollador**: `config/modules.json`
> (gitignored) contiene qué módulos tiene materializados cada uno; no
> existen módulos habilitados por defecto en el núcleo.

### Actualizar un módulo

```bash
pnpm alxarafe module add <nombre> --from ...  # no aplica: para actualizar:
cd modules/<nombre> && git pull origin main
# reconstruir el dist y regenerar el cliente Prisma:
pnpm --filter @alxarafe/<nombre> run build
pnpm db:generate
```

### Eliminar un módulo

```bash
pnpm alxarafe module remove <nombre>
```

Borra `modules/<nombre>` (clon local), el symlink Prisma, limpia
`config/modules.json` y regenera el cliente Prisma.

---

## 7. CLI: `alxarafe module`

Paquete `@alxarafe/cli` en `packages/cli/`, ejecutable vía `pnpm alxarafe`.

### Comandos

| Comando | Descripción |
|---|---|
| `module list` | Lista packages y módulos con su estado (activo/inactivo, dependencias, mountPath) |
| `module validate [nombre]` | Valida manifiestos y grafo de dependencias. Sin argumentos valida todo el workspace; con nombre valida un módulo concreto |
| `module enable <nombre>` | Añade el módulo a `config/modules.json` —fichero local, gitignored— enabled (valida que no rompa el grafo) |
| `module disable <nombre>` | Añade el módulo a `config/modules.json` —local, gitignored— disabled (falla si otro módulo activo lo necesita) |
| `module add <nombre> --from <url\|ruta> [--no-enable]` | Materializa el módulo (clon git o copia local, sin trackear), enlaza su fragment Prisma, lo activa, compila y genera el cliente Prisma |
| `module remove <nombre> [--drop-schema]` | Desinstala el módulo (borra el clon local), elimina symlink Prisma, limpia config, regenera el cliente. `--drop-schema` crea migración que elimina las tablas |

### Opciones

| Flag | Usado en | Descripción |
|---|---|---|
| `--from <url\|ruta>` | `add` | Fuente del módulo: URL git (ssh/https) o ruta local |
| `--no-enable` | `add` | Instala sin añadir a `config/modules.json` (fichero local, gitignored); el módulo queda instalado pero inactivo |
| `--drop-schema` | `remove` | Genera migración Prisma que elimina las tablas del módulo |
| `-h, --help` | cualquier | Muestra la ayuda |

### Ejemplos de uso

```bash
# Ver el estado actual
pnpm alxarafe module list

# Instalar un módulo nuevo desde GitHub (clonado local, nunca trackeado)
pnpm alxarafe module add contacts --from git@github.com:alxarafe/alxarafejs-contacts.git

# Activar / desactivar
pnpm alxarafe module disable contacts
pnpm alxarafe module enable contacts

# Validar el grafo
pnpm alxarafe module validate        # todo
pnpm alxarafe module validate contacts

# Desinstalar (conservando tablas)
pnpm alxarafe module remove contacts

# Desinstalar y borrar las tablas
pnpm alxarafe module remove contacts --drop-schema
```

### Requisitos

- Ejecutar desde la raíz del workspace (donde está `pnpm-workspace.yaml`).
- Archivo `.env` válido (core valida `DATABASE_URL` al importarse).
- PostgreSQL y Redis en ejecución (solo para comandos que ejecutan
  `prisma generate` o `prisma migrate`).

---

## 8. Decisiones de diseño fijadas

1. **`modules/` = extensiones, `packages/` = plataforma.** Separación semántica; ambas son workspaces.
2. **Desactivar NO borra tablas.** Solo se deja de montar rutas. Requiere `remove --drop-schema` para eliminar.
3. **Configuración declarativa derivada del manifest.** El installer nunca reescribe código fuente.
4. **El fragmento Prisma viaja con el módulo** y se compone vía symlink en `models/`.
5. **`dependsOn` se valida en el `ModuleManager`** (existencia + activación de deps) antes de montar; error inmediato si no se cumple.
6. **Los módulos se entregan como repos git propios clonados localmente**,
   no como paquetes npm. `modules/` está en `.gitignore` y **el núcleo nunca
   trackea submódulos ni módulos**: `modules/` debe estar vacío en git.
7. **Carga por ruta** (`import(pathToFileURL(...))`): el monorepo no declara dependencia npm de los módulos; el acoplamiento es por directorio `modules/`.
8. **Precedencia de activación**: env → `config/modules.json` (fichero local,
   gitignored) → enabledDefault.
9. **Los módulos NO dejan rastro en el núcleo.** Solo se versiona el repo
   propio del módulo; `modules/`, fragmentos de Prisma y migraciones de
   módulos son artefactos locales ignorados en git (`.gitignore`). Los
   enlaces se generan al activar/instalar el módulo, no antes. Instalar ≠
   querer versionar.

---

## 9. Preguntas abiertas / pendientes

- **`modules.lock.json`:** registrar versión instalada, fuente (git commit), fecha. Actualmente solo existe `config/modules.json` (enabled/disabled, local y gitignored).
- **Enable/disable con toggling Prisma:** la desactivación completa sacaría el modelo del cliente Prisma (requiere symlink toggle + generate). Actualmente el modelo permanece siempre que el módulo esté instalado.
- **Migraciones del módulo en su propio repo:** hoy el CLI solo hace `prisma generate` en `add`; falta que el módulo entregue su historia de migraciones (`prisma/migrations/`) y que `add` las materialice en el monorepo y ejecute `db:migrate`/`deploy`. Reproducible sin depender de lo que haya en tu disco.
- **Merge de env del manifest:** variables de entorno del módulo que se fusionan en `.env` de forma no destructiva. No implementado.
- **Web (Angular):** adaptación dinámica de rutas lazy y menús según módulos activos.
- **CI del módulo:** test automático en el repo del módulo antes de publicar.
- **Otras fuentes de entrega:** registro npm privado, tarballs, Docker. Pendiente.
