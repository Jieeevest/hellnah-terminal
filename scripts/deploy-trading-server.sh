#!/usr/bin/env bash
# Deploy dashboard (FE) + paper trading backend ke VPS via rsync + docker compose.
# Jalankan dari root repo: ./scripts/deploy-trading-server.sh
#
# Cuma nyentuh direktori sendiri di server (REMOTE_DIR) dan 2 container Docker sendiri
# ("hellnah-trading-fe" publik di port 8090, "hellnah-trading-server" internal-only,
# nggak ada port yang diekspos ke host) — nggak nyentuh nginx atau service lain yang
# udah jalan di server itu.
set -euo pipefail

SSH_HOST="${SSH_HOST:-ops@72.62.120.172}"
SSH_PORT="${SSH_PORT:-24313}"
REMOTE_DIR="${REMOTE_DIR:-/home/ops/hellnah-trading}"
PUBLIC_HOST="${PUBLIC_HOST:-72.62.120.172}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Sync kode ke $SSH_HOST:$REMOTE_DIR"
ssh -p "$SSH_PORT" "$SSH_HOST" "mkdir -p $REMOTE_DIR"

rsync -avz --delete \
  -e "ssh -p $SSH_PORT" \
  --exclude 'node_modules' \
  --exclude 'server/node_modules' \
  --exclude 'server/data' \
  --exclude 'server/logs' \
  --exclude 'server/dist' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'server/.env' \
  --exclude '.backtest-cache' \
  --exclude '.claude' \
  "$ROOT_DIR/" "$SSH_HOST:$REMOTE_DIR/"

echo "==> Setup server/.env di remote (cuma kalau belum ada — nggak nimpa config yang udah jalan)"
ssh -p "$SSH_PORT" "$SSH_HOST" bash -s <<REMOTE_SCRIPT
set -e
cd "$REMOTE_DIR"
if [ ! -f server/.env ]; then
  cat > server/.env <<EOF
TRADING_MODE=paper
CONTROL_API_TOKEN=
ALLOWED_ORIGIN=*
PORT=3010

STARTING_EQUITY=8000
SCAN_INTERVAL_MS=60000
TICK_INTERVAL_MS=15000
WATCHLIST_MODE=all
MAX_WATCHLIST_SIZE=60
WATCHLIST=BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT
EOF
  echo "server/.env dibuat baru (equity default \$8000)."
else
  echo "server/.env sudah ada, dibiarkan (config & equity lama tetap dipakai)."
fi
REMOTE_SCRIPT

echo "==> Build & jalankan container (FE + backend)"
ssh -p "$SSH_PORT" "$SSH_HOST" "cd $REMOTE_DIR && docker compose build && docker compose up -d"

echo "==> Verifikasi"
ssh -p "$SSH_PORT" "$SSH_HOST" "sleep 3 && curl -s http://localhost:8090/api-trading/api/state && echo"

echo ""
echo "==> Selesai! Buka dashboard-nya di browser:"
echo "    http://$PUBLIC_HOST:8090"
echo "    (masuk ke tab 'Auto' buat lihat status & aktifkan bot-nya)"
