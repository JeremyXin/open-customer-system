# Open Customer System - MVP 项目文档

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [数据库设计](#4-数据库设计)
5. [Task 实现详解](#5-task-实现详解)
6. [API 接口一览](#6-api-接口一览)
7. [WebSocket 通信协议](#7-websocket-通信协议)
8. [组件与依赖说明](#8-组件与依赖说明)
9. [本地部署指南](#9-本地部署指南)

---

## 1. 项目概述

Open Customer System 是一个 MVP 级别的在线客服系统，支持访客通过嵌入式 Widget 发起实时对话，客服人员在 Dashboard 中接管并回复。系统采用单一 FIFO 队列模型，无多租户、无 AI、无多渠道，专注于核心客服对话流程。

**核心业务流程：**

```
访客打开 Widget → 填写姓名/邮箱 → 创建会话(WAITING)
    → 客服在 Queue 页面看到新会话 → 点击"接管"(ACTIVE)
    → 双方实时聊天(WebSocket) → 客服点击"解决"(RESOLVED)
```

**设计约束（Guardrails）：**

| 编号 | 约束 |
|------|------|
| G1 | 无管理后台 |
| G2 | 单一 FIFO 队列，无路由/优先级/部门 |
| G3 | 无分析报表 |
| G4 | 快捷回复无分类/标签/搜索 |
| G5 | 无通知偏好设置 |
| G6 | 无会话转接 |
| G7 | Dashboard 与 Widget 不共享组件库 |
| G8 | 无国际化，无 Widget 主题定制 |
| G9 | 仅文本消息，无文件附件 |
| G10 | 无额外 JSON 元数据列 |
| G11 | 无 Turborepo/Workspace |
| G12 | 无 SockJS 降级 |
| G13 | Dashboard 与 Widget 不共享组件 |

---

## 2. 技术栈

### 后端

| 组件 | 版本 | 用途 |
|------|------|------|
| Java | 17+ | 运行时 |
| Spring Boot | 3.2.0 | 应用框架 |
| Spring Security | (Boot 管理) | 认证授权 |
| Spring WebSocket | (Boot 管理) | STOMP 实时通信 |
| MyBatis-Plus | 3.5.7 | ORM 持久层 |
| MySQL | 8.0 | 主数据库 |
| Redis | 7 | 会话缓存/在线状态/消息序列号 |
| Flyway | (Boot 管理) | 数据库版本迁移 |
| JJWT | 0.12.3 | JWT Token 生成与验证 |
| Caffeine | 3.1.8 | 内存级限流缓存 |
| Lombok | (Boot 管理) | 减少样板代码 |
| Actuator + Micrometer | (Boot 管理) | 健康检查与 Prometheus 监控 |

### 前端

| 组件 | 版本 | 用途 |
|------|------|------|
| Next.js | 14.2 | React 全栈框架 |
| React | 18.3 | UI 库 |
| TypeScript | 5.4 | 类型安全 |
| Ant Design | 5.20 | Dashboard UI 组件库 |
| @stomp/stompjs | 7.3 | WebSocket STOMP 客户端 |
| Axios | 1.7 | HTTP 客户端 |
| Tailwind CSS | 3.4 | 原子化 CSS（Widget 样式） |

### 基础设施

| 组件 | 用途 |
|------|------|
| Docker Compose | MySQL + Redis 本地容器编排 |
| Maven Wrapper | 跨平台构建工具 |
| build.sh | 一键打包脚本 |

---

## 3. 项目结构

```
open-customer-system/
├── pom.xml                          # 根 Maven POM（parent）
├── build.sh                         # 一键构建脚本（参考 StreamPark）
├── mvnw / mvnw.cmd                  # Maven Wrapper
├── docker-compose.yml               # MySQL 8 (3307:3306) + Redis (6379)
├── .env / .env.example              # 环境变量
│
├── customer-server/                 # ========== 后端模块 ==========
│   ├── pom.xml                      # Spring Boot 3.2 + 依赖管理
│   └── src/
│       ├── main/java/com/opencustomer/server/
│       │   ├── ServerApplication.java           # 启动类 @EnableScheduling @MapperScan
│       │   │
│       │   ├── config/                          # --- 配置层 ---
│       │   │   ├── WebConfig.java               # CORS 跨域配置
│       │   │   └── WebSocketConfig.java         # STOMP WebSocket 端点与 Broker
│       │   │
│       │   ├── constant/
│       │   │   └── AppConstants.java            # 全局常量
│       │   │
│       │   ├── controller/                      # --- 控制器层 ---
│       │   │   ├── HealthController.java        # GET /api/health
│       │   │   ├── AuthController.java          # POST login/refresh, GET me
│       │   │   ├── ConversationController.java  # 会话 CRUD + 状态流转
│       │   │   ├── MessageController.java       # 消息发送 + 历史查询
│       │   │   ├── CannedResponseController.java# 快捷回复 CRUD
│       │   │   └── AgentController.java         # 在线客服列表
│       │   │
│       │   ├── dto/                             # --- 数据传输对象 ---
│       │   │   ├── Result.java                  # 统一响应 {code, message, data}
│       │   │   ├── LoginRequest/Response.java   # 登录
│       │   │   ├── CreateConversationRequest.java
│       │   │   ├── ConversationResponse.java
│       │   │   ├── SendMessageRequest.java
│       │   │   ├── MessageResponse.java         # 含 deduplicated 标志
│       │   │   ├── CannedResponseRequest/Response.java
│       │   │   └── TypingEvent.java
│       │   │
│       │   ├── entity/                          # --- 实体层 ---
│       │   │   ├── User.java                    # @TableName("users")
│       │   │   ├── Conversation.java            # 含状态机方法
│       │   │   ├── Message.java
│       │   │   └── CannedResponse.java
│       │   │
│       │   ├── enums/                           # --- 枚举 ---
│       │   │   ├── ConversationStatus.java      # WAITING/ACTIVE/RESOLVED/CLOSED
│       │   │   ├── SenderType.java              # VISITOR/AGENT/SYSTEM
│       │   │   ├── UserRole.java                # ADMIN/AGENT
│       │   │   └── UserStatus.java              # ONLINE/OFFLINE
│       │   │
│       │   ├── exception/                       # --- 异常处理 ---
│       │   │   ├── GlobalExceptionHandler.java  # @RestControllerAdvice
│       │   │   ├── AuthenticationException.java            # 401
│       │   │   ├── ResourceNotFoundException.java          # 404
│       │   │   ├── DuplicateResourceException.java         # 409
│       │   │   ├── IllegalStateTransitionException.java    # 409
│       │   │   └── ConversationClosedException.java        # 400
│       │   │
│       │   ├── filter/
│       │   │   └── RateLimitFilter.java         # Caffeine 内存限流
│       │   │
│       │   ├── mapper/                          # --- MyBatis-Plus Mapper ---
│       │   │   ├── UserMapper.java
│       │   │   ├── ConversationMapper.java
│       │   │   ├── MessageMapper.java
│       │   │   └── CannedResponseMapper.java
│       │   │
│       │   ├── security/                        # --- 安全层 ---
│       │   │   ├── SecurityConfig.java          # 无状态 JWT 配置
│       │   │   ├── JwtTokenService.java         # JWT 生成/验证/解析
│       │   │   ├── JwtAuthenticationFilter.java # Bearer Token 过滤器
│       │   │   └── UserDetailsServiceImpl.java
│       │   │
│       │   ├── service/                         # --- 业务层 ---
│       │   │   ├── AuthService / AuthServiceImpl
│       │   │   ├── ConversationService / ConversationServiceImpl
│       │   │   ├── MessageService / MessageServiceImpl
│       │   │   ├── CannedResponseService / CannedResponseServiceImpl
│       │   │   ├── MessageBroadcastService.java # WebSocket 广播
│       │   │   ├── PresenceService.java         # Redis 在线状态
│       │   │   ├── AgentHeartbeatService.java   # 断线自动归队
│       │   │   └── ConversationCleanupService.java # 空会话清理
│       │   │
│       │   ├── utils/
│       │   │   └── QueryLambdaWrapper.java
│       │   │
│       │   └── websocket/                       # --- WebSocket 层 ---
│       │       ├── WebSocketAuthInterceptor.java# STOMP 认证
│       │       ├── WebSocketEventListener.java  # 连接/断开事件
│       │       └── TypingController.java        # 打字状态转发
│       │
│       ├── main/resources/
│       │   ├── application.yml
│       │   └── db/migration/V001-V005           # Flyway 迁移
│       │
│       └── test/java/
│           ├── ServerApplicationTests.java
│           └── entity/ConversationStateTest.java # 16 条状态机测试
│
├── customer-webapp/                 # ========== 前端模块 ==========
│   ├── package.json
│   ├── next.config.js               # API 代理 + antd transpile
│   ├── tailwind.config.js           # preflight: false
│   │
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/                    # --- 客服端 ---
│       │   │   ├── layout.tsx                  # Auth + WebSocket + 侧边栏
│       │   │   └── dashboard/
│       │   │       ├── page.tsx                # 会话队列
│       │   │       ├── login/page.tsx          # 登录页
│       │   │       ├── chat/[id]/page.tsx      # 聊天面板
│       │   │       ├── my-conversations/page.tsx# 我的会话
│       │   │       └── canned-responses/page.tsx# 快捷回复管理
│       │   │
│       │   └── (widget)/                       # --- 访客端 ---
│       │       ├── layout.tsx                  # 独立布局
│       │       └── widget/page.tsx             # 预聊+聊天+重连
│       │
│       ├── components/AuthGuard.tsx
│       ├── contexts/
│       │   ├── AuthContext.tsx                  # 认证状态
│       │   └── WebSocketContext.tsx             # STOMP Provider
│       ├── lib/
│       │   ├── api-client.ts                   # Dashboard Axios
│       │   ├── widget-api-client.ts            # Widget Axios
│       │   └── constants.ts
│       ├── types/                              # TypeScript 类型
│       └── public/
│           └── widget-loader.js                # 嵌入式加载器
```

---

## 4. 数据库设计

通过 Flyway 管理 5 个迁移脚本（V001-V005）自动创建。

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 用户 ID |
| email | VARCHAR(255) UNIQUE | 登录邮箱 |
| password_hash | VARCHAR(255) | bcrypt 密码哈希 |
| display_name | VARCHAR(100) | 显示名称 |
| role | ENUM('ADMIN','AGENT') | 角色 |
| status | ENUM('ONLINE','OFFLINE') | 在线状态 |
| created_at / updated_at | DATETIME | 时间戳 |

### conversations 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 会话 ID |
| visitor_token | VARCHAR(64) | 访客唯一标识（UUID） |
| visitor_name | VARCHAR(100) | 访客姓名 |
| visitor_email | VARCHAR(255) | 访客邮箱 |
| status | ENUM('WAITING','ACTIVE','RESOLVED','CLOSED') | 会话状态 |
| agent_id | BIGINT FK | 分配的客服 ID |
| created_at / updated_at / resolved_at | DATETIME | 时间戳 |

### messages 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 消息 ID |
| conversation_id | BIGINT FK | 所属会话 |
| sender_type | ENUM('VISITOR','AGENT','SYSTEM') | 发送者类型 |
| sender_id | VARCHAR(64) | 发送者标识 |
| content | TEXT | 消息内容（最大 5000 字符） |
| client_message_id | VARCHAR(64) UNIQUE | 客户端幂等 ID |
| sequence_number | BIGINT | Redis 原子递增序列号 |
| created_at | DATETIME | 发送时间 |

### canned_responses 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 快捷回复 ID |
| shortcut | VARCHAR(50) | 快捷指令 |
| content | TEXT | 回复内容 |
| created_by | BIGINT FK | 创建者 |
| created_at / updated_at | DATETIME | 时间戳 |

### 会话状态机

```
           创建
            |
            v
        [WAITING] ──── 客服接管(assign) ────> [ACTIVE]
            ^                                    |
            |       归还队列(returnToQueue)       |
            +------------------------------------+
                                                 |
                                          解决(resolve)
                                                 |
                                                 v
                                            [RESOLVED]
                                                 |
                                            (cleanup)
                                                 v
                                             [CLOSED]
```

---

## 5. Task 实现详解

### Wave 1: 基础设施搭建 (Tasks 1-5, 27)

#### Task 1: Spring Boot 项目脚手架

创建后端 Maven 项目骨架。以 `spring-boot-starter-parent:3.2.0` 为父 POM，引入 Web、Security、WebSocket、MyBatis-Plus、Redis、Flyway 等 starter。`ServerApplication.java` 使用 `@MapperScan` 自动扫描 Mapper 接口。`application.yml` 统一管理数据库（localhost:3307）、Redis、JWT、Actuator 配置。

#### Task 2: Next.js 项目脚手架

创建前端 Next.js 14 App Router 项目。使用路由组 `(dashboard)` 和 `(widget)` 分别承载客服端与访客端。`next.config.js` 配置 API 代理和 Ant Design transpile。Tailwind CSS 设置 `preflight: false` 避免与 Ant Design 冲突。

#### Task 3: Docker Compose

提供 MySQL 8.0（端口 3307）和 Redis 7（端口 6379）的本地容器。命名卷持久化数据，Healthcheck 确保服务就绪。

#### Task 4: Flyway 数据库迁移

5 个版本化 SQL 脚本自动管理 Schema：V001 用户表、V002 会话表、V003 消息表（含 client_message_id UNIQUE 索引）、V004 快捷回复表、V005 种子数据（测试账号 agent@test.com / test123）。Spring Boot 启动时自动执行未应用的迁移。

#### Task 5: TypeScript 类型定义

定义与后端 DTO 对应的 TypeScript 接口：Conversation、Message、User、Auth、WebSocket 事件等。所有类型通过 `types/index.ts` 统一导出。

#### Task 27: Maven 多模块构建

根 `pom.xml` 管理子模块。`build.sh` 支持 `--skipTests`、`--no-webapp`、`--no-dist` 参数，默认执行 `./mvnw -Pwebapp,dist -DskipTests clean install`，打包为 tar.gz 分发包。

---

### Wave 2: 认证与 REST API (Tasks 6-11)

#### Task 6: JWT Token Service + Spring Security

**JwtTokenService** 使用 jjwt 0.12.3，HS256 签名。Access Token 1 小时，Refresh Token 24 小时。**JwtAuthenticationFilter** 从 `Authorization: Bearer` 头提取 JWT，验证后放入 SecurityContext。**SecurityConfig** 禁用 CSRF、STATELESS session，JwtAuthenticationFilter 插在 UsernamePasswordAuthenticationFilter 前。公开端点：`/api/auth/**`、`/api/health`、`/ws/**`。

#### Task 7: Auth REST Endpoints

- `POST /api/auth/login`: bcrypt 验证密码，返回 accessToken + refreshToken
- `POST /api/auth/refresh`: 验证 refreshToken，签发新 accessToken
- `GET /api/auth/me`: 从 SecurityContext 获取当前用户

#### Task 8: 实体 + 状态机

4 个实体使用 `@TableName` 映射表。`Conversation` 内置状态机方法（canAssign/assign, canResolve/resolve, canReturnToQueue/returnToQueue），非法转换抛 409。4 个 Mapper 继承 `BaseMapper<T>`。**ConversationStateTest** 16 条测试覆盖所有状态转换路径。

#### Task 9: Conversation REST API

提供会话 CRUD + 状态流转。`assign()` 使用 MyBatis-Plus UpdateWrapper 实现乐观锁：`WHERE status='WAITING' AND agent_id IS NULL`，受影响行为 0 抛 409 防止双重接管。

#### Task 10: Message REST API

消息发送支持幂等去重（clientMessageId UNIQUE），sequenceNumber 通过 Redis `INCR conversation:{id}:seq` 原子递增，Redis 不可用降级到 DB MAX+1。游标分页通过 `afterSequence` 参数。

#### Task 11: Canned Responses CRUD

标准增删改查，shortcut 唯一性检查（重复抛 409 DuplicateResourceException）。

---

### Wave 3: WebSocket 与 Dashboard UI (Tasks 12-19)

#### Task 12: WebSocket STOMP 配置

**WebSocketConfig** 注册 STOMP 端点 `/ws`，Broker 前缀 `/topic` + `/queue`，应用前缀 `/app`。**WebSocketAuthInterceptor** 在 CONNECT 帧认证，支持 JWT（客服）和 X-Visitor-Token（访客）双模式。**WebSocketEventListener** 监听连接/断开事件，更新 Redis 在线状态。

#### Task 13: 实时消息广播

**MessageBroadcastService** 封装 `SimpMessagingTemplate`：消息推送到 `/topic/conversation/{id}`，队列事件推送到 `/topic/queue`（类型：NEW_CONVERSATION/CONVERSATION_TAKEN/CONVERSATION_RESOLVED/CONVERSATION_RETURNED）。集成在 MessageServiceImpl 和 ConversationServiceImpl 的写操作之后。

#### Task 14: 在线状态 + 打字指示

**PresenceService** 用 Redis Hash `agent:presence` 追踪在线客服。**TypingController** 通过 `@MessageMapping("/typing")` 接收打字事件并转发到对应会话频道。**AgentController** 提供 `GET /api/agents/online` REST 接口。

#### Task 15: Dashboard 登录页

Ant Design Form 登录页。**AuthContext** 管理 Token 生命周期（localStorage 存储、自动刷新）。**AuthGuard** 路由守卫。api-client.ts Axios 拦截器自动附加 JWT 和 401 自动刷新。

#### Task 16: Dashboard 布局 + 队列页

侧边栏导航布局，嵌套 Provider：`AuthProvider → AuthGuard → WebSocketProvider → Content`。**WebSocketContext** 提供 STOMP 客户端（指数退避重连）。**Queue Page** 加载 WAITING 会话列表，订阅 `/topic/queue` 实时更新，"Take Over" 按钮通过 PUT assign 接管。

#### Task 17: Dashboard 聊天面板

核心聊天界面。消息按 sequenceNumber 排序，气泡样式（访客左灰/客服右蓝）。乐观 UI + clientMessageId 去重。WebSocket 订阅实时消息和打字状态。Resolve/Return to Queue 操作按钮。向上滚动加载历史消息（afterSequence 游标）。

#### Task 18: 我的会话 + 未读指示

显示 ACTIVE 会话列表。客户端 localStorage 追踪 `lastSeen:{conversationId}` 实现未读计数。订阅 `/topic/queue` 监听状态变更自动刷新。进入聊天时更新 lastSeen。

#### Task 19: 快捷回复 UI + 斜杠触发

**管理页**：Ant Design Table + Modal CRUD。**斜杠触发**：聊天 TextArea 中输入 `/` 弹出候选列表，按 shortcut 前缀过滤，键盘导航选择，选中后替换输入内容。

---

### Wave 4: Widget 与系统加固 (Tasks 20-26)

#### Task 20: Widget Iframe 加载器

**widget-loader.js**（~6KB IIFE）：创建悬浮按钮（右下角蓝色圆形），点击创建 iframe 指向 `/widget`（400x600px），PostMessage 双向通信，移动端自适应全屏，z-index 999999。使用方式：`<script src="/widget-loader.js" data-server="http://..."></script>`。

#### Task 21: 预聊表单

Widget 管理三种状态：LOADING → PRE_CHAT → CHATTING。新访客填写姓名+邮箱，生成 UUID visitor_token 存 localStorage，POST 创建会话后进入聊天。回访访客检查 localStorage token 查询活跃会话，有则直接进入聊天。**widget-api-client.ts** 使用 X-Visitor-Token 代替 JWT。

#### Task 22: Widget 实时聊天

使用 `@stomp/stompjs` 独立客户端（非 Dashboard WebSocketContext），X-Visitor-Token 认证。双向消息（访客右蓝/客服左灰），乐观 UI + 去重，打字指示。状态显示：WAITING 等待动画、ACTIVE 已连接、RESOLVED 禁用输入+"New Chat"按钮。每 10 秒轮询会话状态。

#### Task 23: 断线重连 + 消息恢复

连接状态：CONNECTING → CONNECTED → DISCONNECTED → RECONNECTING。指数退避（1s→2s→4s→max 30s）。黄色重连 Banner 显示尝试次数。重连成功后通过 `afterSequence` 获取遗漏消息并合并去重。监听 `visibilitychange` 事件，Tab 激活时立即检查/恢复连接。

#### Task 24: 客服断线自动归队

**AgentHeartbeatService**：WebSocket 断开启动 60s 定时器，超时未重连则将该客服所有 ACTIVE 会话设为 WAITING，广播 CONVERSATION_RETURNED 事件，创建 SYSTEM 消息。Redis `agent:session:{id}` TTL 90s。`@Scheduled(fixedRate=30000)` 安全网扫描过期会话。

#### Task 25: 接口限流

**RateLimitFilter**（Caffeine Cache，1 分钟过期）：会话创建 5 次/IP/分钟，消息发送 10 次/用户/分钟。超限返回 429 + Retry-After:60 + JSON 错误体。已认证用户按 userId 限流，匿名按 IP（支持 X-Forwarded-For）。

#### Task 26: 边界情况

- **双重接管**：UpdateWrapper 乐观锁，两个客服同时接管只有一个成功
- **消息长度**：`@Size(max=5000)` 校验，超长返回 400
- **已关闭会话**：RESOLVED/CLOSED 拒绝发消息（ConversationClosedException 400）
- **空会话清理**：每 5 分钟删除 WAITING 且无消息且超过 5 分钟的会话

---

## 6. API 接口一览

### 认证

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | 无 |
| POST | `/api/auth/refresh` | 刷新 Token | 无 |
| GET | `/api/auth/me` | 获取当前用户 | JWT |

### 会话

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/conversations` | 创建会话 | Visitor-Token |
| GET | `/api/conversations?status=` | 查询列表 | JWT / Visitor-Token |
| GET | `/api/conversations/{id}` | 获取详情 | JWT / Visitor-Token |
| PUT | `/api/conversations/{id}/assign` | 客服接管 | JWT |
| PUT | `/api/conversations/{id}/resolve` | 解决会话 | JWT |
| PUT | `/api/conversations/{id}/return-to-queue` | 归还队列 | JWT |

### 消息

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/conversations/{id}/messages` | 发送消息 | JWT / Visitor-Token |
| GET | `/api/conversations/{id}/messages?afterSequence=&limit=` | 查询历史 | JWT / Visitor-Token |

### 快捷回复

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/canned-responses` | 查询全部 | JWT |
| POST | `/api/canned-responses` | 创建 | JWT |
| PUT | `/api/canned-responses/{id}` | 更新 | JWT |
| DELETE | `/api/canned-responses/{id}` | 删除 | JWT |

### 其他

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | 无 |
| GET | `/api/agents/online` | 在线客服列表 | JWT |

---

## 7. WebSocket 通信协议

### 连接

- **端点**: `ws://localhost:8080/ws`（STOMP over WebSocket）
- **认证**:
  - 客服端: CONNECT header `Authorization: Bearer {jwt}`
  - 访客端: CONNECT header `X-Visitor-Token: {uuid}`

### 订阅频道

| 频道 | 用途 | 消息格式 |
|------|------|----------|
| `/topic/conversation/{id}` | 该会话新消息 | MessageResponse 对象 |
| `/topic/conversation/{id}/typing` | 打字状态 | `{senderId, conversationId, typing}` |
| `/topic/queue` | 队列变更 | `{type, conversation}` |
| `/topic/presence` | 在线状态变更 | `{agentId, status}` |

### 发送目的地

| 目的地 | 用途 | 消息格式 |
|--------|------|----------|
| `/app/typing` | 发送打字状态 | `{conversationId, typing: true/false}` |

### 队列事件类型

| type | 触发时机 |
|------|----------|
| NEW_CONVERSATION | 新会话创建 |
| CONVERSATION_TAKEN | 客服接管 |
| CONVERSATION_RESOLVED | 会话解决 |
| CONVERSATION_RETURNED | 归还队列 |

---

## 8. 组件与依赖说明

### 后端核心组件

| 组件 | 包路径 | 作用 |
|------|--------|------|
| SecurityConfig | security/ | Spring Security 无状态 JWT 过滤链 |
| JwtTokenService | security/ | JWT 生成/验证/解析（HS256, jjwt） |
| JwtAuthenticationFilter | security/ | HTTP 请求 JWT 认证过滤器 |
| WebSocketConfig | config/ | STOMP 端点和 Broker 配置 |
| WebSocketAuthInterceptor | websocket/ | STOMP CONNECT 双模式认证 |
| WebSocketEventListener | websocket/ | 连接/断开事件处理 |
| MessageBroadcastService | service/ | SimpMessagingTemplate 消息广播 |
| PresenceService | service/ | Redis Hash 在线状态追踪 |
| AgentHeartbeatService | service/ | 断线检测 + 60s 自动归队 |
| ConversationCleanupService | service/ | 空会话定时清理 |
| RateLimitFilter | filter/ | Caffeine 内存 API 限流 |
| GlobalExceptionHandler | exception/ | 统一异常 → 标准错误响应 |
| Result\<T\> | dto/ | 统一 API 响应 {code, message, data} |
| QueryLambdaWrapper\<T\> | utils/ | MyBatis-Plus Lambda 查询封装 |

### 前端核心组件

| 组件 | 路径 | 作用 |
|------|------|------|
| AuthContext | contexts/ | 登录态管理和 Token 生命周期 |
| WebSocketContext | contexts/ | Dashboard STOMP 客户端 |
| AuthGuard | components/ | Dashboard 路由认证守卫 |
| api-client.ts | lib/ | Dashboard Axios（JWT + 自动刷新） |
| widget-api-client.ts | lib/ | Widget Axios（X-Visitor-Token） |
| widget-loader.js | public/ | 可嵌入 Widget iframe 加载脚本 |
| Dashboard Layout | (dashboard)/layout.tsx | 侧边栏 + Provider 布局 |
| Queue Page | dashboard/page.tsx | WAITING 队列 + 实时更新 |
| Chat Page | dashboard/chat/[id]/page.tsx | 实时聊天 + 快捷回复 |
| My Conversations | dashboard/my-conversations/ | 我的会话 + 未读标记 |
| Canned Responses | dashboard/canned-responses/ | 快捷回复 CRUD |
| Widget Page | (widget)/widget/page.tsx | 预聊+聊天+重连恢复 |

---

## 9. 本地部署指南

### 前置条件

- Java 17+（建议 JDK 17 或 21）
- Node.js 18+（建议 LTS 版本）
- Docker & Docker Compose
- Git

### 第一步：克隆项目

```bash
git clone <repository-url>
cd open-customer-system
```

### 第二步：启动基础设施（MySQL + Redis）

```bash
# 创建 .env 文件
cp .env.example .env

# 启动容器
docker compose up -d

# 验证服务就绪
docker compose ps
# customer-mysql   healthy
# customer-redis   healthy
```

> MySQL 映射到本地端口 3307（避免与本地 3306 冲突），Redis 端口 6379。

### 第三步：启动后端

```bash
cd customer-server

# 编译（首次下载依赖需几分钟）
../mvnw clean compile

# 运行测试
../mvnw test

# 启动应用
../mvnw spring-boot:run
```

启动后可访问：
- API: http://localhost:8080
- WebSocket: ws://localhost:8080/ws
- 健康检查: http://localhost:8080/api/health
- Prometheus: http://localhost:8080/actuator/prometheus

> Flyway 会自动执行数据库迁移（建表 + 种子数据）。

### 第四步：启动前端

```bash
cd customer-webapp

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

启动后可访问：
- Dashboard: http://localhost:3000/dashboard
- Widget: http://localhost:3000/widget
- 测试账号: `agent@test.com` / `test123`

### 第五步：测试 Widget 嵌入

创建测试 HTML 文件：

```html
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
    <h1>My Website</h1>
    <script src="http://localhost:3000/widget-loader.js"
            data-server="http://localhost:3000"></script>
</body>
</html>
```

浏览器打开此文件，右下角出现蓝色聊天按钮。

### 生产构建

```bash
# 一键构建
./build.sh

# 或分别构建
cd customer-server && ../mvnw clean package -DskipTests
cd customer-webapp && npm run build && npm start
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| MYSQL_ROOT_PASSWORD | root123 | MySQL 密码 |
| REDIS_HOST | localhost | Redis 主机 |
| REDIS_PORT | 6379 | Redis 端口 |
| JWT_SECRET | (内置开发密钥) | JWT 签名密钥（生产必须更换） |
| JWT_EXPIRATION | 3600000 | Access Token 有效期 (ms) |
| JWT_REFRESH_EXPIRATION | 86400000 | Refresh Token 有效期 (ms) |

### 常用命令速查

```bash
# 基础设施
docker compose up -d              # 启动 MySQL + Redis
docker compose down               # 停止
docker compose logs -f mysql      # 查看日志

# 后端
cd customer-server
../mvnw clean compile             # 编译
../mvnw test                      # 测试
../mvnw spring-boot:run           # 启动
../mvnw clean package -DskipTests # 打包 JAR

# 前端
cd customer-webapp
npm install                       # 安装依赖
npm run dev                       # 开发模式
npm run build                     # 生产构建
npm start                         # 启动生产服务

# 一键打包
./build.sh                        # 默认跳过测试
./build.sh --with-tests           # 含测试
./build.sh --no-webapp            # 仅后端
```
