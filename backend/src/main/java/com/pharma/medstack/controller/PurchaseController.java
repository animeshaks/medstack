package com.pharma.medstack.controller;

import com.pharma.medstack.entity.PaymentStatus;
import com.pharma.medstack.entity.PurchaseOrderStatus;
import com.pharma.medstack.model.request.PayPurchaseOrderRequest;
import com.pharma.medstack.model.request.PurchaseOrderRequest;
import com.pharma.medstack.model.request.ReceivePurchaseOrderRequest;
import com.pharma.medstack.model.request.SettleSupplierDuesRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.PurchaseOrderItemResponse;
import com.pharma.medstack.model.response.PurchaseOrderResponse;
import com.pharma.medstack.model.response.PurchasePaymentResponse;
import com.pharma.medstack.service.PurchaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/purchases")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
public class PurchaseController {

    private final PurchaseService purchaseService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<PurchaseOrderResponse>>> getAllPurchaseOrders(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID supplierId,
            @RequestParam(required = false) PaymentStatus paymentStatus,
            @RequestParam(required = false) PurchaseOrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.getAllPurchaseOrders(search, supplierId, paymentStatus, status, from, to, pageable),
                "Purchase orders fetched successfully", 200));
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
    public ResponseEntity<ApiResponse<List<PurchaseOrderItemResponse>>> getPurchaseOrderItems(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getPurchaseOrder(id).items(), "Purchase order items fetched successfully", 200));
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> receivePurchaseOrder(
            @PathVariable UUID id,
            @RequestBody(required = false) ReceivePurchaseOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.receivePurchaseOrder(id, request),
                "Purchase order received successfully",
                200
        ));
    }

    @GetMapping("/supplier/{supplierId}")
    public ResponseEntity<ApiResponse<Page<PurchaseOrderResponse>>> getPurchaseOrdersBySupplier(
            @PathVariable UUID supplierId,
            @RequestParam(required = false) PaymentStatus paymentStatus,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.getAllPurchaseOrders(supplierId, paymentStatus, pageable),
                "Supplier purchase orders fetched successfully", 200));
    }

    @GetMapping("/supplier/{supplierId}/all")
    public ResponseEntity<ApiResponse<List<PurchaseOrderResponse>>> getAllPurchaseOrdersForSupplier(@PathVariable UUID supplierId) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.getSupplierPurchaseOrders(supplierId),
                "All supplier purchase orders fetched successfully", 200));
    }

    @GetMapping("/supplier/{supplierId}/payments")
    public ResponseEntity<ApiResponse<List<PurchasePaymentResponse>>> getSupplierPayments(@PathVariable UUID supplierId) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.getSupplierPayments(supplierId),
                "Supplier payment history fetched successfully", 200));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> payPurchaseOrder(
            @PathVariable UUID id,
            @Valid @RequestBody PayPurchaseOrderRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.payPurchaseOrder(id, request, username),
                "Purchase order payment recorded successfully", 200));
    }

    @GetMapping("/{id}/payments")
    public ResponseEntity<ApiResponse<List<PurchasePaymentResponse>>> getOrderPayments(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.getOrderPayments(id),
                "Purchase order payments fetched successfully", 200));
    }

    @PostMapping("/supplier/{supplierId}/settle")
    public ResponseEntity<ApiResponse<List<PurchaseOrderResponse>>> settleSupplierDues(
            @PathVariable UUID supplierId,
            @Valid @RequestBody SettleSupplierDuesRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(
                purchaseService.settleSupplierDues(supplierId, request, username),
                "Supplier dues settled successfully", 200));
    }
}
