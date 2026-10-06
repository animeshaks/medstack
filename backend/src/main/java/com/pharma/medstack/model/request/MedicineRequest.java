package com.pharma.medstack.model.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record MedicineRequest(
    @NotBlank String name,
    String genericName,
    String category,
    String manufacturer,
    String hsnCode,
    String rackLocation,
    boolean requiresPrescription,
    @Min(0) int minStockAlertLevel,
    Integer unitsPerPack,
    String symptoms,
    String targetAgeGroup
) {
    public MedicineRequest(String name, String genericName, String category, String manufacturer,
                           String hsnCode, String rackLocation, boolean requiresPrescription, int minStockAlertLevel) {
        this(name, genericName, category, manufacturer, hsnCode, rackLocation, requiresPrescription, minStockAlertLevel, 1, null, "ALL");
    }

    public MedicineRequest(String name, String genericName, String category, String manufacturer,
                           String hsnCode, String rackLocation, boolean requiresPrescription, int minStockAlertLevel, Integer unitsPerPack) {
        this(name, genericName, category, manufacturer, hsnCode, rackLocation, requiresPrescription, minStockAlertLevel, unitsPerPack, null, "ALL");
    }

    public int getUnitsPerPackOrDefault() {
        return (unitsPerPack != null && unitsPerPack > 0) ? unitsPerPack : 1;
    }

    public String getTargetAgeGroupOrDefault() {
        return (targetAgeGroup != null && !targetAgeGroup.isBlank()) ? targetAgeGroup.trim().toUpperCase() : "ALL";
    }
}
