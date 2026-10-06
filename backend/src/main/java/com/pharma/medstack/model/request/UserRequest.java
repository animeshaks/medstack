package com.pharma.medstack.model.request;

import com.pharma.medstack.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserRequest(
    @NotBlank @Size(min = 3, max = 100) String username,
    @NotBlank @Size(min = 6) String password,
    @NotBlank String fullName,
    @Email String email,
    String phone,
    @NotNull Role role
) {}
