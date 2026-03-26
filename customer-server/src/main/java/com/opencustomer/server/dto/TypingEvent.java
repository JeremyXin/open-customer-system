package com.opencustomer.server.dto;

import lombok.Data;

@Data
public class TypingEvent {
    private Long conversationId;
    private boolean isTyping;

    public Long getConversationId() {
        return conversationId;
    }

    public boolean isTyping() {
        return isTyping;
    }
}
