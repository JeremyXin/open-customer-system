package com.opencustomer.server.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.opencustomer.server.dto.ConversationResponse;
import com.opencustomer.server.dto.CreateConversationRequest;
import com.opencustomer.server.entity.Conversation;
import com.opencustomer.server.entity.Message;
import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.enums.SenderType;
import com.opencustomer.server.exception.IllegalStateTransitionException;
import com.opencustomer.server.exception.ResourceNotFoundException;
import com.opencustomer.server.mapper.ConversationMapper;
import com.opencustomer.server.mapper.MessageMapper;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Conversation service implementation.
 * Handles conversation lifecycle: create, list, assign, resolve, return-to-queue.
 */
@Service
public class ConversationServiceImpl
        extends ServiceImpl<ConversationMapper, Conversation>
        implements ConversationService {

    private final MessageMapper messageMapper;
    private final MessageBroadcastService messageBroadcastService;

    public ConversationServiceImpl(MessageMapper messageMapper,
                                   MessageBroadcastService messageBroadcastService) {
        this.messageMapper = messageMapper;
        this.messageBroadcastService = messageBroadcastService;
    }

    @Override
    public ConversationResponse create(CreateConversationRequest request) {
        String visitorToken = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();

        Conversation conversation = new Conversation();
        conversation.setVisitorToken(visitorToken);
        conversation.setVisitorName(request.getVisitorName());
        conversation.setVisitorEmail(request.getVisitorEmail());
        conversation.setStatus(ConversationStatus.WAITING);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        this.save(conversation);

        Message firstMessage = new Message();
        firstMessage.setConversationId(conversation.getId());
        firstMessage.setSenderType(SenderType.VISITOR);
        firstMessage.setSenderId(visitorToken);
        firstMessage.setContent(request.getInitialMessage());
        firstMessage.setSequenceNumber(1L);
        firstMessage.setCreatedAt(now);
        messageMapper.insert(firstMessage);

        ConversationResponse response = toResponse(conversation);
        messageBroadcastService.broadcastQueueUpdate("NEW_CONVERSATION", response);
        return response;
    }

    @Override
    public List<ConversationResponse> listByStatus(ConversationStatus status) {
        return this.list(new QueryLambdaWrapper<Conversation>()
                .eq(Conversation::getStatus, status)
                .orderByAsc(Conversation::getCreatedAt))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<ConversationResponse> listAll() {
        return this.list(new QueryLambdaWrapper<Conversation>()
                .orderByAsc(Conversation::getCreatedAt))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public ConversationResponse getById(Long id) {
        Conversation conversation = this.baseMapper.selectById(id);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found: " + id);
        }
        return toResponse(conversation);
    }

    @Override
    public ConversationResponse assign(Long id, Long agentId) {
        Conversation conversation = this.baseMapper.selectById(id);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found: " + id);
        }

        conversation.assignToAgent(agentId);

        UpdateWrapper<Conversation> updateWrapper = new UpdateWrapper<>();
        updateWrapper.eq("id", id)
                .eq("status", "WAITING")
                .isNull("agent_id")
                .set("agent_id", agentId)
                .set("status", "ACTIVE")
                .set("updated_at", conversation.getUpdatedAt());

        int updated = this.baseMapper.update(null, updateWrapper);
        if (updated == 0) {
            throw new IllegalStateTransitionException("Conversation already assigned: " + id);
        }
        ConversationResponse response = toResponse(conversation);
        messageBroadcastService.broadcastQueueUpdate("CONVERSATION_TAKEN", response);
        return response;
    }

    @Override
    public ConversationResponse resolve(Long id, Long agentId) {
        Conversation conversation = this.baseMapper.selectById(id);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found: " + id);
        }
        if (conversation.getAgentId() == null || !conversation.getAgentId().equals(agentId)) {
            throw new IllegalStateTransitionException("Conversation not assigned to this agent: " + id);
        }

        conversation.resolve();
        this.updateById(conversation);
        ConversationResponse response = toResponse(conversation);
        messageBroadcastService.broadcastQueueUpdate("CONVERSATION_RESOLVED", response);
        return response;
    }

    @Override
    public ConversationResponse returnToQueue(Long id, Long agentId) {
        Conversation conversation = this.baseMapper.selectById(id);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found: " + id);
        }
        if (conversation.getAgentId() == null || !conversation.getAgentId().equals(agentId)) {
            throw new IllegalStateTransitionException("Conversation not assigned to this agent: " + id);
        }

        conversation.returnToQueue();

        // Use UpdateWrapper to explicitly set agent_id to NULL
        // (MyBatis-Plus updateById ignores null fields by default)
        UpdateWrapper<Conversation> updateWrapper = new UpdateWrapper<>();
        updateWrapper.eq("id", id)
                .set("agent_id", null)
                .set("status", "WAITING")
                .set("updated_at", conversation.getUpdatedAt());
        this.baseMapper.update(null, updateWrapper);
        ConversationResponse response = toResponse(conversation);
        messageBroadcastService.broadcastQueueUpdate("CONVERSATION_RETURNED", response);
        return response;
    }

    private ConversationResponse toResponse(Conversation entity) {
        ConversationResponse response = new ConversationResponse();
        response.setId(entity.getId());
        response.setVisitorToken(entity.getVisitorToken());
        response.setVisitorName(entity.getVisitorName());
        response.setVisitorEmail(entity.getVisitorEmail());
        response.setStatus(entity.getStatus() == null ? null : entity.getStatus().name());
        response.setAgentId(entity.getAgentId());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        response.setResolvedAt(entity.getResolvedAt());
        return response;
    }
}
