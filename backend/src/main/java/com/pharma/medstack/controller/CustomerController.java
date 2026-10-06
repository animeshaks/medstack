package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.CustomerRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.CustomerResponse;
import com.pharma.medstack.service.CustomerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customers")
@Tag(name = "Customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<Page<CustomerResponse>> getAllCustomers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<CustomerResponse> customers = customerService.getAllCustomers(search, pageable);
        return ApiResponse.success(customers, "Customers retrieved successfully", 200);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<CustomerResponse> createCustomer(@Valid @RequestBody CustomerRequest request) {
        CustomerResponse response = customerService.createCustomer(request);
        return ApiResponse.success(response, "Customer created successfully", 201);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<CustomerResponse> getCustomer(@PathVariable UUID id) {
        CustomerResponse response = customerService.getCustomer(id);
        return ApiResponse.success(response, "Customer retrieved successfully", 200);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<CustomerResponse> updateCustomer(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerRequest request) {
        CustomerResponse response = customerService.updateCustomer(id, request);
        return ApiResponse.success(response, "Customer updated successfully", 200);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<Void> deleteCustomer(@PathVariable UUID id) {
        customerService.deleteCustomer(id);
        return ApiResponse.success(null, "Customer deleted successfully", 200);
    }
}
