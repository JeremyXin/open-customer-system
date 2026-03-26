package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.opencustomer.server.dto.MessageResponse;
import com.opencustomer.server.dto.SendMessageRequest;
import com.opencustomer.server.entity.Conversation;
import com.opencustomer.server.entity.Message;
import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.enums.SenderType;
import com.opencustomer.server.exception.ConversationClosedException;
import com.opencustomer.server.exception.ResourceNotFoundException;
import com.opencustomer.server.mapper.ConversationMapper;
import com.opencustomer.server.mapper.MessageMapper;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Message service implementation.
 */
@Service
public class MessageServiceImpl extends ServiceImpl<MessageMapper, Message>
        implements MessageService {

    private final ConversationMapper conversationMapper;
    private final StringRedisTemplate redisTemplate;
    private final MessageBroadcastService messageBroadcastService;

    public MessageServiceImpl(ConversationMapper conversationMapper,
                              StringRedisTemplate redisTemplate,
                              MessageBroadcastService messageBroadcastService) {
        this.conversationMapper = conversationMapper;
        this.redisTemplate = redisTemplate;
        this.messageBroadcastService = messageBroadcastService;
    }

    @Override
    public MessageResponse sendMessage(Long conversationId, SendMessageRequest request) {
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found: " + conversationId);
        }

        // Reject messages to RESOLVED or CLOSED conversations
        if (conversation.getStatus() == ConversationStatus.RESOLVED 
                || conversation.getStatus() == ConversationStatus.CLOSED) {
            throw new ConversationClosedException(
                "Cannot send message to " + conversation.getStatus() + " conversation: " + conversationId);
        }

        Message existing = this.getOne(new QueryLambdaWrapper<Message>()
                .eq(Message::getConversationId, conversationId)
                .eq(Message::getClientMessageId, request.getClientMessageId()));
        if (existing != null) {
            return toResponse(existing, true);
        }

        Message message = new Message();
        message.setConversationId(conversationId);
        SenderType senderType = parseSenderType(request.getSenderType());
        message.setSenderType(senderType);
        message.setSenderId(resolveSenderId(conversation, senderType));
        message.setContent(request.getContent());
        message.setClientMessageId(request.getClientMessageId());
        message.setSequenceNumber(nextSequence(conversationId));
        message.setCreatedAt(LocalDateTime.now());
        this.save(message);
        MessageResponse response = toResponse(message, false);
        messageBroadcastService.broadcastNewMessage(response);
        return response;
    }

    @Override
    public List<MessageResponse> listMessages(Long conversationId, Long afterSequence, int limit) {
        List<Message> messages = this.list(new QueryLambdaWrapper<Message>()
                .eq(Message::getConversationId, conversationId)
                .gt(afterSequence != null, Message::getSequenceNumber, afterSequence)
                .orderByAsc(Message::getSequenceNumber)
                .last("LIMIT " + limit));
        return messages.stream()
                .map(message -> toResponse(message, false))
                .toList();
    }

    private Long nextSequence(Long conversationId) {
        String key = "conversation:" + conversationId + ":seq";
        try {
            Long seq = redisTemplate.opsForValue().increment(key);
            if (seq != null) {
                return seq;
            }
        } catch (DataAccessException ex) {
            // Fall back to database.
        }
        Long maxSequence = this.list(new QueryLambdaWrapper<Message>()
                        .eq(Message::getConversationId, conversationId))
                .stream()
                .map(Message::getSequenceNumber)
                .filter(value -> value != null)
                .max(Comparator.naturalOrder())
                .orElse(0L);
        return maxSequence + 1;
    }

    private SenderType parseSenderType(String senderType) {
        if (!StringUtils.hasText(senderType)) {
            throw new IllegalArgumentException("Sender type is required");
        }
        return SenderType.valueOf(senderType.trim().toUpperCase());
    }

    private String resolveSenderId(Conversation conversation, SenderType senderType) {
        return switch (senderType) {
            case VISITOR -> conversation.getVisitorToken();
            case AGENT -> conversation.getAgentId() == null ? null : conversation.getAgentId().toString();
            case SYSTEM -> "SYSTEM";
        };
    }

    private MessageResponse toResponse(Message message, boolean deduplicated) {
        return MessageResponse.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderType(message.getSenderType() == null ? null : message.getSenderType().name())
                .senderId(message.getSenderId())
                .content(message.getContent())
                .clientMessageId(message.getClientMessageId())
                .sequenceNumber(message.getSequenceNumber())
                .createdAt(message.getCreatedAt())
                .deduplicated(deduplicated)
                .build();
    }
}
