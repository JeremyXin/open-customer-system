package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.opencustomer.server.dto.ConversationResponse;
import com.opencustomer.server.dto.CreateConversationRequest;
import com.opencustomer.server.entity.Conversation;
import com.opencustomer.server.enums.ConversationStatus;
import java.util.List;

public interface ConversationService extends IService<Conversation> {
    ConversationResponse create(CreateConversationRequest request);

    List<ConversationResponse> listByStatus(ConversationStatus status);

    List<ConversationResponse> listAll();

    ConversationResponse getById(Long id);

    ConversationResponse assign(Long id, Long agentId);

    ConversationResponse resolve(Long id, Long agentId);

    ConversationResponse returnToQueue(Long id, Long agentId);
}
