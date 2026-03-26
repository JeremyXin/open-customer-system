package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.opencustomer.server.dto.LoginRequest;
import com.opencustomer.server.dto.LoginResponse;
import com.opencustomer.server.dto.RefreshRequest;
import com.opencustomer.server.dto.UserInfoResponse;
import com.opencustomer.server.entity.User;
import com.opencustomer.server.exception.AuthenticationException;
import com.opencustomer.server.exception.ResourceNotFoundException;
import com.opencustomer.server.mapper.UserMapper;
import com.opencustomer.server.security.JwtTokenService;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl extends ServiceImpl<UserMapper, User> implements AuthService {
    private final UserMapper userMapper;
    private final JwtTokenService jwtTokenService;
    private final PasswordEncoder passwordEncoder;
    private final long expirationMillis;

    public AuthServiceImpl(
            UserMapper userMapper,
            JwtTokenService jwtTokenService,
            PasswordEncoder passwordEncoder,
            @Value("${app.jwt.expiration:3600000}") long expirationMillis) {
        this.userMapper = userMapper;
        this.jwtTokenService = jwtTokenService;
        this.passwordEncoder = passwordEncoder;
        this.expirationMillis = expirationMillis;
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userMapper.selectOne(new QueryLambdaWrapper<User>()
                .eq(User::getEmail, request.getEmail()));
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AuthenticationException("Invalid credentials");
        }
        return buildLoginResponse(user);
    }

    @Override
    public LoginResponse refresh(RefreshRequest request) {
        String refreshToken = request.getRefreshToken();
        if (!jwtTokenService.validateToken(refreshToken)) {
            throw new AuthenticationException("Invalid refresh token");
        }
        Long userId = jwtTokenService.getUserIdFromToken(refreshToken);
        if (userId == null) {
            throw new AuthenticationException("Invalid refresh token");
        }
        User user = userMapper.selectOne(new QueryLambdaWrapper<User>()
                .eq(User::getId, userId));
        if (user == null) {
            throw new AuthenticationException("Invalid refresh token");
        }
        return buildLoginResponse(user);
    }

    @Override
    public UserInfoResponse getCurrentUser(String email) {
        User user = userMapper.selectOne(new QueryLambdaWrapper<User>()
                .eq(User::getEmail, email));
        if (user == null) {
            throw new ResourceNotFoundException("User not found: " + email);
        }
        return UserInfoResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .status(user.getStatus().name())
                .build();
    }

    private LoginResponse buildLoginResponse(User user) {
        UserInfoResponse userInfo = UserInfoResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
        return LoginResponse.builder()
                .accessToken(jwtTokenService.generateAccessToken(user))
                .refreshToken(jwtTokenService.generateRefreshToken(user))
                .expiresIn(expirationMillis)
                .user(userInfo)
                .build();
    }
}
