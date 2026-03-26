package com.opencustomer.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.opencustomer.server.entity.Conversation;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
}
