package com.pharma.medstack.security;

import com.pharma.medstack.entity.User;
import com.pharma.medstack.model.request.AuthRequest;
import com.pharma.medstack.model.response.AuthenticationResult;
import com.pharma.medstack.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

@Component
public class UsernamePasswordAuthHandler implements AuthHandler {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;
    private final com.pharma.medstack.audit.AuditService auditService;
    private final long expirationMs;

    public UsernamePasswordAuthHandler(AuthenticationManager authenticationManager,
                                       JwtTokenService jwtTokenService,
                                       UserRepository userRepository,
                                       com.pharma.medstack.audit.AuditService auditService,
                                       @Value("${medstack.jwt.expiration-ms}") long expirationMs) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenService = jwtTokenService;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.expirationMs = expirationMs;
    }

    @Override
    public AuthType supports() {
        return AuthType.PASSWORD;
    }

    @Override
    public AuthenticationResult authenticate(AuthRequest request) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );

            UserDetails userDetails = (UserDetails) auth.getPrincipal();
            String token = jwtTokenService.generateToken(userDetails);
            User user = userRepository.findByUsernameAndIsDeletedFalse(request.username()).orElseThrow();

            auditService.recordBusinessEvent("LOGIN_SUCCESS", user.getUsername(), user.getRole().name(), "SUCCESS", "User logged in successfully", null, null);

            return new AuthenticationResult(
                    token,
                    "Bearer",
                    expirationMs,
                    user.getUsername(),
                    user.getRole().name()
            );
        } catch (Exception e) {
            auditService.recordBusinessEvent("LOGIN_FAILURE", request.username(), "ANONYMOUS", "FAILURE", "Failed login attempt for username: " + request.username(), "Invalid credentials", null);
            throw new BadCredentialsException("Invalid username or password");
        }
    }
}
