package com.opencustomer.server.service;

import com.opencustomer.server.dto.ConversationResponse;
import com.opencustomer.server.dto.MessageResponse;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Broadcasts conversation messages and queue updates via WebSocket topics.
 */
@Service
public class MessageBroadcastService {

    private final SimpMessagingTemplate messagingTemplate;

    public MessageBroadcastService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void broadcastNewMessage(MessageResponse message) {
        if (message == null || message.getConversationId() == null) {
            return;
        }
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + message.getConversationId(),
                message);
    }

    public void broadcastQueueUpdate(String eventType, ConversationResponse conversation) {
        Map<String, Object> payload = Map.of(
                "type", eventType,
                "conversation", conversation);
        messagingTemplate.convertAndSend("/topic/queue", payload);
    }
}
