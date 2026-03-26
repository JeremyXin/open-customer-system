package com.opencustomer.server.controller;

import com.opencustomer.server.dto.Result;
import com.opencustomer.server.dto.UserInfoResponse;
import com.opencustomer.server.entity.User;
import com.opencustomer.server.mapper.UserMapper;
import com.opencustomer.server.service.PresenceService;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents")
public class AgentController {
    private final PresenceService presenceService;
    private final UserMapper userMapper;

    public AgentController(PresenceService presenceService, UserMapper userMapper) {
        this.presenceService = presenceService;
        this.userMapper = userMapper;
    }

    @GetMapping("/online")
    public Result<List<UserInfoResponse>> listOnlineAgents() {
        Set<String> onlineAgentIds = presenceService.getOnlineAgentIds();
        if (onlineAgentIds.isEmpty()) {
            return Result.success(List.of());
        }
        List<Long> userIds = onlineAgentIds.stream()
                .map(Long::valueOf)
                .collect(Collectors.toList());
        List<User> users = userMapper.selectBatchIds(userIds);
        List<UserInfoResponse> responses = users.stream()
                .map(user -> new UserInfoResponse(
                        user.getId(),
                        user.getEmail(),
                        user.getDisplayName(),
                        user.getRole().name(),
                        user.getStatus().name()))
                .collect(Collectors.toList());
        return Result.success(responses);
    }
}
