package com.pharma.medstack.audit;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class AuditService {

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");
    private static final Logger SYS_LOG = LoggerFactory.getLogger(AuditService.class);

    private static final Pattern SENSITIVE_PATTERN = Pattern.compile(
            "(?i)(\"?password\"?\\s*[:=]\\s*\"?)([^\",\\s}]+)(\"?)",
            Pattern.CASE_INSENSITIVE
    );

    private final boolean enabled;
    private final String logDir;
    private final String fileName;
    private final int retentionDays;
    private final int bufferSize;

    // In-memory bounded deque for instant live monitoring and filtering
    private final Deque<AuditEvent> eventBuffer = new ConcurrentLinkedDeque<>();

    public AuditService(
            @Value("${medstack.audit.enabled:true}") boolean enabled,
            @Value("${medstack.audit.log-dir:logs/audit}") String logDir,
            @Value("${medstack.audit.file-name:activity-audit.log}") String fileName,
            @Value("${medstack.audit.retention-days:30}") int retentionDays,
            @Value("${medstack.audit.buffer-size:1000}") int bufferSize) {
        this.enabled = enabled;
        this.logDir = logDir;
        this.fileName = fileName;
        this.retentionDays = retentionDays;
        this.bufferSize = bufferSize;
    }

    @PostConstruct
    public void init() {
        try {
            Path dirPath = Paths.get(logDir);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }
            Path archivePath = dirPath.resolve("archive");
            if (!Files.exists(archivePath)) {
                Files.createDirectories(archivePath);
            }
            SYS_LOG.info("Audit Service initialized. Log directory: {}, retention: {} days", dirPath.toAbsolutePath(), retentionDays);
            cleanupOldLogFiles();
        } catch (Exception e) {
            SYS_LOG.warn("Failed to prepare audit log directory: {}", e.getMessage());
        }
    }

    /**
     * Record an audit event. Writes to dedicated audit log file and in-memory buffer.
     */
    public void recordEvent(AuditEvent event) {
        if (!enabled || event == null) {
            return;
        }

        // Sanitize sensitive values before writing
        String cleanDetails = sanitize(event.details());
        String cleanError = sanitize(event.errorMessage());

        AuditEvent cleanEvent = new AuditEvent(
                event.timestamp() != null ? event.timestamp() : AuditEvent.nowLocal(),
                event.epochMs() > 0 ? event.epochMs() : System.currentTimeMillis(),
                event.username() != null ? event.username() : "ANONYMOUS",
                event.role() != null ? event.role() : "ANONYMOUS",
                event.action(),
                event.method(),
                event.uri(),
                event.outcome() != null ? event.outcome() : "SUCCESS",
                event.statusCode(),
                event.durationMs(),
                event.clientIp(),
                event.requestId(),
                cleanDetails,
                cleanError,
                event.source() != null ? event.source() : "BACKEND"
        );

        // 1. Log to dedicated log file via Logback
        AUDIT_LOGGER.info(cleanEvent.toLogLine());

        // 2. Add to bounded live memory buffer (newest at head)
        eventBuffer.addFirst(cleanEvent);
        while (eventBuffer.size() > bufferSize) {
            eventBuffer.pollLast();
        }
    }

    /**
     * Helper to record business events directly from service methods.
     */
    public void recordBusinessEvent(String action, String username, String role, String outcome,
                                    String details, String errorMessage, String requestId) {
        long now = System.currentTimeMillis();
        AuditEvent event = new AuditEvent(
                AuditEvent.formatEpoch(now),
                now,
                username != null ? username : "SYSTEM",
                role != null ? role : "SYSTEM",
                action,
                "INTERNAL",
                "/internal",
                outcome,
                outcome.equalsIgnoreCase("SUCCESS") ? 200 : 400,
                0,
                "127.0.0.1",
                requestId != null ? requestId : "bus-" + System.currentTimeMillis(),
                details,
                errorMessage,
                "SERVICE"
        );
        recordEvent(event);
    }

    /**
     * Get paginated and filtered audit events from memory buffer.
     */
    public Page<AuditEvent> getEvents(int page, int size, String outcome, String username, String search) {
        List<AuditEvent> all = new ArrayList<>(eventBuffer);

        Stream<AuditEvent> stream = all.stream();

        if (outcome != null && !outcome.isBlank() && !outcome.equalsIgnoreCase("ALL")) {
            stream = stream.filter(e -> outcome.equalsIgnoreCase(e.outcome()));
        }

        if (username != null && !username.isBlank()) {
            String u = username.toLowerCase().trim();
            stream = stream.filter(e -> e.username() != null && e.username().toLowerCase().contains(u));
        }

        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase().trim();
            stream = stream.filter(e ->
                    (e.action() != null && e.action().toLowerCase().contains(s)) ||
                    (e.uri() != null && e.uri().toLowerCase().contains(s)) ||
                    (e.details() != null && e.details().toLowerCase().contains(s)) ||
                    (e.errorMessage() != null && e.errorMessage().toLowerCase().contains(s)) ||
                    (e.requestId() != null && e.requestId().toLowerCase().contains(s))
            );
        }

        List<AuditEvent> filtered = stream.collect(Collectors.toList());

        int start = Math.min(page * size, filtered.size());
        int end = Math.min(start + size, filtered.size());
        List<AuditEvent> pageContent = filtered.subList(start, end);

        Pageable pageable = PageRequest.of(page, size);
        return new PageImpl<>(pageContent, pageable, filtered.size());
    }

    /**
     * Generate summary metrics for dashboard and monitoring screen.
     */
    public AuditSummaryResponse getSummary() {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        List<AuditEvent> all = new ArrayList<>(eventBuffer);

        long todayStartEpoch = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();

        List<AuditEvent> todayEvents = all.stream()
                .filter(e -> e.epochMs() >= todayStartEpoch)
                .toList();

        long totalToday = todayEvents.size();
        long successToday = todayEvents.stream().filter(e -> "SUCCESS".equalsIgnoreCase(e.outcome())).count();
        long failureToday = todayEvents.stream().filter(e -> "FAILURE".equalsIgnoreCase(e.outcome())).count();

        Map<String, Long> topActions = todayEvents.stream()
                .collect(Collectors.groupingBy(AuditEvent::action, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (e1, e2) -> e1, LinkedHashMap::new));

        File file = getAuditLogFile();
        long fileSize = file.exists() ? file.length() : 0L;
        String formattedSize = formatFileSize(fileSize);

        return new AuditSummaryResponse(
                totalToday,
                successToday,
                failureToday,
                retentionDays,
                file.getAbsolutePath(),
                fileSize,
                formattedSize,
                topActions
        );
    }

    /**
     * Returns the active audit log file for admin inspection or download.
     */
    public File getAuditLogFile() {
        return Paths.get(logDir, fileName).toFile();
    }

    /**
     * Daily scheduled retention cleanup at 2:00 AM.
     * Deletes log files in log-dir and archive older than configured retention days.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanupOldLogFiles() {
        try {
            long maxAgeMs = (long) retentionDays * 24 * 60 * 60 * 1000L;
            long cutoffTime = System.currentTimeMillis() - maxAgeMs;

            Path dirPath = Paths.get(logDir);
            if (!Files.exists(dirPath)) return;

            try (Stream<Path> paths = Files.walk(dirPath)) {
                paths.filter(Files::isRegularFile)
                        .filter(p -> p.getFileName().toString().contains("audit"))
                        .filter(p -> !p.getFileName().toString().equals(fileName)) // Keep active log file
                        .forEach(p -> {
                            try {
                                long lastMod = Files.getLastModifiedTime(p).toMillis();
                                if (lastMod < cutoffTime) {
                                    Files.delete(p);
                                    SYS_LOG.info("Audit log retention: deleted expired file {}", p.getFileName());
                                }
                            } catch (Exception ex) {
                                SYS_LOG.warn("Failed to check/delete expired log file {}: {}", p, ex.getMessage());
                            }
                        });
            }
        } catch (Exception e) {
            SYS_LOG.warn("Error running audit log cleanup: {}", e.getMessage());
        }
    }

    /**
     * Strips passwords and sensitive credentials from log strings.
     */
    public static String sanitize(String input) {
        if (input == null) return null;
        String result = SENSITIVE_PATTERN.matcher(input).replaceAll("$1******$3");
        // Also strip Bearer tokens if present
        result = result.replaceAll("(?i)Bearer\\s+[A-Za-z0-9\\-_.]+", "Bearer ******");
        return result;
    }

    private static String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char unit = "KMGTPE".charAt(exp - 1);
        return String.format("%.1f %sB", bytes / Math.pow(1024, exp), unit);
    }
}
