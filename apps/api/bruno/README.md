# Colección Bruno — Núcleo (auth, users, health)

Pruebas HTTP de los endpoints de **primera parte** que monta `apps/api`
(auth, users, health-check y OpenAPI). Esta colección vive en el repo del
núcleo (`apps/api/bruno`) porque describe la API del núcleo.

> Las colecciones de los **módulos** viven en su propio repo
> (`modules/<nombre>/bruno/`) — ver el README de la colección de contacts.

## Uso

1. Arranca la API: `pnpm start:dev` (o `pnpm dev`) con la BD y `.env`.
2. Abre la carpeta `apps/api/bruno/alxarafe-api` en Bruno y crea/usa el
   entorno `local`:
   - `BASE_URL`: URL de la API.
   - `EMAIL` / `PASSWORD`: credenciales de un usuario existente.
   - `NEW_EMAIL` / `NEW_PASSWORD` / `NAME`: usados por los flujos de
     registro y reset.
3. Habilita la **cookie jar** de la colección (Settings → Cookies) para que
   la sesión de `login` persista.
4. Ejecuta **Login** primero: las peticiones siguientes ya llevan la sesión
   y las variables `csrfToken` y `userId` se capturan automáticamente.

## CSRF

`/auth/*` protege las peticiones de escritura con doble envío CSRF
(`X-CSRF-Token`) cuando la sesión ya tiene `userId`. Por eso los POST que
van con sesión (logout, resend, forgot, reset) incluyen la cabecera
`X-CSRF-Token: {{csrfToken}}` — la captura `Login`/`CSRF token`.

## Flujos

| # | Petición | Notas |
|---|----------|-------|
| 10 | Health check | Sin auth |
| 11 | OpenAPI (swagger.json) | Documento completo generado |
| 20 | Login | Captura `csrfToken` y `userId`; sesión en cookie jar |
| 21 | CSRF token | Alternativa para refrescar el token |
| 22 | Me | Usuario autenticado |
| 23 | Logout | Destruye la sesión |
| 30 | Register | Crea cuenta con `NEW_EMAIL` (sin verificar) |
| 31 | Dev: capture verify token | Lee el token del email (dev) para `NEW_EMAIL` |
| 32 | Verify email | Consume `verifyToken` |
| 33 | Resend verification | Reenvía el email y se vuelve a capturar el token (31) |
| 40 | Forgot password | Envía email de reset para `EMAIL` |
| 41 | Dev: capture reset token | Lee el token del email (dev) |
| 42 | Reset password | Cambia la contraseña con `resetToken` y `NEW_PASSWORD` |
| 50 | List users | Paginado, `$filter`, `$orderby` |
| 51 | Get user | Detalle del usuario de la sesión |

El flujo de registro/verificación y el de reset requieren el transporte de
email **a fichero** (deja `SMTP_HOST` vacío en `.env`) porque el token se
lee desde `emails/*.eml` vía `/auth/dev/email-tokens` (solo en desarrollo).

Detalles de implementación y ejecución de tests (automatizados y Bruno) en
[`docs/testing.md`](../../../docs/testing.md).