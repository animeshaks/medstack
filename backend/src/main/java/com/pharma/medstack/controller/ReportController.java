package com.pharma.medstack.controller;

import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.DashboardKpiResponse;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.model.response.InventoryReportResponse;
import com.pharma.medstack.model.response.SalesReportResponse;
import com.pharma.medstack.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<DashboardKpiResponse>> getDashboardKpis() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getDashboardKpis(), "Dashboard KPIs fetched", 200));
    }

    @GetMapping("/sales")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ResponseEntity<ApiResponse<List<SalesReportResponse>>> getSalesReport(
            @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesReport(from, to), "Sales report fetched", 200));
    }

    @GetMapping("/inventory")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ResponseEntity<ApiResponse<InventoryReportResponse>> getInventoryReport() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getInventoryReport(), "Inventory report fetched", 200));
    }

    @GetMapping("/expiry")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ResponseEntity<ApiResponse<List<InventoryBatchResponse>>> getNearExpiryReport() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getInventoryReport().nearExpiryItems(), "Near expiry report fetched", 200));
    }
}
