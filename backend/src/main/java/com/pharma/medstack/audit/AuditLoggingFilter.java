package com.pharma.medstack.audit;

import com.pharma.medstack.security.JwtTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Filter that automatically intercepts every HTTP request to MedStack API,
 * capturing the mandatory audit metadata: local datetime, username, action, outcome, status, IP, duration, and error details.
 */
@Component
public class AuditLoggingFilter extends OncePerRequestFilter {

    private final AuditService auditService;
    private final JwtTokenService jwtTokenService;

    public AuditLoggingFilter(AuditService auditService, JwtTokenService jwtTokenService) {
        this.auditService = auditService;
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        // Do not audit requests to inspect audit logs to prevent infinite recursion
        if (path.startsWith("/api/v1/audit/logs") ||
            path.startsWith("/api/v1/audit/summary") ||
            path.startsWith("/api/v1/audit/download")) {
            return true;
        }
        // Do not audit static resources or health checks
        return path.startsWith("/swagger-ui") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/api/v1/api-docs") ||
               path.startsWith("/actuator") ||
               path.equals("/favicon.ico");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        long startTime = System.currentTimeMillis();

        // 1. Resolve or generate Request / Correlation ID
        String reqId = request.getHeader("X-Request-Id");
        if (reqId == null || reqId.isBlank()) {
            reqId = "req-" + UUID.randomUUID().toString().substring(0, 8);
        }
        MDC.put("requestId", reqId);
        response.setHeader("X-Request-Id", reqId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            try {
                long duration = System.currentTimeMillis() - startTime;
                int status = response.getStatus();
                String outcome = status < 400 ? "SUCCESS" : "FAILURE";

                // 2. Resolve User & Role
                String username = "ANONYMOUS";
                String role = "ANONYMOUS";

                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                    username = auth.getName();
                    role = auth.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .findFirst()
                            .orElse("USER")
                            .replace("ROLE_", "");
                } else {
                    // Fallback to JWT Bearer header if SecurityContext was cleared
                    String authHeader = request.getHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        try {
                            String jwt = authHeader.substring(7);
                            String extractedUser = jwtTokenService.extractUsername(jwt);
                            if (extractedUser != null) {
                                username = extractedUser;
                                String extractedRole = jwtTokenService.extractRole(jwt);
                                if (extractedRole != null) {
                                    role = extractedRole.replace("ROLE_", "");
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }

                // If this is a login attempt, capture username if available
                String uri = request.getRequestURI();
                if (uri.endsWith("/auth/login") && "ANONYMOUS".equals(username)) {
                    Object loginUser = request.getAttribute("LOGIN_USERNAME");
                    if (loginUser != null) {
                        username = loginUser.toString();
                    }
                }

                // 3. Resolve Action Name
                String action = resolveAction(request);

                // 4. Client IP resolution
                String clientIp = resolveClientIp(request);

                // 5. Error message extraction if failed
                String errorMessage = null;
                if (status >= 400) {
                    errorMessage = (String) request.getAttribute("AUDIT_ERROR_MESSAGE");
                    if (errorMessage == null || errorMessage.isBlank()) {
                        errorMessage = switch (status) {
                            case 400 -> "Bad Request / Validation error";
                            case 401 -> "Unauthorized: Authentication required or invalid credentials";
                            case 403 -> "Forbidden: Insufficient privileges";
                            case 404 -> "Not Found: Resource does not exist";
                            case 405 -> "Method Not Allowed";
                            case 409 -> "Conflict: Duplicate resource";
                            case 500 -> "Internal Server Error";
                            default -> "HTTP status " + status;
                        };
                    }
                }

                // 6. Build details string
                String query = request.getQueryString();
                String details = request.getMethod() + " " + uri + (query != null ? "?" + query : "");

                AuditEvent auditEvent = new AuditEvent(
                        AuditEvent.formatEpoch(startTime),
                        startTime,
                        username,
                        role,
                        action,
                        request.getMethod(),
                        uri,
                        outcome,
                        status,
                        duration,
                        clientIp,
                        reqId,
                        details,
                        errorMessage,
                        "API_FILTER"
                );

                auditService.recordEvent(auditEvent);
            } catch (Exception ex) {
                // Never allow audit logging failure to crash request response
            } finally {
                MDC.remove("requestId");
            }
        }
    }

    private String resolveAction(HttpServletRequest request) {
        // Prioritize explicit client action header if provided
        String clientAction = request.getHeader("X-Client-Action");
        if (clientAction != null && !clientAction.isBlank()) {
            return clientAction.trim().toUpperCase().replace(" ", "_");
        }

        String method = request.getMethod().toUpperCase();
        String uri = request.getRequestURI();

        if (uri.contains("/auth/login")) return "USER_LOGIN";
        if (uri.contains("/auth/refresh")) return "TOKEN_REFRESH";

        if (uri.contains("/bills")) {
            if ("POST".equals(method)) return "CREATE_BILL";
            if ("PUT".equals(method)) return "UPDATE_BILL";
            if ("GET".equals(method) && uri.matches(".*/bills/[a-f0-9\\-]+$")) return "VIEW_BILL";
            if ("GET".equals(method)) return "LIST_BILLS";
        }

        if (uri.contains("/old-stock")) {
            if (uri.contains("upload-csv")) return "OLD_STOCK_CSV_IMPORT";
            if (uri.contains("template")) return "DOWNLOAD_OLD_STOCK_TEMPLATE";
            if (uri.contains("summary")) return "VIEW_OLD_STOCK_SUMMARY";
            if ("POST".equals(method)) return "ADD_OLD_STOCK";
            if ("PUT".equals(method)) return "UPDATE_OLD_STOCK";
            if ("DELETE".equals(method)) return "DELETE_OLD_STOCK";
            if ("GET".equals(method)) return "LIST_OLD_STOCK";
        }

        if (uri.contains("/medicines")) {
            if ("POST".equals(method)) return "CREATE_MEDICINE";
            if ("PUT".equals(method)) return "UPDATE_MEDICINE";
            if ("DELETE".equals(method)) return "DELETE_MEDICINE";
            if ("GET".equals(method) && uri.contains("/search")) return "SEARCH_MEDICINES";
            if ("GET".equals(method)) return "LIST_MEDICINES";
        }

        if (uri.contains("/inventory")) {
            if (uri.contains("/expiry/retire")) return "RETIRE_EXPIRED_BATCHES";
            if (uri.contains("/expiry/near")) return "VIEW_NEAR_EXPIRY";
            if (uri.contains("/expiry/expired")) return "VIEW_EXPIRED_STOCK";
            if ("GET".equals(method)) return "LIST_INVENTORY";
        }

        if (uri.contains("/purchases")) {
            if (uri.contains("/receive")) return "RECEIVE_PURCHASE_ORDER";
            if ("POST".equals(method)) return "CREATE_PURCHASE_ORDER";
            if ("GET".equals(method)) return "LIST_PURCHASES";
        }

        if (uri.contains("/customers")) {
            if ("POST".equals(method)) return "REGISTER_CUSTOMER";
            if ("PUT".equals(method)) return "UPDATE_CUSTOMER";
            if ("GET".equals(method)) return "LIST_CUSTOMERS";
        }

        if (uri.contains("/suppliers")) {
            if ("POST".equals(method)) return "ADD_SUPPLIER";
            if ("PUT".equals(method)) return "UPDATE_SUPPLIER";
            if ("GET".equals(method)) return "LIST_SUPPLIERS";
        }

        if (uri.contains("/doctors")) {
            if ("POST".equals(method)) return "ADD_DOCTOR";
            if ("PUT".equals(method)) return "UPDATE_DOCTOR";
            if ("GET".equals(method)) return "LIST_DOCTORS";
        }

        if (uri.contains("/expenses")) {
            if ("POST".equals(method)) return "RECORD_EXPENSE";
            if ("GET".equals(method)) return "LIST_EXPENSES";
        }

        if (uri.contains("/reports")) {
            return "VIEW_REPORTS";
        }

        if (uri.contains("/users")) {
            if ("POST".equals(method)) return "CREATE_USER";
            if ("PUT".equals(method)) return "UPDATE_USER";
            if ("GET".equals(method)) return "LIST_USERS";
        }

        return method + " " + uri;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
