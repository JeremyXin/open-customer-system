package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.opencustomer.server.dto.LoginRequest;
import com.opencustomer.server.dto.LoginResponse;
import com.opencustomer.server.dto.RefreshRequest;
import com.opencustomer.server.dto.UserInfoResponse;
import com.opencustomer.server.entity.User;

/**
 * Authentication service contract.
 */
public interface AuthService extends IService<User> {
    LoginResponse login(LoginRequest request);

    LoginResponse refresh(RefreshRequest request);

    UserInfoResponse getCurrentUser(String email);
}
