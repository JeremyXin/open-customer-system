package com.opencustomer.server.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.opencustomer.server.constant.AppConstants;
import com.opencustomer.server.security.JwtTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiting filter using Caffeine cache
 * - Conversation creation: 5 requests per IP per minute
 * - Message sending: 10 requests per user per minute
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitFilter extends OncePerRequestFilter {
    private static final int CONVERSATION_LIMIT = 5;
    private static final int MESSAGE_LIMIT = 10;
    private static final long WINDOW_DURATION_SECONDS = 60;
    private static final String RETRY_AFTER_SECONDS = "60";

    private final Cache<String, AtomicInteger> rateLimitCache;
    private final JwtTokenService jwtTokenService;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(JwtTokenService jwtTokenService, ObjectMapper objectMapper) {
        this.jwtTokenService = jwtTokenService;
        this.objectMapper = objectMapper;
        this.rateLimitCache = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(WINDOW_DURATION_SECONDS))
                .maximumSize(10000)
                .build();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String path = request.getServletPath();
        String method = request.getMethod();

        // Rate limit conversation creation
        if ("POST".equalsIgnoreCase(method) && "/api/conversations".equals(path)) {
            String ip = getClientIp(request);
            String key = "conv:" + ip;
            if (!checkRateLimit(key, CONVERSATION_LIMIT)) {
                sendRateLimitResponse(response);
                return;
            }
        }

        // Rate limit message sending
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/conversations/.+/messages")) {
            String identifier = getIdentifier(request);
            String key = "msg:" + identifier;
            if (!checkRateLimit(key, MESSAGE_LIMIT)) {
                sendRateLimitResponse(response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Check rate limit for a given key
     * @param key Cache key
     * @param limit Maximum requests allowed
     * @return true if within limit, false if exceeded
     */
    private boolean checkRateLimit(String key, int limit) {
        AtomicInteger counter = rateLimitCache.get(key, k -> new AtomicInteger(0));
        int currentCount = counter.incrementAndGet();
        return currentCount <= limit;
    }

    /**
     * Get identifier for rate limiting: userId from JWT for authenticated users, IP for visitors
     */
    private String getIdentifier(HttpServletRequest request) {
        String token = resolveToken(request);
        if (token != null && jwtTokenService.validateToken(token)) {
            Long userId = jwtTokenService.getUserIdFromToken(token);
            if (userId != null) {
                return "user:" + userId;
            }
        }
        return "ip:" + getClientIp(request);
    }

    /**
     * Extract JWT token from Authorization header
     */
    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(AppConstants.TOKEN_PREFIX)) {
            return header.substring(AppConstants.JWT_TOKEN_PREFIX_LENGTH);
        }
        return null;
    }

    /**
     * Get client IP address, considering proxies
     */
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // Handle multiple IPs in X-Forwarded-For
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    /**
     * Send 429 Too Many Requests response
     */
    private void sendRateLimitResponse(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", RETRY_AFTER_SECONDS);

        Map<String, Object> body = new HashMap<>();
        body.put("code", 429);
        body.put("message", "Too many requests. Please try again later.");

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
