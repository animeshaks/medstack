package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SalesReportResponse(
    LocalDate date,
    BigDecimal totalSales,
    BigDecimal totalTax,
    BigDecimal totalDiscount,
    BigDecimal netRevenue,
    long billCount
) {}
