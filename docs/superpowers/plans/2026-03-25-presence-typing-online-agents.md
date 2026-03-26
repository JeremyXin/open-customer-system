# Presence, Typing, Online Agents Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Redis-backed agent presence tracking, typing indicator STOMP handling, and a REST endpoint for online agents.

**Architecture:** Introduce a PresenceService that encapsulates Redis presence storage and broadcasts updates to `/topic/presence`. Update WebSocket connection events to use this service. Add a TypingController to relay ephemeral typing events over STOMP, and an AgentController endpoint that reads online agent IDs from PresenceService and returns UserInfoResponse DTOs.

**Tech Stack:** Spring Boot, Spring WebSocket (STOMP), Spring Data Redis, MyBatis-Plus, Lombok.

---

## Chunk 1: Presence Service and WebSocket Events

### Task 1: Add PresenceService

**Files:**
- Create: `customer-server/src/main/java/com/opencustomer/server/service/PresenceService.java`

- [ ] **Step 1: Write minimal class with dependencies and constants**

```java
@Service
public class PresenceService {
    private static final String PRESENCE_KEY = "agent:presence";
    private static final String ONLINE_STATUS = "ONLINE";
    private static final String OFFLINE_STATUS = "OFFLINE";

    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceService(StringRedisTemplate redisTemplate, SimpMessagingTemplate messagingTemplate) {
        this.redisTemplate = redisTemplate;
        this.messagingTemplate = messagingTemplate;
    }
}
```

- [ ] **Step 2: Implement presence operations**

```java
public void setOnline(String agentId, String sessionId) {
    redisTemplate.opsForHash().put(PRESENCE_KEY, agentId, sessionId);
    messagingTemplate.convertAndSend("/topic/presence", Map.of("agentId", agentId, "status", ONLINE_STATUS));
}

public void setOffline(String agentId) {
    redisTemplate.opsForHash().delete(PRESENCE_KEY, agentId);
    messagingTemplate.convertAndSend("/topic/presence", Map.of("agentId", agentId, "status", OFFLINE_STATUS));
}

public Set<String> getOnlineAgentIds() {
    // Redis returns null when the hash does not exist
    Set<Object> rawKeys = redisTemplate.opsForHash().keys(PRESENCE_KEY);
    return rawKeys == null ? Set.of() : rawKeys.stream().map(String::valueOf).collect(Collectors.toSet());
}

public boolean isOnline(String agentId) {
    Boolean exists = redisTemplate.opsForHash().hasKey(PRESENCE_KEY, agentId);
    return Boolean.TRUE.equals(exists);
}
```

- [ ] **Step 3: Ensure imports and null-safe handling**

```java
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
```

### Task 2: Update WebSocketEventListener to use PresenceService

**Files:**
- Modify: `customer-server/src/main/java/com/opencustomer/server/websocket/WebSocketEventListener.java`

- [ ] **Step 1: Replace Redis dependency with PresenceService**

```java
private final PresenceService presenceService;

public WebSocketEventListener(PresenceService presenceService) {
    this.presenceService = presenceService;
}
```

- [ ] **Step 2: Call presence service on connect/disconnect**

```java
// sessionId is extracted via StompHeaderAccessor.getSessionId()
if (isAgentPrincipal(principal)) {
    String agentId = principal.getName();
    presenceService.setOnline(agentId, sessionId);
}

if (isAgentPrincipal(principal)) {
    String agentId = principal.getName();
    presenceService.setOffline(agentId);
}
```

- [ ] **Step 3: Ensure isAgentPrincipal helper exists**

```java
// Keep existing isAgentPrincipal(Principal) helper or add it if missing
```

- [ ] **Step 4: Remove unused Redis constants and imports**

- [ ] **Step 5: Note client subscription for presence updates**

```text
Clients must subscribe to /topic/presence to receive ONLINE/OFFLINE events.
```

## Chunk 2: Typing Indicator STOMP Handler

### Task 3: Add TypingEvent DTO

**Files:**
- Create: `customer-server/src/main/java/com/opencustomer/server/dto/TypingEvent.java`

- [ ] **Step 1: Define TypingEvent DTO with Lombok**

```java
@Data
public class TypingEvent {
    private Long conversationId;
    private boolean isTyping;
}
```

### Task 4: Add TypingController

**Files:**
- Create: `customer-server/src/main/java/com/opencustomer/server/websocket/TypingController.java`

- [ ] **Step 1: Create controller skeleton and dependencies**

```java
@Controller
public class TypingController {
    private final SimpMessagingTemplate messagingTemplate;

    public TypingController(SimpMessagingTemplate messagingTemplate) { ... }
}
```

- [ ] **Step 2: Implement @MessageMapping("/typing") handler**

```java
@MessageMapping("/typing")
public void handleTyping(TypingEvent event, Principal principal) {
    if (event == null || event.getConversationId() == null || principal == null) {
        return;
    }
    Map<String, Object> payload = Map.of(
        "senderId", principal.getName(),
        "isTyping", event.isTyping()
    );
    String destination = "/topic/conversation/" + event.getConversationId() + "/typing";
    messagingTemplate.convertAndSend(destination, payload);
}
```

- [ ] **Step 3: Ensure ephemeral, no persistence**

## Chunk 3: Online Agents REST Endpoint

### Task 5: Add AgentController endpoint

**Files:**
- Create: `customer-server/src/main/java/com/opencustomer/server/controller/AgentController.java`

- [ ] **Step 1: Create controller with dependencies**

```java
@RestController
@RequestMapping("/api/agents")
public class AgentController {
    private final PresenceService presenceService;
    private final UserMapper userMapper;

    public AgentController(PresenceService presenceService, UserMapper userMapper) { ... }
}
```

- [ ] **Step 2: Implement GET /online endpoint**

```java
@GetMapping("/online")
public Result<List<UserInfoResponse>> listOnlineAgents(@AuthenticationPrincipal UserDetails userDetails) {
    Set<String> onlineIds = presenceService.getOnlineAgentIds();
    if (onlineIds.isEmpty()) {
        return Result.success(List.of());
    }

    List<Long> userIds = onlineIds.stream()
        .map(Long::valueOf)
        .toList();

    List<UserInfoResponse> responses = userMapper.selectBatchIds(userIds).stream()
        .map(user -> UserInfoResponse.builder()
            .id(user.getId())
            .email(user.getEmail())
            .displayName(user.getDisplayName())
            .role(user.getRole().name())
            .status(user.getStatus().name())
            .build())
        .toList();

    return Result.success(responses);
}
```

- [ ] **Step 3: Ensure authentication required via existing security**

## Chunk 4: Verification

### Task 6: Compile

**Files:**
- None

- [ ] **Step 1: Run compile**

Run:

```bash
cd customer-server && ../mvnw clean compile
```

Expected: BUILD SUCCESS

---

**Notes:**
- No integration tests added per requirements.
- Do not modify WebSocketConfig, SecurityConfig, pom.xml, or application.yml.
- Do not touch frontend files.
