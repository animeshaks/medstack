package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SupplierKhataSummaryResponse(
    UUID supplierId,
    String supplierName,
    String contactPerson,
    String phone,
    String email,
    String gstin,
    String dlNumber,
    String address,
    BigDecimal outstandingBalance,
    long totalOrdersCount,
    long unpaidOrdersCount,
    BigDecimal totalPurchasedAmount,
    BigDecimal totalPaidAmount,
    Instant lastPurchaseDate,
    Instant lastPaymentDate
) {}
