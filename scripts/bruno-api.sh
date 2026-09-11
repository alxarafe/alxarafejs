#!/usr/bin/env bash
# Ejecuta colecciones Bruno de alxarafejs sin la app de escritorio.
#
# Uso:
#   ./scripts/bruno-api.sh [colección]
#     - con argumento: ejecuta solo esa colección.
#     - sin argumento: ejecuta TODAS las colecciones descubiertas:
#         · núcleo: apps/api/bruno/* (carpetas con bruno.json/collection.bru)
#         · módulos activos según config/modules.json (modules/<módulo>/bruno/*)
#   BASE_URL=... EMAIL=... PASSWORD=... ./scripts/bruno-api.sh
#
# Requiere: PostgreSQL y Redis en marcha, migraciones aplicadas y las
# credenciales EMAIL/PASSWORD del entorno local.bru correspondientes a un
# usuario existente.
#
# Código de salida: 0 solo si TODAS las colecciones terminan OK; 1 si alguna
# falla; 2 si no hay colecciones que ejecutar o la ruta no existe.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:8090}"
HEALTH_URL="${BASE_URL}/health-check"
ENV_NAME="${BRUNO_ENV:-local}"

is_collection() { # dir con bruno.json o collection.bru
  [[ -f "$1/bruno.json" || -f "$1/collection.bru" ]]
}

COLLECTIONS=()
discover() { # base-dir: añade cada subcarpeta colección a COLLECTIONS
  local base="$1" d
  for d in "$base"/*/; do
    if is_collection "$d"; then
      COLLECTIONS+=("$(cd "$d" && pwd)")
    fi
  done
}

if (( $# > 0 )); then
  COLLECTIONS=("$(cd "$(dirname "$1")" && pwd)/$(basename "$1")")
else
  discover "$ROOT/apps/api/bruno"
  if [[ -r "$ROOT/config/modules.json" ]]; then
    mods="$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1])).get("enabled", [])))' "$ROOT/config/modules.json" 2>/dev/null || true)"
    if [[ -n "$mods" ]]; then
      while IFS= read -r name; do
        [[ -n "$name" ]] || continue
        discover "$ROOT/modules/$name/bruno"
      done <<< "$mods"
    fi
  fi
fi

if (( ${#COLLECTIONS[@]} == 0 )); then
  echo "error: no se encontró ninguna colección Bruno (bruno.json/collection.bru)" >&2
  echo "uso: $0 [ruta-a-coleccion]" >&2
  exit 2
fi

for c in "${COLLECTIONS[@]}"; do
  if ! is_collection "$c"; then
    echo "error: no existe la colección: $c" >&2
    echo "uso: $0 [ruta-a-coleccion]" >&2
    exit 2
  fi
done

echo "[bruno] colecciones: ${#COLLECTIONS[@]}"
for c in "${COLLECTIONS[@]}"; do
  echo "  - $c"
done
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
TS="$(date +%s)"
RUN_EMAIL="${EMAIL:-bruno-$TS@alxarafe.com}"
ENV_FILE="${COLLECTIONS[0]}/environments/$ENV_NAME.bru"
RUN_PASSWORD="${PASSWORD:-$(sed -n 's/^[[:space:]]*PASSWORD:[[:space:]]*\(..*\)$/\1/p' "$ENV_FILE" 2>/dev/null | head -n1)}"
RUN_NEW_EMAIL="${NEW_EMAIL:-bruno-new-$TS@alxarafe.com}"
RUN_NEW_PASSWORD="${NEW_PASSWORD:-$(sed -n 's/^[[:space:]]*NEW_PASSWORD:[[:space:]]*\(..*\)$/\1/p' "$ENV_FILE" 2>/dev/null | head -n1)}"
RUN_RESET_PASSWORD="${RESET_PASSWORD:-$(sed -n 's/^[[:space:]]*RESET_PASSWORD:[[:space:]]*\(..*\)$/\1/p' "$ENV_FILE" 2>/dev/null | head -n1)}"
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

run_collection() { # col: ejecuta una colección y devuelve su código de salida
  local col="$1" bru_cwd rel
  # El CLI de Bruno requiere ejecutar desde la raíz de la colección (la que
  # contiene collection.bru + bruno.json).
  if [[ -f "$col/collection.bru" ]]; then
    bru_cwd="$col"
  else
    # subcarpeta dentro de la colección: localizar la raíz y pasar la ruta relativa con -r
    bru_cwd="$col"
    while [[ "$bru_cwd" != "/" && ! -f "$bru_cwd/collection.bru" ]]; do
      bru_cwd="$(dirname "$bru_cwd")"
    done
    if ! [[ -f "$bru_cwd/collection.bru" ]]; then
      echo "error: no encuentro collection.bru ascendiendo desde $col" >&2
      return 2
    fi
  fi
  local -a bru_args=(run --env "$ENV_NAME")
  if [[ "$bru_cwd" != "$col" ]]; then
    rel="$(realpath --relative-to="$bru_cwd" "$col")"
    bru_args=(run -r --env "$ENV_NAME" "$rel")
  fi
  bru_args+=(--env-var "BASE_URL=$BASE_URL"
    --env-var "EMAIL=$RUN_EMAIL"
    --env-var "PASSWORD=$RUN_PASSWORD"
    --env-var "NEW_EMAIL=$RUN_NEW_EMAIL"
    --env-var "NEW_PASSWORD=$RUN_NEW_PASSWORD"
    --env-var "RESET_PASSWORD=$RUN_RESET_PASSWORD"
    --env-var "NAME=$RUN_NAME")

  echo "[bruno] ==== colección: $col ===="
  echo "[bruno] ejecutando (en $bru_cwd): ./node_modules/.bin/bru ${bru_args[*]}"
  (cd "$bru_cwd" && "$ROOT/node_modules/.bin/bru" "${bru_args[@]}")
}

pass=0
fail=0
for c in "${COLLECTIONS[@]}"; do
  if run_collection "$c"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
  fi
done

echo
echo "[bruno] RESUMEN: ${pass} colección(es) OK, ${fail} con errores"
if (( fail > 0 )); then
  exit 1
fi