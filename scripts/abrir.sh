#!/bin/sh
# Abre la app local, la que tiene el botón «Convertir» para PDFs. La usa el ícono «Práctica Piano» del menú.
cd "$(dirname "$0")/.." || exit 1
URL=http://localhost:5173/
if ! curl -s -o /dev/null "$URL"; then
  git pull -q --ff-only || true # se actualiza sola al abrir
  [ package-lock.json -nt node_modules ] && npm install --silent
  nohup npm run dev -- --strictPort > vite-dev.log 2>&1 &
  for _ in $(seq 30); do curl -s -o /dev/null "$URL" && break; sleep 1; done
fi
xdg-open "$URL"
