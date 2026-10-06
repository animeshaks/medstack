#!/bin/bash
# Stop any existing medstack jar process
pkill -f "medstack-1.0.0-SNAPSHOT.jar" 2>/dev/null || true
sleep 1

# Launch in background with nohup
nohup /opt/homebrew/opt/openjdk@21/bin/java \
     -DSPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/medstack_db \
     -DSPRING_DATASOURCE_USERNAME=medstack_user \
     -DSPRING_DATASOURCE_PASSWORD=changeme_strong_password \
     -DJWT_SECRET=changeme-minimum-64-chars-for-hmac-sha512-please-replace-this-value \
     -jar backend/target/medstack-1.0.0-SNAPSHOT.jar > backend.log 2>&1 &

echo "Backend launched with PID $!"
