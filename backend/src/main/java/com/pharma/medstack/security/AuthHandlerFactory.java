package com.pharma.medstack.security;

import com.pharma.medstack.exception.BusinessValidationException;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class AuthHandlerFactory {

    private final List<AuthHandler> handlers;
    private final Map<AuthType, AuthHandler> handlerMap;

    public AuthHandlerFactory(List<AuthHandler> handlers) {
        this.handlers = handlers;
        this.handlerMap = new EnumMap<>(AuthType.class);
    }

    @PostConstruct
    public void init() {
        for (AuthHandler handler : handlers) {
            handlerMap.put(handler.supports(), handler);
        }
    }

    public AuthHandler getHandler(AuthType type) {
        AuthHandler handler = handlerMap.get(type);
        if (handler == null) {
            throw new BusinessValidationException("Unsupported authentication type: " + type);
        }
        return handler;
    }
}
