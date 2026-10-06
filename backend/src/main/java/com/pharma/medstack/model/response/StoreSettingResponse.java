package com.pharma.medstack.model.response;

import java.time.Instant;
import java.util.UUID;

public record StoreSettingResponse(
    UUID id,
    String storeName,
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
    String footerNote,
    Instant updatedAt
) {}
