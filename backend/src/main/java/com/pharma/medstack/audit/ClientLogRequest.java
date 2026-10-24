package com.pharma.medstack.audit;

public record ClientLogRequest(
        String action,
        String outcome, // "SUCCESS" or "FAILURE"
        String details,
        String error,
        String requestId
) {}
