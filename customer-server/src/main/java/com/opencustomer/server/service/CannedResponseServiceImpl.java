package com.opencustomer.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.opencustomer.server.dto.CannedResponseRequest;
import com.opencustomer.server.dto.CannedResponseResponse;
import com.opencustomer.server.entity.CannedResponse;
import com.opencustomer.server.exception.DuplicateResourceException;
import com.opencustomer.server.exception.ResourceNotFoundException;
import com.opencustomer.server.mapper.CannedResponseMapper;
import com.opencustomer.server.utils.QueryLambdaWrapper;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CannedResponseServiceImpl
        extends ServiceImpl<CannedResponseMapper, CannedResponse>
        implements CannedResponseService {

    @Override
    public List<CannedResponseResponse> listAll() {
        return this.list(new QueryLambdaWrapper<CannedResponse>()
                .orderByAsc(CannedResponse::getShortcut))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public CannedResponseResponse create(CannedResponseRequest request, Long userId) {
        CannedResponse existing = this.getOne(new QueryLambdaWrapper<CannedResponse>()
                .eq(CannedResponse::getShortcut, request.getShortcut()));
        if (existing != null) {
            throw new DuplicateResourceException(
                    "Canned response shortcut already exists: " + request.getShortcut());
        }

        LocalDateTime now = LocalDateTime.now();
        CannedResponse cannedResponse = new CannedResponse();
        cannedResponse.setShortcut(request.getShortcut());
        cannedResponse.setContent(request.getContent());
        cannedResponse.setCreatedBy(userId);
        cannedResponse.setCreatedAt(now);
        cannedResponse.setUpdatedAt(now);
        this.save(cannedResponse);
        return toResponse(cannedResponse);
    }

    @Override
    public CannedResponseResponse update(Long id, CannedResponseRequest request) {
        CannedResponse existing = this.getById(id);
        if (existing == null) {
            throw new ResourceNotFoundException("Canned response not found: " + id);
        }

        CannedResponse duplicate = this.getOne(new QueryLambdaWrapper<CannedResponse>()
                .eq(CannedResponse::getShortcut, request.getShortcut())
                .ne(CannedResponse::getId, id));
        if (duplicate != null) {
            throw new DuplicateResourceException(
                    "Canned response shortcut already exists: " + request.getShortcut());
        }

        existing.setShortcut(request.getShortcut());
        existing.setContent(request.getContent());
        existing.setUpdatedAt(LocalDateTime.now());
        this.updateById(existing);
        return toResponse(existing);
    }

    @Override
    public void delete(Long id) {
        CannedResponse existing = this.getById(id);
        if (existing == null) {
            throw new ResourceNotFoundException("Canned response not found: " + id);
        }
        this.removeById(id);
    }

    private CannedResponseResponse toResponse(CannedResponse entity) {
        CannedResponseResponse response = new CannedResponseResponse();
        response.setId(entity.getId());
        response.setShortcut(entity.getShortcut());
        response.setContent(entity.getContent());
        response.setCreatedBy(entity.getCreatedBy());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
