# Tests

Cómo se escriben y ejecutan las pruebas del monorepo: **tests automatizados**
(Vitest + supertest) y **pruebas de API interactivas** (colecciones Bruno).

## 1. Tests automatizados (Vitest + supertest)

Se ejecutan con:

```bash
pnpm test          # vitest run --passWithNoTests
pnpm test:cov      # con cobertura (V8)
```

Vitest las descubre por patrón de fichero en `vite.config.mts`:

```
apps/**/src/**/*.test.ts
packages/**/src/**/*.test.ts
modules/**/src/**/*.test.ts
```

### Dónde colocarlas

| Código | Ruta de tests |
|---|---|
| Paquete del núcleo | `packages/<pkg>/src/__tests__/<unidad>.test.ts` |
| App | `apps/api/src/__tests__/<router>.test.ts` |
| Módulo (su propio repo) | `modules/<nombre>/src/__tests__/<unidad>.test.ts` |

Nada más añadirlo se ejecuta con `pnpm test`: no hace falta configurar nada.
En los módulos, además, es necesario que el patrón `modules/**` esté en
`vite.config.mts` (ya está).

### Patrones usados

- **Servicio con repositorio inyectable** (`constructor(repository = new Repo())`):
  en el test se pasa un *fake* y se verifican llamadas y respuestas sin tocar la BD.

  ```ts
  const service = new ContactService(fakeRepo as never);
  const res = await service.create({ name: "Ada" });
  expect(fakeRepo.createAsync).toHaveBeenCalledWith({ name: "Ada", notes: null });
  ```

- **Capa HTTP con supertest**: en los routers se monta el router real sobre
  un `express()` mínimo y se *mockean* los guards y el controlador que no se
  quiere ejercitar:

  ```ts
  vi.mock("@alxarafe/users", () => ({ requireAuth: (_req,_res,next) => next() }));
  const app = express();
  app.use(express.json());
  app.use("/contacts", contactRouter);
  const res = await request(app).get("/contacts/channel-types");
  ```

  Así se prueban rutas, validación Zod, orden de rutas y forma de la
  respuesta sin Redis ni BD.

> Las pruebas que tocan BD auténtica se consideran de integración y se
> cubren mejor con la colección Bruno contra el servidor en marcha.

## 2. Colecciones Bruno (pruebas de API interactivas)

Bruno es el cliente de API *offline* que usamos en lugar de Postman. Las
colecciones son carpetas con ficheros `.bru` (formato de texto) listas para
abrir en la app de Bruno.

### Dónde vive cada colección (principio de artefactos)

| Colección | Descripción | Repositorio |
|---|---|---|
| `apps/api/bruno/alxarafe-api/` | Endpoints del **núcleo**: auth, users, health, OpenAPI | núcleo |
| `modules/<nombre>/bruno/` | Endpoints de un **módulo** (p. ej. `contacts`) | el repo del módulo |

Un módulo nunca añade peticiones a la colección del núcleo; su colección vive
en su propio repo (no deja rastro en el núcleo).

### Cómo crear una colección

1. Estructura mínima:

   ```
   mi-coleccion/
   ├── bruno.json                # config de la colección (exigida por el CLI v4+)
   ├── collection.bru            # meta de la colección
   ├── environments/local.bru    # variables por entorno
   └── carpeta/                  # peticiones agrupadas
       └── Mi petición.bru
   ```

2. `collection.bru` + `bruno.json`:

   ```
   meta {
     name: mi-coleccion
     type: collection
     seq: 1
   }
   ```
   ```json
   { "version": "1", "name": "mi-coleccion", "type": "collection", "ignore": ["node_modules", ".git"] }
   ```

   Sin `bruno.json`, `bru run` ni la app reconocen la carpeta como colección.

3. `environments/local.bru`:

   ```
   vars {
     BASE_URL: http://localhost:8080
     EMAIL: user@example.com
   }
   ```

4. Petición (formato v2; los verbos son bloques `get {}`, `post {}`, `put {}`,
   `delete {}`, y las cabeceras van a **nivel superior** en un bloque
   `headers { ... }`, nunca dentro del verbo):

   ```
   meta {
     name: Login
     type: http
     seq: 20
   }

   headers {
     X-CSRF-Token: {{csrfToken}}
   }

   post {
     url: {{BASE_URL}}/auth/login
     body: json
     auth: none
   }

   body:json {
     { "email": "{{EMAIL}}", "password": "{{PASSWORD}}" }
   }
   ```

   - `{{VARIABLE}}` interpola variables del entorno o capturadas.
   - `seq` ordena las peticiones en el panel.
   - Las cabeceras van en el bloque `headers {}` dentro del verbo.

### Captura de variables entre peticiones

Los bloques `script:post-response` ejecutan JS tras cada respuesta:

```
script:post-response {
  if (res.body && res.body.responseObject) {
    bru.setVar("contactId", res.body.responseObject.id);
    bru.setVar("csrfToken", res.body.responseObject.csrfToken);
  }
}
```

Así pueden encadenarse: el alta captura el `id` y las siguientes lo usan en
la URL (`/contacts/{{contactId}}/channels`).

### Autenticación

- **Sesión por cookie**: habilita la **cookie jar** de la colección
  (Settings → Cookies → guardar cookies) y haz **login** primero; el resto de
  peticiones llevan la sesión automáticamente.
- **CSRF** (solo en `/auth/*` del núcleo): las escrituras con sesión exigen
  `X-CSRF-Token`. El propio login devuelve `csrfToken`; captúralo y añade la
  cabecera a los POST autenticados. Los módulos (p. ej. contacts) **no**
  protegen sus rutas con CSRF: solo necesitan la cookie.

### Cómo ejecutarlas

**Desde línea de comandos** (sin la app de Bruno; requiere `@usebruno/cli`):

```bash
pnpm test:bruno          # colección del núcleo (apps/api/bruno/alxarafe-api)
pnpm test:bruno modules/contacts/bruno/alxarafe-contacts   # colección de un módulo
BASE_URL=http://localhost:8080 EMAIL=yo@mail.com PASSWORD=misecret pnpm test:bruno
```

El script `scripts/bruno-api.sh`:
1. Arranca **su propia API** (por defecto en `http://localhost:8090`, con
   `COMMON_RATE_LIMIT_MAX_REQUESTS=5000`) si no hay ninguna en esa URL,
   esperándola hasta 90 s. Si ya hay una respondiendo (p. ej. tu dev en
   `:8080`), la usa tal cual.
2. Crea el usuario de login con email fresco (`bruno-<timestamp>@alxarafe.com`)
   si no existe, así cada ejecución es repetible.
3. Ejecuta `bru run --env local` sobre la colección (cookie jar y capturas
   de variables funcionan igual que en la GUI).
4. Apaga la API al terminar si fue él quien la arrancó. El código de salida
   es el de Bruno (≠ 0 si alguna petición falla).

Requisitos: PostgreSQL, Redis, migraciones aplicadas y `SMTP_HOST` vacío en
`.env` (los flujos de verificación/reset leen el token del email a fichero vía
`/auth/dev/email-tokens`). Para apuntar a otra URL o usar credenciales fijas:
`BASE_URL=... EMAIL=... PASSWORD=... pnpm test:bruno`.

**Desde la app de Bruno:**

1. Arranca la API: `pnpm start:dev` (BD + `.env` en marcha).
2. En Bruno: **Abrir carpeta** → selecciona la carpeta de la colección.
3. Entorno: crea/selecciona uno (p. ej. `local`) con sus variables y la
   `BASE_URL` correcta.
4. Ejecuta en orden (o la colección entera: Run → Run Collection),
   empezando por **Login**.

### Colecciones existentes

- `apps/api/bruno/alxarafe-api/` — login/registro/verificación/reset, CSRF,
  users, health-check y swagger. Ver su `README.md` dentro de la carpeta.
- `modules/contacts/bruno/alxarafe-contacts/` — flujo completo de un módulo:
  alta anidada (contacto+addresses+channels), sub-recursos y borrado.

### Buenas prácticas

- Al añadir un endpoint del núcleo, registra su request en la colección del
  núcleo y regístralo también en OpenAPI (Swagger se genera a partir de los
  `registerPath` de los routers).
- Al añadir un endpoint de módulo, hazlo en **su** colección, en **su** repo.
- Usa variables y scripts para encadenar flujos; no hardcodees ids ni tokens.
- Documenta en el `README.md` de la colección el flujo y los prerrequisitos
  (transporte de email a fichero, usuario existente, etc.).