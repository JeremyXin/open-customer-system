# Customer Service System — MVP Work Plan

## TL;DR

> **Quick Summary**: Build a complete MVP customer service system with user-facing chat widget and agent dashboard, powered by Java Spring Boot + React Next.js + OceanBase + Redis + WebSocket real-time messaging. Core flow: user initiates chat → queued → agent takes over → real-time conversation → resolution.
> 
> **Deliverables**:
> - Spring Boot backend (`customer-server`) with REST API + WebSocket (STOMP) for real-time messaging
> - Next.js frontend (`customer-webapp`) with agent dashboard + user chat widget
> - Maven multi-module build with一键打包 (`build.sh` → tar.gz distribution)
> - OceanBase/MySQL schema with Flyway migrations
> - Docker Compose local dev environment (MySQL 8 + Redis)
> - 分发包结构: bin/ conf/ lib/ logs/ temp/ (参考 StreamPark)
> - JWT authentication for agents, anonymous visitor identity via UUID token
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 4 → Task 8 → Task 9 → Task 12 → Task 13 → Task 17 → Task 22 → F1-F4

---

## Context

### Original Request
Build a complete customer service system including user frontend interface and agent admin interface. Features: user clicks to contact support → chat page, agent receives messages → clicks takeover → real-time conversation → resolution.

### Interview Summary
**Key Discussions**:
- **Backend**: Java + Spring Boot chosen for enterprise stability and WebSocket support
- **Frontend**: React + Next.js for both agent dashboard and user widget
- **Database**: OceanBase (MySQL-compatible) + Redis for persistence and real-time state
- **Scope**: MVP core flow only — no AI, multi-channel, SLA, analytics
- **Multi-tenancy**: Single company self-use, no tenant isolation needed
- **Project structure**: Maven multi-module monorepo (`/customer-server` + `/customer-webapp`), 参考 StreamPark 打包模式
- **Build & Deploy**: `build.sh` → `mvnw -Pwebapp,dist` → `dist/` 输出 tar.gz (bin/conf/lib/logs/temp)
- **Auth**: JWT + Spring Security for agents, UUID visitor token for users
- **Tests**: Tests-after strategy with Agent-Executed QA
- **Backend Dev Skill** (`backend-springboot-dev`): MyBatis-Plus for data access (NOT JPA), Service interface/impl pattern (IService + ServiceImpl), BaseMapper + QueryLambdaWrapper, @TableName entities, Actuator + Prometheus monitoring, class max 500 lines, method max 80 lines

**Research Findings**:
- Chatwoot/Papercups use monolithic architecture with WebSocket + Redis pub/sub — proven pattern
- Key data model: users (agents) → conversations → messages, with conversation state machine as architectural cornerstone
- Agent concurrency (3-6 simultaneous chats) is critical UX requirement
- Iframe isolation for user widget is industry standard (Intercom/Zendesk/Chatwoot pattern)
- STOMP over WebSocket with JWT ChannelInterceptor is the Spring standard for authenticated real-time

### Metis Review
**Identified Gaps** (addressed):
- Message delivery guarantees: At-least-once with optimistic UI, client-generated UUID for dedup
- Conversation assignment: Pull model (agent picks from queue) for MVP simplicity
- Offline handling: Conversations persist regardless of connection; REST sync on reconnect
- Widget integration: Script tag + iframe hybrid for isolation
- File upload: Explicitly EXCLUDED from MVP (text-only)
- Visitor identity: UUID localStorage token + pre-chat form (name + email)
- DB migrations: Flyway with versioned SQL files
- Resolved conversation messages: Create NEW conversation, don't reopen
- Local dev: MySQL 8 Docker image (not OceanBase) for dev simplicity
- Agent disconnect: Heartbeat timeout → auto-return conversations to queue

---

## Work Objectives

### Core Objective
Deliver a working MVP customer service system where users can initiate chat conversations via an embeddable widget, and support agents can manage multiple conversations through a real-time dashboard with queue-based takeover.

### Concrete Deliverables
- `/customer-server`: Spring Boot application (REST API + WebSocket + JWT auth + Flyway migrations)
- `/customer-webapp`: Next.js application (agent dashboard at `/dashboard/*` + user widget at `/widget/*`)
- Root `pom.xml`: Maven multi-module parent, orchestrate前后端联合构建
- `build.sh`: 一键构建脚本 (`mvnw -Pwebapp,dist -DskipTests clean install`)
- `docker-compose.yml`: MySQL 8 + Redis for local development
- `dist/`: 打包产出 tar.gz，解压后 bin/conf/lib/logs/temp 可直接部署
- Flyway seed data with test agent accounts

### Definition of Done
- [ ] `cd customer-server && ../mvnw clean verify` → BUILD SUCCESS, all tests pass
- [ ] `cd customer-webapp && npm run build` → exit code 0, zero errors
- [ ] `./build.sh` → dist/ 目录生成 tar.gz, 解压后结构: bin/ conf/ lib/ logs/ temp/
- [ ] `docker-compose up -d` → MySQL + Redis running, app connects successfully
- [ ] End-to-end flow: user opens widget → sends message → agent sees in queue → takes over → real-time chat exchange → agent resolves → user sees "conversation ended"
- [ ] Agent can handle 3+ simultaneous conversations with correct message routing
- [ ] WebSocket reconnection recovers missed messages via REST sync

### Must Have
- Real-time bidirectional messaging via WebSocket (STOMP)
- Conversation state machine: WAITING → ACTIVE → RESOLVED → CLOSED
- Conversation queue with agent takeover (pull model)
- JWT authentication for agents
- Anonymous visitor identity (UUID token + pre-chat form)
- Message persistence with ordering (sequence numbers)
- Agent presence tracking (online/offline)
- At-least-once message delivery with dedup
- Typing indicators
- Optimistic locking for concurrent takeover prevention

### Must NOT Have (Guardrails)
- **G1**: No admin panel. Agent CRUD via Flyway seed migrations only.
- **G2**: Single FIFO queue. No routing, priority, departments, skills-based routing.
- **G3**: No analytics/reporting page. Only conversation count per status in queue view.
- **G4**: Canned responses: flat list only, no categories, no variables, max 50.
- **G5**: In-app notifications only (WebSocket + browser Notification API). No email/SMS/push.
- **G6**: No conversation transfer. Only "return to queue" (unassign → WAITING).
- **G7**: Widget and dashboard share ONLY: API client types. No shared UI component library.
- **G8**: No i18n. Hardcoded strings (Chinese or English, consistent within each interface).
- **G9**: Text messages ONLY. No images, files, markdown, link previews, rich cards.
- **G10**: Exactly 4 conversation states only. No SNOOZED, PENDING_USER, ESCALATED.
- **G11**: No Turborepo/pnpm workspaces. Maven multi-module: root pom + `/customer-server` + `/customer-webapp`.
- **G12**: No SockJS fallback. Modern browsers with native WebSocket only.
- **G13**: No shared component library or design system between widget and dashboard.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: YES (tests-after)
- **Framework**: JUnit 5 + Spring Boot Test + Testcontainers (backend), Jest/Vitest (frontend)
- **If tests-after**: Every service class gets a corresponding test class in the SAME task

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend API**: Use Bash (curl) — Send requests, assert status + response fields
- **WebSocket**: Use Spring WebSocketStompClient in integration tests
- **Frontend UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **Build verification**: `./mvnw clean verify` and `npm run build` must pass

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately, MAX PARALLEL):
├── Task 1: Spring Boot project scaffolding + config [quick]
├── Task 2: Next.js project scaffolding + config [quick]
├── Task 3: Docker Compose (MySQL 8 + Redis) + env config [quick]
├── Task 4: Flyway migrations (schema + seed data) [quick]
├── Task 5: Shared TypeScript type definitions [quick]
└── Task 27: Maven multi-module build + packaging infrastructure [quick]

Wave 2 (Core Backend + Auth — after Wave 1):
├── Task 6: JWT token service + Spring Security config (depends: 1) [unspecified-high]
├── Task 7: Auth REST endpoints — login, refresh, me (depends: 6, 4) [unspecified-high]
├── Task 8: Conversation entity + state machine (depends: 1, 4) [deep]
├── Task 9: Conversation REST API — create, list, assign, resolve (depends: 8) [unspecified-high]
├── Task 10: Message REST API — send, list, pagination, dedup (depends: 8) [unspecified-high]
└── Task 11: Canned responses CRUD API (depends: 4) [quick]

Wave 3 (Real-time + Frontend — after Wave 2):
├── Task 12: WebSocket STOMP config + JWT interceptor (depends: 6) [deep]
├── Task 13: Real-time message delivery — REST→persist→WS broadcast (depends: 12, 10) [deep]
├── Task 14: Queue updates + agent presence + typing indicators via WS (depends: 12, 9) [deep]
├── Task 15: Dashboard login page + auth context + token management (depends: 2, 7) [visual-engineering]
├── Task 16: Dashboard layout + WebSocket provider + conversation queue view (depends: 15, 5) [visual-engineering]
├── Task 17: Dashboard chat panel — message list, input, real-time (depends: 16, 13) [visual-engineering]
├── Task 18: Dashboard active conversations sidebar + unread + switching (depends: 17) [visual-engineering]
└── Task 19: Dashboard canned responses UI (depends: 18, 11) [visual-engineering]

Wave 4 (Widget + Hardening — after Wave 3):
├── Task 20: Widget iframe loader + standalone widget route (depends: 2) [visual-engineering]
├── Task 21: Widget pre-chat form + conversation creation (depends: 20, 9) [visual-engineering]
├── Task 22: Widget real-time chat — send/receive, typing, history (depends: 21, 13) [visual-engineering]
├── Task 23: Widget reconnection + message recovery via REST sync (depends: 22) [deep]
├── Task 24: Agent disconnect → auto-return conversations to queue (depends: 14) [deep]
├── Task 25: Rate limiting — conversation creation + message sending (depends: 9, 10) [unspecified-high]
└── Task 26: Edge cases — double takeover 409, long messages, stale queue (depends: 9, 14) [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

**Critical Path**: Task 1 → Task 4 → Task 8 → Task 9 → Task 12 → Task 13 → Task 17 → Task 22 → F1-F4 → user okay
**Parallel Speedup**: ~65% faster than sequential
**Max Concurrent**: 6 (Wave 1)

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 6, 7, 8, 9, 10, 11 | 1 |
| 2 | — | 15, 20 | 1 |
| 3 | — | (all runtime tasks) | 1 |
| 4 | — | 7, 8, 11 | 1 |
| 5 | — | 16 | 1 |
| 6 | 1 | 7, 12 | 2 |
| 7 | 6, 4 | 15 | 2 |
| 8 | 1, 4 | 9, 10 | 2 |
| 9 | 8 | 14, 21, 25, 26 | 2 |
| 10 | 8 | 13, 25 | 2 |
| 11 | 4 | 19 | 2 |
| 12 | 6 | 13, 14 | 3 |
| 13 | 12, 10 | 17, 22 | 3 |
| 14 | 12, 9 | 24, 26 | 3 |
| 15 | 2, 7 | 16 | 3 |
| 16 | 15, 5 | 17 | 3 |
| 17 | 16, 13 | 18 | 3 |
| 18 | 17 | 19 | 3 |
| 19 | 18, 11 | — | 3 |
| 20 | 2 | 21 | 4 |
| 21 | 20, 9 | 22 | 4 |
| 22 | 21, 13 | 23 | 4 |
| 23 | 22 | — | 4 |
| 24 | 14 | — | 4 |
| 25 | 9, 10 | — | 4 |
| 26 | 9, 14 | — | 4 |
| 27 | — | (build verification) | 1 |

### Agent Dispatch Summary

- **Wave 1**: **6 tasks** — T1-T5 → `quick`, T27 → `quick`
- **Wave 2**: **6 tasks** — T6-T7 → `unspecified-high`, T8 → `deep`, T9-T10 → `unspecified-high`, T11 → `quick`
- **Wave 3**: **8 tasks** — T12-T14 → `deep`, T15-T19 → `visual-engineering`
- **Wave 4**: **7 tasks** — T20-T22 → `visual-engineering`, T23-T24 → `deep`, T25-T26 → `unspecified-high`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [ ] 1. Spring Boot Project Scaffolding

  **What to do**:
  - Initialize Spring Boot 3.x project with Maven in `/customer-server`
  - Dependencies: spring-boot-starter-web, spring-boot-starter-websocket, spring-boot-starter-security, mybatis-plus-spring-boot3-starter (3.5.7), spring-boot-starter-validation, mysql-connector-j, flyway-core, flyway-mysql, redis (spring-boot-starter-data-redis), jjwt (io.jsonwebtoken), caffeine cache, lombok, spring-boot-starter-actuator, micrometer-registry-prometheus, micrometer-core
  - Create `application.yml` with profiles: `default` (local dev), `prod`
  - Configure datasource (MySQL 8 on localhost:3306), Redis (localhost:6379), MyBatis-Plus (mapper-locations, type-aliases-package, global-config)
  - Create base package structure: `com.opencustomer.server` with sub-packages: `config`, `controller`, `service`, `entity`, `mapper`, `security`, `websocket`, `dto`, `exception`, `enums`, `const`, `utils`
  - **Backend Dev Skill**: Follow `backend-springboot-dev` skill — MyBatis-Plus for data access (ServiceImpl + BaseMapper pattern), Service interface/impl split, QueryLambdaWrapper for queries, @TableName on entities, class max 500 lines, method max 80 lines
  - Create global exception handler `@RestControllerAdvice` with standard error response format
  - Create health check endpoint `GET /api/health` → `{"status": "UP"}`
  - Set `<parent>` in `customer-server/pom.xml` to reference root `pom.xml` (created by Task 27)

  **Must NOT do**:
  - No business logic — scaffolding only
  - No Turborepo or workspace tooling
  - No OceanBase-specific configs (use MySQL 8 for dev)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard project initialization, well-defined steps
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5, 27)
  - **Blocks**: Tasks 6, 7, 8, 9, 10, 11
  - **Blocked By**: None

  **References**:
  - Spring Boot 3.x: https://docs.spring.io/spring-boot/docs/current/reference/html/
  - Spring WebSocket: https://docs.spring.io/spring-framework/reference/web/websocket.html

  **Acceptance Criteria**:
  - [ ] `cd customer-server && ../mvnw clean compile` → BUILD SUCCESS
  - [ ] `curl http://localhost:8080/api/health` → `{"status":"UP"}` (with MySQL + Redis running)

  ```
  Scenario: Project compiles successfully
    Tool: Bash
    Preconditions: JDK 17+ installed
    Steps:
      1. cd customer-server && ../mvnw clean compile
      2. Assert exit code = 0
    Expected Result: BUILD SUCCESS in output
    Evidence: .sisyphus/evidence/task-1-compile.txt

  Scenario: Health endpoint responds
    Tool: Bash (curl)
    Preconditions: docker-compose up -d (MySQL + Redis), server running
    Steps:
      1. cd customer-server && ../mvnw spring-boot:run &
      2. sleep 15
      3. curl -s http://localhost:8080/api/health
      4. Assert response contains "UP"
    Expected Result: {"status":"UP"}
    Evidence: .sisyphus/evidence/task-1-health.txt
  ```

  **Commit**: YES
  - Message: `init: spring boot project scaffolding with base config`
  - Files: `customer-server/`
  - Pre-commit: `cd customer-server && ../mvnw clean compile`

- [ ] 2. Next.js Project Scaffolding

  **What to do**:
  - Initialize Next.js 14+ project with TypeScript in `/customer-webapp`
  - Package manager: npm (or bun)
  - Dependencies: react, react-dom, next, typescript, @types/react, @types/node, tailwindcss, postcss, autoprefixer, eslint, eslint-config-next
  - UI library: Ant Design (`antd`) for agent dashboard components
  - Configure Tailwind CSS with base theme tokens
  - Create route group structure:
    - `/customer-webapp/src/app/(dashboard)/` — agent dashboard routes
    - `/customer-webapp/src/app/(widget)/widget/` — user chat widget routes
  - Create base layout for dashboard (with sidebar placeholder) and widget (minimal, no chrome)
  - Create `next.config.js` with API proxy to `http://localhost:8080` for local dev
  - Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8080` and `NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws`
  - Add ESLint + Prettier config

  **Must NOT do**:
  - No shared component library between dashboard and widget (G7, G13)
  - No i18n setup (G8)
  - No Turborepo/workspace tooling (G11)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard frontend project initialization
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: Tasks 15, 20
  - **Blocked By**: None

  **References**:
  - Next.js App Router: https://nextjs.org/docs/app
  - Ant Design: https://ant.design/components/overview
  - Tailwind CSS: https://tailwindcss.com/docs

  **Acceptance Criteria**:
  - [ ] `cd customer-webapp && npm run build` → exit code 0
  - [ ] `cd customer-webapp && npm run lint` → no errors
  - [ ] Dashboard route renders placeholder at `http://localhost:3000/dashboard`
  - [ ] Widget route renders placeholder at `http://localhost:3000/widget`

  ```
  Scenario: Frontend builds successfully
    Tool: Bash
    Preconditions: Node.js 18+ installed
    Steps:
      1. cd customer-webapp && npm install && npm run build
      2. Assert exit code = 0
    Expected Result: Build output shows "Compiled successfully"
    Evidence: .sisyphus/evidence/task-2-build.txt

  Scenario: Routes accessible
    Tool: Bash (curl)
    Preconditions: cd customer-webapp && npm run dev (running)
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
      2. Assert status = 200
      3. curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/widget
      4. Assert status = 200
    Expected Result: Both return 200
    Evidence: .sisyphus/evidence/task-2-routes.txt
  ```

  **Commit**: YES
  - Message: `init: next.js project with typescript and tailwind`
  - Files: `customer-webapp/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 3. Docker Compose + Environment Config

  **What to do**:
  - Create `docker-compose.yml` at project root with:
    - MySQL 8.0 service: port 3306, database `customer_service`, root password, health check
    - Redis 7.x service: port 6379, health check
    - Volumes for data persistence
  - Create `.env.example` with all required environment variables (DB, Redis, JWT secret, etc.)
  - Create `scripts/init-db.sh` for initial database setup if needed
  - Create root `README.md` with quick start instructions:
    1. `docker-compose up -d`
    2. `cd customer-server && ../mvnw spring-boot:run`
    3. `cd customer-webapp && npm run dev`
  - Add `.gitignore` updates for Node.js artifacts (node_modules, .next, etc.) alongside existing Java ignores

  **Must NOT do**:
  - No Kubernetes, Terraform, or cloud IaC (scope lock-down)
  - No OceanBase Docker image (use MySQL 8 for dev)
  - No monitoring/observability tools

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple Docker config, well-defined
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: All runtime tasks (implicitly)
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `docker-compose up -d` → both services healthy
  - [ ] `docker-compose ps` → mysql and redis both "Up (healthy)"
  - [ ] `mysql -h 127.0.0.1 -P 3306 -u root -p -e "SELECT 1"` → success

  ```
  Scenario: Docker services start successfully
    Tool: Bash
    Preconditions: Docker installed and running
    Steps:
      1. docker-compose up -d
      2. sleep 10
      3. docker-compose ps
      4. Assert mysql status contains "healthy"
      5. Assert redis status contains "healthy"
    Expected Result: Both services running and healthy
    Evidence: .sisyphus/evidence/task-3-docker.txt

  Scenario: MySQL accepts connections
    Tool: Bash
    Preconditions: docker-compose up -d
    Steps:
      1. docker exec customer-service-mysql mysql -u root -proot -e "SHOW DATABASES"
      2. Assert output contains "customer_service"
    Expected Result: customer_service database exists
    Evidence: .sisyphus/evidence/task-3-mysql.txt
  ```

  **Commit**: YES
  - Message: `infra: docker-compose with mysql and redis`
  - Files: `docker-compose.yml`, `.env.example`, `scripts/`, `README.md`, `.gitignore`
  - Pre-commit: `docker-compose config`

- [ ] 4. Flyway Database Migrations + Seed Data

  **What to do**:
  - Create Flyway migration files in `customer-server/src/main/resources/db/migration/`:
    - `V001__create_users_table.sql`: agents table (id BIGINT AUTO_INCREMENT, email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), display_name VARCHAR(100), role ENUM('AGENT') DEFAULT 'AGENT', status ENUM('ONLINE','OFFLINE') DEFAULT 'OFFLINE', created_at TIMESTAMP, updated_at TIMESTAMP)
    - `V002__create_conversations_table.sql`: (id BIGINT AUTO_INCREMENT, visitor_name VARCHAR(100), visitor_email VARCHAR(255), visitor_token VARCHAR(36), status ENUM('WAITING','ACTIVE','RESOLVED','CLOSED'), agent_id BIGINT NULL FK→users, created_at, updated_at, resolved_at TIMESTAMP NULL)
    - `V003__create_messages_table.sql`: (id BIGINT AUTO_INCREMENT, conversation_id BIGINT FK→conversations, sender_type ENUM('VISITOR','AGENT','SYSTEM'), sender_id BIGINT NULL, content TEXT NOT NULL, client_message_id VARCHAR(36), sequence_number BIGINT NOT NULL, created_at TIMESTAMP; UNIQUE KEY (conversation_id, client_message_id); INDEX (conversation_id, sequence_number))
    - `V004__create_canned_responses_table.sql`: (id BIGINT AUTO_INCREMENT, title VARCHAR(100), content TEXT, short_code VARCHAR(50) UNIQUE, created_at, updated_at)
    - `V005__seed_data.sql`: Insert test agent (email: agent@test.com, password: bcrypt hash of "test123"), 5 sample canned responses
  - Ensure all tables use InnoDB engine, UTF8MB4 charset
  - Add appropriate indexes for common queries

  **Must NOT do**:
  - No `metadata JSON` columns (G10 — keep schema simple)
  - No `conversation_events` audit table
  - No `message_status` delivery tracking table
  - Only 4 tables total: users, conversations, messages, canned_responses

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: SQL DDL creation, straightforward
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 5)
  - **Blocks**: Tasks 7, 8, 11
  - **Blocked By**: None (migration files only, applied when server starts)

  **Acceptance Criteria**:
  - [ ] Server starts with `cd customer-server && ../mvnw spring-boot:run` → Flyway applies all 5 migrations
  - [ ] `SELECT count(*) FROM flyway_schema_history WHERE success = true` → 5
  - [ ] `SELECT * FROM users WHERE email = 'agent@test.com'` → 1 row

  ```
  Scenario: Flyway migrations apply successfully
    Tool: Bash
    Preconditions: MySQL running via docker-compose, server started
    Steps:
      1. cd customer-server && ../mvnw spring-boot:run (wait for startup)
      2. docker exec customer-service-mysql mysql -u root -proot customer_service -e "SELECT count(*) as cnt FROM flyway_schema_history WHERE success = 1"
      3. Assert cnt = 5
    Expected Result: All 5 migrations applied successfully
    Evidence: .sisyphus/evidence/task-4-migrations.txt

  Scenario: Seed data present
    Tool: Bash
    Preconditions: Migrations applied
    Steps:
      1. docker exec customer-service-mysql mysql -u root -proot customer_service -e "SELECT email, display_name FROM users"
      2. Assert output contains "agent@test.com"
      3. docker exec customer-service-mysql mysql -u root -proot customer_service -e "SELECT count(*) as cnt FROM canned_responses"
      4. Assert cnt >= 5
    Expected Result: Test agent and canned responses seeded
    Evidence: .sisyphus/evidence/task-4-seed.txt
  ```

  **Commit**: YES
  - Message: `schema: flyway migrations and seed data`
  - Files: `customer-server/src/main/resources/db/migration/V001-V005`
  - Pre-commit: `cd customer-server && ../mvnw clean compile`

- [ ] 5. Shared TypeScript Type Definitions

  **What to do**:
  - Create `customer-webapp/src/types/` directory with TypeScript interfaces matching backend models:
    - `customer-webapp/src/types/conversation.ts`: Conversation interface (id, visitorName, visitorEmail, visitorToken, status: 'WAITING'|'ACTIVE'|'RESOLVED'|'CLOSED', agentId, createdAt, updatedAt, resolvedAt)
    - `customer-webapp/src/types/message.ts`: Message interface (id, conversationId, senderType: 'VISITOR'|'AGENT'|'SYSTEM', senderId, content, clientMessageId, sequenceNumber, createdAt)
    - `customer-webapp/src/types/user.ts`: User/Agent interface (id, email, displayName, role, status: 'ONLINE'|'OFFLINE')
    - `customer-webapp/src/types/auth.ts`: LoginRequest, LoginResponse (accessToken, refreshToken, expiresIn), TokenPayload
    - `customer-webapp/src/types/api.ts`: ApiResponse<T> wrapper, PaginatedResponse<T>, ErrorResponse
    - `customer-webapp/src/types/websocket.ts`: WS event types (NewMessage, ConversationUpdated, AgentTyping, QueueUpdate, PresenceChange)
    - `customer-webapp/src/types/index.ts`: barrel export
  - Create `customer-webapp/src/lib/api-client.ts`: base Axios/fetch wrapper with JWT interceptor (request adds Authorization header, response 401 → refresh token)
  - Create `customer-webapp/src/lib/constants.ts`: API_URL, WS_URL from env vars

  **Must NOT do**:
  - No shared npm package between frontend and backend
  - These are frontend-only types (may diverge from backend)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type definition files, straightforward
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4)
  - **Blocks**: Task 16
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `cd customer-webapp && npx tsc --noEmit` → 0 errors
  - [ ] All type files export correctly via barrel

  ```
  Scenario: Types compile without errors
    Tool: Bash
    Preconditions: web project initialized (Task 2)
    Steps:
      1. cd customer-webapp && npx tsc --noEmit
      2. Assert exit code = 0
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-5-typecheck.txt
  ```

  **Commit**: YES
  - Message: `types: shared typescript type definitions and api client`
  - Files: `customer-webapp/src/types/`, `customer-webapp/src/lib/`
  - Pre-commit: `cd customer-webapp && npx tsc --noEmit`

- [ ] 6. JWT Token Service + Spring Security Config

  **What to do**:
  - Create `JwtTokenService` in `security/` package:
    - `generateAccessToken(User user)` → JWT with sub=userId, email, role; expires 1h
    - `generateRefreshToken(User user)` → JWT with sub=userId; expires 7d
    - `validateToken(String token)` → Claims or throw
    - `getUserIdFromToken(String token)` → Long
    - Use io.jsonwebtoken (jjwt) library with HS256 signing
    - Secret from `application.yml` property `jwt.secret`
  - Create `JwtAuthenticationFilter extends OncePerRequestFilter`:
    - Extract Bearer token from Authorization header
    - Validate → set SecurityContext with UserDetails
    - Skip for public endpoints (/api/auth/**, /api/conversations POST, /api/health)
  - Create `SecurityConfig` with `@EnableWebSecurity`:
    - CORS: allow localhost:3000 (frontend), configurable origins
    - CSRF: disabled (JWT-based)
    - Session: STATELESS
    - Public endpoints: POST /api/auth/login, POST /api/auth/refresh, POST /api/conversations, GET /api/health
    - All other endpoints: authenticated
  - Create `UserDetailsServiceImpl` loading from `UserRepository`
  - Unit tests for JwtTokenService: generate, validate, expired token, invalid token

  **Must NOT do**:
  - No social login, SSO, magic link
  - No user registration endpoint (agents seeded via Flyway)
  - No password reset flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Security is critical, requires careful implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 10, 11)
  - **Blocks**: Tasks 7, 12
  - **Blocked By**: Task 1

  **References**:
  - Spring Security: https://docs.spring.io/spring-security/reference/
  - jjwt: https://github.com/jwtk/jjwt

  **Acceptance Criteria**:
  - [ ] Unit tests pass for token generation, validation, expiration
  - [ ] Unauthenticated request to protected endpoint → 401
  - [ ] Request with valid Bearer token → 200
  - [ ] Request with expired token → 401

  ```
  Scenario: JWT token lifecycle
    Tool: Bash
    Preconditions: Server running
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/conversations
         (GET without token to protected list endpoint)
      2. Assert status = 401
      3. curl -s http://localhost:8080/api/health
      4. Assert status = 200 (public endpoint)
    Expected Result: Protected endpoints return 401, public return 200
    Evidence: .sisyphus/evidence/task-6-jwt-auth.txt

  Scenario: Invalid token rejected
    Tool: Bash
    Preconditions: Server running
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.token.here" http://localhost:8080/api/conversations
      2. Assert status = 401
    Expected Result: Invalid token returns 401
    Evidence: .sisyphus/evidence/task-6-invalid-token.txt
  ```

  **Commit**: YES
  - Message: `feat: jwt token service and spring security config`
  - Files: `customer-server/src/.../security/`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 7. Auth REST Endpoints

  **What to do**:
  - Create `AuthController` with:
    - `POST /api/auth/login` — body: {email, password} → validate credentials → return {accessToken, refreshToken, expiresIn, user: {id, email, displayName}}
    - `POST /api/auth/refresh` — body: {refreshToken} → validate refresh token → return new {accessToken, refreshToken, expiresIn}
    - `GET /api/auth/me` — Authorization: Bearer {token} → return current user info
  - Create `AuthService` with login logic (BCrypt password verification)
  - Create DTOs: `LoginRequest`, `LoginResponse`, `RefreshRequest`, `TokenResponse`
  - Integration tests with `@SpringBootTest` + Testcontainers (MySQL):
    - Valid login → 200 with tokens
    - Invalid password → 401
    - Invalid email → 401
    - Refresh with valid token → new tokens
    - Refresh with expired token → 401

  **Must NOT do**:
  - No registration endpoint
  - No password change/reset

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Auth endpoints need careful testing and security validation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8, 9, 10, 11)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 6, 4

  **Acceptance Criteria**:
  - [ ] `POST /api/auth/login` with valid credentials → 200, body has accessToken
  - [ ] `POST /api/auth/login` with wrong password → 401
  - [ ] `POST /api/auth/refresh` with valid refresh → 200, new accessToken
  - [ ] `GET /api/auth/me` with valid token → 200, user info

  ```
  Scenario: Agent login success
    Tool: Bash (curl)
    Preconditions: Server running, seed agent exists
    Steps:
      1. curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"agent@test.com","password":"test123"}'
      2. Assert HTTP 200
      3. Assert response JSON has "accessToken" field (non-null)
      4. Assert response JSON has "refreshToken" field (non-null)
      5. Extract accessToken, call GET /api/auth/me with Bearer token
      6. Assert response has "email": "agent@test.com"
    Expected Result: Login returns tokens, /me returns user info
    Evidence: .sisyphus/evidence/task-7-login.txt

  Scenario: Login with wrong password
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"agent@test.com","password":"wrongpass"}'
      2. Assert status = 401
    Expected Result: 401 Unauthorized
    Evidence: .sisyphus/evidence/task-7-login-fail.txt
  ```

  **Commit**: YES
  - Message: `feat: auth rest endpoints login refresh me`
  - Files: `customer-server/src/.../controller/AuthController.java`, `customer-server/src/.../service/AuthService.java`, `customer-server/src/.../dto/auth/`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 8. Conversation Entity + State Machine

  **What to do**:
  - Create `Conversation` entity with `@TableName("conversations")` and all fields matching V002 migration
  - Create `ConversationStatus` enum: WAITING, ACTIVE, RESOLVED, CLOSED
  - Implement state machine as methods on the entity:
    - `assignToAgent(User agent)`: WAITING → ACTIVE (sets agent_id, updated_at)
    - `resolve()`: ACTIVE → RESOLVED (sets resolved_at, updated_at)
    - `close()`: RESOLVED → CLOSED (sets updated_at)
    - `returnToQueue()`: ACTIVE → WAITING (clears agent_id, updated_at)
    - Each method throws `IllegalStateTransitionException` if current status is invalid for the transition
  - Create `ConversationMapper extends BaseMapper<Conversation>` with `@Mapper` annotation:
    - Use `QueryLambdaWrapper` for status-based queries
    - Optimistic lock assign: custom SQL or `update()` with `UpdateWrapper` where status='WAITING' AND agent_id IS NULL
  - Create `Message` entity with `@TableName("messages")` matching V003
  - Create `MessageMapper extends BaseMapper<Message>` with methods using `QueryLambdaWrapper`
  - Create `CannedResponse` entity + `CannedResponseMapper`
  - **Follow backend-springboot-dev skill**: Service interface/impl pattern, BaseMapper, @TableName entities, QueryLambdaWrapper
  - **Exhaustive unit tests** for state machine:
    - All valid transitions succeed
    - All invalid transitions throw (e.g., WAITING→RESOLVED, ACTIVE→WAITING via wrong method, CLOSED→anything)
    - Transition from each state to every other state tested

  **Must NOT do**:
  - No SNOOZED, PENDING_USER, ESCALATED states (G10)
  - No metadata JSON columns
  - No audit event tracking

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: State machine is the architectural cornerstone, needs careful design and exhaustive testing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 9, 10, 11)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 1, 4

  **Acceptance Criteria**:
  - [ ] All state transition unit tests pass (minimum 12 test cases)
  - [ ] Valid: WAITING→ACTIVE, ACTIVE→RESOLVED, RESOLVED→CLOSED, ACTIVE→WAITING
  - [ ] Invalid: WAITING→RESOLVED, WAITING→CLOSED, RESOLVED→ACTIVE, CLOSED→any → throw IllegalStateTransitionException
  - [ ] Optimistic lock query returns 0 rows when conversation already taken

  ```
  Scenario: State machine valid transitions
    Tool: Bash
    Preconditions: Server compiled
    Steps:
      1. cd customer-server && ../mvnw test -pl . -Dtest="ConversationStateTest"
      2. Assert all tests pass
    Expected Result: All valid transition tests green, all invalid transition tests verify exception thrown
    Evidence: .sisyphus/evidence/task-8-state-machine.txt

  Scenario: State machine rejects invalid transitions
    Tool: Bash
    Preconditions: Server compiled
    Steps:
      1. cd customer-server && ../mvnw test -pl . -Dtest="ConversationStateTest#testInvalidTransitions"
      2. Assert tests pass (exceptions correctly thrown)
    Expected Result: IllegalStateTransitionException thrown for each invalid transition
    Evidence: .sisyphus/evidence/task-8-invalid-transitions.txt
  ```

  **Commit**: YES
  - Message: `feat: conversation state machine with exhaustive tests`
  - Files: `customer-server/src/.../entity/`, `customer-server/src/.../mapper/`, `customer-server/src/test/.../entity/`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 9. Conversation REST API

  **What to do**:
  - Create `ConversationController`:
    - `POST /api/conversations` — public (visitor creates). Body: {visitorName, visitorEmail, initialMessage}. Creates conversation (WAITING) + first message. Generates visitor_token (UUID) returned in response. Uses Redis INCR for message sequence_number.
    - `GET /api/conversations` — authenticated (agent). Query params: status (optional filter). Returns list sorted by createdAt ASC.
    - `GET /api/conversations/{id}` — authenticated. Returns conversation with agent info.
    - `PUT /api/conversations/{id}/assign` — authenticated (agent takes over). Uses optimistic lock UPDATE. Returns updated conversation or 409 if already taken.
    - `PUT /api/conversations/{id}/resolve` — authenticated (assigned agent only). Transitions ACTIVE→RESOLVED.
    - `PUT /api/conversations/{id}/return-to-queue` — authenticated (assigned agent). Transitions ACTIVE→WAITING, clears agent.
  - Create `ConversationService` with all business logic
  - Create DTOs: CreateConversationRequest, ConversationResponse, ConversationListResponse
  - Integration tests:
    - Create conversation → 201, status=WAITING
    - List conversations by status → correct filtering
    - Assign → 200, status=ACTIVE
    - Double assign → first 200, second 409
    - Resolve → 200, status=RESOLVED
    - Return to queue → 200, status=WAITING

  **Must NOT do**:
  - No routing, priority, departments (G2)
  - No search (scope lock-down)
  - No conversation transfer (G6)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core business logic API with race condition handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 10, 11)
  - **Blocks**: Tasks 14, 21, 25, 26
  - **Blocked By**: Task 8

  **Acceptance Criteria**:
  - [ ] POST /api/conversations → 201, body has id, status="WAITING", visitorToken
  - [ ] PUT /api/conversations/{id}/assign → 200, status="ACTIVE"
  - [ ] Concurrent assign (race condition) → one 200, other 409
  - [ ] PUT /api/conversations/{id}/resolve → 200, status="RESOLVED"

  ```
  Scenario: Full conversation lifecycle via REST
    Tool: Bash (curl)
    Preconditions: Server running with seed data
    Steps:
      1. POST /api/conversations with {"visitorName":"John","visitorEmail":"john@test.com","initialMessage":"Help me"}
      2. Assert 201, extract conversation id
      3. Login as agent, get token
      4. PUT /api/conversations/{id}/assign with Bearer token
      5. Assert 200, status="ACTIVE"
      6. PUT /api/conversations/{id}/resolve with Bearer token
      7. Assert 200, status="RESOLVED"
    Expected Result: Full lifecycle WAITING→ACTIVE→RESOLVED
    Evidence: .sisyphus/evidence/task-9-lifecycle.txt

  Scenario: Double takeover returns 409
    Tool: Bash (curl)
    Preconditions: Conversation in WAITING status, two agent tokens
    Steps:
      1. Create conversation → WAITING
      2. Agent1 PUT /api/conversations/{id}/assign → 200
      3. Agent2 PUT /api/conversations/{id}/assign → 409
    Expected Result: Second assign returns 409 Conflict
    Evidence: .sisyphus/evidence/task-9-double-takeover.txt
  ```

  **Commit**: YES
  - Message: `feat: conversation rest api with optimistic locking`
  - Files: `customer-server/src/.../controller/ConversationController.java`, `customer-server/src/.../service/ConversationService.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 10. Message REST API

  **What to do**:
  - Create `MessageController`:
    - `POST /api/conversations/{id}/messages` — send message. Body: {content, senderType, clientMessageId}. Validates: conversation exists, content <= 5000 chars, clientMessageId is UUID. Server assigns sequence_number via Redis `INCR conversation:{id}:seq`. Dedup: if clientMessageId already exists, return existing message (idempotent).
    - `GET /api/conversations/{id}/messages` — list messages. Query params: afterSequence (for gap fill), limit (default 50, max 100). Sorted by sequence_number ASC.
  - Create `MessageService`:
    - `sendMessage()`: validate, persist to DB, assign sequence, dedup check
    - Use Caffeine cache for fast dedup check (clientMessageId → messageId, 5 min TTL)
    - DB unique constraint (conversation_id, client_message_id) as fallback dedup
  - Create DTOs: SendMessageRequest, MessageResponse, MessageListResponse
  - Integration tests:
    - Send message → 201, has sequence_number
    - Send duplicate clientMessageId → 200, same message returned (idempotent)
    - List messages with afterSequence → only newer messages
    - Send message with content > 5000 chars → 400
    - Send to non-existent conversation → 404

  **Must NOT do**:
  - No message types beyond plain text (G9)
  - No message editing or deletion
  - No message_status tracking table
  - No file/image attachments

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Dedup logic and sequence numbers need careful implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9, 11)
  - **Blocks**: Tasks 13, 25
  - **Blocked By**: Task 8

  **Acceptance Criteria**:
  - [ ] POST message → 201, response has sequence_number
  - [ ] Same clientMessageId twice → same message returned (idempotent)
  - [ ] GET messages?afterSequence=5 → only messages with sequence > 5
  - [ ] Content > 5000 chars → 400 Bad Request

  ```
  Scenario: Message send and dedup
    Tool: Bash (curl)
    Preconditions: Active conversation exists
    Steps:
      1. POST /api/conversations/{id}/messages with {"content":"Hello","senderType":"VISITOR","clientMessageId":"uuid-1"}
      2. Assert 201, extract message id and sequence_number
      3. POST same request again (same clientMessageId)
      4. Assert 200, same message id returned
    Expected Result: First creates, second returns same (idempotent)
    Evidence: .sisyphus/evidence/task-10-dedup.txt

  Scenario: Message content validation
    Tool: Bash (curl)
    Preconditions: Active conversation exists
    Steps:
      1. POST message with content = 5001 'x' characters
      2. Assert 400 Bad Request
    Expected Result: Validation rejects oversized content
    Evidence: .sisyphus/evidence/task-10-validation.txt
  ```

  **Commit**: YES
  - Message: `feat: message rest api with dedup and sequencing`
  - Files: `customer-server/src/.../controller/MessageController.java`, `customer-server/src/.../service/MessageService.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 11. Canned Responses CRUD API

  **What to do**:
  - Create `CannedResponseController`:
    - `GET /api/canned-responses` — authenticated. List all canned responses, sorted by title ASC.
    - `POST /api/canned-responses` — authenticated. Body: {title, content, shortCode}. Create new.
    - `PUT /api/canned-responses/{id}` — authenticated. Update existing.
    - `DELETE /api/canned-responses/{id}` — authenticated. Delete.
  - Create `CannedResponseService` with CRUD logic
  - Validation: title required, content required, shortCode unique
  - DTOs: CannedResponseRequest, CannedResponseResponse
  - Integration tests: CRUD operations, unique shortCode violation → 409

  **Must NOT do**:
  - No categories, tags, or search (G4)
  - No variable interpolation (e.g., {{name}})
  - No limit > 50 enforcement at this stage

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple CRUD, well-defined
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9, 10)
  - **Blocks**: Task 19
  - **Blocked By**: Task 4

  **Acceptance Criteria**:
  - [ ] GET /api/canned-responses → 200, returns seeded responses
  - [ ] POST → 201, new response created
  - [ ] PUT → 200, updated
  - [ ] DELETE → 204
  - [ ] Duplicate shortCode → 409

  ```
  Scenario: Canned response CRUD
    Tool: Bash (curl)
    Preconditions: Server running, authenticated
    Steps:
      1. GET /api/canned-responses → 200, count >= 5 (seeded)
      2. POST with {"title":"Greeting","content":"Hello!","shortCode":"greet"} → 201
      3. PUT /{id} with {"title":"Updated"} → 200
      4. DELETE /{id} → 204
      5. GET → count = original count
    Expected Result: Full CRUD cycle works
    Evidence: .sisyphus/evidence/task-11-canned-crud.txt
  ```

  **Commit**: YES
  - Message: `feat: canned responses crud api`
  - Files: `customer-server/src/.../controller/CannedResponseController.java`, `customer-server/src/.../service/CannedResponseService.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 12. WebSocket STOMP Config + JWT Channel Interceptor

  **What to do**:
  - Create `WebSocketConfig implements WebSocketMessageBrokerConfigurer`:
    - `registerStompEndpoints()`: endpoint `/ws` with allowed origins (localhost:3000, configurable)
    - `configureMessageBroker()`: simple broker for `/topic` and `/queue`, app destination prefix `/app`
  - Create `WebSocketAuthInterceptor implements ChannelInterceptor`:
    - On STOMP CONNECT frame: extract JWT from native header `Authorization: Bearer {token}`
    - Validate token -> set Principal on StompHeaderAccessor
    - Invalid/missing token -> throw MessageDeliveryException (connection rejected)
    - For visitor connections: accept token from `visitor-token` native header (UUID, no JWT validation)
  - Create `WebSocketEventListener` handling:
    - `SessionConnectedEvent`: log connection, update agent presence in Redis
    - `SessionDisconnectEvent`: log disconnect, update agent presence in Redis
  - Integration tests with WebSocketStompClient:
    - Connect with valid JWT -> success
    - Connect without token -> rejected
    - Connect as visitor with visitor-token -> success

  **Must NOT do**:
  - No SockJS fallback (G12)
  - No complex topic authorization

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: WebSocket + STOMP + JWT integration is complex
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 13-19)
  - **Blocks**: Tasks 13, 14
  - **Blocked By**: Task 6

  **References**:
  - Spring WebSocket STOMP: https://docs.spring.io/spring-framework/reference/web/websocket/stomp.html

  **Acceptance Criteria**:
  - [ ] STOMP client connects with valid JWT -> connected
  - [ ] STOMP client connects without JWT -> rejected
  - [ ] Visitor connects with visitor-token header -> connected
  - [ ] Agent presence updated in Redis on connect/disconnect

  ```
  Scenario: WebSocket auth with JWT
    Tool: Bash (integration test)
    Preconditions: Server running
    Steps:
      1. cd customer-server && ../mvnw test -Dtest="WebSocketAuthTest"
      2. Test: connect with valid JWT -> assert connected
      3. Test: connect without token -> assert refused
      4. Test: connect with expired JWT -> assert refused
    Expected Result: All auth tests pass
    Evidence: .sisyphus/evidence/task-12-ws-auth.txt

  Scenario: Visitor WebSocket connection
    Tool: Bash (integration test)
    Steps:
      1. cd customer-server && ../mvnw test -Dtest="WebSocketVisitorTest"
      2. Test: connect with visitor-token header -> success
    Expected Result: Visitor can connect and subscribe
    Evidence: .sisyphus/evidence/task-12-ws-visitor.txt
  ```

  **Commit**: YES
  - Message: `feat: websocket stomp config with jwt channel interceptor`
  - Files: `customer-server/src/.../websocket/`, `customer-server/src/.../config/WebSocketConfig.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 13. Real-Time Message Delivery

  **What to do**:
  - Modify `MessageService.sendMessage()` to broadcast after persist:
    1. Persist message to DB (existing from Task 10)
    2. Broadcast via `SimpMessagingTemplate.convertAndSend("/topic/conversation/{id}", messageDTO)`
    3. Also send queue notification: `convertAndSend("/topic/queue", {type: "NEW_MESSAGE", conversationId, preview})`
  - Create `MessageBroadcastService`:
    - `broadcastNewMessage(Message)`: sends to conversation topic
    - `broadcastQueueUpdate(String type, Conversation)`: sends to queue topic
    - Uses Redis pub/sub for cross-instance delivery
  - Integration tests with WebSocketStompClient:
    - Agent subscribes to /topic/conversation/{id}, visitor sends message via REST -> agent receives via WS
    - Visitor subscribes, agent sends -> visitor receives
    - Message received has same fields as REST response

  **Must NOT do**:
  - No Kafka or RabbitMQ
  - No delivery receipts or ACK
  - REST for all mutations, WebSocket only pushes

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Real-time message routing is critical path
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 17, 22
  - **Blocked By**: Tasks 12, 10

  **Acceptance Criteria**:
  - [ ] Visitor sends message via REST -> agent receives via WebSocket within 500ms
  - [ ] Agent sends message via REST -> visitor receives via WebSocket within 500ms
  - [ ] Message persisted in DB BEFORE WebSocket broadcast

  ```
  Scenario: Real-time message delivery
    Tool: Bash (integration test)
    Steps:
      1. cd customer-server && ../mvnw test -Dtest="RealTimeMessageTest"
      2. Agent subscribes to /topic/conversation/{id}
      3. POST message as visitor
      4. Assert: Agent receives message within 2s with correct content
    Expected Result: Message delivered in real-time
    Evidence: .sisyphus/evidence/task-13-realtime.txt

  Scenario: Queue notification on new conversation
    Tool: Bash (integration test)
    Steps:
      1. Agent subscribes to /topic/queue
      2. POST /api/conversations (new conversation)
      3. Assert: Agent receives NEW_CONVERSATION event
    Expected Result: All agents notified
    Evidence: .sisyphus/evidence/task-13-queue-notify.txt
  ```

  **Commit**: YES
  - Message: `feat: real-time message delivery via websocket`
  - Files: `customer-server/src/.../service/MessageBroadcastService.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 14. Queue Updates + Agent Presence + Typing Indicators

  **What to do**:
  - **Queue updates**: Broadcast to `/topic/queue` on conversation state changes:
    - NEW_CONVERSATION, CONVERSATION_TAKEN, CONVERSATION_RESOLVED, CONVERSATION_RETURNED
  - **Agent presence**:
    - `PresenceService`: tracks agent online status in Redis hash `agent:presence`
    - On WebSocket connect: HSET + broadcast to /topic/presence
    - On disconnect: HDEL + broadcast
    - `GET /api/agents/online` -> list of online agents
  - **Typing indicators**:
    - STOMP message to `/app/typing` with {conversationId, isTyping}
    - Server forwards to `/topic/conversation/{id}/typing`
    - Ephemeral only, no persistence
  - Integration tests for each feature

  **Must NOT do**:
  - No complex presence states (just online/offline)
  - No notification preferences (G5)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multiple real-time features coordinated together
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 24, 26
  - **Blocked By**: Tasks 12, 9

  **Acceptance Criteria**:
  - [ ] Agent assigns conversation -> all agents on /topic/queue receive CONVERSATION_TAKEN
  - [ ] Agent connects -> /topic/presence shows online
  - [ ] Agent disconnects -> shows offline
  - [ ] Typing indicator forwarded between participants

  ```
  Scenario: Queue real-time updates
    Tool: Bash (integration test)
    Steps:
      1. Agent1 subscribes to /topic/queue
      2. Visitor creates conversation -> Agent1 receives NEW_CONVERSATION
      3. Agent2 assigns -> Agent1 receives CONVERSATION_TAKEN
    Expected Result: Queue events broadcast correctly
    Evidence: .sisyphus/evidence/task-14-queue-updates.txt

  Scenario: Typing indicator
    Tool: Bash (integration test)
    Steps:
      1. Agent subscribes to /topic/conversation/{id}/typing
      2. Visitor sends typing event
      3. Assert: Agent receives typing notification
    Expected Result: Typing indicator forwarded
    Evidence: .sisyphus/evidence/task-14-typing.txt
  ```

  **Commit**: YES
  - Message: `feat: queue updates agent presence typing indicators`
  - Files: `customer-server/src/.../service/PresenceService.java`, `customer-server/src/.../websocket/`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 15. Dashboard Login Page + Auth Context

  **What to do**:
  - Create agent login page at `/dashboard/login`:
    - Email + password form (Ant Design Form, Input, Button)
    - Validation, error display, redirect on success
  - Create `AuthContext` (React Context + Provider):
    - State: user, tokens, isAuthenticated, isLoading
    - Actions: login, logout, refreshToken
    - Token storage: localStorage
    - Auto-refresh: 401 interceptor -> refresh -> retry
  - Create `AuthGuard` component wrapping dashboard routes
  - Create `useAuth()` hook
  - Ant Design ConfigProvider setup

  **Must NOT do**:
  - No social login, registration, password reset

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Login page UI + auth state management
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 2, 7

  **Acceptance Criteria**:
  - [ ] Login page renders at /dashboard/login
  - [ ] Valid credentials -> redirects to /dashboard
  - [ ] Invalid credentials -> error message
  - [ ] Refresh page while authenticated -> stays logged in

  ```
  Scenario: Agent login flow
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3000/dashboard
      2. Assert redirected to /dashboard/login
      3. Fill email "agent@test.com", password "test123"
      4. Click login button
      5. Assert URL is /dashboard
    Expected Result: Successful login
    Evidence: .sisyphus/evidence/task-15-login.png

  Scenario: Invalid credentials
    Tool: Playwright
    Steps:
      1. Fill email "agent@test.com", password "wrongpass"
      2. Click login
      3. Assert error message visible
    Expected Result: Error shown, stays on login
    Evidence: .sisyphus/evidence/task-15-login-error.png
  ```

  **Commit**: YES
  - Message: `feat: dashboard login page with auth context`
  - Files: `customer-webapp/src/app/(dashboard)/dashboard/login/`, `customer-webapp/src/contexts/AuthContext.tsx`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 16. Dashboard Layout + Conversation Queue View

  **What to do**:
  - Dashboard layout: left sidebar (logo, nav, online agents, user info, logout), main content area
  - WebSocket provider (React Context): connect to /ws with JWT, auto-reconnect (exponential backoff), connection status indicator
  - Conversation Queue page:
    - Fetch WAITING conversations via GET /api/conversations?status=WAITING
    - List: visitor name, message preview (100 chars), wait time, "Take Over" button
    - Real-time: subscribe to /topic/queue -> add/remove as events arrive
    - Empty state: "No conversations waiting"
    - Badge in sidebar nav

  **Must NOT do**:
  - No analytics/charts (G3)
  - No search/filter beyond status (G2)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dashboard layout + real-time queue UI
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 15, 5

  **Acceptance Criteria**:
  - [ ] Queue shows waiting conversations
  - [ ] "Take Over" assigns and navigates to chat
  - [ ] New conversation appears in real-time
  - [ ] Taken conversation disappears in real-time

  ```
  Scenario: Queue and takeover
    Tool: Playwright
    Steps:
      1. Login, navigate to /dashboard
      2. Assert: waiting conversations displayed
      3. Click "Take Over" on first
      4. Assert: navigated to chat view, status ACTIVE
    Expected Result: Queue works, takeover navigates to chat
    Evidence: .sisyphus/evidence/task-16-queue.png

  Scenario: Real-time queue update
    Tool: Playwright
    Steps:
      1. Agent viewing queue with 2 conversations
      2. Create new conversation via curl
      3. Assert: 3rd conversation appears without refresh
    Expected Result: Real-time update via WebSocket
    Evidence: .sisyphus/evidence/task-16-realtime.png
  ```

  **Commit**: YES
  - Message: `feat: dashboard layout and conversation queue view`
  - Files: `customer-webapp/src/app/(dashboard)/dashboard/`, `customer-webapp/src/contexts/WebSocketContext.tsx`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 17. Dashboard Chat Panel

  **What to do**:
  - ChatPanel component:
    - Messages sorted by sequence_number, visitor left / agent right (bubble style)
    - Auto-scroll on new message, load older on scroll up (cursor pagination)
  - Message input: TextArea, Enter to send, Shift+Enter newline, 5000 char limit, disabled when RESOLVED
  - Real-time: subscribe /topic/conversation/{id}, optimistic UI with client UUID dedup
  - Typing indicator: subscribe /topic/conversation/{id}/typing, show "Visitor is typing..."
  - Header: visitor name, email, status, "Resolve" and "Return to Queue" buttons

  **Must NOT do**:
  - No file attachments (G9), no markdown, no link previews

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Core chat UI component
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 16, 13

  **Acceptance Criteria**:
  - [ ] Messages displayed in order
  - [ ] Agent sends -> appears immediately (optimistic)
  - [ ] Visitor sends -> appears in real-time
  - [ ] Resolve -> input disabled
  - [ ] Typing indicator works

  ```
  Scenario: Real-time chat
    Tool: Playwright
    Steps:
      1. Agent opens active conversation
      2. Type "Hello" and press Enter
      3. Assert: message appears right-aligned
      4. (Simulate visitor message via API)
      5. Assert: visitor message appears left-aligned
    Expected Result: Bidirectional real-time chat
    Evidence: .sisyphus/evidence/task-17-chat.png

  Scenario: Resolve conversation
    Tool: Playwright
    Steps:
      1. Click "Resolve" button
      2. Assert: status = RESOLVED, input disabled
    Expected Result: Conversation resolved
    Evidence: .sisyphus/evidence/task-17-resolve.png
  ```

  **Commit**: YES
  - Message: `feat: dashboard chat panel with real-time messaging`
  - Files: `customer-webapp/src/app/(dashboard)/dashboard/components/ChatPanel/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 18. Active Conversations Sidebar + Unread + Switching

  **What to do**:
  - "My Conversations" sidebar: agent's ACTIVE conversations list
  - Each item: visitor name, last message preview, unread badge, time
  - Click to switch chat panel content
  - Unread tracking (client-side): track last seen sequence per conversation
  - Browser notifications for new messages in non-focused conversations
  - Draft preservation per conversation when switching

  **Must NOT do**:
  - No sound notifications (G5)
  - No notification settings

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Sidebar UI with real-time state
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 19
  - **Blocked By**: Task 17

  **Acceptance Criteria**:
  - [ ] Active conversations listed
  - [ ] Unread badge on non-active conversation with new message
  - [ ] Click switches chat panel
  - [ ] Draft preserved across switches

  ```
  Scenario: Multi-chat switching
    Tool: Playwright
    Steps:
      1. Agent has 3 active conversations
      2. Visitor in conv B sends message
      3. Assert: conv B shows unread badge
      4. Click conv B
      5. Assert: badge disappears, messages shown
      6. Type draft, switch to conv A, switch back
      7. Assert: draft preserved
    Expected Result: Multi-chat with unread and draft preservation
    Evidence: .sisyphus/evidence/task-18-multichat.png
  ```

  **Commit**: YES
  - Message: `feat: active conversations sidebar with unread indicators`
  - Files: `customer-webapp/src/app/(dashboard)/dashboard/components/Sidebar/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 19. Dashboard Canned Responses UI

  **What to do**:
  - `/` trigger in chat input -> show canned response dropdown
  - Filter by shortCode as agent types
  - Select inserts content into input
  - Management page: table view, add/edit/delete via modals
  - Fetch from /api/canned-responses

  **Must NOT do**:
  - No categories, variable interpolation (G4)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with keyboard interaction
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 18, 11

  **Acceptance Criteria**:
  - [ ] Type `/` -> dropdown appears
  - [ ] Filter works by shortCode prefix
  - [ ] Select inserts content
  - [ ] CRUD management works

  ```
  Scenario: Canned response insertion
    Tool: Playwright
    Steps:
      1. In chat input, type "/"
      2. Assert: dropdown appears
      3. Type "greet"
      4. Assert: filtered results
      5. Click response
      6. Assert: content inserted in input
    Expected Result: Slash shortcut works
    Evidence: .sisyphus/evidence/task-19-canned.png
  ```

  **Commit**: YES
  - Message: `feat: canned responses ui with slash shortcut`
  - Files: `customer-webapp/src/app/(dashboard)/dashboard/components/CannedResponses/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 20. Widget Iframe Loader + Standalone Widget Route

  **What to do**:
  - Create `customer-webapp/public/widget-loader.js`: lightweight script (~2KB) that creates iframe pointing to `/widget`, positions as floating button (bottom-right), click to expand, PostMessage API for host page communication
  - Create `/widget` route in Next.js: standalone layout (no dashboard chrome), PostMessage listener
  - Widget states: collapsed (button only), expanded (chat panel)
  - Usage: `<script src="https://your-domain/widget-loader.js" data-server="http://localhost:3000"></script>`

  **Must NOT do**: No theming/customization API (G8)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: Task 21 | **Blocked By**: Task 2

  **Acceptance Criteria**:
  - [ ] Widget loader creates iframe
  - [ ] Click expands chat panel
  - [ ] Widget route renders standalone

  ```
  Scenario: Widget loads on external page
    Tool: Playwright
    Steps:
      1. Create test HTML with widget-loader.js
      2. Assert: floating button visible (bottom-right)
      3. Click button -> iframe expands
    Expected Result: Widget loads and expands
    Evidence: .sisyphus/evidence/task-20-widget-load.png
  ```

  **Commit**: YES
  - Message: `feat: widget iframe loader and standalone route`
  - Files: `customer-webapp/public/widget-loader.js`, `customer-webapp/src/app/(widget)/widget/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 21. Widget Pre-Chat Form + Conversation Creation

  **What to do**:
  - Pre-chat form: name (required) + email (required), "Start Chat" button
  - Generate UUID visitor token -> localStorage
  - POST /api/conversations -> transition to chat
  - Returning visitor: check localStorage token, fetch existing conversations, skip form if open conv exists

  **Must NOT do**: No CAPTCHA, no custom fields

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: Task 22 | **Blocked By**: Tasks 20, 9

  **Acceptance Criteria**:
  - [ ] Form validates and creates conversation
  - [ ] Returning visitor skips form
  - [ ] Visitor token in localStorage

  ```
  Scenario: New visitor starts chat
    Tool: Playwright
    Steps:
      1. Open widget, fill name "John" + email "john@test.com"
      2. Click "Start Chat"
      3. Assert: chat view appears
    Expected Result: Conversation created
    Evidence: .sisyphus/evidence/task-21-prechat.png
  ```

  **Commit**: YES
  - Message: `feat: widget pre-chat form and conversation creation`
  - Files: `customer-webapp/src/app/(widget)/widget/components/PreChatForm/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 22. Widget Real-Time Chat

  **What to do**:
  - Connect WebSocket with visitor-token, subscribe to /topic/conversation/{id}
  - Messages: visitor right, agent left (bubble style)
  - Send: POST /api/conversations/{id}/messages, optimistic UI with client UUID
  - Typing indicator: send/receive via /app/typing and /topic/conversation/{id}/typing
  - Status display: WAITING "Waiting for agent...", ACTIVE "Connected with {name}", RESOLVED "Conversation resolved" + disabled input

  **Must NOT do**: No file attachments (G9), no markdown

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: Task 23 | **Blocked By**: Tasks 21, 13

  **Acceptance Criteria**:
  - [ ] Real-time messaging works bidirectionally
  - [ ] Status transitions displayed correctly
  - [ ] Typing indicator works

  ```
  Scenario: Widget real-time chat
    Tool: Playwright
    Steps:
      1. Visitor starts chat, sees "Waiting for agent..."
      2. (Agent takes over via API)
      3. Assert: "Connected with {name}"
      4. Send message -> appears right-aligned
      5. (Agent sends via API) -> appears left-aligned
    Expected Result: Full chat flow
    Evidence: .sisyphus/evidence/task-22-widget-chat.png
  ```

  **Commit**: YES
  - Message: `feat: widget real-time chat with typing indicators`
  - Files: `customer-webapp/src/app/(widget)/widget/components/Chat/`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 23. Widget Reconnection + Message Recovery

  **What to do**:
  - Reconnect on disconnect: exponential backoff (1s, 2s, 4s, max 30s)
  - "Connection lost. Reconnecting..." banner
  - On reconnect: GET /api/conversations/{id}/messages?afterSequence={last} -> merge
  - Tab visibility: verify WS connection when tab becomes visible
  - States: CONNECTING, CONNECTED, DISCONNECTED, RECONNECTING

  **Must NOT do**: No offline message queue

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: None | **Blocked By**: Task 22

  **Acceptance Criteria**:
  - [ ] Reconnects after server restart
  - [ ] Missed messages recovered
  - [ ] No duplicates after reconnect

  ```
  Scenario: Reconnection and recovery
    Tool: Playwright + Bash
    Steps:
      1. Active chat in widget
      2. Kill server WS
      3. Assert: "Connection lost" banner
      4. (Send 2 agent messages)
      5. Restore connection
      6. Assert: 2 messages appear, no duplicates
    Expected Result: Recovery works
    Evidence: .sisyphus/evidence/task-23-reconnect.png
  ```

  **Commit**: YES
  - Message: `feat: widget reconnection and message recovery`
  - Files: `customer-webapp/src/hooks/useWebSocketReconnect.ts`
  - Pre-commit: `cd customer-webapp && npm run build`

- [ ] 24. Agent Disconnect Auto-Return Conversations to Queue

  **What to do**:
  - `AgentHeartbeatService`: on WS disconnect, start 60s timer; if not reconnected, return all ACTIVE conversations to WAITING
  - Broadcast CONVERSATION_RETURNED + SYSTEM message "Agent disconnected"
  - Redis tracking: `SET agent:session:{agentId} {sessionId} EX 90`
  - Scheduled safety net: every 30s check for stale agents

  **Must NOT do**: No conversation transfer (G6), no "away" status

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: None | **Blocked By**: Task 14

  **Acceptance Criteria**:
  - [ ] Agent offline > 60s -> conversations returned to WAITING
  - [ ] Agent reconnects < 60s -> conversations stay ACTIVE

  ```
  Scenario: Auto-return after disconnect
    Tool: Bash (integration test)
    Steps:
      1. Agent has 2 ACTIVE conversations
      2. Agent disconnects, wait 65s
      3. Assert: both conversations WAITING, agentId null
    Expected Result: Auto-return works
    Evidence: .sisyphus/evidence/task-24-auto-return.txt
  ```

  **Commit**: YES
  - Message: `feat: agent disconnect auto-return conversations`
  - Files: `customer-server/src/.../service/AgentHeartbeatService.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 25. Rate Limiting

  **What to do**:
  - `RateLimitFilter`: conversation creation 5/IP/min, message sending 10/user/min
  - 429 Too Many Requests with Retry-After header
  - Caffeine cache for in-memory rate tracking

  **Must NOT do**: No CAPTCHA, no IP blacklisting

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: None | **Blocked By**: Tasks 9, 10

  **Acceptance Criteria**:
  - [ ] 6th conversation creation in 1 min -> 429
  - [ ] 11th message in 1 min -> 429
  - [ ] Retry-After header present

  ```
  Scenario: Rate limit enforcement
    Tool: Bash (curl loop)
    Steps:
      1. Send 6 POST /api/conversations
      2. Assert: 5 return 201, 6th returns 429
    Expected Result: Rate limit enforced
    Evidence: .sisyphus/evidence/task-25-rate-limit.txt
  ```

  **Commit**: YES
  - Message: `feat: rate limiting for conversations and messages`
  - Files: `customer-server/src/.../filter/RateLimitFilter.java`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 26. Edge Cases

  **What to do**:
  - Double takeover: strengthen optimistic lock, frontend handles 409 with notification
  - Long messages: server @Size(max=5000), frontend char counter
  - Stale queue: always fetch via REST on reconnect before WS subscription
  - Empty conversations: cleanup job for 0-message convs > 5 min old
  - Message to RESOLVED: return 400

  **Must NOT do**: No retry queues

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES | Wave 4 | **Blocks**: None | **Blocked By**: Tasks 9, 14

  **Acceptance Criteria**:
  - [ ] Concurrent takeover: one 200, one 409
  - [ ] Message > 5000 chars -> 400
  - [ ] Message to RESOLVED -> 400

  ```
  Scenario: Double takeover
    Tool: Bash (parallel curl)
    Steps:
      1. Create WAITING conversation
      2. Send 2 concurrent assign requests
      3. Assert: one 200, one 409
    Expected Result: Exactly one succeeds
    Evidence: .sisyphus/evidence/task-26-double-takeover.txt
  ```

  **Commit**: YES
  - Message: `fix: edge cases double-takeover long-messages stale-queue`
  - Files: `customer-server/src/.../service/`, `customer-webapp/src/`
  - Pre-commit: `cd customer-server && ../mvnw clean verify`

- [ ] 27. Maven Multi-Module Build & Packaging Infrastructure

  **What to do**:
  - Create root `pom.xml` (packaging=pom) as Maven parent:
    - `groupId`: com.opencustomer
    - `artifactId`: open-customer-system
    - `version`: 1.0.0-SNAPSHOT
    - `<modules>`: `customer-server` (only module managed by Maven; customer-webapp is built via frontend-maven-plugin)
    - Properties: java.version=17, spring-boot.version, frontend-maven-plugin.version=1.12.1, node.version=v18.x.x
    - PluginManagement: spring-boot-maven-plugin, maven-compiler-plugin, maven-assembly-plugin
  - Create `build.sh` in project root:
    - Parse optional flags: `--skipTests`, `--webapp` (include frontend build), `--dist` (produce tar.gz)
    - Default command: `./mvnw -Pwebapp,dist -DskipTests clean install`
    - Check JAVA_HOME and Java version ≥ 17
    - Print build start/end time and result summary
    - Make executable: `chmod +x build.sh`
  - Add Maven profiles to `customer-server/pom.xml`:
    - Profile `webapp` (activated by `-Pwebapp`):
      - `frontend-maven-plugin` (com.github.eirslett:frontend-maven-plugin:1.12.1)
      - Phase: `generate-resources`
      - `installDirectory`: `${project.basedir}/../customer-webapp`
      - Executions: install-node-and-npm → npm install → npm run build
      - `maven-resources-plugin` to copy `customer-webapp/.next/` or `customer-webapp/out/` (Next.js static export) to `customer-server/src/main/resources/static/`
    - Profile `dist` (activated by `-Pdist`):
      - `maven-assembly-plugin` with custom descriptor `src/main/assembly/assembly.xml`
      - `finalName`: open-customer-system-${project.version}
      - Output: `dist/open-customer-system-${project.version}-bin.tar.gz`
  - Create `customer-server/src/main/assembly/assembly.xml`:
    - Format: tar.gz
    - Include: `bin/` (scripts), `conf/` (config templates), `lib/` (all dependency JARs + main JAR), `logs/` (empty), `temp/` (empty)
    - FileSet: `src/main/assembly/bin/` → `bin/` with fileMode 0755
    - FileSet: `src/main/assembly/conf/` → `conf/`
    - DependencySets: scope=runtime → `lib/`
  - Create `customer-server/src/main/assembly/bin/startup.sh`:
    - Detect JAVA_HOME, validate Java version
    - Set JVM args: -Xms256m -Xmx512m -XX:+UseG1GC
    - Start Spring Boot: `nohup java $JVM_ARGS -jar lib/open-customer-system-*.jar --spring.config.additional-location=conf/ > logs/stdout.log 2>&1 &`
    - Write PID to `logs/app.pid`
    - Print startup info
  - Create `customer-server/src/main/assembly/bin/shutdown.sh`:
    - Read PID from `logs/app.pid`
    - Graceful shutdown: `kill $PID`, wait 30s, then `kill -9` if still running
    - Clean up PID file
  - Create `customer-server/src/main/assembly/conf/application-prod.yml`:
    - Externalized config template with placeholders:
      - `server.port`: 8080
      - `spring.datasource.url`: jdbc:mysql://localhost:3306/customer_service
      - `spring.datasource.username`: ${DB_USER:root}
      - `spring.datasource.password`: ${DB_PASSWORD:}
      - `spring.data.redis.host`: ${REDIS_HOST:localhost}
      - `app.jwt.secret`: ${JWT_SECRET:change-me-in-production}
      - `app.jwt.expiration`: 3600000
  - Create `.mvn/wrapper/` directory with Maven Wrapper files at project root level
  - Update `customer-server/pom.xml` `<parent>` to reference root pom.xml

  **Must NOT do**:
  - No Gradle — Maven only
  - No Turborepo or pnpm workspaces
  - No custom Maven plugins — use only standard and frontend-maven-plugin
  - No multi-environment config (only `default` and `prod` profiles)
  - No Docker image building (just tar.gz distribution)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Boilerplate Maven config and shell scripts, well-defined structure from StreamPark reference
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None — this is pure build tooling configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4, 5)
  - **Blocks**: Final build verification
  - **Blocked By**: None (can start immediately, but Task 1 must complete before `webapp` profile can be fully tested)

  **References**:

  **Pattern References** (existing code to follow):
  - StreamPark `build.sh`: `/Users/songjiayin/Leibaoxin/code/incubator-streampark/build.sh` — build script structure, flag parsing, Maven invocation pattern
  - StreamPark root `pom.xml`: `/Users/songjiayin/Leibaoxin/code/incubator-streampark/pom.xml` — multi-module parent POM structure, profile definitions
  - StreamPark service `pom.xml`: `/Users/songjiayin/Leibaoxin/code/incubator-streampark/streampark-console/streampark-console-service/pom.xml` — frontend-maven-plugin config, assembly plugin config, webapp/dist profiles
  - StreamPark `assembly.xml`: `/Users/songjiayin/Leibaoxin/code/incubator-streampark/streampark-console/streampark-console-service/src/main/assembly/assembly.xml` — distribution package descriptor
  - StreamPark `bin/` scripts: `/Users/songjiayin/Leibaoxin/code/incubator-streampark/streampark-console/streampark-console-service/src/main/assembly/bin/` — startup.sh, shutdown.sh patterns

  **External References**:
  - frontend-maven-plugin: https://github.com/eirslett/frontend-maven-plugin
  - maven-assembly-plugin: https://maven.apache.org/plugins/maven-assembly-plugin/

  **WHY Each Reference Matters**:
  - StreamPark files provide the EXACT pattern to replicate: how frontend-maven-plugin integrates npm build into Maven lifecycle, how assembly.xml defines the dist structure, and how bin scripts manage the Java process. Copy the structure, adapt names and paths.

  **Acceptance Criteria**:
  - [ ] Root `pom.xml` exists with correct modules, properties, and profile definitions
  - [ ] `build.sh` exists, is executable, and prints usage when run with `--help`
  - [ ] `customer-server/pom.xml` has `webapp` and `dist` profiles defined
  - [ ] `assembly.xml` defines tar.gz format with bin/conf/lib/logs/temp structure
  - [ ] `startup.sh` and `shutdown.sh` exist in assembly bin/ directory
  - [ ] `application-prod.yml` exists with externalized config placeholders
  - [ ] `.mvn/wrapper/` exists at project root

  ```
  Scenario: Root pom.xml is valid Maven project
    Tool: Bash
    Preconditions: JDK 17+ and Maven installed
    Steps:
      1. ./mvnw validate -N (non-recursive, root only)
      2. Assert exit code = 0
    Expected Result: BUILD SUCCESS
    Failure Indicators: "Non-resolvable parent POM" or XML parse error
    Evidence: .sisyphus/evidence/task-27-root-pom-validate.txt

  Scenario: build.sh is executable and shows help
    Tool: Bash
    Preconditions: build.sh exists at project root
    Steps:
      1. ls -la build.sh (verify executable permission)
      2. ./build.sh --help
      3. Assert output contains usage instructions
    Expected Result: Help text printed, exit code 0
    Failure Indicators: "Permission denied" or no output
    Evidence: .sisyphus/evidence/task-27-build-help.txt

  Scenario: Assembly descriptor is valid XML
    Tool: Bash
    Preconditions: assembly.xml exists
    Steps:
      1. xmllint --noout customer-server/src/main/assembly/assembly.xml || python3 -c "import xml.etree.ElementTree as ET; ET.parse('customer-server/src/main/assembly/assembly.xml'); print('VALID')"
      2. Assert output = VALID or no errors
    Expected Result: XML is well-formed
    Failure Indicators: "parser error" or "ParseError"
    Evidence: .sisyphus/evidence/task-27-assembly-xml.txt

  Scenario: Full build produces dist tar.gz (integration — run AFTER Tasks 1+2 complete)
    Tool: Bash
    Preconditions: Tasks 1 and 2 complete (Spring Boot + Next.js scaffolded), Docker services running
    Steps:
      1. ./build.sh
      2. ls dist/*.tar.gz
      3. Assert tar.gz file exists
      4. tar -tzf dist/*.tar.gz | head -20
      5. Assert output contains bin/startup.sh, conf/application-prod.yml, lib/
    Expected Result: tar.gz contains bin/ conf/ lib/ directories with expected files
    Failure Indicators: "BUILD FAILURE" or missing directories in archive
    Evidence: .sisyphus/evidence/task-27-full-build.txt
  ```

  **Commit**: YES
  - Message: `build: maven multi-module + build.sh + assembly packaging`
  - Files: `pom.xml`, `build.sh`, `.mvn/`, `customer-server/src/main/assembly/`
  - Pre-commit: `./mvnw validate -N`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `./mvnw clean verify` + `npm run build` + `npm run lint`. Review all changed files for: `@SuppressWarnings`, empty catches, `System.out.println` in prod, commented-out code, unused imports, `any` type in TypeScript. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state (`docker-compose down -v && docker-compose up -d`). Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: full user→agent chat flow end-to-end. Test edge cases: double takeover, agent disconnect, widget reconnection. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check all "Must NOT do" guardrails (G1-G13). Detect unaccounted files. Flag any admin panel, analytics, file upload, i18n, or other excluded scope.
  Output: `Tasks [N/N compliant] | Guardrails [N/N clean] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Phase | Commit | Message | Key Files |
|-------|--------|---------|-----------|
| 0 | T1 | `init: spring boot project scaffolding` | customer-server/pom.xml, application.yml |
| 0 | T2 | `init: next.js project scaffolding` | customer-webapp/package.json, next.config.js |
| 0 | T3 | `infra: docker-compose mysql + redis` | docker-compose.yml, .env.example |
| 0 | T4 | `schema: flyway migrations and seed data` | customer-server/src/main/resources/db/migration/ |
| 0 | T5 | `types: shared typescript type definitions` | customer-webapp/src/types/ |
| 0 | T27 | `build: maven multi-module + build.sh + assembly packaging` | pom.xml, build.sh, .mvn/, customer-server/src/main/assembly/ |
| 1 | T6 | `feat: jwt token service + spring security` | customer-server/src/.../security/ |
| 1 | T7 | `feat: auth rest endpoints` | customer-server/src/.../controller/AuthController.java |
| 1 | T8 | `feat: conversation state machine` | customer-server/src/.../entity/Conversation.java |
| 1 | T9 | `feat: conversation rest api` | customer-server/src/.../controller/ConversationController.java |
| 1 | T10 | `feat: message rest api with dedup` | customer-server/src/.../controller/MessageController.java |
| 1 | T11 | `feat: canned responses crud api` | customer-server/src/.../controller/CannedResponseController.java |
| 2 | T12 | `feat: websocket stomp + jwt interceptor` | customer-server/src/.../config/WebSocketConfig.java |
| 2 | T13 | `feat: real-time message delivery` | customer-server/src/.../service/MessageBroadcastService.java |
| 2 | T14 | `feat: queue updates + presence + typing` | customer-server/src/.../service/PresenceService.java |
| 2 | T15 | `feat: dashboard login + auth context` | customer-webapp/src/app/dashboard/login/ |
| 2 | T16 | `feat: dashboard layout + queue view` | customer-webapp/src/app/dashboard/ |
| 2 | T17 | `feat: dashboard chat panel` | customer-webapp/src/app/dashboard/components/ChatPanel/ |
| 2 | T18 | `feat: active conversations sidebar` | customer-webapp/src/app/dashboard/components/Sidebar/ |
| 2 | T19 | `feat: canned responses ui` | customer-webapp/src/app/dashboard/components/CannedResponses/ |
| 3 | T20 | `feat: widget iframe loader` | customer-webapp/public/widget-loader.js, customer-webapp/src/app/widget/ |
| 3 | T21 | `feat: widget pre-chat form` | customer-webapp/src/app/widget/components/PreChatForm/ |
| 3 | T22 | `feat: widget real-time chat` | customer-webapp/src/app/widget/components/Chat/ |
| 3 | T23 | `feat: widget reconnection + sync` | customer-webapp/src/hooks/useWebSocketReconnect.ts |
| 3 | T24 | `feat: agent disconnect auto-return` | customer-server/src/.../service/AgentHeartbeatService.java |
| 3 | T25 | `feat: rate limiting` | customer-server/src/.../filter/RateLimitFilter.java |
| 3 | T26 | `fix: edge cases` | customer-server/src/.../service/ |

---

## Success Criteria

### Verification Commands
```bash
# Backend builds and tests pass
cd customer-server && ../mvnw clean verify  # Expected: BUILD SUCCESS

# Frontend builds successfully
cd customer-webapp && npm run build  # Expected: exit code 0

# Full build produces distribution package
./build.sh  # Expected: dist/ directory with tar.gz
tar -tzf dist/*.tar.gz | grep -E "bin/|conf/|lib/"  # Expected: bin/ conf/ lib/ present

# Docker services running
docker-compose up -d && docker-compose ps  # Expected: mysql + redis Up

# Auth works
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@test.com","password":"test123"}' | jq '.accessToken'
# Expected: non-null JWT string

# Conversation creation works
curl -s -X POST http://localhost:8080/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"visitorName":"John","visitorEmail":"john@test.com","initialMessage":"Help"}' | jq '.status'
# Expected: "WAITING"

# Agent takeover works
curl -s -X PUT http://localhost:8080/api/conversations/1/assign \
  -H "Authorization: Bearer {token}" | jq '.status'
# Expected: "ACTIVE"
```

### Final Checklist
- [ ] All "Must Have" requirements implemented and verified
- [ ] All "Must NOT Have" guardrails (G1-G13) respected
- [ ] All backend tests pass (`cd customer-server && ../mvnw clean verify`)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] `./build.sh` produces valid tar.gz with bin/conf/lib/logs/temp structure
- [ ] End-to-end chat flow works (widget → queue → takeover → chat → resolve)
- [ ] WebSocket reconnection recovers state
- [ ] Agent can handle 3+ simultaneous conversations
- [ ] Double takeover returns 409 Conflict
