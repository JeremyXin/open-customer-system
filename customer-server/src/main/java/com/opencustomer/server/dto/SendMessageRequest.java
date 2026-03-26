package com.opencustomer.server.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Send message request payload.
 */
@Data
public class SendMessageRequest {
    @NotBlank(message = "Content is required")
    @Size(max = 5000, message = "Content must be at most 5000 characters")
    private String content;

    @NotNull(message = "Sender type is required")
    private String senderType;

    @NotBlank(message = "Client message id is required")
    private String clientMessageId;
}
