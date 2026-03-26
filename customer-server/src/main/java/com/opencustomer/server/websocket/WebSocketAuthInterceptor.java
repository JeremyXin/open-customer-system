package com.opencustomer.server.websocket;

import com.opencustomer.server.constant.AppConstants;
import com.opencustomer.server.security.JwtTokenService;
import com.opencustomer.server.security.UserDetailsServiceImpl;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {
    private static final String VISITOR_HEADER = "X-Visitor-Token";
    private static final String VISITOR_PREFIX = "visitor:";

    private final JwtTokenService jwtTokenService;
    private final UserDetailsServiceImpl userDetailsService;

    public WebSocketAuthInterceptor(JwtTokenService jwtTokenService, UserDetailsServiceImpl userDetailsService) {
        this.jwtTokenService = jwtTokenService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() != StompCommand.CONNECT) {
            return message;
        }

        String token = resolveBearerToken(accessor);
        if (token != null) {
            if (!jwtTokenService.validateToken(token)) {
                throw new MessageDeliveryException("Invalid authentication");
            }
            Long userId = jwtTokenService.getUserIdFromToken(token);
            if (userId == null) {
                throw new MessageDeliveryException("Invalid authentication");
            }
            userDetailsService.loadUserByUserId(userId);
            accessor.setUser(new SimplePrincipal(String.valueOf(userId)));
            return message;
        }

        String visitorToken = resolveFirstHeader(accessor, VISITOR_HEADER);
        if (visitorToken != null) {
            accessor.setUser(new SimplePrincipal(VISITOR_PREFIX + visitorToken));
            return message;
        }

        throw new MessageDeliveryException("Missing authentication");
    }

    private String resolveBearerToken(StompHeaderAccessor accessor) {
        String header = resolveFirstHeader(accessor, "Authorization");
        if (header == null) {
            return null;
        }
        if (header.startsWith(AppConstants.TOKEN_PREFIX)) {
            return header.substring(AppConstants.JWT_TOKEN_PREFIX_LENGTH);
        }
        return null;
    }

    private String resolveFirstHeader(StompHeaderAccessor accessor, String name) {
        List<String> values = accessor.getNativeHeader(name);
        if (values == null || values.isEmpty()) {
            return null;
        }
        String value = values.get(0);
        return value == null || value.isBlank() ? null : value;
    }

    private static final class SimplePrincipal implements Principal {
        private final String name;

        private SimplePrincipal(String name) {
            this.name = name == null || name.isBlank() ? UUID.randomUUID().toString() : name;
        }

        @Override
        public String getName() {
            return name;
        }
    }
}
