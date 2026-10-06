package com.pharma.medstack.model.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateStoreSettingRequest(
    @NotBlank String storeName,
    String tagline,
    String address,
    String city,
    String state,
    String pincode,
    String phone,
    String email,
    String gstin,
    String dlNumber,
    String upiId,
    String footerNote
) {}
