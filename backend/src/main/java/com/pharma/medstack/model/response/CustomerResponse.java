package com.pharma.medstack.model.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CustomerResponse(
    UUID id,
    String name,
    String phone,
    String email,
    UUID preferredDoctorId,
    String address,
    int rewardPoints,
    BigDecimal outstandingBalance,
    Instant createdAt
) {
    public CustomerResponse(UUID id, String name, String phone, String email, UUID preferredDoctorId, String address, int rewardPoints, Instant createdAt) {
        this(id, name, phone, email, preferredDoctorId, address, rewardPoints, BigDecimal.ZERO, createdAt);
    }
}
