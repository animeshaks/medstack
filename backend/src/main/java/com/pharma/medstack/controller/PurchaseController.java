package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.PurchaseOrderRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.PurchaseOrderResponse;
import com.pharma.medstack.service.PurchaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/purchases")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
public class PurchaseController {

    private final PurchaseService purchaseService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<PurchaseOrderResponse>>> getAllPurchaseOrders(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getAllPurchaseOrders(pageable), "Purchase orders fetched successfully", 200));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> createPurchaseOrder(@Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.createPurchaseOrder(request), "Purchase order created successfully", 200));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> getPurchaseOrder(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getPurchaseOrder(id), "Purchase order fetched successfully", 200));
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<ApiResponse<java.util.List<com.pharma.medstack.model.response.PurchaseOrderItemResponse>>> getPurchaseOrderItems(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getPurchaseOrder(id).items(), "Purchase order items fetched successfully", 200));
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> receivePurchaseOrder(
            @PathVariable UUID id,
            @RequestBody(required = false) com.pharma.medstack.model.request.ReceivePurchaseOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.receivePurchaseOrder(id, request),
                "Purchase order received successfully",
                200
        ));
    }
}
