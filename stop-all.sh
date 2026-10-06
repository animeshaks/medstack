#!/bin/bash
# ==============================================================================
# MedStack — Stop All Services Script
# ==============================================================================

echo "➜ Stopping MedStack Services..."

# Stop Backend
if lsof -i :8080 >/dev/null 2>&1; then
    PID_8080=$(lsof -ti :8080)
    kill -9 $PID_8080 2>/dev/null || true
    echo "  ✔ Stopped Backend service (port 8080)."
else
    echo "  - Backend is not running."
fi

# Stop Nginx if desired
read -p "Do you also want to stop Nginx (port 3000)? [y/N]: " STOP_NGINX
if [[ "$STOP_NGINX" =~ ^[Yy]$ ]]; then
    NGINX_BIN="/opt/homebrew/opt/nginx/bin/nginx"
    if [ ! -f "$NGINX_BIN" ]; then
        NGINX_BIN="nginx"
    fi
    "$NGINX_BIN" -s stop 2>/dev/null || true
    echo "  ✔ Stopped Nginx."
fi

echo "✔ Done."
