package com.opencustomer.server.controller;

import com.opencustomer.server.dto.MessageResponse;
import com.opencustomer.server.dto.Result;
import com.opencustomer.server.dto.SendMessageRequest;
import com.opencustomer.server.service.MessageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Message REST endpoints for conversations.
 */
@RestController
@RequestMapping("/api/conversations/{conversationId}/messages")
@Validated
public class MessageController {
    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping
    public ResponseEntity<Result<MessageResponse>> sendMessage(
            @PathVariable Long conversationId,
            @Valid @RequestBody SendMessageRequest request) {
        MessageResponse response = messageService.sendMessage(conversationId, request);
        HttpStatus status = response.isDeduplicated() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(Result.success(response));
    }

    @GetMapping
    public Result<List<MessageResponse>> listMessages(
            @PathVariable Long conversationId,
            @RequestParam(required = false) Long afterSequence,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) {
        int boundedLimit = Math.min(limit, 100);
        return Result.success(messageService.listMessages(conversationId, afterSequence, boundedLimit));
    }
}
