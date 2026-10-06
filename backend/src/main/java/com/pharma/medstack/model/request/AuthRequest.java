package com.pharma.medstack.model.request;

import com.pharma.medstack.security.AuthType;
import jakarta.validation.constraints.NotBlank;

public record AuthRequest(
    @NotBlank String username,
    @NotBlank String password,
    AuthType authType
) {
    public AuthRequest {
        if (authType == null) {
            authType = AuthType.PASSWORD;
        }
    }
}
