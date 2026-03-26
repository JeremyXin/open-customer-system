package com.opencustomer.server.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.opencustomer.server.enums.UserRole;
import com.opencustomer.server.enums.UserStatus;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * 用户实体
 * 对应 users 表,用于认证与业务数据读取。
 */
@Data
@TableName("users")
public class User {
    @TableField("id")
    private Long id;

    @TableField("email")
    private String email;

    @TableField("password_hash")
    private String passwordHash;

    @TableField("display_name")
    private String displayName;

    @TableField("role")
    private UserRole role;

    @TableField("status")
    private UserStatus status;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;

}
