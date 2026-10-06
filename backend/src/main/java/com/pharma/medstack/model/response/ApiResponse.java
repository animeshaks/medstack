package com.pharma.medstack.model.response;

import java.time.Instant;

public record ApiResponse<T>(
    boolean success,
    int statusCode,
    String message,
    T data,
    ErrorDetail error,
    Instant timestamp
) {
    public static <T> ApiResponse<T> success(T data, String message, int statusCode) {
        return new ApiResponse<>(true, statusCode, message, data, null, Instant.now());
    }

    public static <T> ApiResponse<T> error(String message, int statusCode, ErrorDetail error) {
        return new ApiResponse<>(false, statusCode, message, null, error, Instant.now());
    }
}
