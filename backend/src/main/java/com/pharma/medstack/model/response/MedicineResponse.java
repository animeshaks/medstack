package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MedicineResponse(
    UUID id,
    String name,
    String genericName,
    String category,
    String manufacturer,
    String hsnCode,
    String rackLocation,
    boolean requiresPrescription,
    int minStockAlertLevel,
    int unitsPerPack,
    String symptoms,
    String targetAgeGroup,
    BigDecimal gstRate,
    Instant createdAt
) {
    public MedicineResponse(UUID id, String name, String genericName, String category,
                            String manufacturer, String hsnCode, String rackLocation,
                            boolean requiresPrescription, int minStockAlertLevel,
                            int unitsPerPack, String symptoms, String targetAgeGroup,
                            Instant createdAt) {
        this(id, name, genericName, category, manufacturer, hsnCode, rackLocation,
             requiresPrescription, minStockAlertLevel, unitsPerPack, symptoms, targetAgeGroup,
             new BigDecimal("5.00"), createdAt);
    }
}
