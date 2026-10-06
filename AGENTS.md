# MedStack — Autonomous Agent Build Instructions

## 0. Mission

Build **MedStack**, a production-oriented, lightweight Pharmacy POS, Inventory, Billing, and Store Management system.

The implementation must be:

- Modular and maintainable.
- A **Layered Monolith** on the backend.
- REST-first and frontend/backend decoupled.
- Fast enough for a retail pharmacy POS workflow.
- Secure with JWT + RBAC.
- Transactionally correct for inventory and billing.
- Containerized with Docker Compose for local deployment.
- Designed so the backend can later move to **Google Cloud Run** with minimal changes.
- Free of unnecessary frameworks and infrastructure.
- Easy for another engineer to understand and extend.

**Important:** Do not over-engineer the first version. Prefer a clean modular monolith over premature microservices.

---

# 1. Non-Negotiable Technology Stack

## Backend

- Java 21+
- Spring Boot 3.x
- Spring Web
- Spring Data JPA
- Spring Security
- Jakarta Validation
- PostgreSQL 16
- Flyway database migrations
- JWT using HMAC-SHA512
- SLF4J + Logback
- OpenAPI/Swagger
- Maven

## Frontend

- HTML5
- CSS3
- Vanilla JavaScript ES6+ modules
- No React
- No Angular
- No Vue
- No frontend bundler
- Chart.js is allowed only for dashboard charts.
- QR-code generation may use a small focused library or a backend-generated QR representation; do not introduce a large UI framework.

## Infrastructure

- Docker
- Docker Compose
- Nginx
- PostgreSQL
- Application configuration through environment variables.

---

# 2. Repository Structure

Create exactly this high-level structure:

```text
/medstack-root
│
├── backend/
│   ├── pom.xml
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/pharma/medstack/
│   │   │   │   ├── MedStackApplication.java
│   │   │   │   │
│   │   │   │   ├── config/
│   │   │   │   │   ├── SecurityConfig.java
│   │   │   │   │   ├── OpenApiConfig.java
│   │   │   │   │   └── JpaAuditingConfig.java
│   │   │   │   │
│   │   │   │   ├── security/
│   │   │   │   │   ├── JwtAuthenticationFilter.java
│   │   │   │   │   ├── JwtTokenService.java
│   │   │   │   │   ├── CustomUserDetailsService.java
│   │   │   │   │   ├── AuthType.java
│   │   │   │   │   ├── AuthHandler.java
│   │   │   │   │   ├── AuthHandlerFactory.java
│   │   │   │   │   └── UsernamePasswordAuthHandler.java
│   │   │   │   │
│   │   │   │   ├── controller/
│   │   │   │   ├── service/
│   │   │   │   ├── repository/
│   │   │   │   ├── entity/
│   │   │   │   ├── model/
│   │   │   │   │   ├── request/
│   │   │   │   │   └── response/
│   │   │   │   ├── exception/
│   │   │   │   └── util/
│   │   │   │
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       └── db/migration/
│   │   │           ├── V1__initial_schema.sql
│   │   │           └── ...
│   │   │
│   │   └── test/
│   │       └── java/com/pharma/medstack/
│   │
│   └── Dockerfile              # Optional convenience copy if needed
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── css/
│   │   ├── variables.css
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── state.js
│   │   ├── router.js
│   │   ├── permissions.js
│   │   ├── utils.js
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── assets/
│
├── docker/
│   ├── docker-compose.yml
│   ├── backend.Dockerfile
│   └── nginx.conf
│
├── .env.example
├── .gitignore
├── README.md
└── INSTRUCTIONS.md
```

Do not mix frontend code into the Spring Boot resources directory.

---

# 3. Architecture Principles

## 3.1 Layered Monolith

Use:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

Controllers must never contain business logic.

Repositories must never contain business workflows.

Services own business rules and transaction boundaries.

Entities represent persistence state.

DTOs must be used for API contracts.

Do not expose JPA entities directly from REST endpoints.

---

# 4. Backend Package Design

Base package:

```text
com.pharma.medstack
```

## config/

Contains application configuration only.

Examples:

- Security configuration
- OpenAPI configuration
- JPA auditing configuration
- ObjectMapper configuration
- CORS configuration if ever required

Nginx should handle browser-to-API same-origin routing in normal deployment.

## security/

Implement authentication independently from business services.

Required components:

```text
AuthType
AuthHandler
UsernamePasswordAuthHandler
AuthHandlerFactory
JwtTokenService
JwtAuthenticationFilter
CustomUserDetailsService
```

### AuthType

```java
PASSWORD,
OTP,
EMAIL
```

Only `PASSWORD` is required for v1.

### AuthHandler

Create an interface similar to:

```java
public interface AuthHandler {
    AuthType supports();
    AuthenticationResult authenticate(AuthRequest request);
}
```

The controller must not contain:

```java
if (authType == PASSWORD) ...
else if (authType == OTP) ...
```

Instead, resolve the appropriate handler through a factory/registry.

Adding OTP later should require adding a new handler rather than rewriting `AuthController`.

---

# 5. Database Design

Use PostgreSQL 16.

Use **Flyway migrations**.

Do NOT rely on:

```text
spring.jpa.hibernate.ddl-auto=update
```

for production schema management.

Local development may use `validate`, but Flyway owns schema creation and evolution.

Recommended:

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

## 5.1 Common Audit Fields

Every business table must contain:

```text
created_at
updated_at
created_by
updated_by
is_deleted
```

Use a reusable mapped superclass:

```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditableEntity {
    ...
}
```

Do not duplicate auditing code across entities.

---

# 6. Domain Model

Implement the following entities.

## User

```text
id
username
password_hash
full_name
email
phone
role
status
created_at
updated_at
created_by
updated_by
is_deleted
```

Roles:

```text
ADMIN
OWNER
STAFF
```

Statuses should be an enum such as:

```text
ACTIVE
INACTIVE
```

Passwords must never be stored in plaintext.

Use BCrypt/DelegatingPasswordEncoder for password hashing.

JWT access tokens must be signed using HMAC-SHA512.

JWT secret must come from environment configuration.

Never hard-code the JWT secret.

---

## Doctor

```text
id
name
specialization
phone
email
clinic_hospital_name
registration_number
audit fields
```

Registration number should have an appropriate uniqueness constraint if business requirements require it.

---

## Customer

```text
id
name
phone
email
preferred_doctor_id
address
reward_points
audit fields
```

`phone` must be unique among non-deleted customers.

---

## Supplier

```text
id
name
contact_person
phone
email
gstin
dl_number
address
audit fields
```

---

## Item / Medicine

Use entity name `Medicine` or `Item`; choose one consistently throughout the codebase.

Recommended:

```text
Medicine
```

Fields:

```text
id
name
generic_name
category
manufacturer
hsn_code
rack_location
requires_prescription
min_stock_alert_level
audit fields
```

Do not store batch-specific values such as expiry, MRP, cost price, or quantity on the Medicine table.

Those belong to InventoryBatch.

---

## InventoryBatch

```text
id
item_id
batch_number
expiry_date
mrp
cost_price
selling_price
quantity
is_retired
audit fields
```

Business constraints:

- Quantity cannot become negative.
- Retired batches cannot be sold.
- Expired batches cannot be sold.
- Selling price must not exceed MRP unless an explicit future business rule permits it.
- Batch numbers must be handled consistently per medicine.

Recommended indexes:

```text
(item_id)
(expiry_date)
(item_id, expiry_date)
(is_retired)
```

---

## PurchaseOrder

```text
id
supplier_id
invoice_number
invoice_date
total_amount
tax_amount
status
audit fields
```

Status:

```text
PENDING
RECEIVED
```

---

## PurchaseOrderItem

```text
id
purchase_order_id
item_id
batch_number
expiry_date
quantity
cost_price
tax_percent
mrp
audit fields
```

---

## Order / Bill

Avoid naming the Java entity simply `Order` if it creates ambiguity with framework concepts.

Recommended entity:

```text
SalesOrder
```

Database table:

```text
sales_orders
```

Fields:

```text
id
bill_number
customer_id
user_id
prescribing_doctor_id
total_amount
discount_amount
tax_amount
grand_total
payment_status
order_status
audit fields
```

---

## OrderItem

Recommended Java entity:

```text
SalesOrderItem
```

Fields:

```text
id
order_id
inventory_batch_id
quantity
unit_price
tax_rate
subtotal
audit fields
```

---

## Payment

```text
id
order_id
payment_method
transaction_ref
amount
payment_time
audit fields
```

Payment methods:

```text
CASH
UPI
CARD
NETBANKING
```

Do not store sensitive card information.

---

## Expense

```text
id
category
amount
description
expense_date
logged_by
audit fields
```

---

# 7. Important Database Constraints

Add appropriate:

- Primary keys
- Foreign keys
- Unique constraints
- Check constraints where practical
- Indexes for search-heavy fields
- Indexes for foreign keys
- Indexes for expiry and inventory lookup
- Unique bill number constraint
- Unique customer phone constraint
- Appropriate decimal precision for monetary values

For monetary fields use:

```text
NUMERIC / BigDecimal
```

Never use floating-point `double` for money.

---

# 8. API Response Contract

Every REST response must use:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": {},
  "error": null,
  "timestamp": "2026-10-01T12:00:00Z"
}
```

Create:

```java
ApiResponse<T>
```

and use it consistently.

For errors:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {}
  },
  "timestamp": "..."
}
```

Implement a global:

```text
@RestControllerAdvice
```

for:

- Validation errors
- Resource not found
- Business rule violations
- Authentication errors
- Authorization errors
- Duplicate resource errors
- Generic unexpected errors

Do not leak stack traces or internal database details to clients.

---

# 9. REST API Design

Use versioned APIs:

```text
/api/v1/auth
/api/v1/users
/api/v1/medicines
/api/v1/inventory
/api/v1/customers
/api/v1/doctors
/api/v1/suppliers
/api/v1/purchases
/api/v1/bills
/api/v1/payments
/api/v1/expenses
/api/v1/reports
```

Examples:

```text
POST   /api/v1/auth/login
GET    /api/v1/medicines
POST   /api/v1/medicines
GET    /api/v1/medicines/{id}
PUT    /api/v1/medicines/{id}
DELETE /api/v1/medicines/{id}
```

Use pagination for large collections.

Example:

```text
GET /api/v1/medicines?page=0&size=20&sort=name,asc&search=paracetamol
```

Never load an unbounded database collection into memory.

---

# 10. RBAC

## ADMIN

Global access.

Can:

- Manage users
- Manage all master data
- View reports
- View financial data
- Perform operational actions

## OWNER

Can:

- Manage users
- Manage inventory
- Manage suppliers
- Manage purchases
- Manage customers
- Manage doctors
- Create/edit bills according to business rules
- View financial reports
- View margins
- Manage expenses

## STAFF

Can:

- POS billing
- Search inventory
- View stock
- Register customers
- View relevant doctors
- Process payments

Cannot:

- Create users
- Manage users
- View profit margins
- View sensitive financial reports
- Edit finalized historical bills
- Perform owner-level administration

Enforce authorization at the backend.

Frontend hiding is only a UX measure and must never be treated as security.

Use Spring Security method-level authorization where appropriate.

---

# 11. Inventory Business Logic

This is one of the most critical parts of the application.

## 11.1 Purchase Receiving

When a PurchaseOrder changes to:

```text
RECEIVED
```

the system must atomically:

1. Validate purchase order.
2. Prevent duplicate receiving.
3. Process each PurchaseOrderItem.
4. Find the corresponding inventory batch.
5. Create the batch if it does not exist.
6. Otherwise increment quantity.
7. Persist all changes.
8. Mark purchase order as RECEIVED.
9. Commit everything as one transaction.

Use:

```java
@Transactional
```

at the service layer.

If any item fails, the complete purchase receiving operation must roll back.

---

# 12. FIFO / Expiry-First Selling

When dispensing a medicine:

1. Find eligible batches for the medicine.
2. Exclude retired batches.
3. Exclude expired batches.
4. Sort by earliest expiry date.
5. Consume stock from the earliest-expiring batch first.
6. If that batch does not have enough stock, continue to the next batch.
7. Never allow stock to become negative.
8. Record exactly which batches were consumed in SalesOrderItem records.

Recommended query ordering:

```text
ORDER BY expiry_date ASC, id ASC
```

Use database locking or another concurrency-safe mechanism so two simultaneous bills cannot oversell the same inventory.

---

# 13. Expiry Management

Provide:

```text
GET /api/v1/inventory/expiry/near
GET /api/v1/inventory/expiry/expired
POST /api/v1/inventory/expiry/retire
```

The near-expiry endpoint should accept a configurable number of days.

Example:

```text
GET /api/v1/inventory/expiry/near?days=90
```

Bulk retirement must:

- Validate all selected batches.
- Mark them retired.
- Record an audit/business event.
- Never delete inventory history.

---

# 14. Bill Creation

Bill creation must be transactional.

Workflow:

```text
Receive cart
    ↓
Validate medicines
    ↓
Validate prescription requirements
    ↓
Resolve FIFO batches
    ↓
Reserve/decrement inventory
    ↓
Calculate subtotal
    ↓
Calculate tax
    ↓
Apply discount
    ↓
Calculate grand total
    ↓
Create SalesOrder
    ↓
Create SalesOrderItems
    ↓
Create Payment
    ↓
Commit transaction
```

Do not trust totals sent by the frontend.

The backend must recalculate:

- Unit price
- Subtotal
- Tax
- Discount
- Grand total

The frontend is only a presentation/input layer.

---

# 15. Prescription Rule

If:

```text
requires_prescription = true
```

the billing workflow must require appropriate prescribing doctor information according to the configured business rule.

Do not silently bypass this validation.

Keep this rule in the service layer.

---

# 16. Bill Editing

Editing a finalized bill is sensitive.

Required workflow:

```text
Existing Bill
    ↓
Load original items
    ↓
Reverse original inventory deductions
    ↓
Validate new cart
    ↓
Recalculate FIFO allocation
    ↓
Apply new inventory deductions
    ↓
Recalculate totals
    ↓
Update bill
    ↓
Update payment information if required
    ↓
Write audit/business event
```

The entire operation must be transactional.

Do not physically delete the original bill.

Maintain an audit trail for changes.

For production-quality implementation, create a bill audit/history model such as:

```text
BillAuditLog
- id
- sales_order_id
- action
- old_snapshot
- new_snapshot
- changed_by
- changed_at
```

Store snapshots as JSONB if appropriate.

---

# 17. Logging

Use SLF4J + Logback.

Business events should be structured and searchable.

Examples:

```text
BILL_CREATED
BILL_UPDATED
PAYMENT_RECEIVED
INVENTORY_RECEIVED
INVENTORY_DEDUCTED
BATCH_RETIRED
PURCHASE_RECEIVED
LOGIN_SUCCESS
LOGIN_FAILURE
```

Never log:

- Passwords
- JWT tokens
- Card details
- Sensitive credentials

Use appropriate log levels:

```text
INFO  business events
WARN  suspicious/invalid business operations
ERROR unexpected failures
DEBUG diagnostic information
```

---

# 18. Frontend Architecture

No frontend framework.

Use:

```html
<script type="module" src="/js/app.js"></script>
```

Modules should have clear responsibilities.

Recommended:

```text
api.js
    HTTP wrapper

auth.js
    login/logout/token/session

state.js
    cart/session/UI state

permissions.js
    role checks

router.js
    lightweight SPA-style routing

services/
    backend domain calls

components/
    reusable UI components

pages/
    screen-level UI
```

Avoid putting the entire frontend into one JavaScript file.

---

# 19. Frontend State

Implement a lightweight state manager.

Minimum state:

```text
currentUser
jwt
role
cart
selectedCustomer
selectedDoctor
theme
```

Cart item:

```text
medicineId
medicineName
quantity
unitPrice
taxRate
```

Do not trust client-side cart totals.

The backend is authoritative.

---

# 20. Authentication Storage

For v1, store the access token in memory where practical.

If persistent browser storage is used, document the security trade-off.

Never put passwords in localStorage.

Implement:

```text
login
logout
session restore if applicable
401 handling
automatic redirect to login
```

The frontend must not attempt to decode JWT claims as a replacement for backend authorization.

---

# 21. POS Keyboard Workflow

The POS must be optimized for keyboard use.

Required behavior:

```text
F2 or /
    → focus medicine search

Type >= 3 characters
    → debounced search

Arrow Up/Down
    → navigate results

Enter
    → select medicine

Quantity input
    → automatically focus

F9
    → finalize bill
```

Avoid excessive modal dialogs.

The primary POS workflow should require minimal mouse usage.

---

# 22. Medicine Search

Search only after at least 3 characters.

Use debounce on the frontend.

Example:

```text
300ms debounce
```

Backend search should use indexed fields.

Search can consider:

```text
name
generic_name
manufacturer
batch_number
```

Do not implement a fake Elasticsearch-like system.

Use PostgreSQL indexes and efficient queries for v1.

---

# 23. Billing UI

The billing screen should contain:

```text
Medicine Search
    ↓
Search Results
    ↓
Cart
    ↓
Customer
    ↓
Doctor / Prescription
    ↓
Discount
    ↓
Tax
    ↓
Grand Total
    ↓
Payment Method
    ↓
Finalize
```

Support:

- CASH
- UPI
- CARD
- NETBANKING

After finalization:

- Show bill summary.
- Offer print.
- Offer WhatsApp invoice message.
- Show dynamic UPI QR when applicable.
- Allow selection of bill/receipt size.

---

# 24. WhatsApp Invoice

Generate a WhatsApp message URL containing a concise invoice summary.

Do not send WhatsApp messages directly from the backend in v1.

Example message content:

```text
Invoice: MS-000123
Total: ₹850.00
Thank you for your purchase.
```

Do not expose internal database identifiers.

---

# 25. UPI QR

Generate a UPI payment QR dynamically from:

```text
merchant VPA
amount
bill reference
```

The UPI configuration must come from environment/configuration.

Do not hard-code credentials or merchant identifiers.

---

# 26. Dashboards

Create role-aware dashboard pages.

KPIs:

```text
Today's Sales
Today's Bills
Low Stock Items
Near Expiry Items
Expired Batches
Outstanding/Pending Items if applicable
```

OWNER/ADMIN may see financial information.

STAFF must not see margins or restricted financial KPIs.

Charts:

- Daily sales
- Weekly sales
- Monthly/yearly trends

Chart.js is acceptable for these visualizations.

Do not build a large frontend analytics framework.

---

# 27. Management Screens

Implement dedicated screens for:

```text
Users
Medicines
Inventory
Customers
Suppliers
Doctors
Purchases
Bills
Expenses
Reports
```

Every data table should support, where applicable:

- Search
- Sort
- Pagination
- Server-side filtering
- CSV export
- Responsive horizontal scrolling

For large datasets, prefer server-side pagination and filtering.

---

# 28. CSV Import

Provide CSV upload for:

```text
Medicines
Suppliers
Inventory
```

The backend must validate uploaded data.

Do not trust CSV content.

Return row-level validation errors.

Example:

```json
{
  "row": 17,
  "field": "expiryDate",
  "message": "Invalid date"
}
```

Large imports should be processed transactionally in sensible batches rather than loading unlimited data into memory.

---

# 29. Responsive UI

Use CSS variables:

```css
:root {
    --bg: ...;
    --surface: ...;
    --text: ...;
    --primary: ...;
    --danger: ...;
}
```

Implement:

```text
Light mode
Dark mode
```

At widths below approximately 768px:

- Tables should horizontally scroll.
- Forms should stack.
- Dashboard cards should wrap.
- POS controls should remain usable.

---

# 30. Nginx

Nginx serves frontend static files.

It proxies:

```text
/api/*
```

to the backend.

Recommended configuration:

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:8080/api/;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Because frontend and API share the same origin through Nginx, avoid unnecessary CORS configuration.

If CORS is enabled for local development, restrict allowed origins explicitly.

---

# 31. Docker Backend

Use a multi-stage build.

`docker/backend.Dockerfile`:

```dockerfile
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline

COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

COPY --from=builder /app/target/*.jar app.jar

ENV JAVA_OPTS="-Xms128m -Xmx384m -XX:+UseG1GC"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

The runtime image must run as a non-root user.

---

# 32. Docker Compose

Use PostgreSQL + API + Nginx.

Example:

```yaml
services:

  db:
    image: postgres:16-alpine
    container_name: medstack-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-medstack_db}
      POSTGRES_USER: ${POSTGRES_USER:-medstack_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal-net

  api:
    build:
      context: ../backend
      dockerfile: ../docker/backend.Dockerfile
    container_name: medstack-api
    restart: unless-stopped
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/${POSTGRES_DB:-medstack_db}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER:-medstack_user}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db
    networks:
      - internal-net

  web:
    image: nginx:alpine
    container_name: medstack-web
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ../frontend:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
    networks:
      - internal-net

networks:
  internal-net:
    driver: bridge

volumes:
  postgres_data:
```

Do not commit actual passwords or JWT secrets.

Create:

```text
.env.example
```

with placeholder values.

---

# 33. 12-Factor / Cloud Run Readiness

The application must follow these principles:

## Configuration

All environment-specific values come from environment variables.

Examples:

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
JWT_SECRET
UPI_MERCHANT_VPA
```

## Stateless API

Do not store application session state on the local filesystem.

Do not depend on local files for persistent business data.

## Logs

Write logs to stdout/stderr.

## Port

The backend must be configurable through:

```text
PORT
```

or Spring's standard server port configuration.

Cloud Run should be able to start the backend without code changes.

## Database

PostgreSQL should be externalized when deployed to Cloud Run.

The application must not assume the database runs in the same container.

## Container lifecycle

The application must tolerate:

- Container restarts
- Multiple backend instances
- Stateless scaling

Do not rely on in-memory locks as the only concurrency mechanism.

---

# 34. Configuration

Use:

```text
application.yml
application-dev.yml
application-test.yml
```

Avoid secrets in source code.

Example:

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}

  jpa:
    hibernate:
      ddl-auto: validate

  flyway:
    enabled: true

server:
  port: ${PORT:8080}

medstack:
  jwt:
    secret: ${JWT_SECRET}
```

---

# 35. Testing Requirements

Create meaningful automated tests.

## Unit Tests

Test:

- Billing calculations
- FIFO allocation
- Expiry filtering
- Discount calculations
- Tax calculations
- RBAC rules
- Authentication strategies

## Integration Tests

Test:

- Purchase receiving
- Inventory updates
- Bill creation
- Bill editing
- Payment creation
- Transaction rollback
- Concurrent inventory behavior where practical

Use Testcontainers for PostgreSQL integration tests if practical.

Do not create superficial tests just to increase coverage.

---

# 36. Transaction Safety

The following operations must be transactional:

```text
Purchase receiving
Bill creation
Bill editing
Payment creation when part of bill finalization
Inventory retirement
```

Never perform:

```text
database update
→ external side effect
→ another database update
```

inside a transaction unless the external side effect is explicitly designed for consistency.

For v1, printing and WhatsApp generation happen after successful bill creation on the frontend.

---

# 37. Concurrency

Inventory is shared state.

Consider:

```text
User A sells 5 units
User B sells 7 units
Available stock = 10
```

The application must not allow both transactions to succeed if only 10 units exist.

Use database-level locking/optimistic or pessimistic locking appropriately.

Do not depend only on Java `synchronized`.

The solution must work when multiple backend instances are running.

---

# 38. Error Handling

Create business exceptions such as:

```text
ResourceNotFoundException
DuplicateResourceException
InsufficientStockException
ExpiredBatchException
RetiredBatchException
InvalidBillException
UnauthorizedOperationException
InvalidPaymentException
```

Map them to appropriate HTTP status codes.

Example:

```text
404 → Resource not found
400 → Invalid request/business validation
401 → Authentication required
403 → Forbidden
409 → Conflict
500 → Unexpected server error
```

---

# 39. API Documentation

Expose Swagger/OpenAPI.

Document:

- Authentication
- Request parameters
- Request bodies
- Response models
- Error responses
- Pagination
- Important business rules

Do not document internal implementation details.

---

# 40. Seed Data

For development only, create optional seed data:

```text
ADMIN user
OWNER user
STAFF user
sample medicines
sample doctors
sample suppliers
sample customers
```

Never use production passwords.

Clearly document development credentials.

---

# 41. README Requirements

Create a useful README containing:

1. Project overview
2. Architecture
3. Directory structure
4. Prerequisites
5. Environment setup
6. Local development
7. Docker Compose startup
8. API documentation
9. Database migration strategy
10. Default development credentials
11. Testing
12. Cloud Run migration considerations

Startup should be as simple as:

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build
```

Document the exact URL.

---

# 42. Development Workflow

Implement in this order.

## Phase 1 — Foundation

- Repository structure
- Spring Boot project
- PostgreSQL
- Flyway
- Audit base entity
- API response wrapper
- Exception handling
- Docker Compose
- Nginx

## Phase 2 — Authentication

- User entity
- Password hashing
- JWT
- Auth strategy architecture
- RBAC
- Login API
- Security configuration

## Phase 3 — Master Data

Implement CRUD for:

- Medicines
- Doctors
- Customers
- Suppliers
- Users

## Phase 4 — Inventory

Implement:

- InventoryBatch
- PurchaseOrder
- PurchaseOrderItem
- Purchase receiving
- FIFO
- Expiry
- Retirement
- Low stock

## Phase 5 — POS

Implement:

- Cart
- Bill creation
- Tax
- Discount
- Payment
- Prescription rules
- Receipt generation
- Bill search

## Phase 6 — Bill Editing

Implement:

- Historical bill loading
- Stock reversal
- Reallocation
- Audit trail

## Phase 7 — Expenses & Reports

Implement:

- Expenses
- Sales reports
- Inventory reports
- Expiry reports
- Dashboard KPIs

## Phase 8 — Frontend UX

Implement:

- Login
- Dashboard
- POS
- CRUD screens
- Tables
- Search
- CSV export/import
- Theme
- Keyboard navigation
- Print
- WhatsApp
- UPI QR

## Phase 9 — Hardening

- Automated tests
- Concurrency testing
- Security review
- Validation review
- Docker verification
- README
- OpenAPI
- Performance checks

---

# 43. Coding Standards

Use:

- Constructor injection
- Immutable DTOs where practical
- `final` fields
- Small focused services
- Meaningful method names
- Meaningful exception names
- Java records for simple DTOs where appropriate
- `BigDecimal` for money
- `Instant`/`OffsetDateTime` consistently for timestamps
- Enums for finite states
- Database constraints in addition to application validation

Avoid:

- Field injection
- God classes
- Giant controllers
- Giant service classes
- Static global state
- Hard-coded secrets
- Hard-coded environment URLs
- Business logic in controllers
- Returning entities directly
- `double` for money
- Unbounded queries
- Silent exception swallowing

---

# 44. Security Requirements

Implement:

- Password hashing
- JWT signature verification
- Token expiry
- RBAC
- Input validation
- SQL injection protection through JPA/parameterized queries
- No sensitive data in logs
- No secrets in Git
- Appropriate HTTP security headers
- Secure error responses

JWT should be short-lived.

If refresh tokens are introduced later, design them separately rather than making access tokens long-lived.

---

# 45. Performance Requirements

The application should remain lightweight.

Priorities:

1. Fast POS search
2. Correct inventory transactions
3. Low database round trips
4. Pagination
5. Proper indexing
6. Efficient DTO queries
7. Avoid N+1 queries
8. Avoid unnecessary frontend libraries

Do not introduce Redis, Kafka, Elasticsearch, Kubernetes, or microservices unless a future requirement explicitly justifies them.

For the first version, PostgreSQL + Spring Boot + Nginx is sufficient.

---

# 46. Definition of Done

The implementation is complete only when:

- [ ] Backend compiles.
- [ ] Frontend loads through Nginx.
- [ ] PostgreSQL starts through Docker Compose.
- [ ] Flyway creates the database schema.
- [ ] Login works.
- [ ] JWT authentication works.
- [ ] RBAC works.
- [ ] Medicine CRUD works.
- [ ] Customer CRUD works.
- [ ] Supplier CRUD works.
- [ ] Doctor CRUD works.
- [ ] Purchase receiving updates inventory.
- [ ] FIFO/expiry-first selling works.
- [ ] Expired batches cannot be sold.
- [ ] Retired batches cannot be sold.
- [ ] Low-stock reporting works.
- [ ] Bill creation is transactional.
- [ ] Payment recording works.
- [ ] Bill editing reverses/reapplies inventory correctly.
- [ ] Bill audit trail exists.
- [ ] Expense management works.
- [ ] Dashboard works.
- [ ] CSV import/export works.
- [ ] POS keyboard workflow works.
- [ ] Print workflow works.
- [ ] WhatsApp invoice link works.
- [ ] UPI QR works.
- [ ] Dark/light theme works.
- [ ] Responsive UI works.
- [ ] API errors follow the unified response structure.
- [ ] Swagger/OpenAPI works.
- [ ] Automated tests exist for critical business logic.
- [ ] Docker Compose starts successfully from a clean checkout.
- [ ] No production secrets are committed.

---

# 47. Autonomous Agent Rules

When implementing this project, the agent must follow these rules:

### Rule 1 — Inspect Before Changing

Before creating or modifying files, inspect the existing repository structure.

Do not overwrite existing work blindly.

### Rule 2 — Preserve Architecture

Do not introduce a framework or dependency merely because it makes one small task easier.

### Rule 3 — Business Logic First

For inventory and billing, correctness is more important than UI polish.

### Rule 4 — Backend Is Authoritative

Never trust:

- Frontend totals
- Frontend permissions
- Frontend stock values
- Frontend prices
- Frontend tax calculations

Recalculate and validate on the backend.

### Rule 5 — Database Is Authoritative for Stock

Inventory consistency must survive multiple application instances.

### Rule 6 — Use Migrations

Every schema change must be represented by a Flyway migration.

Never manually alter production schema.

### Rule 7 — Keep Changes Reviewable

Prefer small coherent files and services.

### Rule 8 — Do Not Create Placeholder Implementations

If an endpoint is exposed, implement its real behavior or clearly mark it as intentionally unavailable.

Do not return fake success responses.

### Rule 9 — Test Critical Workflows

Before considering a feature complete, test the business-critical path.

### Rule 10 — Verify Docker

After implementation, verify that the complete stack can be built and started using Docker Compose.

---

# 48. Suggested Initial API Inventory

At minimum, implement:

```text
AUTH
POST   /api/v1/auth/login

USERS
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}

MEDICINES
GET    /api/v1/medicines
POST   /api/v1/medicines
GET    /api/v1/medicines/{id}
PUT    /api/v1/medicines/{id}
DELETE /api/v1/medicines/{id}

CUSTOMERS
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/{id}
PUT    /api/v1/customers/{id}
DELETE /api/v1/customers/{id}

DOCTORS
GET    /api/v1/doctors
POST   /api/v1/doctors
GET    /api/v1/doctors/{id}
PUT    /api/v1/doctors/{id}
DELETE /api/v1/doctors/{id}

SUPPLIERS
GET    /api/v1/suppliers
POST   /api/v1/suppliers
GET    /api/v1/suppliers/{id}
PUT    /api/v1/suppliers/{id}
DELETE /api/v1/suppliers/{id}

PURCHASES
GET    /api/v1/purchases
POST   /api/v1/purchases
GET    /api/v1/purchases/{id}
POST   /api/v1/purchases/{id}/receive

INVENTORY
GET    /api/v1/inventory
GET    /api/v1/inventory/search
GET    /api/v1/inventory/low-stock
GET    /api/v1/inventory/expiry/near
GET    /api/v1/inventory/expiry/expired
POST   /api/v1/inventory/expiry/retire

BILLS
GET    /api/v1/bills
POST   /api/v1/bills
GET    /api/v1/bills/{id}
PUT    /api/v1/bills/{id}
POST   /api/v1/bills/{id}/payments

EXPENSES
GET    /api/v1/expenses
POST   /api/v1/expenses
PUT    /api/v1/expenses/{id}
DELETE /api/v1/expenses/{id}

REPORTS
GET    /api/v1/reports/sales
GET    /api/v1/reports/inventory
GET    /api/v1/reports/expiry
GET    /api/v1/reports/dashboard
```

Adjust endpoints if a cleaner REST design is required, but preserve the same domain capabilities.

---

# 49. Final Agent Objective

The final result should feel like a **real pharmacy POS product**, not a CRUD demo.

The most important characteristics are:

```text
FAST POS
+
CORRECT INVENTORY
+
TRANSACTIONAL BILLING
+
SECURE RBAC
+
SIMPLE OPERATIONS
+
CLEAN ARCHITECTURE
+
EASY DEPLOYMENT
```

Build the system incrementally, verify each phase, and leave the repository in a runnable state.

When finished, provide a concise implementation summary containing:

1. What was built.
2. Important architectural decisions.
3. How to run it.
4. Test status.
5. Any intentionally deferred features.
