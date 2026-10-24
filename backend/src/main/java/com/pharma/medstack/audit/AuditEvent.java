package com.pharma.medstack.audit;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Represents an immutable audit record capturing user activity, outcomes, and errors.
 * Formatted in human-readable local time.
 */
public record AuditEvent(
        String timestamp,
        long epochMs,
        String username,
        String role,
        String action,
        String method,
        String uri,
        String outcome, // "SUCCESS" or "FAILURE"
        int statusCode,
        long durationMs,
        String clientIp,
        String requestId,
        String details,
        String errorMessage,
        String source
) {
    private static final DateTimeFormatter LOCAL_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS zzz").withZone(ZoneId.systemDefault());

    public static String nowLocal() {
        return LOCAL_FORMATTER.format(Instant.now());
    }

    public static String formatEpoch(long epochMs) {
        return LOCAL_FORMATTER.format(Instant.ofEpochMilli(epochMs));
    }

    /**
     * Human-readable formatted string for file logging.
     * Contains all mandatory audit fields: local datetime, username, action, outcome, status, IP, duration, details/errors.
     */
    public String toLogLine() {
        StringBuilder sb = new StringBuilder();
        sb.append("[").append(timestamp != null ? timestamp : nowLocal()).append("] | ");
        sb.append("USER: ").append(username != null ? username : "ANONYMOUS");
        if (role != null && !role.isBlank()) {
            sb.append(" (").append(role).append(")");
        }
        sb.append(" | ACTION: ").append(action);
        sb.append(" | OUTCOME: ").append(outcome != null ? outcome : "UNKNOWN");
        if (statusCode > 0) {
            sb.append(" (").append(statusCode).append(")");
        }
        sb.append(" | DURATION: ").append(durationMs).append("ms");
        sb.append(" | IP: ").append(clientIp != null ? clientIp : "UNKNOWN");
        sb.append(" | REQ_ID: ").append(requestId != null ? requestId : "N/A");
        if (errorMessage != null && !errorMessage.isBlank()) {
            sb.append(" | ERROR: ").append(errorMessage.replaceAll("[\r\n]+", " "));
        }
        if (details != null && !details.isBlank()) {
            sb.append(" | DETAILS: ").append(details.replaceAll("[\r\n]+", " "));
        }
        return sb.toString();
    }
}
