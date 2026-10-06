package com.pharma.medstack.model.response;

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
    Instant createdAt
) {}
