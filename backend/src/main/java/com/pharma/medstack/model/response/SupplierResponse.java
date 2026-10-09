package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SupplierResponse(
    UUID id,
    String name,
    String contactPerson,
    String phone,
    String email,
    String gstin,
    String dlNumber,
    String address,
    BigDecimal outstandingBalance,
    Instant createdAt,
    Instant updatedAt
) {
    public SupplierResponse(
        UUID id,
        String name,
        String contactPerson,
        String phone,
        String email,
        String gstin,
        String dlNumber,
        String address,
        Instant createdAt,
        Instant updatedAt
    ) {
        this(id, name, contactPerson, phone, email, gstin, dlNumber, address, BigDecimal.ZERO, createdAt, updatedAt);
    }
}
