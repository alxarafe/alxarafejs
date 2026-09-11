#!/usr/bin/env bash
# Ejecuta una colección Bruno de alxarafejs sin la app de escritorio.
#
# Uso:
#   ./scripts/bruno-api.sh [colección]       (por defecto núcleo: apps/api/bruno/alxarafe-api)
#   BASE_URL=... EMAIL=... PASSWORD=... ./scripts/bruno-api.sh
#
# Requiere: PostgreSQL y Redis en marcha, migraciones aplicadas y las
# credenciales EMAIL/PASSWORD del entorno local.bru correspondientes a un
# usuario existente.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:8090}"
HEALTH_URL="${BASE_URL}/health-check"
ENV_NAME="${BRUNO_ENV:-local}"
COLLECTION="${1:-}"
if [[ -z "$COLLECTION" ]]; then
  COLLECTION="$ROOT/apps/api/bruno/alxarafe-api"
fi
COLLECTION="$(cd "$(dirname "$COLLECTION")" && pwd)/$(basename "$COLLECTION")"

if ! [[ -d "$COLLECTION" ]]; then
  echo "error: no existe el directorio: $COLLECTION" >&2
  echo "uso: $0 [ruta-a-coleccion]" >&2
  exit 2
fi

echo "[bruno] colección: $COLLECTION"
echo "[bruno] base url:  $BASE_URL (entorno: $ENV_NAME)"

API_PID=""
cleanup() {
  if [[ -n "$API_PID" ]]; then
    pkill -P "$API_PID" 2>/dev/null || true
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "[bruno] API ya disponible en $BASE_URL (no se arranca ninguna)."
  echo "[bruno] ojo: usa límites de rate-limit amplios si quieres evitar 429"
  echo "[bruno] (COMMON_RATE_LIMIT_MAX_REQUESTS alto); o libra el puerto y deja que"
  echo "[bruno] este script arranque su propia API con límites amplios."
else
  echo "[bruno] API no disponible — arrancando en segundo plano..."
  HOST="$(python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.argv[1]); print(u.hostname or 'localhost')" "$BASE_URL")"
  PORT="$(python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.argv[1]); print(u.port or 80)" "$BASE_URL")"
  export HOST
  export PORT
  # Límites amplios para que las ráfagas de la colección no den 429.
  export COMMON_RATE_LIMIT_MAX_REQUESTS="${COMMON_RATE_LIMIT_MAX_REQUESTS:-5000}"
  export COMMON_RATE_LIMIT_WINDOW_MS="${COMMON_RATE_LIMIT_WINDOW_MS:-1000}"
  pnpm start:dev >/tmp/alxarafe-bruno-api.log 2>&1 &
  API_PID=$!
  ok=0
  for _ in $(seq 1 90); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      ok=1
      break
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if [[ "$ok" != "1" ]]; then
    echo "error: la API no arrancó en 90s (log: /tmp/alxarafe-bruno-api.log)" >&2
    exit 1
  fi
  echo "[bruno] API lista en $HEALTH_URL"
fi

# Credenciales: email fresco por ejecución (repetible, "sin pedir nada").
# Sobrescribibles con EMAIL/NEW_EMAIL/... si quieres credenciales fijas.
ENV_FILE="$COLLECTION/environments/$ENV_NAME.bru"
TS="$(date +%s)"
RUN_EMAIL="${EMAIL:-bruno-$TS@alxarafe.com}"
RUN_PASSWORD="${PASSWORD:-$(sed -n 's/^[[:space:]]*PASSWORD:[[:space:]]*\(..*\)$/\1/p' "$ENV_FILE" 2>/dev/null | head -n1)}"
RUN_NEW_EMAIL="${NEW_EMAIL:-bruno-new-$TS@alxarafe.com}"
RUN_NEW_PASSWORD="${NEW_PASSWORD:-$(sed -n 's/^[[:space:]]*NEW_PASSWORD:[[:space:]]*\(..*\)$/\1/p' "$ENV_FILE" 2>/dev/null | head -n1)}"
RUN_NAME="${NAME:-Bruno User $TS}"

bootstrap_user() {
  local email="$1" password="$2"
  local code
  code="$(curl -s -o /tmp/alxarafe-bruno-register.json -w '%{http_code}' -X POST \
    "$BASE_URL/auth/register" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$RUN_NAME\",\"email\":\"$email\",\"password\":\"$password\"}")"
  if [[ "$code" == 2* ]]; then
    echo "[bruno] usuario de pruebas creado: $email"
  else
    echo "[bruno] usuario de pruebas ya existe ($code): $email"
  fi
}

if [[ "${BRUNO_BOOTSTRAP_USER:-1}" == "1" && -n "$RUN_EMAIL" && -n "$RUN_PASSWORD" ]]; then
  bootstrap_user "$RUN_EMAIL" "$RUN_PASSWORD"
fi
# NOTA: NEW_EMAIL NO se pre-registra: la colección crea ese usuario vía
# 'Register' durante la ejecución.

# El CLI de Bruno requiere ejecutar desde la raíz de la colección (la que
# contiene collection.bru + bruno.json).
if [[ -f "$COLLECTION/collection.bru" ]]; then
  BRU_CWD="$COLLECTION"
  BRU_ARGS=(run --env "$ENV_NAME")
else
  # subcarpeta dentro de la colección: localizar la raíz y pasar la ruta relativa con -r
  BRU_CWD="$COLLECTION"
  if ! [[ -f "$BRU_CWD/collection.bru" ]]; then
    BRU_CWD="$(dirname "$BRU_CWD")"
    while [[ "$BRU_CWD" != "/" && ! -f "$BRU_CWD/collection.bru" ]]; do
      BRU_CWD="$(dirname "$BRU_CWD")"
    done
  fi
  if ! [[ -f "$BRU_CWD/collection.bru" ]]; then
    echo "error: no encuentro collection.bru ascendiendo desde $COLLECTION" >&2
    exit 2
  fi
  REL_SUBFOLDER="$(realpath --relative-to="$BRU_CWD" "$COLLECTION")"
  BRU_ARGS=(run -r --env "$ENV_NAME" "$REL_SUBFOLDER")
fi
BRU_ARGS+=(--env-var "BASE_URL=$BASE_URL"
  --env-var "EMAIL=$RUN_EMAIL"
  --env-var "PASSWORD=$RUN_PASSWORD"
  --env-var "NEW_EMAIL=$RUN_NEW_EMAIL"
  --env-var "NEW_PASSWORD=$RUN_NEW_PASSWORD"
  --env-var "NAME=$RUN_NAME")

echo "[bruno] ejecutando (en $BRU_CWD): ./node_modules/.bin/bru ${BRU_ARGS[*]}"
(cd "$BRU_CWD" && "$ROOT/node_modules/.bin/bru" "${BRU_ARGS[@]}")