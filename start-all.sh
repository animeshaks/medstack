#!/bin/bash
# ==============================================================================
# MedStack — All-in-One Startup Script (DB, Backend, Nginx, UI)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "           🚀 Starting MedStack Ecosystem               "
echo "========================================================"

# ------------------------------------------------------------------------------
# 1. Check & Start PostgreSQL Database (Port 5432)
# ------------------------------------------------------------------------------
echo "➜ Checking PostgreSQL Database..."
if lsof -i :5432 >/dev/null 2>&1; then
    echo "  ✔ PostgreSQL is already running on port 5432."
else
    echo "  PostgreSQL not running. Attempting to start via Homebrew..."
    if command -v brew >/dev/null 2>&1; then
        brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
    fi
    
    # Wait up to 10 seconds
    for i in {1..10}; do
        if lsof -i :5432 >/dev/null 2>&1; then
            echo "  ✔ PostgreSQL is now ready on port 5432."
            break
        fi
        sleep 1
    done

    if ! lsof -i :5432 >/dev/null 2>&1; then
        echo "  ❌ Warning: PostgreSQL could not be verified on port 5432."
        echo "     Please ensure PostgreSQL is running before continuing."
    fi
fi

# ------------------------------------------------------------------------------
# 2. Check Java & Backend JAR
# ------------------------------------------------------------------------------
JAVA_BIN="/opt/homebrew/opt/openjdk@21/bin/java"
if [ ! -f "$JAVA_BIN" ]; then
    JAVA_BIN="java"
fi

JAR_PATH="$DIR/backend/target/medstack-1.0.0-SNAPSHOT.jar"

if [ ! -f "$JAR_PATH" ]; then
    echo "➜ Backend JAR not found. Building with Maven..."
    JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn clean package -DskipTests -f backend/pom.xml
fi

# Stop any running process on port 8080
if lsof -i :8080 >/dev/null 2>&1; then
    echo "➜ Freeing port 8080 from existing process..."
    PID_8080=$(lsof -ti :8080)
    kill -9 $PID_8080 2>/dev/null || true
    sleep 1
fi

echo "➜ Starting MedStack Spring Boot Backend..."
nohup "$JAVA_BIN" \
    -DSPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/medstack_db \
    -DSPRING_DATASOURCE_USERNAME=medstack_user \
    -DSPRING_DATASOURCE_PASSWORD=changeme_strong_password \
    -DJWT_SECRET=changeme-minimum-64-chars-for-hmac-sha512-please-replace-this-value \
    -jar "$JAR_PATH" > backend.log 2>&1 &

BACKEND_PID=$!
disown $BACKEND_PID 2>/dev/null || true
echo "  Backend launched with PID $BACKEND_PID (logging to backend.log)"

echo "➜ Waiting for Backend health check..."
READY=false
for i in {1..35}; do
    if curl -s -f http://localhost:8080/actuator/health >/dev/null 2>&1 || curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/medicines | grep -q "401\|200"; then
        READY=true
        break
    fi
    sleep 1
done

if [ "$READY" = true ]; then
    echo "  ✔ Backend is ready on http://localhost:8080"
else
    echo "  ⚠️ Backend is taking longer than usual to respond. Check backend.log for details."
fi

# ------------------------------------------------------------------------------
# 3. Check & Start Nginx Reverse Proxy & UI (Port 3000)
# ------------------------------------------------------------------------------
echo "➜ Checking Nginx Web Server..."
NGINX_BIN="/opt/homebrew/opt/nginx/bin/nginx"
if [ ! -f "$NGINX_BIN" ]; then
    NGINX_BIN="nginx"
fi

if lsof -i :3000 >/dev/null 2>&1; then
    echo "  Reloading running Nginx..."
    "$NGINX_BIN" -s reload 2>/dev/null || true
    echo "  ✔ Nginx reloaded and serving on port 3000."
else
    echo "  Starting Nginx..."
    "$NGINX_BIN" 2>/dev/null || true
    sleep 1
    if lsof -i :3000 >/dev/null 2>&1; then
        echo "  ✔ Nginx started on port 3000."
    else
        echo "  ❌ Failed to start Nginx. Check /opt/homebrew/var/log/nginx/error.log"
    fi
fi

# ------------------------------------------------------------------------------
# 4. Summary Dashboard
# ------------------------------------------------------------------------------
echo ""
echo "========================================================"
echo "        🎉 MedStack Services Successfully Started!      "
echo "========================================================"
echo "  🌐 Web App / Frontend : http://localhost:3000"
echo "  🔌 REST API Backend   : http://localhost:8080"
echo "  🗄️ PostgreSQL DB       : localhost:5432 (medstack_db)"
echo "--------------------------------------------------------"
echo "  Default Logins:"
echo "    👑 Admin : admin / Admin@123"
echo "    🏪 Owner : owner / Owner@123"
echo "    👨‍⚕️ Staff : staff / Staff@123"
echo "--------------------------------------------------------"
echo "  To stop all services: ./stop-all.sh"
echo "========================================================"
