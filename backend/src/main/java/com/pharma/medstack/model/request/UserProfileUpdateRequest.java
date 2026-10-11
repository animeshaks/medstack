package com.pharma.medstack.model.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UserProfileUpdateRequest(
    @NotBlank(message = "Full name is required")
    String fullName,

    @Email(message = "Email must be valid")
    String email,

    String phone
) {}
