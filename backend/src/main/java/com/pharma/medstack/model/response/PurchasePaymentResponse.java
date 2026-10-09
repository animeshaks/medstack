package com.pharma.medstack.model.response;

import com.pharma.medstack.entity.PaymentMethod;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PurchasePaymentResponse(
    UUID id,
    UUID purchaseOrderId,
    String invoiceNumber,
    UUID supplierId,
    String supplierName,
    PaymentMethod paymentMethod,
    BigDecimal amount,
    String transactionRef,
    Instant paymentTime,
    String notes,
    Instant createdAt
) {}
