package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseReportResponse(
    LocalDate date,
    String category,
    BigDecimal amount,
    long count
) {}
