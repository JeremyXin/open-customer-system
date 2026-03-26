package com.opencustomer.server.websocket;

import java.security.Principal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import com.opencustomer.server.service.AgentHeartbeatService;
import com.opencustomer.server.service.PresenceService;

@Component
public class WebSocketEventListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(WebSocketEventListener.class);
    private final PresenceService presenceService;
    private final AgentHeartbeatService agentHeartbeatService;

    public WebSocketEventListener(PresenceService presenceService,
                                  AgentHeartbeatService agentHeartbeatService) {
        this.presenceService = presenceService;
        this.agentHeartbeatService = agentHeartbeatService;
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Principal principal = accessor.getUser();
        LOGGER.info("WebSocket connected sessionId={}, principal={}", sessionId, principalName(principal));
        if (isAgentPrincipal(principal)) {
            String agentId = principal.getName();
            presenceService.setOnline(agentId, sessionId);
            agentHeartbeatService.agentConnected(Long.valueOf(agentId), sessionId);
        }
    }

    @EventListener
    public void handleSessionDisconnected(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Principal principal = accessor.getUser();
        LOGGER.info("WebSocket disconnected sessionId={}, principal={}", sessionId, principalName(principal));
        if (isAgentPrincipal(principal)) {
            String agentId = principal.getName();
            presenceService.setOffline(agentId);
            agentHeartbeatService.agentDisconnected(Long.valueOf(agentId));
        }
    }

    private boolean isAgentPrincipal(Principal principal) {
        if (principal == null) {
            return false;
        }
        String name = principal.getName();
        return name != null && name.matches("\\d+");
    }

    private String principalName(Principal principal) {
        return principal == null ? "anonymous" : principal.getName();
    }
}
