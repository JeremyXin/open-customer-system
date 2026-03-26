package com.opencustomer.server.exception;

/**
 * Exception thrown when attempting to send a message to a closed or resolved conversation.
 */
public class ConversationClosedException extends RuntimeException {
    public ConversationClosedException(String message) {
        super(message);
    }
}
