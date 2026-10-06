package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.RetireBatchRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<InventoryBatchResponse>>> getInventory(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getInventory(pageable), "Inventory fetched successfully", 200));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<InventoryBatchResponse>>> searchInventory(
            @RequestParam("q") String query, Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.searchInventory(query, pageable), "Inventory search results", 200));
    }

    @GetMapping("/medicine/{medicineId}")
    public ResponseEntity<ApiResponse<List<InventoryBatchResponse>>> getBatchesByMedicine(@PathVariable UUID medicineId) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getBatchesByMedicine(medicineId), "Medicine batches fetched successfully", 200));
    }

    @GetMapping("/low-stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<List<InventoryBatchResponse>>> getLowStock() {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getLowStock(), "Low stock inventory fetched successfully", 200));
    }

    @GetMapping("/expiry/near")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER', 'STAFF')")
    public ResponseEntity<ApiResponse<List<InventoryBatchResponse>>> getNearExpiry(@RequestParam(defaultValue = "90") int days) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getNearExpiry(days), "Near expiry inventory fetched successfully", 200));
    }

    @GetMapping("/expiry/expired")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<List<InventoryBatchResponse>>> getExpired() {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getExpired(), "Expired inventory fetched successfully", 200));
    }

    @PostMapping("/expiry/retire")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<Void>> retireBatches(@Valid @RequestBody RetireBatchRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        inventoryService.retireBatches(request, username);
        return ResponseEntity.ok(ApiResponse.success(null, "Batches retired successfully", 200));
    }
}
