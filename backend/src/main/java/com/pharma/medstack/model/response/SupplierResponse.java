package com.pharma.medstack.model.response;

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
    Instant createdAt,
    Instant updatedAt
) {}
