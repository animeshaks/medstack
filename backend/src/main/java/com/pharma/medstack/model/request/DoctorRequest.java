package com.pharma.medstack.model.request;

import jakarta.validation.constraints.NotBlank;

public record DoctorRequest(
    @NotBlank String name,
    String specialization,
    String phone,
    String email,
    String clinicHospitalName,
    String registrationNumber
) {}
