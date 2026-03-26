package com.opencustomer.server.controller;

import com.opencustomer.server.dto.LoginRequest;
import com.opencustomer.server.dto.LoginResponse;
import com.opencustomer.server.dto.RefreshRequest;
import com.opencustomer.server.dto.Result;
import com.opencustomer.server.dto.UserInfoResponse;
import com.opencustomer.server.exception.AuthenticationException;
import com.opencustomer.server.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auth endpoints for login, refresh, and current user.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<Result<LoginResponse>> login(
            @Validated @RequestBody LoginRequest request) {
        return ResponseEntity.ok(Result.success(authService.login(request)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<Result<LoginResponse>> refresh(
            @Validated @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(Result.success(authService.refresh(request)));
    }

    @GetMapping("/me")
    public Result<UserInfoResponse> me() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AuthenticationException("Unauthorized");
        }
        String email = extractEmail(authentication.getPrincipal());
        return Result.success(authService.getCurrentUser(email));
    }

    private String extractEmail(Object principal) {
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        if (principal instanceof String email && !email.isBlank()) {
            return email;
        }
        throw new AuthenticationException("Unauthorized");
    }
}
