package com.pharma.medstack.model.request;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record CustomerRequest(
    @NotBlank String name,
    @NotBlank String phone,
    String email,
    UUID preferredDoctorId,
    String address
) {}
