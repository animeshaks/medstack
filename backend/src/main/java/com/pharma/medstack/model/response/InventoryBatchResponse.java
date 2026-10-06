package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record InventoryBatchResponse(
    UUID id,
    UUID medicineId,
    String medicineName,
    String genericName,
    String batchNumber,
    LocalDate expiryDate,
    BigDecimal mrp,
    BigDecimal costPrice,
    BigDecimal sellingPrice,
    int quantity,
    int looseQuantity,
    int unitsPerPack,
    int totalUnits,
    boolean isRetired,
    int minStockAlertLevel,
    boolean lowStock
) {
    public InventoryBatchResponse(UUID id, UUID medicineId, String medicineName, String genericName,
                                  String batchNumber, LocalDate expiryDate, BigDecimal mrp, BigDecimal costPrice,
                                  BigDecimal sellingPrice, int quantity, boolean isRetired, int minStockAlertLevel,
                                  boolean lowStock) {
        this(id, medicineId, medicineName, genericName, batchNumber, expiryDate, mrp, costPrice, sellingPrice,
             quantity, 0, 1, quantity, isRetired, minStockAlertLevel, lowStock);
    }
}
