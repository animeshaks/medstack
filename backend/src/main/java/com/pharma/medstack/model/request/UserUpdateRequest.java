package com.pharma.medstack.model.request;

import com.pharma.medstack.entity.Role;
import com.pharma.medstack.entity.UserStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserUpdateRequest(
    String username,
    @NotBlank String fullName,
    @Email String email,
    String phone,
    @NotNull Role role,
    @NotNull UserStatus status
) {
    public UserUpdateRequest(String fullName, String email, String phone, Role role, UserStatus status) {
        this(null, fullName, email, phone, role, status);
    }
}
