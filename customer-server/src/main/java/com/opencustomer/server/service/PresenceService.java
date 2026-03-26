package com.opencustomer.server.service;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

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

    public void setOnline(String agentId, String sessionId) {
        redisTemplate.opsForHash().put(PRESENCE_KEY, agentId, sessionId);
        messagingTemplate.convertAndSend(
                "/topic/presence",
                Map.of("agentId", agentId, "status", ONLINE_STATUS));
    }

    public void setOffline(String agentId) {
        redisTemplate.opsForHash().delete(PRESENCE_KEY, agentId);
        messagingTemplate.convertAndSend(
                "/topic/presence",
                Map.of("agentId", agentId, "status", OFFLINE_STATUS));
    }

    public Set<String> getOnlineAgentIds() {
        Set<Object> rawKeys = redisTemplate.opsForHash().keys(PRESENCE_KEY);
        if (rawKeys == null) {
            return Collections.emptySet();
        }
        return rawKeys.stream().map(String::valueOf).collect(Collectors.toSet());
    }

    public boolean isOnline(String agentId) {
        Boolean exists = redisTemplate.opsForHash().hasKey(PRESENCE_KEY, agentId);
        return Boolean.TRUE.equals(exists);
    }
}
