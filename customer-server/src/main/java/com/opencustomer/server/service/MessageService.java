package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.opencustomer.server.dto.MessageResponse;
import com.opencustomer.server.dto.SendMessageRequest;
import com.opencustomer.server.entity.Message;
import java.util.List;

/**
 * Message service interface.
 */
public interface MessageService extends IService<Message> {
    MessageResponse sendMessage(Long conversationId, SendMessageRequest request);

    List<MessageResponse> listMessages(Long conversationId, Long afterSequence, int limit);
}
