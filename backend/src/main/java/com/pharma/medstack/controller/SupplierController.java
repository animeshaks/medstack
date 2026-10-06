package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.SupplierRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.SupplierResponse;
import com.pharma.medstack.service.SupplierService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/suppliers")
@Tag(name = "Suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<Page<SupplierResponse>> getAllSuppliers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<SupplierResponse> suppliers = supplierService.getAllSuppliers(search, pageable);
        return ApiResponse.success(suppliers, "Suppliers retrieved successfully", 200);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<SupplierResponse> createSupplier(@Valid @RequestBody SupplierRequest request) {
        SupplierResponse response = supplierService.createSupplier(request);
        return ApiResponse.success(response, "Supplier created successfully", 201);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<SupplierResponse> getSupplier(@PathVariable UUID id) {
        SupplierResponse response = supplierService.getSupplier(id);
        return ApiResponse.success(response, "Supplier retrieved successfully", 200);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<SupplierResponse> updateSupplier(
            @PathVariable UUID id,
            @Valid @RequestBody SupplierRequest request) {
        SupplierResponse response = supplierService.updateSupplier(id, request);
        return ApiResponse.success(response, "Supplier updated successfully", 200);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<Void> deleteSupplier(@PathVariable UUID id) {
        supplierService.deleteSupplier(id);
        return ApiResponse.success(null, "Supplier deleted successfully", 200);
    }
}
