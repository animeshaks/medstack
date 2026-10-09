package com.pharma.medstack.model.request;

import com.pharma.medstack.entity.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public record PayPurchaseOrderRequest(
    @NotNull PaymentMethod paymentMethod,
    @NotNull @DecimalMin("0.01") BigDecimal amount,
    String transactionRef,
    Instant paymentTime,
    String notes
) {
    public PayPurchaseOrderRequest(PaymentMethod paymentMethod, BigDecimal amount, String transactionRef) {
        this(paymentMethod, amount, transactionRef, null, null);
    }
}
