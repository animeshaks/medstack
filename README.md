# MedStack — Pharmacy POS & Management System

MedStack is a production-grade Pharmacy Point of Sale (POS), Inventory, Billing, and Store Management system built with a layered monolith architecture on Spring Boot 3 and modern vanilla ES6+ web modules.

---

## 1. Architecture Overview
- **Backend**: Java 21, Spring Boot 3.3.4, Spring Data JPA, Spring Security, Flyway migrations, JWT (HMAC-SHA512).
- **Database**: PostgreSQL 16 (`medstack_db`) with pessimistic locking for concurrency-safe FIFO inventory dispensing.
- **Frontend**: Lightweight SPA using Vanilla HTML5, CSS3 variables (Light/Dark themes), and ES6+ modules (no React/Vue/Angular).
- **Gateway / Proxy**: Nginx reverse proxy serving the frontend SPA and proxying `/api/*` to the Spring Boot backend.

---

## 2. Default Seed Credentials

The database is automatically seeded via Flyway with three roles:

| Role | Username | Password | Access Scope |
|---|---|---|---|
| **ADMIN** | `admin` | `Admin@123` | Full administrative control, user management, audit logs |
| **OWNER** | `owner` | `Owner@123` | Store management, margins, inventory, purchases, expenses |
| **STAFF** | `staff` | `Staff@123` | POS billing, stock lookup, customers |

---

## 3. How to Start the Application

### Option A: Local Native Services (Homebrew + Java) — *Recommended for Local Dev*

> **Apple Silicon (M1/M2/M3) Mac**: You must use the ARM-native Java 21 installed via `/opt/homebrew`. The Intel (`/usr/local`) Java binaries will fail with `Bad CPU type in executable`. Install once with:
> ```bash
> /opt/homebrew/bin/brew install openjdk@21
> /opt/homebrew/bin/brew install maven
> ```

Follow this exact sequence of commands to start the application on your machine:

#### Step 1: Start PostgreSQL
```bash
brew services start postgresql@16
```
*(PostgreSQL runs on port `5432` with database `medstack_db` and user `medstack_user`)*

#### Step 2: Start Nginx Web Gateway
```bash
brew services start nginx
```
*(Nginx runs on port `3000`, serves the frontend SPA, and proxies `/api/*` to `http://localhost:8080`)*

#### Step 3: Start the Spring Boot Backend

From the project root directory, run using the ARM-native Java 21:

```bash
/opt/homebrew/opt/openjdk@21/bin/java \
     -DSPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/medstack_db \
     -DSPRING_DATASOURCE_USERNAME=medstack_user \
     -DSPRING_DATASOURCE_PASSWORD=changeme_strong_password \
     -DJWT_SECRET=changeme-minimum-64-chars-for-hmac-sha512-please-replace-this-value \
     -jar backend/target/medstack-1.0.0-SNAPSHOT.jar
```

*Alternatively, build and run with Maven (ARM-native):*
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21 /opt/homebrew/bin/mvn spring-boot:run \
     -Dspring-boot.run.jvmArguments="\
     -DSPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/medstack_db \
     -DSPRING_DATASOURCE_USERNAME=medstack_user \
     -DSPRING_DATASOURCE_PASSWORD=changeme_strong_password \
     -DJWT_SECRET=changeme-minimum-64-chars-for-hmac-sha512-please-replace-this-value"
```

*To rebuild the jar before starting (after code changes):*
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21 /opt/homebrew/bin/mvn clean package -DskipTests
```

#### Step 4: Access the Application
- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **Interactive Swagger UI**: [http://localhost:3000/api/v1/swagger-ui/index.html](http://localhost:3000/api/v1/swagger-ui/index.html)
- **Actuator Health Check**: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)
- **OpenAPI Specification**: [http://localhost:3000/api/v1/api-docs](http://localhost:3000/api/v1/api-docs)

---

### Option B: Docker Compose (All-in-One Containerized)

If Docker Desktop is installed and running:

```bash
# 1. Ensure .env file exists
cp -n .env.example .env

# 2. Build and launch containers in background
docker compose -f docker/docker-compose.yml up --build -d
```

- **Web UI**: [http://localhost](http://localhost)
- **API**: [http://localhost:8080](http://localhost:8080)
- **Swagger UI**: [http://localhost/api/v1/swagger-ui/index.html](http://localhost/api/v1/swagger-ui/index.html)

---

## 4. How to Stop the Application

### Stopping Local Native Services:
```bash
# 1. Stop the backend process
kill $(pgrep -f "medstack-1.0.0-SNAPSHOT.jar") 2>/dev/null || pkill -f "spring-boot"

# 2. Stop Nginx gateway
brew services stop nginx

# 3. Stop PostgreSQL service
brew services stop postgresql@16
```

### Stopping Docker Compose:
```bash
docker compose -f docker/docker-compose.yml down
```

---

## 5. Running Automated Tests

To run the complete test suite (17 tests covering unit & integration tests):

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21 /opt/homebrew/bin/mvn test
```

---

## 6. Keyboard Shortcuts on POS Terminal (`#/pos`)
- **`F2`** or **`/`**: Focus medicine search
- **`Arrow Up` / `Arrow Down`**: Navigate search results
- **`Enter`**: Select medicine and focus quantity
- **`F9`**: Finalize bill & display receipt / WhatsApp invoice link
