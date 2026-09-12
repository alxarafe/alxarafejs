# Seguridad

## Cabeceras y transporte

- **Helmet** aplica cabeceras de seguridad HTTP (X-Content-Type-Options, strict-transport, etc.).
- **CORS** (`cors({ credentials: true, origin: env.CORS_ORIGIN })`): solo permite el origen configurado y envío de cookies (`credentials`).

## Sesiones

- **Redis** como store: una sesión comprometida no sobrevive a un reinicio del proceso y es revocable instantáneamente.
- Cookie `sid` con `HttpOnly` (no accesible desde JS) y `SameSite=Lax`.
- `SESSION_NAME` y `SESSION_SECRET` configurables; TTL por defecto 7 días (`SESSION_TTL_SECONDS`).
- Al iniciar/logout se regenera la sesión para mitigar *session fixation*.

## Rate limiting

- `rateLimiter` limita por IP: ventana `COMMON_RATE_LIMIT_WINDOW_MS` (1 s) y `COMMON_RATE_LIMIT_MAX_REQUESTS` (20) por defecto.
- Se aplica globalmente antes del enrutado.

## CSRF

- Patrón *double-submit* con cabecera `X-CSRF-Token` comparada contra el token guardado en la sesión Redis. Detalle en [auth.md](auth.md).

## Contraseñas y tokens

- Contraseñas: **bcryptjs, 12 rondas**. Nunca se devuelven al cliente (`toPublicUser` / modelo OpenAPI sin `passwordHash`).
- Tokens de verificación/reset: `crypto.randomBytes`, solo se guarda el **hash SHA-256** en BD, de un solo uso y con caducidad ([database.md](database.md)).

## Anti-enumeración

- **Login**: fallo genérico `Invalid email or password` tanto si el email no existe como si la contraseña es incorrecta.
- **Forgot-password**: respuesta idéntica exista o no la cuenta (`"If an account exists for that email, a reset link has been sent"`).

## Validación de entrada

- Validación de parámetros y body con **Zod** (`validateRequest`): cualquier violación responde `400` antes de llegar al servicio.
- IDs de ruta validados (p. ej. `:id` debe ser entero positivo).

## Registro y logging

- `requestLogger` añade `request-id` y registra cada petición con **pino-http**.
- Los errores internos se registran por `request-id` en el `errorHandler`.
- No se loguean secretos ni contraseñas.

## Producción

- Cambiar `SESSION_SECRET` (≥32 chars sin default) y `SMTP_*` (ver `.env.example`).
- Publicar bajo HTTPS real: `PUBLIC_WEB_URL` (base de enlaces de email) y `TRUST_PROXY` son **obligatorias** en producción; sin ellas el arranque falla a propósito.
- El router `/auth/dev` **no se monta** en producción.