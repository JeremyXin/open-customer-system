package com.opencustomer.server.websocket;

import com.opencustomer.server.dto.TypingEvent;
import java.security.Principal;
import java.util.Map;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class TypingController {
    private final SimpMessagingTemplate messagingTemplate;

    public TypingController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/typing")
    public void handleTyping(TypingEvent event, Principal principal) {
        if (event == null || event.getConversationId() == null || principal == null) {
            return;
        }
        String destination = "/topic/conversation/" + event.getConversationId() + "/typing";
        messagingTemplate.convertAndSend(
                destination,
                Map.of(
                        "senderId", principal.getName(),
                        "isTyping", event.isTyping()));
    }
}
