package com.pharma.medstack.model.response;

public record AuthenticationResult(
    String accessToken,
    String tokenType,
    long expiresIn,
    String username,
    String role
) {}
