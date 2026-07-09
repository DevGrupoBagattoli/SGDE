#!/bin/sh
set -e

# Migrations automáticas (padrão: habilitado)
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "[entrypoint] Aplicando migrations pendentes..."
  node_modules/.bin/prisma migrate deploy
  echo "[entrypoint] Migrations concluídas."
else
  echo "[entrypoint] Migrations automáticas desabilitadas (RUN_MIGRATIONS=false)."
fi

# Repassa o comando (CMD do Dockerfile) para o next start
exec "$@"
