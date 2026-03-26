package com.opencustomer.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.opencustomer.server.entity.Message;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MessageMapper extends BaseMapper<Message> {
}
