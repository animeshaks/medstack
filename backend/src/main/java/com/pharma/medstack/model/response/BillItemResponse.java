package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BillItemResponse(
    UUID id,
    UUID inventoryBatchId,
    UUID medicineId,
    String medicineName,
    String batchNumber,
    LocalDate expiryDate,
    int quantity,
    BigDecimal unitPrice,
    BigDecimal taxRate,
    BigDecimal subtotal,
    String dispenseUnit,
    int packSize,
    boolean rxRequired
) {
    public BillItemResponse(UUID id, UUID inventoryBatchId, UUID medicineId, String medicineName,
                            String batchNumber, LocalDate expiryDate, int quantity,
                            BigDecimal unitPrice, BigDecimal taxRate, BigDecimal subtotal,
                            String dispenseUnit, int packSize) {
        this(id, inventoryBatchId, medicineId, medicineName, batchNumber, expiryDate, quantity,
             unitPrice, taxRate, subtotal, dispenseUnit, packSize, false);
    }

    public BillItemResponse(UUID id, UUID inventoryBatchId, UUID medicineId, String medicineName,
                            String batchNumber, LocalDate expiryDate, int quantity,
                            BigDecimal unitPrice, BigDecimal taxRate, BigDecimal subtotal) {
        this(id, inventoryBatchId, medicineId, medicineName, batchNumber, expiryDate, quantity,
             unitPrice, taxRate, subtotal, "UNIT", 1, false);
    }
}
