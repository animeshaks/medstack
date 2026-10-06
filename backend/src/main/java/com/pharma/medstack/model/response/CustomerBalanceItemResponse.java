package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CustomerBalanceItemResponse(
    UUID customerId,
    String customerName,
    String customerPhone,
    BigDecimal outstandingBalance,
    long unpaidBillsCount,
    Instant lastBillDate
) {}
