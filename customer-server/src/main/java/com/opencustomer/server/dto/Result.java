package com.opencustomer.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {
    private boolean success;
    private T data;
    private String message;
    private Integer code;

    public static <T> Result<T> success(T data) {
        return Result.<T>builder()
                .success(true)
                .data(data)
                .code(200)
                .build();
    }

    public static <T> Result<T> success() {
        return success(null);
    }

    public static <T> Result<T> error(String message) {
        return Result.<T>builder()
                .success(false)
                .message(message)
                .code(500)
                .build();
    }

    public static <T> Result<T> error(int code, String message) {
        return Result.<T>builder()
                .success(false)
                .message(message)
                .code(code)
                .build();
    }
}
