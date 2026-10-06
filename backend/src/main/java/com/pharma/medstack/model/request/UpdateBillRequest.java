package com.pharma.medstack.model.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record UpdateBillRequest(
    UUID customerId,
    UUID prescribingDoctorId,
    @NotEmpty List<CartItemRequest> items,
    @DecimalMin("0.0") BigDecimal discountAmount
) {}
