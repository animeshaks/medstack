package com.pharma.medstack.security;

import com.pharma.medstack.model.request.AuthRequest;
import com.pharma.medstack.model.response.AuthenticationResult;

public interface AuthHandler {
    AuthType supports();
    AuthenticationResult authenticate(AuthRequest request);
}
