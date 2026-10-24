package com.pharma.medstack.audit;

import java.util.Map;

public record AuditSummaryResponse(
        long totalEventsToday,
        long successCountToday,
        long failureCountToday,
        int retentionDays,
        String logFilePath,
        long logFileSizeBytes,
        String formattedFileSize,
        Map<String, Long> topActionsToday
) {}
