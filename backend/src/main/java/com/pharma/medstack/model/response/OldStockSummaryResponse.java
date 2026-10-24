package com.pharma.medstack.model.response;

import java.math.BigDecimal;

public record OldStockSummaryResponse(
    long totalBatches,
    long activeBatches,
    long clearedBatches,
    long totalUnitsRemaining,
    BigDecimal totalCostValue,
    BigDecimal totalMrpValue
) {}
