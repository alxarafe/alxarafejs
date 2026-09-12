# Autenticación

## Modelo

- **Sesiones server-side** en Redis: `express-session` + `connect-redis`, cookie de sesión `sid` (HttpOnly, `SameSite=Lax`). No hay JWT.
- La sesión guarda `userId` y el `csrfToken` vigente.
- Los datos sensibles del usuario (passwordHash, tokens en bruto) nunca se devuelven al cliente: la API expone un `User` "público" (`id`, `name`, `email`, `role`, `emailVerifiedAt`, `createdAt`, `updatedAt`).

## Protección CSRF (double-submit)

- Cada sesión tiene un `csrfToken` aleatorio almacenado en la sesión de Redis.
- El cliente lo recibe al hacer **login/register** (en `responseObject.csrfToken`) o vía `GET /auth/csrf`.
- En toda mutación con sesión autenticada el cliente debe enviar el token en la cabecera **`X-CSRF-Token`** — se valida a nivel de aplicación, así que también cubre los routers de los módulos (no solo `/auth`). La sesión de Redis es la fuente de verdad: el token enviado se compara contra el almacenado (no se valida contra una cookie, por eso es "double-submit" con cabecera).
- Si falta o no coincide: `403`.
- El registro y el login no exigen CSRF (aún no hay sesión). Una vez autenticado, **cada mutación requiere el token vigente**; si el servidor rota el token, el cliente debe refrescarlo.

## Flujos

### Registro — `POST /auth/register`

1. Normaliza el email a minúsculas.
2. Si ya existe un usuario con ese email → `409`.
3. Cifra la contraseña con **bcrypt (12 rondas)**, crea el usuario (`role` por defecto `USER`, `emailVerifiedAt` nulo).
4. Genera un token de verificación y envía el email de verificación (vigencia **24 h**).
5. Responde `201` con el usuario público y el `csrfToken`.

### Login — `POST /auth/login`

1. Busca por email normalizado y compara la contraseña con bcrypt.
2. Fallo genérico `Invalid email or password` (`401`) en ambos casos para no filtrar qué emails existen.
3. Crea la sesión y responde con el usuario público y el `csrfToken`.

### Logout — `POST /auth/logout`

Requiere sesión y CSRF. Destruye la sesión y la cookie.

### Verificación de email

- **`POST /auth/verify-email`** `{ token }`: consulta el token por su **hash**; rechaza tokens inexistentes, ya usados o caducados (`400`). Marca `emailVerifiedAt` y consume el token.
- **`POST /auth/resend-verification`** (sesión + CSRF): solo si el email no está verificado; borra los tokens de verificación previos del usuario y envía uno nuevo.

### Reset de contraseña

- **`POST /auth/forgot-password`** `{ email }`: crea un token de reset (vigencia **1 h**) reemplazando los anteriores y envía un email con `reset-password?token=...`. La respuesta es **idéntica exista o no la cuenta** (anti-enumeración).
- **`POST /auth/reset-password`** `{ token, password }`: valida el token por hash, cifra la nueva contraseña y consume el token.

### Endpoint CSRF

- **`GET /auth/csrf`** → `{ csrfToken }`. Útil para renovar el token (p. ej. tras volver a abrir el navegador con una sesión viva).

## Gestión de tokens (single-use, hash en BD)

Los tokens de contraseña reset y de verificación se generan con `crypto.randomBytes` (strings largos) y **solo se almacena su hash SHA-256** en la base de datos (`tokenHash @unique`). Un token sirve una única vez (`usedAt`) y tiene caducidad. Esto hace que una fuga de BD no exponga tokens usables. Detalle en [database.md](database.md).

## Dev router (`/auth/dev`)

Solo en `NODE_ENV=development`: permite reenviar/manipular flujos de verificación y reset para pruebas sin SMTP.