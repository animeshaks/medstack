package com.pharma.medstack.model.request;

import com.pharma.medstack.entity.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateBillRequest(
    UUID customerId,
    String customerName,
    String customerPhone,
    UUID prescribingDoctorId,
    @NotEmpty List<CartItemRequest> items,
    @DecimalMin("0.0") BigDecimal discountAmount,
    @NotNull PaymentMethod paymentMethod,
    String transactionRef,
    Integer redeemPoints,
    @DecimalMin("0.0") BigDecimal paidAmount
) {
    public CreateBillRequest(UUID customerId, UUID prescribingDoctorId, List<CartItemRequest> items, BigDecimal discountAmount, PaymentMethod paymentMethod, String transactionRef) {
        this(customerId, null, null, prescribingDoctorId, items, discountAmount, paymentMethod, transactionRef, 0, null);
    }

    public CreateBillRequest(UUID customerId, String customerName, String customerPhone, UUID prescribingDoctorId, List<CartItemRequest> items, BigDecimal discountAmount, PaymentMethod paymentMethod, String transactionRef) {
        this(customerId, customerName, customerPhone, prescribingDoctorId, items, discountAmount, paymentMethod, transactionRef, 0, null);
    }

    public CreateBillRequest(UUID customerId, String customerName, String customerPhone, UUID prescribingDoctorId, List<CartItemRequest> items, BigDecimal discountAmount, PaymentMethod paymentMethod, String transactionRef, Integer redeemPoints) {
        this(customerId, customerName, customerPhone, prescribingDoctorId, items, discountAmount, paymentMethod, transactionRef, redeemPoints, null);
    }

    public int getRedeemPointsOrDefault() {
        return (redeemPoints != null && redeemPoints > 0) ? redeemPoints : 0;
    }
}
