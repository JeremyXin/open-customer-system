package com.opencustomer.server.utils;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

/**
 * QueryLambdaWrapper 适配类
 * 统一项目内查询包装器命名,复用 MyBatis-Plus LambdaQueryWrapper。
 */
public class QueryLambdaWrapper<T> extends LambdaQueryWrapper<T> {
}
