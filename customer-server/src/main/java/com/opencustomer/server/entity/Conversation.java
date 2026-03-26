package com.opencustomer.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.exception.IllegalStateTransitionException;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("conversations")
public class Conversation {
    private Long id;
    private String visitorToken;
    private String visitorName;
    private String visitorEmail;
    private ConversationStatus status;
    private Long agentId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;

    public ConversationStatus getStatus() {
        return status;
    }

    public void setStatus(ConversationStatus status) {
        this.status = status;
    }

    public Long getAgentId() {
        return agentId;
    }

    public void setAgentId(Long agentId) {
        this.agentId = agentId;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void assignToAgent(Long agentId) {
        if (status != ConversationStatus.WAITING) {
            throw new IllegalStateTransitionException("Only waiting conversations can be assigned to an agent.");
        }
        this.agentId = agentId;
        this.status = ConversationStatus.ACTIVE;
        this.updatedAt = LocalDateTime.now();
    }

    public void resolve() {
        if (status != ConversationStatus.ACTIVE) {
            throw new IllegalStateTransitionException("Only active conversations can be resolved.");
        }
        this.status = ConversationStatus.RESOLVED;
        this.resolvedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void close() {
        if (status != ConversationStatus.RESOLVED) {
            throw new IllegalStateTransitionException("Only resolved conversations can be closed.");
        }
        this.status = ConversationStatus.CLOSED;
        this.updatedAt = LocalDateTime.now();
    }

    public void returnToQueue() {
        if (status != ConversationStatus.ACTIVE) {
            throw new IllegalStateTransitionException("Only active conversations can return to the queue.");
        }
        this.agentId = null;
        this.status = ConversationStatus.WAITING;
        this.updatedAt = LocalDateTime.now();
    }
}
