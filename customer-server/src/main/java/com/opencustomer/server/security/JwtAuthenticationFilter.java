package com.opencustomer.server.security;

import com.opencustomer.server.constant.AppConstants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT authentication filter.
 * Extracts Bearer Token from request header, validates it and sets SecurityContext.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenService jwtTokenService;
    private final UserDetailsServiceImpl userDetailsService;

    public JwtAuthenticationFilter(JwtTokenService jwtTokenService, UserDetailsServiceImpl userDetailsService) {
        this.jwtTokenService = jwtTokenService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && jwtTokenService.validateToken(token)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            Long userId = jwtTokenService.getUserIdFromToken(token);
            if (userId != null) {
                var userDetails = userDetailsService.loadUserByUserId(userId);
                var authentication = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        // WebSocket - auth handled at STOMP level by WebSocketAuthInterceptor
        if (path.startsWith("/ws")) {
            return true;
        }
        // Public auth endpoints
        if ("/api/auth/login".equals(path) || "/api/auth/refresh".equals(path)) {
            return true;
        }
        if ("/api/health".equals(path)) {
            return true;
        }
        // Visitor endpoints - no JWT, use X-Visitor-Token instead
        if (path.startsWith("/api/conversations")) {
            String method = request.getMethod();
            // Allow visitor to create conversations, get conversations, and send/read messages
            if ("POST".equalsIgnoreCase(method) || "GET".equalsIgnoreCase(method)) {
                // If request has a JWT, still process it (agent requests)
                // If no JWT, skip filter (visitor requests)
                String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
                if (authHeader == null || !authHeader.startsWith(AppConstants.TOKEN_PREFIX)) {
                    return true;
                }
            }
        }
        return false;
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(AppConstants.TOKEN_PREFIX)) {
            return header.substring(AppConstants.JWT_TOKEN_PREFIX_LENGTH);
        }
        return null;
    }
}
