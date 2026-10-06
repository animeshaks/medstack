package com.pharma.medstack.model.request;

import java.time.LocalDate;
import java.util.UUID;

public record ReceiveItemRequest(
    UUID itemId,
    Boolean included,
    Integer receivedQuantity,
    Integer receivedFreeQuantity,
    String batchNumber,
    LocalDate expiryDate,
    String itemStatus,
    String remarks
) {}
