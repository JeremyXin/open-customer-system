package com.opencustomer.server.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.opencustomer.server.dto.ConversationResponse;
import com.opencustomer.server.dto.MessageResponse;
import com.opencustomer.server.entity.Conversation;
import com.opencustomer.server.entity.Message;
import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.enums.SenderType;
import com.opencustomer.server.mapper.ConversationMapper;
import com.opencustomer.server.mapper.MessageMapper;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AgentHeartbeatService {
    private static final Logger logger = LoggerFactory.getLogger(AgentHeartbeatService.class);
    private static final String SESSION_KEY_PREFIX = "agent:session:";
    private static final long SESSION_TTL_SECONDS = 90L;
    private static final long DISCONNECT_TIMEOUT_SECONDS = 60L;
    private static final String RETURN_MESSAGE = "Agent disconnected, returning to queue";

    private final StringRedisTemplate redisTemplate;
    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final MessageBroadcastService messageBroadcastService;
    private final ScheduledExecutorService scheduler;
    private final Map<Long, ScheduledFuture<?>> disconnectTimers = new ConcurrentHashMap<>();

    public AgentHeartbeatService(StringRedisTemplate redisTemplate,
                                 ConversationMapper conversationMapper,
                                 MessageMapper messageMapper,
                                 MessageBroadcastService messageBroadcastService) {
        this.redisTemplate = redisTemplate;
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.messageBroadcastService = messageBroadcastService;
        this.scheduler = Executors.newSingleThreadScheduledExecutor();
    }

    public void agentConnected(Long agentId, String sessionId) {
        if (agentId == null || sessionId == null) {
            return;
        }
        cancelDisconnectTimer(agentId);
        String key = sessionKey(agentId);
        redisTemplate.opsForValue().set(key, sessionId, SESSION_TTL_SECONDS, TimeUnit.SECONDS);
        logger.info("Agent connected agentId={}, sessionId={}", agentId, sessionId);
    }

    public void agentDisconnected(Long agentId) {
        if (agentId == null) {
            return;
        }
        if (disconnectTimers.containsKey(agentId)) {
            return;
        }
        redisTemplate.delete(sessionKey(agentId));
        ScheduledFuture<?> future = scheduler.schedule(
                () -> handleDisconnectTimeout(agentId),
                DISCONNECT_TIMEOUT_SECONDS,
                TimeUnit.SECONDS);
        disconnectTimers.put(agentId, future);
        logger.info("Agent disconnected agentId={}, starting {}s timeout", agentId, DISCONNECT_TIMEOUT_SECONDS);
    }

    @Scheduled(fixedRate = 30000)
    public void cleanupStaleSessions() {
        List<Long> agentIds = List.copyOf(disconnectTimers.keySet());
        for (Long agentId : agentIds) {
            String sessionId = redisTemplate.opsForValue().get(sessionKey(agentId));
            if (sessionId == null) {
                ScheduledFuture<?> future = disconnectTimers.remove(agentId);
                if (future != null) {
                    future.cancel(false);
                }
                handleDisconnectTimeout(agentId);
            }
        }
    }

    private void handleDisconnectTimeout(Long agentId) {
        String sessionId = redisTemplate.opsForValue().get(sessionKey(agentId));
        if (sessionId != null) {
            logger.info("Agent agentId={} reconnected before timeout, cancelling", agentId);
            cancelDisconnectTimer(agentId);
            return;
        }
        logger.info("Disconnect timeout fired for agentId={}, returning conversations to queue", agentId);
        try {
            returnAgentConversations(agentId);
        } catch (Exception e) {
            logger.error("Failed to return conversations for agentId={}", agentId, e);
        }
        redisTemplate.delete(sessionKey(agentId));
        cancelDisconnectTimer(agentId);
    }

    private void returnAgentConversations(Long agentId) {
        List<Conversation> activeConversations = conversationMapper.selectList(
                new QueryLambdaWrapper<Conversation>()
                        .eq(Conversation::getStatus, ConversationStatus.ACTIVE)
                        .eq(Conversation::getAgentId, agentId));
        if (activeConversations.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (Conversation conversation : activeConversations) {
            UpdateWrapper<Conversation> updateWrapper = new UpdateWrapper<>();
            updateWrapper.eq("id", conversation.getId())
                    .eq("status", "ACTIVE")
                    .eq("agent_id", agentId)
                    .set("status", "WAITING")
                    .set("agent_id", null)
                    .set("updated_at", now);
            int updated = conversationMapper.update(null, updateWrapper);
            if (updated == 0) {
                continue;
            }
            insertSystemMessage(conversation.getId(), now);
            ConversationResponse response = toResponse(conversation, now);
            messageBroadcastService.broadcastQueueUpdate("CONVERSATION_RETURNED", response);
        }
    }

    private void insertSystemMessage(Long conversationId, LocalDateTime now) {
        Message message = new Message();
        message.setConversationId(conversationId);
        message.setSenderType(SenderType.SYSTEM);
        message.setSenderId("SYSTEM");
        message.setContent(RETURN_MESSAGE);
        message.setSequenceNumber(nextSequence(conversationId));
        message.setCreatedAt(now);
        messageMapper.insert(message);
        MessageResponse response = MessageResponse.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderType(SenderType.SYSTEM.name())
                .senderId(message.getSenderId())
                .content(message.getContent())
                .clientMessageId(message.getClientMessageId())
                .sequenceNumber(message.getSequenceNumber())
                .createdAt(message.getCreatedAt())
                .deduplicated(false)
                .build();
        messageBroadcastService.broadcastNewMessage(response);
    }

    private Long nextSequence(Long conversationId) {
        Long maxSequence = messageMapper.selectList(
                new QueryLambdaWrapper<Message>()
                        .eq(Message::getConversationId, conversationId))
                .stream()
                .map(Message::getSequenceNumber)
                .filter(value -> value != null)
                .max(Long::compareTo)
                .orElse(0L);
        return maxSequence + 1;
    }

    private ConversationResponse toResponse(Conversation conversation, LocalDateTime now) {
        ConversationResponse response = new ConversationResponse();
        response.setId(conversation.getId());
        response.setVisitorToken(conversation.getVisitorToken());
        response.setVisitorName(conversation.getVisitorName());
        response.setVisitorEmail(conversation.getVisitorEmail());
        response.setStatus(ConversationStatus.WAITING.name());
        response.setAgentId(null);
        response.setCreatedAt(conversation.getCreatedAt());
        response.setUpdatedAt(now);
        response.setResolvedAt(conversation.getResolvedAt());
        return response;
    }

    private void cancelDisconnectTimer(Long agentId) {
        ScheduledFuture<?> future = disconnectTimers.remove(agentId);
        if (future != null) {
            future.cancel(false);
        }
    }

    private String sessionKey(Long agentId) {
        return SESSION_KEY_PREFIX + agentId;
    }
}
