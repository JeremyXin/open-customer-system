package com.opencustomer.server.constant;

public final class AppConstants {
    private AppConstants() {}

    public static final int MAX_MESSAGE_LENGTH = 5000;
    public static final int MAX_CANNED_RESPONSES = 50;
    public static final int MAX_CONVERSATIONS_PER_PAGE = 50;
    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_TAGS_PER_CONVERSATION = 10;
    public static final int MAX_NOTE_LENGTH = 2000;
    public static final int JWT_TOKEN_PREFIX_LENGTH = 7;
    public static final String TOKEN_PREFIX = "Bearer ";
}
