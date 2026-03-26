package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.opencustomer.server.dto.CannedResponseRequest;
import com.opencustomer.server.dto.CannedResponseResponse;
import com.opencustomer.server.entity.CannedResponse;
import java.util.List;

public interface CannedResponseService extends IService<CannedResponse> {
    List<CannedResponseResponse> listAll();

    CannedResponseResponse create(CannedResponseRequest request, Long userId);

    CannedResponseResponse update(Long id, CannedResponseRequest request);

    void delete(Long id);
}
