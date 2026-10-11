package com.pharma.medstack.controller;

import com.pharma.medstack.entity.PaymentStatus;
import com.pharma.medstack.model.request.AddPaymentRequest;
import com.pharma.medstack.model.request.CreateBillRequest;
import com.pharma.medstack.model.request.SettleCustomerDueRequest;
import com.pharma.medstack.model.request.UpdateBillRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.BillAuditLogResponse;
import com.pharma.medstack.model.response.BillResponse;
import com.pharma.medstack.model.response.CustomerBalanceItemResponse;
import com.pharma.medstack.model.response.CustomerDueSummaryResponse;
import com.pharma.medstack.service.BillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<BillResponse>>> getAllBills(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) Instant startDate,
            @RequestParam(required = false) Instant endDate,
            @RequestParam(required = false) PaymentStatus paymentStatus,
            @RequestParam(required = false) Boolean dueOnly,
            @RequestParam(required = false) Boolean rxRequiredOnly,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                billService.getAllBills(search, customerId, userId, startDate, endDate, paymentStatus, dueOnly, rxRequiredOnly, pageable),
                "Bills fetched successfully", 200));
    }

    @GetMapping("/dues/summary")
    public ResponseEntity<ApiResponse<CustomerDueSummaryResponse>> getDuesSummary() {
        return ResponseEntity.ok(ApiResponse.success(billService.getDuesSummary(), "Dues summary fetched successfully", 200));
    }

    @GetMapping("/dues/customers")
    public ResponseEntity<ApiResponse<Page<CustomerBalanceItemResponse>>> getCustomersWithDues(
            @RequestParam(required = false) String search,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(billService.getCustomersWithDues(search, pageable), "Customers with dues fetched successfully", 200));
    }

    @PostMapping("/dues/settle-customer/{customerId}")
    public ResponseEntity<ApiResponse<List<BillResponse>>> settleCustomerDue(
            @PathVariable UUID customerId,
            @Valid @RequestBody SettleCustomerDueRequest request) {
        return ResponseEntity.ok(ApiResponse.success(billService.settleCustomerDue(customerId, request), "Customer dues settled successfully", 200));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BillResponse>> createBill(@Valid @RequestBody CreateBillRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(billService.createBill(request, username), "Bill created successfully", 200));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BillResponse>> getBill(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(billService.getBill(id), "Bill fetched successfully", 200));
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<ApiResponse<BillResponse>> addPayment(
            @PathVariable UUID id, @Valid @RequestBody AddPaymentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(billService.addPayment(id, request), "Payment added successfully", 200));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ResponseEntity<ApiResponse<BillResponse>> updateBill(
            @PathVariable UUID id, @Valid @RequestBody UpdateBillRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(billService.updateBill(id, request, username), "Bill updated successfully", 200));
    }

    @GetMapping("/{id}/audit")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ResponseEntity<ApiResponse<List<BillAuditLogResponse>>> getBillAuditLog(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(billService.getBillAuditLog(id), "Bill audit log fetched successfully", 200));
    }
}
