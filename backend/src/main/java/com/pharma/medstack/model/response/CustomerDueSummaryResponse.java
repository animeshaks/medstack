package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.util.List;

public record CustomerDueSummaryResponse(
    BigDecimal totalOutstandingAmount,
    long totalDueCustomers,
    long totalDueBills,
    List<CustomerBalanceItemResponse> topDueCustomers
) {}
