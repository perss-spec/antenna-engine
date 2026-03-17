#!/bin/bash
# PROMIN Antenna Studio — Start Script
# Запускает Axum solver server + Web server

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=== PROMIN Antenna Studio ==="

# Kill previous instances
pkill -f "promin-server" 2>/dev/null
pkill -f "serve.py" 2>/dev/null
sleep 1

# Build frontend if needed
if [ ! -f dist/index.html ] || [ "$(find src -newer dist/index.html -name '*.ts' -o -name '*.tsx' | head -1)" ]; then
    echo "Building frontend..."
    npm run build 2>&1 | tail -2
fi

# Start Axum solver server (optional, provides Rust-powered computation)
if [ -f target/release/promin-server ]; then
    echo "Starting Axum solver on :3001..."
    ./target/release/promin-server &
    sleep 1
else
    echo "No Axum server binary (run: cargo build --bin promin-server --no-default-features --features server --release)"
    echo "Frontend will use local JS solver (works fine for analytical models)"
fi

# Start web server
PORT=${1:-4173}
echo "Starting web server on :$PORT..."
python3 serve.py "$PORT" &

sleep 1
echo ""
echo "Ready!"
echo "  Local:   http://localhost:$PORT/antenna-engine/"
IP=$(hostname -I | awk '{print $1}')
echo "  Network: http://$IP:$PORT/antenna-engine/"
echo ""
echo "Press Ctrl+C to stop"
wait
