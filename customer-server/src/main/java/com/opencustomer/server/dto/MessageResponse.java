package com.opencustomer.server.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

/**
 * Message response payload.
 */
@Data
@Builder
public class MessageResponse {
    private Long id;
    private Long conversationId;
    private String senderType;
    private String senderId;
    private String content;
    private String clientMessageId;
    private Long sequenceNumber;
    private LocalDateTime createdAt;
    private boolean deduplicated;
}
