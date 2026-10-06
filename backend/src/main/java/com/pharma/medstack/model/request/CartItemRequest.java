package com.pharma.medstack.model.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CartItemRequest(
    @NotNull UUID medicineId,
    @Min(1) int quantity,
    String dispenseUnit
) {
    public CartItemRequest(UUID medicineId, int quantity) {
        this(medicineId, quantity, "UNIT");
    }

    public String getDispenseUnitOrDefault() {
        return (dispenseUnit != null && !dispenseUnit.isBlank()) ? dispenseUnit.trim().toUpperCase() : "UNIT";
    }
}
