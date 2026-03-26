package com.opencustomer.server.service;

import com.opencustomer.server.entity.Conversation;
import com.opencustomer.server.entity.Message;
import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.mapper.ConversationMapper;
import com.opencustomer.server.mapper.MessageMapper;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Service for cleaning up empty conversations that have been waiting too long.
 */
@Service
public class ConversationCleanupService {

    private static final Logger logger = LoggerFactory.getLogger(ConversationCleanupService.class);
    private static final int CLEANUP_THRESHOLD_MINUTES = 5;

    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;

    public ConversationCleanupService(ConversationMapper conversationMapper,
                                      MessageMapper messageMapper) {
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
    }

    /**
     * Scheduled cleanup job that runs every 5 minutes.
     * Deletes WAITING conversations with 0 messages that are older than 5 minutes.
     */
    @Scheduled(fixedRate = 300000) // 5 minutes in milliseconds
    public void cleanupEmptyConversations() {
        logger.info("Starting cleanup of empty conversations");
        
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(CLEANUP_THRESHOLD_MINUTES);
        
        // Find all WAITING conversations older than threshold
        List<Conversation> oldWaitingConversations = conversationMapper.selectList(
            new QueryLambdaWrapper<Conversation>()
                .eq(Conversation::getStatus, ConversationStatus.WAITING)
                .lt(Conversation::getCreatedAt, threshold)
        );
        
        int deletedCount = 0;
        for (Conversation conversation : oldWaitingConversations) {
            // Check if conversation has 0 messages
            Long messageCount = messageMapper.selectCount(
                new QueryLambdaWrapper<Message>()
                    .eq(Message::getConversationId, conversation.getId())
            );
            
            if (messageCount == 0) {
                // Delete the conversation
                conversationMapper.deleteById(conversation.getId());
                deletedCount++;
                logger.debug("Deleted empty conversation: id={}, createdAt={}", 
                    conversation.getId(), conversation.getCreatedAt());
            }
        }
        
        if (deletedCount > 0) {
            logger.info("Cleanup completed: deleted {} empty conversations", deletedCount);
        } else {
            logger.debug("Cleanup completed: no empty conversations to delete");
        }
    }
}
