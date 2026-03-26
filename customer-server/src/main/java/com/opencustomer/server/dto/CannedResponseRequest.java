package com.opencustomer.server.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public class CannedResponseRequest {
    @NotBlank(message = "Shortcut is required")
    @Size(max = 50, message = "Shortcut must be at most 50 characters")
    private String shortcut;

    @NotBlank(message = "Content is required")
    private String content;

    public String getShortcut() {
        return shortcut;
    }

    public void setShortcut(String shortcut) {
        this.shortcut = shortcut;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
