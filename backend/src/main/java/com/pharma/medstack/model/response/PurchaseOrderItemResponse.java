package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PurchaseOrderItemResponse(
    UUID id,
    UUID medicineId,
    String medicineName,
    String batchNumber,
    LocalDate expiryDate,
    int quantity,
    int freeQuantity,
    int totalQuantity,
    String scheme,
    BigDecimal costPrice,
    BigDecimal taxPercent,
    BigDecimal mrp,
    BigDecimal discountPercent,
    BigDecimal schemeDiscountPercent,
    BigDecimal discountAmount,
    BigDecimal taxableAmount,
    BigDecimal taxAmount,
    BigDecimal totalAmount,
    Integer receivedQuantity,
    Integer receivedFreeQuantity,
    Integer receivedTotalQuantity,
    String itemStatus,
    String remarks
) {
    public PurchaseOrderItemResponse(
        UUID id,
        UUID medicineId,
        String medicineName,
        String batchNumber,
        LocalDate expiryDate,
        int quantity,
        int freeQuantity,
        int totalQuantity,
        String scheme,
        BigDecimal costPrice,
        BigDecimal taxPercent,
        BigDecimal mrp,
        BigDecimal discountPercent,
        BigDecimal schemeDiscountPercent,
        BigDecimal discountAmount,
        BigDecimal taxableAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount
    ) {
        this(id, medicineId, medicineName, batchNumber, expiryDate, quantity, freeQuantity, totalQuantity, scheme,
             costPrice, taxPercent, mrp, discountPercent, schemeDiscountPercent, discountAmount,
             taxableAmount, taxAmount, totalAmount, null, null, null, "PENDING", null);
    }

    public PurchaseOrderItemResponse(
        UUID id,
        UUID medicineId,
        String medicineName,
        String batchNumber,
        LocalDate expiryDate,
        int quantity,
        BigDecimal costPrice,
        BigDecimal taxPercent,
        BigDecimal mrp
    ) {
        this(id, medicineId, medicineName, batchNumber, expiryDate, quantity, 0, quantity, null,
             costPrice, taxPercent, mrp, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
             costPrice != null ? costPrice.multiply(BigDecimal.valueOf(quantity)) : BigDecimal.ZERO,
             BigDecimal.ZERO,
             costPrice != null ? costPrice.multiply(BigDecimal.valueOf(quantity)) : BigDecimal.ZERO,
             null, null, null, "PENDING", null);
    }
}
