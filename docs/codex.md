# Auditoría técnica y arquitectónica de Alxarafe JS

Fecha del análisis: **12 de septiembre de 2026**  
Alcance: repositorio principal en `main` (`d102762`) y módulo de ejemplo
`contacts` presente localmente en `modules/contacts` (`3e99ac2`).

## 1. Resumen ejecutivo

Alxarafe JS tiene una base sensata para evolucionar hacia una plataforma
modular profesional: el monorepo separa infraestructura, datos, sesiones,
usuarios y autenticación; TypeScript está en modo estricto; los contratos de
entrada usan Zod; las sesiones son server-side; los tokens sensibles se
guardan mediante hash; existe un manifest de módulos validado; y la suite
unitaria actual es rápida. La documentación y las colecciones Bruno muestran
además una intención poco habitual —y positiva— de hacer verificables los
flujos completos.

El proyecto, sin embargo, **no está todavía listo para producción ni para ser
consumido de forma reproducible por un equipo**. Los bloqueos principales son:

1. Un clon limpio de `HEAD` no compila. `@alxarafe/database` exporta tipos de
   `contacts`, pero `contacts` no forma parte del commit del repositorio padre.
2. Aunque la arquitectura deseada es usar módulos como submódulos Git, el
   estado actual contiene un repositorio anidado e ignorado: no existe
   `.gitmodules` ni un gitlink `160000`. Docker y CI tampoco incluyen módulos.
3. La CLI acepta nombres y URLs que terminan interpolados en rutas destructivas
   y comandos de shell. Un nombre como `..` puede sacar la operación de
   `modules/`, y una fuente o nombre de paquete manipulado puede inyectar shell.
4. La protección CSRF solo está instalada dentro de `/auth`. Las mutaciones de
   `contacts` requieren sesión, pero no CSRF, por lo que son atacables desde
   otro sitio web en el navegador de un usuario autenticado.
5. La configuración de producción no falla de forma segura: hay un secreto de
   sesión por defecto, SMTP puede caer silenciosamente al transporte a fichero,
   faltan `trust proxy` y una URL pública independiente, y Node 23 está EOL.
6. La autorización no tiene un modelo explícito. Cualquier usuario autenticado
   puede listar los datos públicos de todos los usuarios y leer o modificar
   todos los contactos. Esto solo sería válido si se declara deliberadamente
   que el sistema es un directorio compartido y de confianza.

Mi recomendación es conservar la división de paquetes y el concepto de
manifest, pero cerrar primero la cadena reproducible
**submódulo → schema/migraciones → build → tests → imagen**, fijar la frontera
de confianza de los módulos y completar el modelo de seguridad. Añadir nuevas
funciones de negocio antes de resolverlo aumentaría el coste de corrección.

### Dictamen

| Área | Estado | Dictamen |
|---|---|---|
| Diseño modular | Prometedor | Buena dirección, contrato aún incompleto |
| Reproducibilidad | Bloqueada | Un clon limpio no compila |
| Seguridad | Insuficiente | Hay riesgos críticos en CLI, CSRF y configuración |
| Persistencia | Parcial | Núcleo correcto; ciclo de migraciones de módulos no resuelto |
| API | Funcional como prototipo | Contrato y validación divergen en varios puntos |
| Web | Demostración | Login/listado básicos; no existe entrega productiva completa |
| Pruebas | Buen inicio | 65 tests pasan, pero faltan las áreas de mayor riesgo |
| Operación | Inmadura | Sin CI, readiness, observabilidad ni despliegue reproducible |
| Documentación | Amplia | Útil, pero contiene contradicciones con el código y el diseño deseado |

## 2. Método y límites del análisis

Se revisaron:

- todas las fuentes versionadas del backend y el frontend;
- manifests, `package.json`, lockfile, TypeScript, Biome, Prisma y Docker;
- schema y migración del núcleo;
- gestor de módulos y CLI;
- módulo local `contacts`, incluido su schema, API y tests;
- documentación y colecciones/runners Bruno;
- estado del repositorio padre y del repositorio anidado de `contacts`.

No se leyó el contenido de `.env`, no se usaron credenciales y no se modificó
código, configuración, datos ni módulos. Las únicas escrituras del análisis se
realizaron en una copia temporal de `HEAD` fuera del repositorio y en este
documento.

### Comprobaciones ejecutadas

| Comprobación | Resultado | Observación |
|---|---|---|
| `pnpm test` | **OK** | 6 ficheros, 65 tests; incluye 27 tests de `contacts` |
| `pnpm exec biome check .` | **OK** | 79 ficheros; `apps/web` está excluido por configuración |
| TypeScript API `--noEmit` | **OK** | Sobre el workspace local, con Prisma y `contacts` ya materializados |
| TypeScript web `--noEmit` | **OK** | No incluye los ficheros `*.spec.ts` |
| Instalación de `HEAD` sin `.env` | **FALLO** | `postinstall: prisma generate` exige `DATABASE_URL` |
| Prisma generate en copia limpia con URL ficticia | **OK** | No requiere conexión a la base de datos |
| Build de copia limpia de `HEAD` | **FALLO** | Faltan `Address`, `Channel`, `ChannelType` y `Contact` en Prisma Client |
| Registro Git de submódulos | **FALLO** | Sin `.gitmodules`, sin salida de `git submodule status`, sin gitlink |

No se ejecutaron las colecciones Bruno porque pueden crear/sincronizar una base
de datos y usar Redis; tampoco se construyó una imagen Docker ni se hizo un
audit remoto de dependencias. No deben interpretarse los tests locales como
verificación de producción.

### Estado Git durante la revisión

- El repositorio padre estaba en `main`, alineado con `origin/main`.
- `AGENTS.md` ya era un archivo no seguido antes de empezar y se mantuvo
  intacto.
- `modules/contacts`, `config/modules.json`, emails, builds y cobertura son
  estado local ignorado por el padre.
- El repositorio anidado de `contacts` estaba limpio y alineado con su propio
  `origin/main`.
- Este informe es el único archivo nuevo creado dentro del repositorio.

## 3. Arquitectura observada

### 3.1 Componentes

| Componente | Responsabilidad real |
|---|---|
| `apps/api` | Composición Express, carga dinámica de módulos, OpenAPI y bootstrap HTTP |
| `apps/web` | SPA Angular con login y listado paginado de usuarios |
| `packages/core` | Entorno, logging, middlewares, envelope, paginación, filtros y gestor de módulos |
| `packages/database` | Prisma Client, schema y migración del núcleo |
| `packages/session` | `express-session`, Redis y comprobación CSRF |
| `packages/users` | Modelo público, persistencia, servicio, API y guards |
| `packages/auth` | Registro, login, verificación, reset y endpoints de sesión |
| `packages/email` | SMTP o escritura de mensajes EML |
| `packages/cli` | Instalación, activación y retirada de módulos |
| `modules/contacts` | Módulo de referencia: contactos, direcciones y canales |

La dependencia principal es acíclica y razonable:

```text
core
├── database
├── email
├── session
└── cli
    
database + session ──► users
core + database + email + session + users ──► auth
auth + users + session + database + core ──► api
core + database + users ──► contacts
```

El frontend no comparte tipos compilados con el backend; mantiene interfaces
equivalentes a mano. Esto reduce acoplamiento de build, pero permite deriva de
contrato.

### 3.2 Flujo HTTP

El orden efectivo es:

```text
parsers → CORS → Helmet → rate limit → request logger → sesión
        → rutas del núcleo → rutas de módulos → Swagger → 404/error
```

La estructura `router → controller → service → repository` es clara. Los
servicios convierten resultados y fallos esperados en `ServiceResponse`, y los
repositorios encapsulan Prisma. Es una base mantenible para el tamaño actual.

### 3.3 Flujo modular actual

`ModuleManager` escanea `packages/` y `modules/`, valida manifests, nombres
duplicados, dependencias y ciclos, y decide qué extensiones están habilitadas.
`createApp` importa el `server.entry` por ruta y monta el router y su registro
OpenAPI.

Hay que distinguir dos conceptos:

- **intención confirmada:** `modules/` debe alojar módulos adicionales como
  submódulos Git, con `contacts` como ejemplo publicado en GitHub;
- **estado de este checkout:** `contacts` es un repositorio Git anidado bajo un
  directorio ignorado. El padre no registra su URL ni su commit.

Esta diferencia es la causa de varios fallos de build, Docker, onboarding y CI.

## 4. Puntos fuertes que conviene conservar

### 4.1 Separación de responsabilidades

- Las fronteras entre `core`, `database`, `session`, `users`, `auth` y `api`
  son comprensibles y el grafo no contiene ciclos de paquetes.
- El patrón controller/service/repository mantiene Express fuera de la lógica
  principal y facilita dobles de repositorio en tests.
- `toPublicUser` crea una frontera explícita que evita devolver
  `passwordHash` por accidente.
- La aplicación acepta un `ModuleManager` inyectable, una decisión pequeña que
  ya permite aislar la prueba de health del filesystem real.

### 4.2 Tipado y validación

- TypeScript usa `strict`, consistencia de casing, declaraciones y sourcemaps.
- Zod centraliza la validación y alimenta también OpenAPI.
- Los manifests usan un schema `.strict()`, por lo que los campos desconocidos
  no pasan inadvertidos.
- La gramática de filtros está implementada como parser, no concatenando SQL;
  luego se traduce a objetos Prisma con una allowlist de campos.

### 4.3 Decisiones de seguridad acertadas

- Las sesiones se guardan en Redis y la cookie es `HttpOnly`, `SameSite=Lax` y
  `secure` en producción.
- El login regenera la sesión, mitigando fijación de sesión.
- Las contraseñas usan bcrypt con coste 12.
- Los tokens de verificación y reset se generan con aleatoriedad criptográfica
  y en base de datos solo se guarda SHA-256.
- Login responde de forma genérica ante usuario inexistente o contraseña
  incorrecta.
- Helmet, CORS con credenciales, rate limiting y request IDs ya están en el
  pipeline; no hay que introducirlos desde cero.
- La API de desarrollo que extrae tokens no se monta cuando
  `NODE_ENV !== development`.

### 4.4 Plataforma modular

- El manifest reúne nombre, versión, dependencias, entrada HTTP y fragmento
  Prisma en una única declaración.
- Se detectan nombres duplicados, dependencias ausentes, ciclos y dependencias
  desactivadas antes de servir tráfico.
- Un módulo desactivado no se importa, por lo que sus efectos laterales de
  runtime no se ejecutan.
- El módulo `contacts` prueba el contrato completo: schema, repositorio,
  servicio, router, OpenAPI, colecciones Bruno y tests.
- Fijar cada módulo como submódulo puede dar una propiedad muy valiosa: el
  repositorio padre puede certificar exactamente qué commit de cada módulo es
  compatible con una entrega.

### 4.5 Calidad y experiencia de desarrollo

- `pnpm-lock.yaml` y `--frozen-lockfile` ayudan a builds deterministas.
- `allowBuilds` limita scripts de instalación permitidos.
- Biome, Vitest, `tsup` y `tsc` forman una toolchain simple.
- Los tests unitarios son rápidos y legibles; los de `ModuleManager` aíslan el
  filesystem en directorios temporales.
- El runner Bruno intenta separar base de datos, índice Redis y correo del
  entorno de desarrollo, una buena dirección para pruebas de integración.
- La imagen usa varias etapas y ejecuta como usuario no privilegiado.
- La documentación cubre arquitectura, API, seguridad, datos, módulos,
  pruebas y desarrollo con bastante más detalle que un prototipo habitual.

## 5. Hallazgos prioritarios

### 5.1 P0 — Bloqueos antes de cualquier uso profesional

#### P0-1. `HEAD` no es construible desde un clon limpio

**Evidencia.** `packages/database/src/index.ts` exporta tipos Prisma
`Address`, `Channel`, `ChannelType` y `Contact`. Esos modelos solo existen en
el fragmento local de `modules/contacts`. Al generar Prisma solo con los
ficheros versionados y ejecutar `pnpm build`, la generación de declaraciones
de `@alxarafe/database` falla con cuatro `TS2305`.

El lockfile también contiene el importer `modules/contacts`, aunque el módulo
no está registrado por el padre. El workspace local pasa typecheck porque ya
tiene el fragmento, el cliente generado y artefactos previos; ese resultado no
representa un clon nuevo.

**Impacto.** Onboarding, CI, publicación de paquetes y Docker no son
reproducibles.

**Corrección.** Registrar `contacts` como submódulo real si forma parte de la
distribución, y eliminar del núcleo cualquier exportación concreta de modelos
opcionales. Un paquete de plataforma no debe declarar tipos que solo existen
cuando se instala una extensión. El módulo debe consumir sus tipos Prisma
generados mediante un contrato de composición definido, o el build debe
generar un cliente compuesto en un paquete de aplicación no publicable.

#### P0-2. Los módulos no son hoy submódulos Git reales

**Evidencia.** No existe `.gitmodules`; `git submodule status` está vacío; y
`git ls-files --stage modules/contacts` no muestra un gitlink. `.gitignore`
ignora `modules/*`, la CLI ejecuta `git clone` y la documentación afirma en
varios puntos que el núcleo nunca registra submódulos.

**Impacto.** Otro clon no conoce la URL ni el commit de `contacts`. Tampoco hay
forma de reconstruir una versión exacta del producto meses después.

**Corrección.** Elegir y aplicar una sola política:

1. versionar `.gitmodules`;
2. registrar cada módulo oficial como gitlink fijado a un commit;
3. hacer checkout recursivo en onboarding y CI;
4. separar **presencia** del submódulo de **activación** funcional;
5. adaptar la CLI a `git submodule add/update/deinit`, sin clonar repositorios
   ignorados;
6. copiar `modules/` en el build Docker y validar que todos los gitlinks estén
   inicializados;
7. actualizar toda la documentación que ahora dice “nunca submódulo”.

Si se quiere que el núcleo permanezca completamente independiente, una opción
mejor es crear un repositorio de **distribución** que incluya al núcleo y a los
módulos como submódulos. El núcleo puede seguir siendo puro, mientras que la
distribución fija una combinación compatible y desplegable.

#### P0-3. La CLI puede ejecutar shell o borrar fuera de `modules/`

**Evidencia.** `name`, `from` y el `name` leído de `package.json` se interpolan
en strings enviados a `execSync`. `name` también se pasa a `join` antes de
`rmSync(..., { recursive: true })` sin exigir un identificador seguro ni
comprobar que la ruta resuelta permanezca dentro de `modules/`.

**Impacto.** Un argumento accidental como `..`, un manifest hostil o una URL
con metacaracteres puede provocar borrado del repositorio o ejecución de
comandos. Como los módulos ejecutan además `pnpm install`, build y generación,
instalar un módulo equivale a darle ejecución de código con los permisos del
desarrollador/CI.

**Corrección.** Antes de conservar esta CLI:

- limitar nombres a algo como `^[a-z][a-z0-9-]*$`;
- resolver la ruta, usar `realpath` cuando proceda y comprobar que su padre
  exacto es `<root>/modules` antes de copiar o borrar;
- sustituir `execSync(string)` por `spawnSync(program, args, { shell: false })`;
- validar URL/protocolo y no aceptar opciones Git arbitrarias;
- validar que fragmentos y entries permanecen dentro del submódulo;
- separar operaciones destructivas y pedir confirmación explícita;
- añadir tests de path traversal, argumentos con espacios/metacaracteres,
  rollback y fallo parcial;
- declarar que solo se admiten módulos de confianza. Para módulos no
  confiables, el aislamiento debe ser por proceso/contenedor, no un import ESM.

#### P0-4. Las mutaciones de módulos no tienen CSRF

**Evidencia.** `csrfProtection` se instala con `authRouter.use(...)`, por lo
que solo protege rutas bajo `/auth`. `contacts` aplica `requireAuth` a POST,
PUT y DELETE, pero nunca aplica CSRF. La propia documentación de tests indica
que los módulos no necesitan la cabecera.

**Impacto.** La seguridad de esas mutaciones depende solo del comportamiento
`SameSite=Lax` de la cookie. Este reduce ataques entre sitios distintos, pero
no sustituye un token CSRF y no cubre todos los escenarios de mismo sitio,
orígenes hermanos o futuras configuraciones de cookie. CORS tampoco es una
defensa CSRF: controla la lectura de respuestas, no todas las formas de envío.

**Corrección.** Aplicar CSRF globalmente, después de sesión y antes de todas las
rutas mutadoras, con una allowlist explícita para endpoints públicos que no lo
requieran. Alternativamente, cada módulo debe declarar y demostrar el mismo
middleware, pero la defensa global es menos propensa a omisiones. Añadir tests
HTTP que prueben ausencia, token incorrecto y token válido en una ruta de
módulo.

#### P0-5. Producción acepta configuración insegura o inoperante

**Evidencia.** Si faltan variables, `NODE_ENV` pasa a `production`,
`SESSION_SECRET` usa un valor conocido, SMTP vacío activa correo a disco y las
URLs se forman con `HOST`/`PORT`. No hay `PUBLIC_WEB_URL`; tampoco se configura
`trust proxy`. El Dockerfile fija Node `23.11.1`.

Node 23 está EOL desde mayo de 2025 y Angular 20 no lo incluye en su matriz de
Node soportados. Las fuentes oficiales consultadas están al final del informe.

**Impacto.** Cookies seguras que no se emiten detrás de un proxy, enlaces a
`localhost`/`0.0.0.0`, tokens escritos en el filesystem de producción, secreto
compartido entre instalaciones y runtime sin parches.

**Corrección.** Usar una línea LTS soportada por backend y Angular (hoy Node 24
encaja), alinear `engines`, `.tool-versions`, `@types/node` y Docker, y aplicar
validación condicional:

- en producción, `SESSION_SECRET` sin default y con entropía suficiente;
- `PUBLIC_WEB_URL` y, si hace falta, `PUBLIC_API_URL`, independientes del bind;
- SMTP/proveedor obligatorio o cola configurada explícitamente;
- `TRUST_PROXY` explícito y probado;
- orígenes CORS como lista validada;
- rechazo de combinaciones inseguras antes de abrir el puerto.

### 5.2 P1 — Necesario antes de manejar datos reales

#### P1-1. No existe un modelo de autorización/propiedad completo

`requireRole` existe pero no se usa. Cualquier sesión válida puede consultar
`GET /users` y `GET /users/:id`, incluidos email, rol y fechas. `contacts` no
tiene `ownerId`, tenant, ACL ni guard de rol; todos pueden leer y mutar todo.

Hay que tomar una decisión de producto y convertirla en invariantes:

- SaaS/multiusuario: `tenantId` y/o `ownerId` en todas las entidades, filtros
  obligatorios en repositorio y constraints/índices compuestos;
- directorio corporativo compartido: roles y permisos para lectura/escritura;
- aplicación monousuario: eliminar complejidad de usuarios/roles que no aporta
  seguridad real.

La autorización debe probarse con tests negativos: usuario A nunca ve ni
modifica recursos de B, y un `USER` no lista usuarios si esa operación es de
administración.

#### P1-2. Los enlaces de email no corresponden a rutas utilizables

`appBaseUrl` usa el host y puerto del backend y genera
`/verify-email?token=...` y `/reset-password?token=...`. El backend expone
POST bajo `/auth/...`; Angular no tiene páginas `verify-email` ni
`reset-password`. En producción el frontend ni siquiera se sirve desde la
imagen actual.

Se necesita `PUBLIC_WEB_URL`, páginas Angular que consuman el token y llamen a
la API, y tests de extremo a extremo que abran el enlace producido. Después de
leer el token, la SPA debería retirarlo de la barra de direcciones para reducir
exposición en historial y referrers.

#### P1-3. Registro, verificación y reset no son atómicos

- Registro crea usuario y token antes de enviar correo. Si el envío falla,
  responde 500 pero deja la cuenta creada; el siguiente registro devuelve 409
  y el usuario puede quedar sin sesión ni una recuperación clara.
- Verificación actualiza usuario y luego marca el token; reset actualiza la
  contraseña y luego consume el token. Dos solicitudes concurrentes pueden
  superar la comprobación previa.
- Borrar tokens y crear uno nuevo son operaciones separadas.
- Cambiar contraseña no invalida otras sesiones.
- La precomprobación de email duplicado tiene carrera; una violación única de
  Prisma termina actualmente como 500.

Conviene hacer consumos atómicos con transacciones o `updateMany` condicionado
por `usedAt = null` y `expiresAt > now`, mapear `P2002` a 409 e introducir una
versión de sesión/credenciales que invalide sesiones tras reset. El email debe
enviarse mediante outbox/cola con reintentos, no dentro de la transacción HTTP.

#### P1-4. El aislamiento de correo Bruno está roto

El runner exporta `EMAILS_DIR` y `authDevRouter` lee de esa ruta, pero
`@alxarafe/email` siempre escribe en `<cwd>/emails`. Por tanto, emisor y lector
usan carpetas distintas durante el run aislado. Esto contradice la
documentación reciente y puede hacer que Bruno falle o lea residuos locales.

Una única función/configuración debe resolver el directorio de correo para
emisor y lector. El test debe crear una carpeta temporal, enviar un correo y
demostrar que el endpoint recupera exactamente ese token.

#### P1-5. No hay estrategia de migraciones reproducible para módulos

El schema se compone con symlinks locales, pero las migraciones de módulos se
ignoran. `module add` solo hace `prisma generate`; `module remove
--drop-schema` invoca `migrate dev` después de retirar el fragmento y genera
una migración local también ignorada. Los tests Bruno recurren a `db push
--accept-data-loss`.

Esto no permite auditar ni repetir cambios productivos. Además, un
`TEST_DATABASE_URL` suministrado se acepta como “de test” sin comprobar que sea
distinto de desarrollo/producción.

Definir antes de añadir otro módulo:

- quién posee cada migración y cómo se ordenan globalmente;
- cómo se detectan colisiones de modelos/tablas/enums;
- cómo se actualiza y revierte un submódulo;
- política forward-only para producción, backups y retirada de datos;
- validación fuerte de la URL destino antes de `--accept-data-loss`;
- una fase de ensamblado que produzca schema y migraciones inmutables incluidos
  en el artefacto de release.

#### P1-6. Cobertura insuficiente en las áreas críticas y ausencia de CI

De los 65 tests actuales, 37 cubren helpers/core, 27 el módulo `contacts` y 1
el health check. No hay tests automatizados del núcleo para auth, usuarios,
sesiones, CSRF, email, CLI, Prisma real, carga dinámica ni shutdown.

El test Angular `app.spec.ts` no lo ejecuta `pnpm test`: Vitest solo busca
`*.test.ts`, mientras Angular usa `*.spec.ts`. Además conserva la expectativa
generada `Hello, web`, que ya no existe en `app.html`. Tampoco hay configuración
CI versionada.

La puerta mínima de un PR debería ejecutar en un clon limpio y con submódulos:

1. instalación congelada;
2. validación de submódulos/manifests y schema compuesto;
3. lint backend y frontend;
4. typecheck de todos los workspaces y tests Angular;
5. unitarios y contratos de módulos;
6. integración con PostgreSQL/Redis efímeros;
7. build completo e imagen Docker;
8. scanner de dependencias, imagen y secretos;
9. una colección de smoke/E2E sobre el artefacto construido.

#### P1-7. Inicio, errores y salud no son robustos

- La API empieza a escuchar sin esperar a `redisClient.connect()`; la promesa
  no tiene `catch` y puede haber tráfico antes de que las sesiones funcionen.
- El health check solo confirma que Express responde; no distingue liveness de
  readiness ni comprueba PostgreSQL/Redis.
- El manejador final devuelve 404 como texto y delega errores al handler por
  defecto de Express, rompiendo el envelope y pudiendo exponer HTML/stack en
  desarrollo.
- El log de errores pierde stack/contexto al interpolar solo `message` en
  muchos `catch`.
- El cierre fuerza `process.exit` y no informa de fallos de cierre; faltan
  timeouts HTTP y drenado verificable.

La API debe conectar dependencias, comprobar migraciones y solo entonces abrir
el puerto. Separar `/live` de `/ready`, responder errores con un envelope
estable y loguear objetos Error estructurados.

### 5.3 P2 — Mejoras de mantenibilidad y producto

#### P2-1. `validateRequest` valida, pero descarta los datos parseados

Zod puede transformar y normalizar (`trim`, `coerce`, IDs a número), pero el
middleware llama a `parseAsync` y luego los controllers siguen usando
`req.body`, `req.params` y `req.query` originales. Por ejemplo, un email con
espacios puede validar tras `trim` y acabar almacenándose con los espacios.

El middleware debe sustituir los segmentos por el resultado parseado o dejar
el DTO validado en `res.locals`. Los controllers no deberían volver a hacer
`parseInt`. También debe distinguir `ZodError` de errores inesperados.

#### P2-2. El contrato OpenAPI no representa la API completa

- Solo se documentan normalmente respuestas de éxito, no 400/401/403/404/409/429/500.
- No hay esquema de seguridad por cookie ni requisitos en rutas protegidas.
- El documento no define `servers`, versión de ruta ni política de compatibilidad.
- Los schemas de query se registran, pero no se usan como middleware en los
  listados; la documentación promete rechazo y el runtime aplica defaults o
  clamps silenciosos.
- El envelope hace redundante el status HTTP con `statusCode` en body y mezcla
  `responseObject` opcional en OpenAPI con `null` en runtime.
- Swagger se expone en `/` en todos los entornos sin una decisión explícita.

Conviene tratar OpenAPI como contrato probado: validar request/response en
tests, generar cliente web o tipos desde él y ejecutar detección de breaking
changes en CI.

#### P2-3. Filtro y paginación necesitan semántica tipada

El parser evita SQL injection, pero no valida combinaciones de campo, operador
y valor. `contains(id, ...)`, fechas inválidas o `id eq 'texto'` pueden llegar
a Prisma y convertirse en 500. Una dirección de orden desconocida se transforma
silenciosamente en `asc`. Los listados duplican la traducción en `users` y
`contacts`.

Además, ordenar solo por un campo no único puede producir saltos/duplicados
entre páginas; offsets enormes son costosos; y sin `$count` una página llena
puede publicar un `nextLink` vacío posterior.

Definir metadatos por recurso —tipo, operadores permitidos y coerción—,
añadir `id` como desempate y valorar cursor pagination para tablas grandes. La
duplicación actual ya justifica extraer un adaptador común pequeño y probado.

#### P2-4. El módulo `contacts` tiene inconsistencias propias

- El listado hace `include: { addresses: true }` y luego descarta las
  direcciones, generando E/S innecesaria.
- `PUT` acepta todos los campos opcionales y puede ser un no-op; semánticamente
  es un PATCH o debe exigir una representación completa.
- Resolver/crear tipos de canal ocurre antes de la escritura principal; si la
  actualización falla pueden quedar tipos creados como efecto parcial.
- La resolución de hasta 50 canales es secuencial (N+1).
- Los channel types son globales, editables indirectamente por cualquier
  usuario y no normalizan mayúsculas/espacios con una política de unicidad.
- No hay control de concurrencia (`updatedAt`/versión o ETag), auditoría ni
  ownership.
- Varios `as Promise<...>` en el repositorio silencian posibles divergencias
  con los tipos generados.

La estructura del módulo es buen ejemplo pedagógico, pero debe convertirse en
el primer test de compatibilidad y seguridad del SDK modular.

#### P2-5. El rate limiter está mal parametrizado para el nombre documentado

`windowMs` se calcula como
`15 * 60 * COMMON_RATE_LIMIT_WINDOW_MS`. La variable se documenta como la
ventana completa en milisegundos. Con `1000` el resultado casualmente son 15
minutos, no 1 segundo; con `60000` serían más de seis días. La documentación y
`.env.example` afirman 20 peticiones por segundo, mientras el código aplica
20 por 15 minutos con esos valores. Configurar `60000` como una ventana de un
minuto produciría en realidad 15 horas.

La variable debe mapearse directamente a `windowMs` o llamarse unidad/base de
cálculo. En despliegues con varias réplicas, el store en memoria tampoco da un
límite global; conviene reutilizar Redis con namespace separado y definir la
estrategia de IP/proxy.

#### P2-6. La experiencia de desarrollo puede usar artefactos obsoletos

`start:dev` observa solo `apps/api/src/index.ts`, pero los imports workspace
resuelven los `dist/` de paquetes. Cambiar `packages/*/src` o un módulo no
garantiza su reconstrucción. Tests de la app también pueden consumir esos
dist previos. Esto hace posible que local pase con artefactos no reproducibles,
como ocurre con Prisma/contacts.

Crear un modo dev coordinado que observe paquetes y módulos, o resolver fuentes
de forma explícita en desarrollo. CI siempre debe empezar de checkout limpio,
sin `dist`, cliente Prisma ni caches previos.

#### P2-7. El frontend no tiene aún una ruta clara a producción

- La imagen construye Angular, pero Express no sirve sus artefactos y no hay
  configuración de hosting separada.
- Las rutas de verificación/reset/registro no existen.
- La URL `/api` está hardcodeada y solo funciona mediante el proxy de desarrollo
  o una infraestructura externa no documentada.
- El token CSRF vive en memoria. Tras refrescar, `UsersPage` lo pide de forma
  asíncrona; si falla, logout queda sin manejo de error y puede no funcionar.
- Los guards navegan como efecto lateral en lugar de devolver un `UrlTree`.
- No hay manejo global de 401/403, accesibilidad probada, i18n, e2e ni estrategia
  de estado/caché.
- Biome excluye todo `apps/web` y no hay otro lint efectivo en scripts.

No hace falta sobrediseñarlo: primero elegir hosting (mismo origen o despliegue
independiente), completar los tres flujos auth y añadir tests de componentes y
un e2e real.

#### P2-8. Imagen y supply chain requieren endurecimiento

- Falta `.dockerignore`; el contexto puede enviar `.env`, `.git`, emails,
  caches y `node_modules` al builder aunque no terminen en una capa copiada.
- La etapa final copia árboles completos de `apps/` y `packages/`, incluidos
  fuentes y elementos no necesarios, no solo dist/schema/migraciones.
- `modules/` no se copia ni compila.
- La base está fijada a un tag EOL y no a digest.
- No hay `HEALTHCHECK`, SBOM, firma, provenance ni escaneo de imagen.
- No se ha documentado dónde/ cuándo se ejecuta `prisma migrate deploy`.

Son buenas la separación de etapas, instalación congelada y ejecución como
`node`. Deben mantenerse mientras se reduce el artefacto y se añade la cadena
de confianza.

#### P2-9. Configuración, datos y observabilidad

- El import del barrel `@alxarafe/core` tiene efectos laterales de entorno y
  puede exigir `DATABASE_URL` incluso en herramientas que solo necesitan el
  gestor de módulos.
- El orden recomendado en README (`pnpm install` antes de crear `.env`) no
  funciona porque `postinstall` carga `prisma.config.ts` y exige la URL.
- `HOST` se documenta como bind, pero `app.listen` solo recibe puerto; a la vez
  se reutiliza para URLs públicas.
- No existe política de pool/timeout de PostgreSQL ni reintentos/circuit breaker
  para Redis, SMTP o base de datos.
- Request ID acepta directamente cualquier valor recibido sin longitud/formato.
- Faltan métricas, trazas, auditoría de login/cambios sensibles, redacción
  central de PII y alertas.
- Los tokens consumidos/caducados no tienen trabajo de limpieza ni índices
  orientados a expiración.
- La unicidad de email depende de normalización de aplicación sobre una
  columna case-sensitive; importaciones o carreras pueden romper la intención.

Separar configuración de build y runtime, validar producción por perfil y
añadir observabilidad básica antes de introducir una plataforma compleja.

## 6. Diseño profesional propuesto para módulos/submódulos

### 6.1 Modelo de confianza

Un módulo cargado con `import()` comparte proceso, variables, filesystem,
red, sesión y credenciales de base de datos con el núcleo. Por tanto:

- un submódulo cargado in-process es **código totalmente confiable**;
- manifest y allowlists reducen errores, pero no son un sandbox;
- módulos de terceros no auditados deben ejecutarse como servicios separados,
  con identidad y permisos mínimos, comunicados por HTTP/eventos.

Esta decisión debe estar escrita en el contrato del módulo y en el proceso de
aprobación de nuevas extensiones.

### 6.2 Repositorios y fijación de versiones

Para el modelo confirmado de submódulos:

```text
alxarafejs (distribución)
├── packages/...
├── apps/...
├── .gitmodules
└── modules/
    └── contacts/  ── gitlink a un commit auditado de alxarafejs-contacts
```

Cada release del padre debe fijar:

- commit del núcleo;
- commit de cada módulo;
- lockfile resultante;
- versión del schema/migraciones;
- matriz de compatibilidad y checksum del artefacto.

Actualizar `contacts` sería un cambio revisable del gitlink en el padre, no un
`git pull` local no registrado. Activar/desactivar afecta runtime; no cambia la
versión instalada.

### 6.3 Contrato de manifest que falta

El manifest actual es un buen inicio, pero debería validar además:

- identificador y versión SemVer reales;
- rango de versión de plataforma y de cada dependencia;
- rutas normalizadas confinadas al módulo;
- mount path reservado y no colisionante;
- versión del contrato/manifest;
- migraciones y orden/versionado;
- permisos/capacidades solicitadas: DB, rutas, jobs, eventos, configuración;
- health/readiness opcional;
- integridad/commit esperado si no lo aporta ya el gitlink.

El loader debe ordenar topológicamente, detectar colisiones de rutas/modelos y
validar en runtime que router y registry tienen la forma esperada. El orden de
`readdirSync` no debe decidir precedencia funcional.

### 6.4 Pipeline de composición

```text
checkout --recurse-submodules
    ↓
validar gitlinks + manifests + compatibilidad + colisiones
    ↓
componer schema y migraciones en staging inmutable
    ↓
prisma generate
    ↓
build de packages, módulos, API y web desde cero
    ↓
unit + contract + integración + e2e
    ↓
imagen mínima firmada (incluye solo módulos habilitables certificados)
    ↓
migrate deploy controlado
    ↓
readiness y apertura de tráfico
```

Runtime no debería clonar, instalar dependencias, generar Prisma ni crear
migraciones. Esas son operaciones de supply chain/release.

## 7. Revisión por área

### 7.1 Núcleo

`core` concentra utilidades razonables, pero también demasiados efectos
laterales a través de su barrel. Mantendría modelos HTTP, filtros y contrato
modular, separando configuración/logger de las APIs puras. Corregiría primero
rate limit, error handler y request ID. `ModuleManager.invalid` tampoco refleja
de forma útil duplicados/ciclos/manifests inválidos en modo no estricto; o se
implementa un informe completo o se elimina esa promesa.

### 7.2 Base de datos

La separación del cliente y el schema es positiva. Faltan independencia real
respecto a módulos opcionales, migraciones compuestas, constraints de tenancy,
normalización robusta de email, cleanup de tokens y pruebas con PostgreSQL.
Los nombres de tablas del núcleo (`"User"`) y de contacts (`contacts`) siguen
convenciones distintas; conviene fijar una antes de crecer.

### 7.3 Sesión y autenticación

La combinación sesión Redis + cookie HttpOnly + token CSRF es adecuada para una
SPA del mismo ecosistema. Técnicamente el esquema usado es un token sincronizado
guardado en sesión, no “double-submit cookie”, porque no existe una segunda
cookie con el token. Cambiar el nombre en docs evita confusión.

Faltan política de verificación de email, rotación de secretos, invalidación de
sesiones, throttling específico de login/forgot/resend, transacciones y entrega
asíncrona de correo. La anti-enumeración de forgot tampoco es total: si existe
el usuario y falla el email se devuelve 500, mientras un usuario inexistente
recibe 200, además de diferencias de tiempo.

### 7.4 API

El envelope uniforme simplifica el cliente, aunque `statusCode` duplica el
protocolo HTTP. Si se conserva, debe aplicarse también a 404, errores no
capturados, rate limit y router dev. Versionaría la API (`/api/v1` o mediante
headers solo si hay una razón) antes de clientes externos. OpenAPI debe ser la
fuente contractual, no solo documentación de éxito.

### 7.5 Web

Angular standalone, signals, interceptor funcional y guards pequeños son una
base limpia. La aplicación es, por ahora, una demo de integración, no el
frontend de todos los flujos descritos. La prioridad es cerrar el mismo origen
productivo, auth completa, errores y tests; no introducir todavía una gran
capa de estado.

### 7.6 CLI

La CLI ofrece una UX clara, pero mezcla gestión Git, filesystem, pnpm, Prisma y
migraciones sin transacción ni plan/confirmación. La documentación afirma que
`add` revierte cualquier fallo posterior, pero el código solo limpia ante
manifest inválido/nombre discordante. Fallos de install/build/generate pueden
dejar directorio, symlink y config parciales. En `remove`, el comentario dice
“best effort” con grafo inválido, pero se instancia el manager estricto antes
de poder retirar el módulo defectuoso.

Para uso profesional: comandos con argumentos sin shell, validación previa,
`--dry-run`, journal de operaciones, rollback probado y separación clara entre
registrar submódulo, habilitarlo, migrarlo y retirarlo.

### 7.7 Pruebas

Los tests actuales demuestran bien parsers, paginación, grafo modular y lógica
de contacts. El siguiente incremento de valor no es subir cobertura de líneas
indiscriminadamente, sino cubrir invariantes:

- autorización y aislamiento entre usuarios/tenants;
- CSRF en cada método mutador, incluido un módulo cargado dinámicamente;
- carrera de consumo de token y duplicidad de email;
- fallo SMTP después de crear cuenta/outbox;
- Redis caído al arrancar y durante una petición;
- schema/migraciones desde checkout limpio;
- CLI frente a traversal, shell injection y rollback;
- build con submódulos inicializados y sin inicializar;
- enlace real de verificación/reset hasta la SPA;
- compatibilidad OpenAPI y cliente web.

## 8. Deriva y errores de documentación

La documentación es una fortaleza, pero actualmente puede inducir a errores:

- afirma que los módulos nunca son submódulos, contrario al diseño confirmado;
- presenta `contacts` como parte operativa sin que el padre lo pueda recuperar;
- promete rollback completo de `module add`, no implementado;
- presenta `file://` como fuente local admitida, pero la detección de URL no
  acepta ese protocolo;
- dice que todos los inputs Zod llegan normalizados, pero el parseo se descarta;
- califica CSRF como double-submit y dice que módulos no lo necesitan;
- afirma que una sesión Redis comprometida no sobrevive al reinicio del proceso,
  cuando precisamente el store externo permite que sobreviva;
- documenta rate limit de 20 peticiones/segundo, distinto del cálculo real;
- dice que el correo Bruno usa `EMAILS_DIR`, pero el emisor lo ignora;
- describe enlaces al frontend que no tienen página receptora;
- recomienda instalar antes de crear `.env`, secuencia que falla;
- describe `HOST` como bind aunque no se pasa a `listen`;
- el README enumera seis librerías y omite la CLI en el mapa principal;
- `docs/database.md` sitúa `prisma.config.ts` bajo `packages/database`, pero
  está en la raíz;
- `docs/web.md` afirma que no se usa Zone.js, aunque está en polyfills;
- el test Angular generado espera contenido que ya no existe.

Después de fijar la arquitectura, conviene convertir parte de la documentación
en verificaciones: ejemplos de comandos en CI, OpenAPI contractual y tests de
configuración/manifests.

## 9. Hoja de ruta recomendada

### Fase 0 — Contención inmediata (1–3 días)

1. No usar `module add/remove` con fuentes no controladas.
2. Validar nombre/rutas y eliminar `execSync` con shell.
3. Mover CSRF al pipeline global y cubrir `contacts`.
4. Hacer fallar producción con secreto default o SMTP implícito.
5. Corregir `EMAILS_DIR` y no reutilizar una API externa en Bruno salvo opt-in.
6. Documentar temporalmente que no existe aún un build limpio soportado.

**Salida:** no hay traversal/inyección conocida, todas las mutaciones tienen
CSRF y configuración insegura no arranca.

### Fase 1 — Reproducibilidad (3–7 días)

1. Registrar `contacts` como submódulo real —o crear repo de distribución—.
2. Eliminar referencias concretas de contacts en el paquete database del
   núcleo.
3. Definir checkout recursivo y compatibilidad manifest/plataforma.
4. Diseñar composición reproducible de Prisma y migraciones.
5. Incluir módulos en build/Docker y crear `.dockerignore`.
6. Hacer que install/build no dependan de artefactos locales ni de un secreto
   de runtime; corregir orden de `.env`.
7. Migrar a Node LTS soportado y alinear toolchain.

**Salida:** un runner vacío puede clonar recursivamente y completar install,
generate, test, build e imagen dos veces con el mismo resultado.

### Fase 2 — Seguridad y datos (1–2 semanas)

1. Fijar tenancy/ownership/RBAC y aplicarlo en repositorios.
2. Hacer atómicos tokens y cambios de credenciales; añadir invalidación de
   sesiones.
3. Introducir outbox/worker o proveedor con reintentos para correo.
4. Separar URL pública de bind/proxy y terminar flujos web.
5. Endurecer rate limiting por endpoint y distribuido.
6. Definir política de migrations deploy/rollback/backup.
7. Añadir audit log de acciones sensibles.

**Salida:** tests negativos de autorización, concurrencia y recuperación pasan
con PostgreSQL y Redis reales efímeros.

### Fase 3 — Contratos y calidad (1–2 semanas)

1. Usar el resultado parseado de Zod como DTO.
2. Unificar errores/envelope y completar OpenAPI con seguridad y errores.
3. Generar/verificar tipos cliente desde OpenAPI.
4. Tipar filtro/orden, desempatar paginación y limitar offsets.
5. Integrar tests Angular y lint frontend en el comando raíz.
6. Añadir contract tests exigidos a todo submódulo.

**Salida:** no hay divergencia conocida entre schema, runtime, OpenAPI y web.

### Fase 4 — Operación (1–2 semanas)

1. CI obligatoria y protección de rama.
2. Readiness/liveness, startup ordenado y graceful shutdown probado.
3. Logs estructurados con redacción, métricas y trazas básicas.
4. Imagen mínima, SBOM, escaneo, firma y promoción por digest.
5. Runbook de migración, rollback, incidentes, backups y restauración.
6. SLOs iniciales: disponibilidad, latencia, error rate y entrega de correo.

**Salida:** despliegue repetible a staging, prueba de restauración y rollback de
aplicación documentado.

## 10. Criterios para declarar una primera versión profesional

No publicaría `1.0` hasta demostrar de forma automatizada:

- clon recursivo limpio e instalación sin estado local;
- build de núcleo + web + todos los submódulos fijados;
- migraciones reproducibles sobre base vacía y upgrade desde la versión previa;
- ausencia de operaciones CLI fuera de rutas permitidas;
- autorización/tenancy y CSRF con casos negativos;
- reset/verificación desde el enlace real hasta la UI;
- invalidación de sesiones después de cambio de contraseña;
- error uniforme y OpenAPI compatible;
- readiness que impide tráfico sin Redis/PostgreSQL;
- imagen no-root, mínima, escaneada y reproducible;
- backup/restore probado;
- CI obligatoria sin depender de `dist`, Prisma Client o módulos preexistentes.

## 11. Prioridad resumida

| Orden | Acción | Riesgo que elimina |
|---:|---|---|
| 1 | Asegurar CLI: nombres, rutas y procesos sin shell | Ejecución/borrado arbitrario |
| 2 | Aplicar CSRF global | Mutaciones cross-site |
| 3 | Formalizar submódulos y desacoplar database de contacts | Build no reproducible |
| 4 | Fallar seguro en producción y migrar Node | Secretos/runtime inadecuados |
| 5 | Definir autorización/tenancy | Exposición y modificación transversal |
| 6 | Resolver migraciones modulares | Pérdida/deriva de datos |
| 7 | Reparar auth/email y atomicidad | Cuentas bloqueadas/tokens reutilizados |
| 8 | CI desde checkout limpio | Regresiones invisibles |
| 9 | Contrato OpenAPI/Zod/web | Incompatibilidad de clientes |
| 10 | Readiness, observabilidad y supply chain | Incidentes difíciles de detectar/operar |

## 12. Conclusión

El proyecto no necesita una reescritura. Su mejor activo es que ya tiene
fronteras comprensibles y un módulo real con el que probarlas. La estrategia
correcta es endurecer esas fronteras:

- Git debe fijar qué código compone el producto;
- el build debe empezar limpio y producir un artefacto completo;
- el schema y las migraciones deben ser parte del release;
- el núcleo debe aplicar seguridad transversal a cualquier módulo;
- el manifest debe ser un contrato de compatibilidad, no solo metadatos;
- los módulos in-process deben tratarse como código plenamente confiable.

Con los P0 y P1 resueltos, Alxarafe JS puede convertirse en una base profesional
coherente. Sin ellos, añadir módulos aumenta simultáneamente el riesgo de datos,
seguridad y despliegue.

## 13. Fuentes externas puntuales

El análisis es principalmente evidencia del repositorio. Para el estado de
soporte del runtime se consultaron fuentes oficiales el 12-09-2026:

- [Node.js — Previous Releases](https://nodejs.org/en/about/previous-releases):
  Node 23 figura EOL; Node recomienda Active/Maintenance LTS para producción.
- [Angular — Version compatibility](https://angular.dev/reference/versions):
  Angular 20.2/20.3 admite Node `^20.19`, `^22.12` o `^24`, no Node 23.
- [Angular — Versioning and releases](https://angular.dev/reference/releases):
  Angular 20 permanece en LTS hasta el 28-11-2026.
