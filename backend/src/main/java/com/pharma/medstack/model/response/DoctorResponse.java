package com.pharma.medstack.model.response;

import java.time.Instant;
import java.util.UUID;

public record DoctorResponse(
    UUID id,
    String name,
    String specialization,
    String phone,
    String email,
    String clinicHospitalName,
    String registrationNumber,
    Instant createdAt,
    Instant updatedAt
) {}
