package com.opencustomer.server.controller;

import com.opencustomer.server.dto.CannedResponseRequest;
import com.opencustomer.server.dto.CannedResponseResponse;
import com.opencustomer.server.dto.Result;
import com.opencustomer.server.service.CannedResponseService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
@RequestMapping("/api/canned-responses")
public class CannedResponseController {
    private final CannedResponseService cannedResponseService;

    public CannedResponseController(CannedResponseService cannedResponseService) {
        this.cannedResponseService = cannedResponseService;
    }

    @GetMapping
    public Result<List<CannedResponseResponse>> listAll() {
        return Result.success(cannedResponseService.listAll());
    }

    @PostMapping
    public ResponseEntity<Result<CannedResponseResponse>> create(
            @Validated @RequestBody CannedResponseRequest request) {
        CannedResponseResponse response = cannedResponseService.create(request, 1L);
        return ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Result<CannedResponseResponse>> update(
            @PathVariable Long id,
            @Validated @RequestBody CannedResponseRequest request) {
        CannedResponseResponse response = cannedResponseService.update(id, request);
        return ResponseEntity.ok(Result.success(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Result<Void>> delete(@PathVariable Long id) {
        cannedResponseService.delete(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).body(Result.success());
    }
}
