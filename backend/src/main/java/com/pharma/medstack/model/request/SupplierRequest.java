package com.pharma.medstack.model.request;

import jakarta.validation.constraints.NotBlank;

public record SupplierRequest(
    @NotBlank String name,
    String contactPerson,
    String phone,
    String email,
    String gstin,
    String dlNumber,
    String address
) {}
