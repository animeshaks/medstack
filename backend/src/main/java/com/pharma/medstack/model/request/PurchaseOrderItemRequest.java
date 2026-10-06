package com.pharma.medstack.model.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PurchaseOrderItemRequest(
    @NotNull UUID medicineId,
    @NotBlank String batchNumber,
    @NotNull LocalDate expiryDate,
    @Min(1) int quantity,
    Integer freeQuantity,
    String scheme,
    @NotNull @DecimalMin("0.0") BigDecimal costPrice,
    @DecimalMin("0.0") BigDecimal taxPercent,
    @DecimalMin("0.0") BigDecimal discountPercent,
    @DecimalMin("0.0") BigDecimal schemeDiscountPercent,
    @NotNull @DecimalMin("0.0") BigDecimal mrp
) {
    public PurchaseOrderItemRequest(
        UUID medicineId,
        String batchNumber,
        LocalDate expiryDate,
        int quantity,
        BigDecimal costPrice,
        BigDecimal taxPercent,
        BigDecimal mrp
    ) {
        this(medicineId, batchNumber, expiryDate, quantity, 0, null, costPrice, taxPercent, BigDecimal.ZERO, BigDecimal.ZERO, mrp);
    }
}
