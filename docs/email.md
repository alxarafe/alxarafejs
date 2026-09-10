# Email

Paquete `@alxarafe/email` basado en **nodemailer**.

## Selección de transporte

- Si **`SMTP_HOST` está vacío** (dev, por defecto en `.env.example`) → **transporte a fichero**: cada correo se escribe como `.eml` en `./emails` (relativo al `cwd`), listo para inspeccionar sin servidor SMTP.
- Si hay `SMTP_HOST` → transporte SMTP real. `SMTP_PORT=465` activa `secure` (`TLS`); se usan `SMTP_USER`/`SMTP_PASS` para autenticación si están definidos.
- El transporte se crea una sola vez y se cachea (`getTransport`).

## API

```ts
sendEmail({ to, subject, text, html? }): Promise<void>
getDevMailDir(): string
```

- `from` se rellena siempre con `EMAIL_FROM` (`no-reply@alxarafe.com` por defecto).
- En dev se loguea `[DEV MAIL] <subject> -> <to> (written to ./emails)`.

## Correos enviados por el sistema

| Ocasión | Asunto | Vigencia del token |
|---|---|---|
| Registro | Verify your email address | 24 h |
| Reenvío de verificación | Verify your email address | 24 h |
| Reset de contraseña | Reset your password | 1 h |

Los enlaces apuntan al frontend (`appBaseUrl` = `http://HOST:PORT` salvo en producción, que usa `https`):
- `/verify-email?token=...`
- `/reset-password?token=...`

## Dev helper

En `NODE_ENV=development`, `GET /auth/dev/email-tokens?email=X&purpose=verify|reset` devuelve el token del último `.eml` enviado a ese email, para completar verificación/reset en pruebas automatizadas sin SMTP.