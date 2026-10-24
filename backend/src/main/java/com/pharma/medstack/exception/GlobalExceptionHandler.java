package com.pharma.medstack.exception;

import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.ErrorDetail;
import jakarta.servlet.http.HttpServletRequest;
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

    private void setAuditError(HttpServletRequest request, String message) {
        if (request != null && message != null) {
            request.setAttribute("AUDIT_ERROR_MESSAGE", message);
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationExceptions(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = new HashMap<>();
        StringBuilder summary = new StringBuilder("Validation failed: ");
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
            summary.append(error.getField()).append(" (").append(error.getDefaultMessage()).append("); ");
        }
        setAuditError(request, summary.toString().trim());
        return ApiResponse.error("Validation failed", HttpStatus.BAD_REQUEST.value(), new ErrorDetail("VALIDATION_ERROR", errors));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleResourceNotFoundException(ResourceNotFoundException ex, HttpServletRequest request) {
        setAuditError(request, ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.NOT_FOUND.value(), new ErrorDetail("NOT_FOUND", null));
    }

    @ExceptionHandler(DuplicateResourceException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> handleDuplicateResourceException(DuplicateResourceException ex, HttpServletRequest request) {
        setAuditError(request, ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.CONFLICT.value(), new ErrorDetail("DUPLICATE_RESOURCE", null));
    }

    @ExceptionHandler(InsufficientStockException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleInsufficientStockException(InsufficientStockException ex, HttpServletRequest request) {
        setAuditError(request, ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("INSUFFICIENT_STOCK", null));
    }

    @ExceptionHandler(InvalidBillException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleInvalidBillException(InvalidBillException ex, HttpServletRequest request) {
        setAuditError(request, ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("INVALID_BILL", null));
    }

    @ExceptionHandler(BusinessValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBusinessValidationException(BusinessValidationException ex, HttpServletRequest request) {
        setAuditError(request, ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("BUSINESS_VALIDATION", null));
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleAccessDeniedException(AccessDeniedException ex, HttpServletRequest request) {
        setAuditError(request, "Access denied: " + ex.getMessage());
        return ApiResponse.error("Access denied", HttpStatus.FORBIDDEN.value(), new ErrorDetail("FORBIDDEN", null));
    }

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> handleAuthenticationException(AuthenticationException ex, HttpServletRequest request) {
        setAuditError(request, "Authentication failed: " + ex.getMessage());
        return ApiResponse.error("Authentication failed", HttpStatus.UNAUTHORIZED.value(), new ErrorDetail("UNAUTHORIZED", null));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleIllegalArgumentException(IllegalArgumentException ex, HttpServletRequest request) {
        log.warn("Illegal argument: {}", ex.getMessage());
        setAuditError(request, "Invalid argument: " + ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), new ErrorDetail("INVALID_ARGUMENT", null));
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleTypeMismatchException(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String msg = "Invalid value '" + ex.getValue() + "' for parameter '" + ex.getName() + "'";
        log.warn("Type mismatch: {}", msg);
        setAuditError(request, msg);
        return ApiResponse.error(msg, HttpStatus.BAD_REQUEST.value(), new ErrorDetail("TYPE_MISMATCH", null));
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public ApiResponse<Void> handleMethodNotSupported(org.springframework.web.HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        setAuditError(request, ex.getMessage());
        return ApiResponse.error(ex.getMessage(), HttpStatus.METHOD_NOT_ALLOWED.value(), new ErrorDetail("METHOD_NOT_ALLOWED", null));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleGenericException(Exception ex, HttpServletRequest request) {
        log.error("Unhandled server exception: {}", ex.getMessage(), ex);
        setAuditError(request, "Server error: " + ex.getClass().getSimpleName() + " - " + ex.getMessage());
        // Do not expose stack traces to the client
        return ApiResponse.error("An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR.value(), new ErrorDetail("INTERNAL_ERROR", null));
    }
}
