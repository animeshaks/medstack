package com.pharma.medstack.model.response;

import java.math.BigDecimal;

public record DashboardKpiResponse(
    BigDecimal todaySalesTotal,
    long todayBillCount,
    long lowStockItemCount,
    long nearExpiryItemCount,
    long expiredBatchCount,
    long pendingPurchaseOrders
) {}
