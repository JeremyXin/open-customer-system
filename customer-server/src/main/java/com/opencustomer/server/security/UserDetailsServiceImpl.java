package com.opencustomer.server.security;

import com.opencustomer.server.entity.User;
import com.opencustomer.server.mapper.UserMapper;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * 用户认证信息加载服务
 * 从数据库读取用户信息并转换为 Spring Security 的 UserDetails。
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {
    private final UserMapper userMapper;

    public UserDetailsServiceImpl(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userMapper.selectOne(new QueryLambdaWrapper<User>()
                .eq(User::getEmail, email));
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + email);
        }
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                List.of(new SimpleGrantedAuthority(user.getRole().name())));
    }

    public UserDetails loadUserByUserId(Long userId) throws UsernameNotFoundException {
        User user = userMapper.selectOne(new QueryLambdaWrapper<User>()
                .eq(User::getId, userId));
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + userId);
        }
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                List.of(new SimpleGrantedAuthority(user.getRole().name())));
    }
}
