package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExpenseResponse(
    UUID id,
    String category,
    BigDecimal amount,
    String description,
    LocalDate expenseDate,
    String loggedBy,
    Instant createdAt
) {}
