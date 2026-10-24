package com.pharma.medstack.model.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record OldStockRequest(
    UUID medicineId,

    @NotBlank(message = "Medicine name is mandatory")
    String medicineName,

    String genericName,
    String category,
    String manufacturer,
    String hsnCode,
    String rackLocation,

    @NotBlank(message = "Batch number is mandatory")
    String batchNumber,

    @NotNull(message = "Expiry date is mandatory")
    LocalDate expiryDate,

    @NotNull(message = "MRP is mandatory")
    @DecimalMin(value = "0.01", message = "MRP must be greater than 0")
    BigDecimal mrp,

    BigDecimal costPrice,

    @NotNull(message = "Selling price is mandatory")
    @DecimalMin(value = "0.01", message = "Selling price must be greater than 0")
    BigDecimal sellingPrice,

    @NotNull(message = "Quantity is mandatory")
    @Min(value = 0, message = "Quantity cannot be negative")
    Integer quantity,

    Integer looseQuantity,
    Integer unitsPerPack,
    BigDecimal gstRate,
    Boolean requiresPrescription,
    Integer minStockAlertLevel,
    String stockNotes
) {}
