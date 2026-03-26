package com.opencustomer.server.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.exception.IllegalStateTransitionException;
import org.junit.jupiter.api.Test;

public class ConversationStateTest {
    private Conversation conversationWithStatus(ConversationStatus status) {
        Conversation conversation = new Conversation();
        conversation.setStatus(status);
        return conversation;
    }

    @Test
    void waitingToActiveAssignsAgent() {
        Conversation conversation = conversationWithStatus(ConversationStatus.WAITING);

        conversation.assignToAgent(12L);

        assertEquals(ConversationStatus.ACTIVE, conversation.getStatus());
        assertEquals(12L, conversation.getAgentId());
        assertNotNull(conversation.getUpdatedAt());
    }

    @Test
    void activeToResolvedSetsResolvedAt() {
        Conversation conversation = conversationWithStatus(ConversationStatus.ACTIVE);

        conversation.resolve();

        assertEquals(ConversationStatus.RESOLVED, conversation.getStatus());
        assertNotNull(conversation.getResolvedAt());
        assertNotNull(conversation.getUpdatedAt());
    }

    @Test
    void resolvedToClosed() {
        Conversation conversation = conversationWithStatus(ConversationStatus.RESOLVED);

        conversation.close();

        assertEquals(ConversationStatus.CLOSED, conversation.getStatus());
        assertNotNull(conversation.getUpdatedAt());
    }

    @Test
    void activeToWaitingReturnsToQueue() {
        Conversation conversation = conversationWithStatus(ConversationStatus.ACTIVE);
        conversation.setAgentId(77L);

        conversation.returnToQueue();

        assertEquals(ConversationStatus.WAITING, conversation.getStatus());
        assertNull(conversation.getAgentId());
        assertNotNull(conversation.getUpdatedAt());
    }

    @Test
    void waitingToResolvedThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.WAITING);

        assertThrows(IllegalStateTransitionException.class, conversation::resolve);
    }

    @Test
    void waitingToClosedThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.WAITING);

        assertThrows(IllegalStateTransitionException.class, conversation::close);
    }

    @Test
    void waitingToWaitingThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.WAITING);

        assertThrows(IllegalStateTransitionException.class, conversation::returnToQueue);
    }

    @Test
    void activeToActiveThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.ACTIVE);

        assertThrows(IllegalStateTransitionException.class, () -> conversation.assignToAgent(5L));
    }

    @Test
    void activeToClosedThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.ACTIVE);

        assertThrows(IllegalStateTransitionException.class, conversation::close);
    }

    @Test
    void resolvedToActiveThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.RESOLVED);

        assertThrows(IllegalStateTransitionException.class, () -> conversation.assignToAgent(9L));
    }

    @Test
    void resolvedToWaitingThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.RESOLVED);

        assertThrows(IllegalStateTransitionException.class, conversation::returnToQueue);
    }

    @Test
    void resolvedToResolvedThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.RESOLVED);

        assertThrows(IllegalStateTransitionException.class, conversation::resolve);
    }

    @Test
    void closedToWaitingThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.CLOSED);

        assertThrows(IllegalStateTransitionException.class, conversation::returnToQueue);
    }

    @Test
    void closedToActiveThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.CLOSED);

        assertThrows(IllegalStateTransitionException.class, () -> conversation.assignToAgent(4L));
    }

    @Test
    void closedToResolvedThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.CLOSED);

        assertThrows(IllegalStateTransitionException.class, conversation::resolve);
    }

    @Test
    void closedToClosedThrows() {
        Conversation conversation = conversationWithStatus(ConversationStatus.CLOSED);

        assertThrows(IllegalStateTransitionException.class, conversation::close);
    }
}
