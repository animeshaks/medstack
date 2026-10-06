package com.pharma.medstack.model.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
    @NotBlank String category,
    @NotNull @DecimalMin("0.01") BigDecimal amount,
    String description,
    @NotNull LocalDate expenseDate
) {}
