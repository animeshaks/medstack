package com.pharma.medstack.model.response;

import java.time.Instant;
import java.util.UUID;

public record BillAuditLogResponse(
    UUID id,
    UUID salesOrderId,
    String action,
    String oldSnapshot,
    String newSnapshot,
    String changedBy,
    Instant changedAt
) {}
