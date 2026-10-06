package com.pharma.medstack.model.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PurchaseOrderRequest(
    @NotNull UUID supplierId,
    String invoiceNumber,
    LocalDate invoiceDate,
    @DecimalMin("0.0") BigDecimal discountPercent,
    @DecimalMin("0.0") BigDecimal discountAmount,
    @NotEmpty @Valid List<PurchaseOrderItemRequest> items
) {
    public PurchaseOrderRequest(
        UUID supplierId,
        String invoiceNumber,
        LocalDate invoiceDate,
        List<PurchaseOrderItemRequest> items
    ) {
        this(supplierId, invoiceNumber, invoiceDate, BigDecimal.ZERO, BigDecimal.ZERO, items);
    }
}
