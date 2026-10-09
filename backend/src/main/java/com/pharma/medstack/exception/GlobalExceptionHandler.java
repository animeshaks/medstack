package com.pharma.medstack.exception;

import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.ErrorDetail;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }
        return ApiResponse.error("Validation failed", HttpStatus.BAD_REQUEST.value(), new ErrorDetail("VALIDATION_ERROR", errors));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleResourceNotFoundException(ResourceNotFoundException ex) {
        return ApiResponse.error(ex.getMessage(), HttpStatus.NOT_FOUND.value(), new ErrorDetail("NOT_FOUND", null));
    }

    @ExceptionHandler(DuplicateResourceException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> handleDuplicateResourceException(DuplicateResourceException ex) {
        return ApiResponse.error(ex.getMessage(), HttpStatus.CONFLICT.value(), new ErrorDetail("DUPLICATE_RESOURCE", null));
    }

    @ExceptionHandler(InsufficientStockException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleInsufficientStockException(InsufficientStockException ex) {
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("INSUFFICIENT_STOCK", null));
    }

    @ExceptionHandler(InvalidBillException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleInvalidBillException(InvalidBillException ex) {
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("INVALID_BILL", null));
    }

    @ExceptionHandler(BusinessValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBusinessValidationException(BusinessValidationException ex) {
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("BUSINESS_VALIDATION", null));
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleAccessDeniedException(AccessDeniedException ex) {
        return ApiResponse.error("Access denied", HttpStatus.FORBIDDEN.value(), new ErrorDetail("FORBIDDEN", null));
    }

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> handleAuthenticationException(AuthenticationException ex) {
        return ApiResponse.error("Authentication failed", HttpStatus.UNAUTHORIZED.value(), new ErrorDetail("UNAUTHORIZED", null));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleGenericException(Exception ex) {
        log.error("Unhandled server exception: {}", ex.getMessage(), ex);
        // Do not expose stack traces to the client
        return ApiResponse.error("An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR.value(), new ErrorDetail("INTERNAL_ERROR", null));
    }
}
