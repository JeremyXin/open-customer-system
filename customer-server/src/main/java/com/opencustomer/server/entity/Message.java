package com.opencustomer.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.opencustomer.server.enums.SenderType;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("messages")
public class Message {
    private Long id;
    private Long conversationId;
    private SenderType senderType;
    private String senderId;
    
    @Size(max = 5000, message = "Message content must be at most 5000 characters")
    private String content;
    
    private String clientMessageId;
    private Long sequenceNumber;
    private LocalDateTime createdAt;
}
