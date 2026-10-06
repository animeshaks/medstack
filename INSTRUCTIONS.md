# MedStack Developer Instructions

## 1. Quick Start (Local Native Setup)

### Step 1: Start Database
```bash
brew services start postgresql@16
```

### Step 2: Start Nginx Gateway
```bash
brew services start nginx
```

### Step 3: Start Backend API
```bash
java -DSPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/medstack_db \
     -DSPRING_DATASOURCE_USERNAME=medstack_user \
     -DSPRING_DATASOURCE_PASSWORD=changeme_strong_password \
     -DJWT_SECRET=changeme-minimum-64-chars-for-hmac-sha512-please-replace-this-value \
     -jar backend/target/medstack-1.0.0-SNAPSHOT.jar
```
*(Or `cd backend && mvn spring-boot:run`)*

### Step 4: Open Application
- Web UI: **http://localhost:3000**
- Swagger UI: **http://localhost:3000/api/v1/swagger-ui/index.html**

---

## 2. Default Seed Credentials
| Username | Password | Role | Scope |
|---|---|---|---|
| `admin` | `Admin@123` | `ADMIN` | Global administrator |
| `owner` | `Owner@123` | `OWNER` | Store & inventory management |
| `staff` | `Staff@123` | `STAFF` | POS billing |

---

## 3. Stopping the Application
```bash
kill $(pgrep -f "medstack-1.0.0-SNAPSHOT.jar") 2>/dev/null || pkill -f "spring-boot"
brew services stop nginx
brew services stop postgresql@16
```

---

## 4. Docker Compose Alternative
```bash
cp -n .env.example .env
docker compose -f docker/docker-compose.yml up --build -d
```
Stop with: `docker compose -f docker/docker-compose.yml down`

---

## 5. Running Tests
```bash
cd backend
mvn test
```
