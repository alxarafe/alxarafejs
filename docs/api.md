# API

Entorno de desarrollo: `http://localhost:8080`. El spec OpenAPI 3.0 se sirve en `/swagger.json` y la UI en `/swagger`.

## Formato de respuesta estándar

Toda respuesta (éxito o error) usa el envelope `ServiceResponse`:

```json
{
  "success": true,
  "message": "Users found",
  "responseObject": { },   // entidad, lista paginada o null
  "statusCode": 200
}
```

- `success`: `true`/`false`.
- `message`: texto legible (p. ej. `"User not found"`).
- `responseObject`: el dato de dominio. En listas paginadas es `{ data, pagination }` (ver abajo).
- `statusCode`: mismo valor que el HTTP status de la respuesta.

Los controllers y guards construyen estas respuestas con `ServiceResponse.success()` / `ServiceResponse.failure()`; también el `errorHandler` (404 y errores no capturados) responde con el envelope, nunca HTML.

## Colecciones y paginación (estilo OData)

`GET /users` devuelve una **lista paginada** con `data` + `pagination`:

```json
{
  "success": true,
  "message": "Users found",
  "responseObject": {
    "data": [
      { "id": 1, "name": "Ana", "email": "ana@example.com", "role": "USER", "emailVerifiedAt": null, "createdAt": "...", "updatedAt": "..." }
    ],
    "pagination": {
      "count": 42,
      "limit": 10,
      "offset": 0,
      "page": 1,
      "totalPages": 5,
      "nextLink": "/users?$count=true&$top=10&$skip=10",
      "previousLink": null
    }
  },
  "statusCode": 200
}
```

### Query options soportados

| Option | Aliases | Descripción | Default/límite |
|---|---|---|---|
| `$top` | `limit` | Número de items por página | `100`, máx. `500` |
| `$skip` | `offset` | Items a saltar (desplazamiento) | `0` |
| `$count` | `$inlinecount` | Si `true|1`, se cuenta el total exacto (`count` = total real) | sin conteo: `count` = `offset + items` |
| `$filter` | — | Expresiones de filtrado (ver abajo) | — |
| `$orderby` | — | Ordenación `campo asc|desc` separada por comas | `id asc` |

Los enlaces `nextLink`/`previousLink` los genera el servidor e **incluyen** `$top`, `$skip`, `$count`, `$filter` y `$orderby` ya calculados.

### `$filter`

Gramática soportada (parser recursivo en `@alxarafe/core`):

- **Comparadores**: `eq`, `ne`, `gt`, `ge`/`gte`, `lt`, `le`/`lte`
- **Funciones**: `contains(campo, 'x')`, `startswith(campo, 'x')`, `endswith(campo, 'x')`
- **Lógica**: `and`, `or` (precedencia: `or` < `and`) y paréntesis
- **Literales**: `'texto'` (comillas simples/dobles), números, `true`, `false`, `null`

Campos filtrables/ordenables en `User`: `id`, `email`, `name`, `role`, `emailVerifiedAt`, `createdAt`, `updatedAt`. Otros campos (p. ej. `passwordHash`) se rechazan con **400**.

Ejemplos:

```
GET /users?$top=10&$skip=20&$count=true
GET /users?$filter=role eq 'ADMIN'
GET /users?$filter=name contains 'ana' and emailVerifiedAt ne null
GET /users?$filter=createdAt gt '2026-01-01'
GET /users?$orderby=name desc,email asc
```

Un filtro/orden inválido responde **400** con el mensaje del error (`Invalid $filter: ...`).

## Endpoints

### Health

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health-check` | No | Probe de readiness: comprueba **Redis** y **BD**, responde `200` (`"Service is healthy"`) o `503` (`"Service is not ready"`) con `responseObject.checks = { redis, database }` (`"ok"`/`"unavailable"`). Se sirve antes de sesión/log para seguir respondiendo aunque Redis caiga |

### Auth

| Método | Ruta | Auth | CSRF | Body | Respuesta |
|---|---|---|---|---|---|
| `POST` | `/auth/register` | No | No | `{ name, email, password }` | `201` → `{ user, csrfToken }` |
| `POST` | `/auth/login` | No | No | `{ email, password }` | `200` → `{ user, csrfToken }` |
| `POST` | `/auth/logout` | **Sí** | **Sí** | — | `200` |
| `GET` | `/auth/me` | **Sí** | No | — | `200` → `User` |
| `GET` | `/auth/csrf` | No | No | — | `200` → `{ csrfToken }` |
| `POST` | `/auth/verify-email` | No | No | `{ token }` | `200` |
| `POST` | `/auth/resend-verification` | **Sí** | **Sí** | — | `200` |
| `POST` | `/auth/forgot-password` | No | No | `{ email }` | `200` |
| `POST` | `/auth/reset-password` | No | No | `{ token, password }` | `200` |

El `csrfToken` devuelto en login/register (o en `GET /auth/csrf`) debe enviarse como cabecera `X-CSRF-Token` en las mutaciones con sesión autenticada. Ver [auth.md](auth.md).

### Users

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/users` | **Sí** | Lista paginada (`$top`, `$skip`, `$count`, `$filter`, `$orderby`) |
| `GET` | `/users/:id` | **Sí** | Entidad por id (valida `id` entero positivo) |

### Dev (solo `NODE_ENV=development`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/auth/dev/email-tokens?email=X&purpose=verify\|reset` | Extrae el token del último correo `.eml` enviado al email indicado (para testing sin SMTP) |

En `production` este router no se monta.

## Errores

- **Validación de entrada** (`validateRequest`): responde `400` con `Invalid input: campo: mensaje` (Zod).
- **Filtro/orden inválido**: `400` con `Invalid $filter: ...` / `Invalid $orderby: ...`.
- **No autenticado**: `401`.
- **Sin permisos** (`requireRole`): `403`.
- **No encontrado**: `404` (rutas desconocidas; envelope con `"Route not found"`).
- **Conflictos de negocio** (p. ej. email ya registrado): `409`.
- **No listo** (dependencia de health caída): `503`.
- **Errores internos**: `500`, con mensaje genérico (`"Internal Server Error"`) en producción y el detalle en los logs bajo el `request-id` (en desarrollo el message llega al cliente).