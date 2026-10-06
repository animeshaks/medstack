package com.pharma.medstack.model.response;

import com.pharma.medstack.entity.Role;
import com.pharma.medstack.entity.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
    UUID id,
    String username,
    String fullName,
    String email,
    String phone,
    Role role,
    UserStatus status,
    Instant createdAt
) {}
