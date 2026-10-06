package com.pharma.medstack.model.response;

import java.util.List;

public record InventoryReportResponse(
    long totalActiveBatches,
    long lowStockCount,
    long nearExpiryCount,
    long expiredCount,
    List<InventoryBatchResponse> lowStockItems,
    List<InventoryBatchResponse> nearExpiryItems
) {}
