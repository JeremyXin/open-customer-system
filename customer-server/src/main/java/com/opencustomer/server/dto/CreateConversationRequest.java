package com.opencustomer.server.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Create conversation request payload from visitor.
 */
@Data
public class CreateConversationRequest {
    @NotBlank
    @Size(max = 100)
    private String visitorName;

    @Email
    private String visitorEmail;

    @NotBlank
    @Size(max = 5000)
    private String initialMessage;
}
