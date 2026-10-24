package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.OldStockRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.CsvImportResultResponse;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.model.response.OldStockSummaryResponse;
import com.pharma.medstack.service.OldStockService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/old-stock")
@RequiredArgsConstructor
@Tag(name = "Opening & Old Stock Management")
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
public class OldStockController {

    private final OldStockService oldStockService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<InventoryBatchResponse>>> getOldStock(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                oldStockService.getOldStockBatches(search, status, pageable),
                "Opening stock batches retrieved successfully", 200));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<OldStockSummaryResponse>> getOldStockSummary() {
        return ResponseEntity.ok(ApiResponse.success(
                oldStockService.getOldStockSummary(),
                "Opening stock summary retrieved successfully", 200));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InventoryBatchResponse>> addOldStock(
            @Valid @RequestBody OldStockRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(
                oldStockService.addOldStock(request, username),
                "Opening stock batch added successfully", 201));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<InventoryBatchResponse>> updateOldStock(
            @PathVariable UUID id,
            @Valid @RequestBody OldStockRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(
                oldStockService.updateOldStock(id, request, username),
                "Opening stock batch updated successfully", 200));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteOldStock(@PathVariable UUID id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        oldStockService.deleteOldStock(id, username);
        return ResponseEntity.ok(ApiResponse.success(null, "Opening stock batch deleted successfully", 200));
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate() {
        String csv = oldStockService.generateCsvTemplate();
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"old_stock_template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    @PostMapping(value = "/upload-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CsvImportResultResponse>> uploadCsvFile(
            @RequestParam("file") MultipartFile file) throws IOException {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        CsvImportResultResponse result = oldStockService.importOldStockCsv(file.getInputStream(), username);
        String msg = result.errorCount() == 0
                ? "CSV import completed successfully. " + result.importedCount() + " batches imported."
                : "CSV validation failed with " + result.errorCount() + " errors. Please fix errors and re-upload.";
        return ResponseEntity.ok(ApiResponse.success(result, msg, 200));
    }

    @PostMapping(value = "/upload-csv-text", consumes = {MediaType.TEXT_PLAIN_VALUE, MediaType.APPLICATION_OCTET_STREAM_VALUE})
    public ResponseEntity<ApiResponse<CsvImportResultResponse>> uploadCsvText(
            @RequestBody String csvText) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        ByteArrayInputStream bais = new ByteArrayInputStream(csvText.getBytes(StandardCharsets.UTF_8));
        CsvImportResultResponse result = oldStockService.importOldStockCsv(bais, username);
        String msg = result.errorCount() == 0
                ? "CSV import completed successfully. " + result.importedCount() + " batches imported."
                : "CSV validation failed with " + result.errorCount() + " errors. Please fix errors and re-upload.";
    @PostMapping("/upload-csv-json")
    public ResponseEntity<ApiResponse<CsvImportResultResponse>> uploadCsvJson(
            @RequestBody CsvUploadRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String csv = request != null && request.csv() != null ? request.csv() : "";
        ByteArrayInputStream bais = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        CsvImportResultResponse result = oldStockService.importOldStockCsv(bais, username);
        String msg = result.errorCount() == 0
                ? "CSV import completed successfully. " + result.importedCount() + " batches imported."
                : "CSV validation failed with " + result.errorCount() + " errors. Please fix errors and re-upload.";
        return ResponseEntity.ok(ApiResponse.success(result, msg, 200));
    }

    public record CsvUploadRequest(String csv) {}
}
