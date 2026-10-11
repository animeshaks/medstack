package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PurchaseReportResponse(
    LocalDate date,
    BigDecimal totalAmount,
    BigDecimal taxAmount,
    BigDecimal paidAmount,
    BigDecimal dueAmount,
    long orderCount
) {}
