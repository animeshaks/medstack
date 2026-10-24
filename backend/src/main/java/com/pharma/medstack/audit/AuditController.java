package com.pharma.medstack.audit;

import com.pharma.medstack.model.response.ApiResponse;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.File;

@RestController
@RequestMapping("/api/v1/audit")
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<Page<AuditEvent>>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String search) {

        Page<AuditEvent> events = auditService.getEvents(page, size, outcome, username, search);
        return ResponseEntity.ok(ApiResponse.success(events, "Audit logs retrieved successfully", 200));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<AuditSummaryResponse>> getSummary() {
        AuditSummaryResponse summary = auditService.getSummary();
        return ResponseEntity.ok(ApiResponse.success(summary, "Audit summary retrieved successfully", 200));
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> downloadAuditLog() {
        File file = auditService.getAuditLogFile();
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }

        FileSystemResource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"activity-audit.log\"")
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(file.length())
                .body(resource);
    }

    @PostMapping("/client-log")
    public ResponseEntity<ApiResponse<Void>> recordClientLog(
            @RequestBody ClientLogRequest request) {

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities()
                .stream().findFirst().map(Object::toString).orElse("USER").replace("ROLE_", "");

        long now = System.currentTimeMillis();
        AuditEvent event = new AuditEvent(
                AuditEvent.formatEpoch(now),
                now,
                username,
                role,
                request.action() != null ? request.action().toUpperCase() : "CLIENT_ACTION",
                "CLIENT",
                "/client-ui",
                request.outcome() != null ? request.outcome().toUpperCase() : "SUCCESS",
                "SUCCESS".equalsIgnoreCase(request.outcome()) ? 200 : 400,
                0,
                "CLIENT_BROWSER",
                request.requestId(),
                request.details(),
                request.error(),
                "FRONTEND"
        );

        auditService.recordEvent(event);
        return ResponseEntity.ok(ApiResponse.success(null, "Client activity recorded", 200));
    }
}
