#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/geotrack-fe

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "El repositorio del VPS debe estar en la rama main." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "El repositorio del VPS tiene cambios locales. Revisalos antes de desplegar." >&2
  exit 1
fi

git pull --ff-only origin main
docker compose up -d --build --wait
docker compose ps

puerto_frontend="$(docker compose port frontend 80)"
puerto_frontend="${puerto_frontend##*:}"
codigo_api="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${puerto_frontend}/api/autenticacion/actual")"
if [[ "$codigo_api" != "401" ]]; then
  echo "El proxy de /api devolvió HTTP ${codigo_api}; se esperaba 401 sin sesión." >&2
  exit 1
fi

printf 'Revisión desplegada: %s\n' "$(git rev-parse --short HEAD)"
