# Draft: Customer Service System (open-customer-system)

## Project State
- **Current state**: Blank slate, only .gitignore (Java-oriented), LICENSE, README
- **No existing code**: No package.json, pom.xml, go.mod, or any source files
- **Git**: 1 commit ("Initial commit"), clean working tree
- **README**: "Open-source customer service system"

## User Requirements (confirmed)
- User-facing frontend: customer chat interface (click to contact support)
- Agent-facing admin panel: receive messages, take over conversations
- Full workflow: user initiates -> queued -> agent accepts/takes over -> real-time chat -> resolution

## Research Findings

### Core Feature Modules Needed
**User-side (Critical)**:
- Chat widget (embeddable, customizable)
- Message history (persistent across sessions)
- Pre-chat form (collect name/email)
- Typing indicators, read receipts
- File upload, offline messages

**Agent-side (Critical)**:
- Conversation queue (unassigned conversations)
- Takeover/assign mechanism
- Multi-chat handling (3-6 simultaneous)
- Customer info sidebar
- Canned responses
- Conversation status (open/pending/resolved)

**Admin (High)**:
- Agent management (roles, availability)
- Routing rules (round-robin, skill-based)
- Analytics/reports (volume, response times, CSAT)

**System (Critical)**:
- WebSocket for real-time messaging
- Message persistence (PostgreSQL)
- Presence tracking (Redis)
- Notification system

### Architecture References
- Chatwoot: Rails + Vue.js + PostgreSQL + Redis + ActionCable
- Papercups: Elixir/Phoenix + React + PostgreSQL
- Rocket.Chat: Node.js/Meteor + MongoDB + React
- Production pattern: WebSocket + Redis pub/sub + PostgreSQL

### Key Schema Pattern
```
accounts -> users (agents)
         -> contacts (customers)
         -> conversations -> messages
         -> inboxes
         -> canned_responses
```

## Technical Decisions (CONFIRMED)
- **Backend**: Java + Spring Boot (WebSocket via Spring WebSocket/STOMP)
- **Frontend**: React + Next.js (user widget + agent dashboard)
- **Project structure**: Monorepo Maven multi-module (参考 StreamPark 模式)
- **Directory naming**: `customer-server` (后端), `customer-webapp` (前端)
- **Scope**: MVP core flow (user chat -> queue -> agent takeover -> real-time chat -> resolve)
- **Multi-tenancy**: Single company self-use (no multi-tenant isolation needed)
- **Database**: OceanBase (primary, MySQL-compatible) + Redis (presence, session, pub/sub)
- **Real-time**: WebSocket (Spring WebSocket + STOMP for backend, native WS/SockJS for frontend)
- **Auth**: JWT + Spring Security (stateless, refresh token)
- **Test strategy**: Tests-after (implement first, add tests after core features stable)
- **Agent QA**: ALWAYS (mandatory for all tasks regardless of test choice)
- **Build & Packaging**: Maven multi-module + frontend-maven-plugin + maven-assembly-plugin
  - 参考 StreamPark 模式: build.sh -> mvnw -Pwebapp,dist -> dist/ 产出 tar.gz
  - frontend-maven-plugin 在 Maven generate-resources 阶段执行 npm install + build
  - maven-resources-plugin 将前端 dist/ 拷贝到 resources/static/
  - maven-assembly-plugin 按 assembly.xml 描述符生成最终分发包
  - 最终产出结构: bin/ conf/ lib/ logs/ temp/

## StreamPark Build Pattern Reference
- **build.sh**: 入口脚本, 执行 `mvnw -Pwebapp,dist -DskipTests clean install`
- **frontend-maven-plugin**: 在 console-service pom.xml 中通过 webapp profile 激活
  - install-node-and-pnpm -> pnpm install -> pnpm run build
  - 构建产物从 webapp/dist/ 拷贝到 service/src/main/resources/static/
- **maven-assembly-plugin**: 自定义 assembly.xml 定义 dist 包结构
- **启动脚本**: startup.sh -> main.sh (检测 Java, 设置 JVM 参数, 启动 Spring Boot)
- **配置外置**: conf/config.yaml (不打进 JAR, 运行时加载)

## Open Questions (RESOLVED)
- Database: OceanBase + Redis (confirmed)
- Auth: JWT + Spring Security (confirmed)
- Test strategy: Tests-after (confirmed)

## Test Strategy Decision
- **Infrastructure exists**: NO
- **Automated tests**: YES (tests-after)
- **Framework**: JUnit 5 + Spring Boot Test (backend), Jest/Vitest (frontend)
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

## Scope Boundaries
- INCLUDE: User chat widget, agent dashboard, real-time messaging, conversation queue, agent takeover, basic user/agent management, message persistence
- EXCLUDE: Multi-channel (email/SMS/social), AI chatbot, SLA management, complex analytics, mobile app, multi-tenancy, automation rules, knowledge base
