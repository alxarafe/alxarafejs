# Cliente web (`@alxarafe/web`)

Aplicación **Angular 20** standalone (sin `NgModule`), gestor **pnpm**, en `apps/web`. No usa zona.js (signals); se añadió la dependencia extra para soporte de alineación señales.

## Estructura

```
apps/web/src/app/
├── app.ts / app.config.ts / app.routes.ts
├── core/
│   ├── models/           api.ts (ServiceResponse, Paginación, ApiError), user.ts
│   ├── services/         auth.service.ts, users.service.ts
│   ├── interceptors/     api.interceptor.ts
│   └── guards/           auth.guard.ts, guest.guard.ts
└── pages/
    ├── login/            login.ts
    └── users/            users.ts (tabla paginada)
```

## Rutas

| Ruta | Componente | Guard |
|---|---|---|
| `` → redirect `/login` | | |
| `/login` | `LoginPage` | `guestGuard` (redirige a `/users` si ya hay sesión) |
| `/users` | `UsersPage` | `authGuard` (redirige a `/login` sin sesión) |
| `**` → redirect `/login` | | |

## HTTP

- `provideHttpClient(withFetch(), withInterceptors([apiInterceptor]))` en `app.config.ts`.
- **`apiInterceptor`** (HTTP interceptor funcional):
  - Fuerza `withCredentials: true` (cookies de sesión en todas las peticiones, CORS con credentials).
  - En métodos `POST/PUT/PATCH/DELETE` inyecta la cabecera `X-CSRF-Token` con el token vigente del `AuthService`.
  - Convierte errores HTTP en `ApiError { message, status }`.

### Servicios

- **`AuthService`**: `register`, `login`, `logout`, `me`, `getCsrfToken` (y gestión en memoria del `csrfToken` + estado de sesión para los guards).
- **`UsersService`**: `list(query)` → `PaginatedList<User>` usando el envelope `ServiceResponse`; `getById`.

### Modelos

- `ServiceResponse<T>` (success, message, responseObject, statusCode), `PaginationMeta` (count, limit, offset, page, totalPages, nextLink, previousLink) y `PaginatedList<T>` — espejo exacto del backend.
- `User` público: `id`, `name`, `email`, `role`, `emailVerifiedAt`, `createdAt`, `updatedAt`.

## Páginas

- **Login**: formulario email + contraseña; de la respuesta se guarda `csrfToken` y se navega a `/users`.
- **Users**: tabla paginada con `$top/$skip/$count`; la propia paginación los construye usando `nextLink`/`previousLink` devueltos por la API.

## Desarrollo

- **Proxy**: `proxy.conf.json` redirige `/api` → `http://localhost:8080` en dev, evitando CORS: los servicios llaman a `/api/...` y el servidor Angular reenvía. Las peticiones van con `withCredentials` (relevante cuando se consume con cookie de sesión).
- Scripts: `pnpm --filter @alxarafe/web build|start|test`.
- **Biome**: el directorio `apps/web` está excluido del lint en la raíz.

## Abrir el cliente

```bash
pnpm --filter @alxarafe/web start   # http://localhost:4200 (proxy → 8080)
```