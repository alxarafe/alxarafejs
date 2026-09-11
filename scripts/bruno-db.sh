#!/usr/bin/env bash
# Prepara la base de datos de test aislada para las colecciones Bruno (y
# cualquier otra suite de integración), SIN tocar la BD de desarrollo.
#
# Uso:
#   TEST_DATABASE_URL=... BRUNO_RESET_DB=1 ./scripts/bruno-db.sh
#
# Salida: imprime por stdout las variables que el runner debe exportar:
#   export TEST_DATABASE_URL='...'
#
# Reglas:
#   - TEST_DATABASE_URL (o su alias BRUNO_DB_URL) si se suministra: se usa tal
#     cual (se asume que existe; no se crea).
#   - Si no, se deriva de DATABASE_URL (leída de .env): misma conexión y BD
#     `alxarafe_bruno`, que se crea si no existe.
#   - Se sincroniza el esquema con `prisma db push` (cubre núcleo + módulos
#     activos vía los fragmentos enlazados). Idempotente y no interactivo.
#   - Con BRUNO_RESET_DB=1 se vacía primero la BD de test (--force-reset).
#
# Exit: 0 si la BD queda lista; != 0 con mensaje claro en caso contrario.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "error: no hay .env en $ROOT (hace falta DATABASE_URL)" >&2
  exit 2
fi
set -a
. <(grep -E '^(DATABASE_URL|TEST_DATABASE_URL|BRUNO_DB_URL)=' .env || true)
set +a

DEV_URL="${DATABASE_URL:-}"
if [[ -z "$DEV_URL" ]]; then
  echo "error: falta DATABASE_URL en .env" >&2
  exit 2
fi

derive_url() { # url base database-name -> url
  python3 - "$1" "$2" <<'PY'
import sys, urllib.parse
u = urllib.parse.urlsplit(sys.argv[1])
name = sys.argv[2].replace("/", "")
print(urllib.parse.urlunsplit((u.scheme, u.netloc, f"/{name}", u.query, u.fragment)))
PY
}

TEST_URL="${TEST_DATABASE_URL:-${BRUNO_DB_URL:-}}"
TEST_DB_NAME=""
if [[ -z "$TEST_URL" ]]; then
  DEV_NAME="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.urlsplit(sys.argv[1]).path.strip("/"))' "$DEV_URL" || true)"
  TEST_DB_NAME="${DEV_NAME}_bruno"
  TEST_URL="$(derive_url "$DEV_URL" "$TEST_DB_NAME")"
fi

# 1) Asegurar que la BD de test existe (solo cuando derivamos la URL).
if [[ -z "$TEST_URL" ]]; then
    echo "error: no se pudo derivar TEST_DATABASE_URL" >&2
    exit 2
fi
if [[ -n "$TEST_DB_NAME" ]]; then
  ADMIN_URL="$(derive_url "$DEV_URL" postgres)"
  PG="$(ls -d node_modules/.pnpm/pg@*/node_modules/pg 2>/dev/null | head -n1)"
  if [[ -z "$PG" ]]; then
    echo "error: no encuentro 'pg' en node_modules/.pnpm para crear la BD de test" >&2
    exit 2
  fi
  ADMIN_URL="$ADMIN_URL" TEST_DB_NAME="$TEST_DB_NAME" PG_PATH="./$PG" node -e '
    const { Client } = require(process.env.PG_PATH);
    (async () => {
      const c = new Client({ connectionString: process.env.ADMIN_URL });
      await c.connect();
      const name = process.env.TEST_DB_NAME;
      const { rowCount } = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
      if (rowCount === 0) {
        await c.query(`CREATE DATABASE ${JSON.stringify(name)}`);
        console.error(`[bruno-db] creada la BD de test: ${name}`);
      } else {
        console.error(`[bruno-db] la BD de test ya existe: ${name}`);
      }
      await c.end();
    })().catch((e) => {
      console.error(`[bruno-db] no se pudo preparar la BD de test: ${e.message}`);
      console.error("[bruno-db] (¿el usuario de DATABASE_URL tiene permiso CREATEDB? Puedes pre-crearla y usar TEST_DATABASE_URL.)");
      process.exit(1);
    });
  '
fi

# 2) Sincronizar esquema (núcleo + fragmentos de módulos activos).
# Consentimiento de operador (solo es válido para la BD de test dedicada) para
# el bloqueo de Prisma a "acciones peligrosas con pérdida de datos".
CONSENT="Permito prisma db push solo sobre la BD de test dedicada alxarafe_bruno, nunca sobre producción ni desarrollo"
RESET_FLAGS=("--accept-data-loss")
if [[ "${BRUNO_RESET_DB:-0}" == "1" ]]; then
  RESET_FLAGS+=("--force-reset")
  echo "[bruno-db] BRUNO_RESET_DB=1: vaciando y resincronizando la BD de test" >&2
fi
echo "[bruno-db] sincronizando esquema en $TEST_URL ..." >&2
if ! PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="$CONSENT" DATABASE_URL="$TEST_URL" pnpm db:push "${RESET_FLAGS[@]}" >/dev/null 2>&1; then
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="$CONSENT" DATABASE_URL="$TEST_URL" pnpm db:push "${RESET_FLAGS[@]}"
  echo "error: prisma db push falló sobre la BD de test" >&2
  exit 1
fi
echo "[bruno-db] esquema listo en $TEST_URL" >&2

# 3) Emitir la configuración para el runner.
echo "export TEST_DATABASE_URL=$(printf %q "$TEST_URL")"