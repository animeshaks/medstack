package com.pharma.medstack.model.response;

import com.pharma.medstack.entity.PurchaseOrderStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PurchaseOrderResponse(
    UUID id,
    UUID supplierId,
    String supplierName,
    String invoiceNumber,
    LocalDate invoiceDate,
    BigDecimal subtotal,
    BigDecimal discountPercent,
    BigDecimal discountAmount,
    BigDecimal totalAmount,
    BigDecimal taxAmount,
    PurchaseOrderStatus status,
    List<PurchaseOrderItemResponse> items,
    Instant createdAt,
    String receivingNotes
) {
    public PurchaseOrderResponse(
        UUID id,
        UUID supplierId,
        String supplierName,
        String invoiceNumber,
        LocalDate invoiceDate,
        BigDecimal subtotal,
        BigDecimal discountPercent,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        BigDecimal taxAmount,
        PurchaseOrderStatus status,
        List<PurchaseOrderItemResponse> items,
        Instant createdAt
    ) {
        this(id, supplierId, supplierName, invoiceNumber, invoiceDate, subtotal,
             discountPercent, discountAmount, totalAmount, taxAmount, status, items, createdAt, null);
    }

    public PurchaseOrderResponse(
        UUID id,
        UUID supplierId,
        String supplierName,
        String invoiceNumber,
        LocalDate invoiceDate,
        BigDecimal totalAmount,
        BigDecimal taxAmount,
        PurchaseOrderStatus status,
        List<PurchaseOrderItemResponse> items,
        Instant createdAt
    ) {
        this(id, supplierId, supplierName, invoiceNumber, invoiceDate,
             totalAmount != null && taxAmount != null ? totalAmount.subtract(taxAmount) : totalAmount,
             BigDecimal.ZERO, BigDecimal.ZERO, totalAmount, taxAmount, status, items, createdAt, null);
    }
}
