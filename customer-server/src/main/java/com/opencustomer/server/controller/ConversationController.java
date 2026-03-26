package com.opencustomer.server.controller;

import com.opencustomer.server.dto.ConversationResponse;
import com.opencustomer.server.dto.CreateConversationRequest;
import com.opencustomer.server.dto.Result;
import com.opencustomer.server.entity.User;
import com.opencustomer.server.enums.ConversationStatus;
import com.opencustomer.server.exception.ResourceNotFoundException;
import com.opencustomer.server.mapper.UserMapper;
import com.opencustomer.server.service.ConversationService;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Conversation REST endpoints.
 * Handles conversation creation (public), listing, assignment, resolution.
 */
@RestController
@RequestMapping("/api/conversations")
@Validated
public class ConversationController {

    private final ConversationService conversationService;
    private final UserMapper userMapper;

    public ConversationController(ConversationService conversationService, UserMapper userMapper) {
        this.conversationService = conversationService;
        this.userMapper = userMapper;
    }

    @PostMapping
    public ResponseEntity<Result<ConversationResponse>> create(
            @Valid @RequestBody CreateConversationRequest request) {
        ConversationResponse response = conversationService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response));
    }

    @GetMapping
    public Result<List<ConversationResponse>> list(
            @RequestParam(required = false) ConversationStatus status) {
        if (status == null) {
            return Result.success(conversationService.listAll());
        }
        return Result.success(conversationService.listByStatus(status));
    }

    @GetMapping("/{id}")
    public Result<ConversationResponse> getById(@PathVariable Long id) {
        return Result.success(conversationService.getById(id));
    }

    @PutMapping("/{id}/assign")
    public Result<ConversationResponse> assign(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long agentId = resolveAgentId(userDetails);
        return Result.success(conversationService.assign(id, agentId));
    }

    @PutMapping("/{id}/resolve")
    public Result<ConversationResponse> resolve(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long agentId = resolveAgentId(userDetails);
        return Result.success(conversationService.resolve(id, agentId));
    }

    @PutMapping("/{id}/return-to-queue")
    public Result<ConversationResponse> returnToQueue(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long agentId = resolveAgentId(userDetails);
        return Result.success(conversationService.returnToQueue(id, agentId));
    }

    private Long resolveAgentId(UserDetails userDetails) {
        if (userDetails == null) {
            throw new ResourceNotFoundException("User not authenticated");
        }
        String email = userDetails.getUsername();
        User user = userMapper.selectOne(new QueryLambdaWrapper<User>()
                .eq(User::getEmail, email));
        if (user == null) {
            throw new ResourceNotFoundException("User not found: " + email);
        }
        return user.getId();
    }
}
