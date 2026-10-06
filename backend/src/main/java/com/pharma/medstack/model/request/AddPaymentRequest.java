package com.pharma.medstack.model.request;

import com.pharma.medstack.entity.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public record AddPaymentRequest(
    @NotNull PaymentMethod paymentMethod,
    @NotNull @DecimalMin("0.01") BigDecimal amount,
    String transactionRef,
    Instant paymentTime
) {
    public AddPaymentRequest(PaymentMethod paymentMethod, BigDecimal amount, String transactionRef) {
        this(paymentMethod, amount, transactionRef, null);
    }
}
