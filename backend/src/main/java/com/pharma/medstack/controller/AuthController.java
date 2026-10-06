package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.AuthRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.AuthenticationResult;
import com.pharma.medstack.security.AuthHandler;
import com.pharma.medstack.security.AuthHandlerFactory;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {

    private final AuthHandlerFactory authHandlerFactory;

    public AuthController(AuthHandlerFactory authHandlerFactory) {
        this.authHandlerFactory = authHandlerFactory;
    }

    @PostMapping("/login")
    public ApiResponse<AuthenticationResult> login(@Valid @RequestBody AuthRequest request) {
        AuthHandler handler = authHandlerFactory.getHandler(request.authType());
        AuthenticationResult result = handler.authenticate(request);
        return ApiResponse.success(result, "Login successful", 200);
    }
}
