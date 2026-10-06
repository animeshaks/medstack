package com.pharma.medstack.model.response;

import com.pharma.medstack.entity.PaymentMethod;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentResponse(
    UUID id,
    PaymentMethod paymentMethod,
    String transactionRef,
    BigDecimal amount,
    Instant paymentTime
) {}
