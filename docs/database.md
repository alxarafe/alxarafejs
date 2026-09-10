# Base de datos

- **Motor**: PostgreSQL.
- **ORM**: Prisma 7 con driver adapter `@prisma/adapter-pg` (Prisma 7 ya no lee `DATABASE_URL` directamente desde el schema; la URL se lee en `packages/database/prisma.config.ts`).
- **Generación del cliente**: `prisma generate` en `postinstall`.
- El `datasource` se declara sin `url` en el schema porque el adapter la inyecta en tiempo de ejecución.

## Modelos

### `User`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `Int` | PK autoincremental |
| `email` | `String` | `@unique` |
| `passwordHash` | `String` | bcrypt (12 rondas) |
| `name` | `String` | |
| `role` | `enum Role` | `USER` \| `ADMIN`, por defecto `USER` |
| `emailVerifiedAt` | `DateTime?` | Nulo hasta que verifica el email |
| `createdAt` / `updatedAt` | `DateTime` | `@default(now())` / `@updatedAt` |
| `emailVerificationTokens` | 1-N | |
| `passwordResetTokens` | 1-N | |

### `EmailVerificationToken`

Verificación de email. Campos: `id`, `tokenHash @unique`, `userId` (FK, `onDelete: Cascade`), `expiresAt`, `usedAt?`, `createdAt`. Índice en `userId`. Vigencia: **24 h**.

### `PasswordResetToken`

Reseteo de contraseña. Misma estructura, vigencia: **1 h**.

## Decisiones de diseño

- **El token en bruto nunca se guarda**: solo `tokenHash` (SHA-256). El token de un solo uso viaja en el link del email; resolverlo en la BD solo es posible por hash, y además exige algo que el atacante no tiene (el texto original).
- **Single-use**: `usedAt` se rellena al consumirse; los flujos rechazan tokens ya usados.
- **Rotación**: al reenviar verificación o reset, se borran los tokens anteriores del usuario.
- **Baja de tokens**: `onDelete: Cascade` elimina los tokens al borrar el usuario.
- **Datos públicos**: el repositorio/servicio de `@alxarafe/users` expone `toPublicUser` y el modelo OpenAPI excluye `passwordHash` (ver [security.md](security.md)).

## Comandos

```bash
pnpm db:migrate dev   # crear/migrar cambios con generador de diffs
pnpm db:push          # aplicar schema sin historial
pnpm db:studio        # UI de inspección
pnpm db:deploy        # aplicar migraciones en entornos gestionados
```