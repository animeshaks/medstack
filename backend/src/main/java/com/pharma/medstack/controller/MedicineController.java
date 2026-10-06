package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.MedicineRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.MedicineResponse;
import com.pharma.medstack.service.MedicineService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/medicines")
@Tag(name = "Medicines")
public class MedicineController {

    private final MedicineService medicineService;

    public MedicineController(MedicineService medicineService) {
        this.medicineService = medicineService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<Page<MedicineResponse>> getAllMedicines(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String symptom,
            @RequestParam(required = false) String ageGroup,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<MedicineResponse> medicines = medicineService.getAllMedicines(search, symptom, ageGroup, pageable);
        return ApiResponse.success(medicines, "Medicines retrieved successfully", 200);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<MedicineResponse> createMedicine(@Valid @RequestBody MedicineRequest request) {
        MedicineResponse response = medicineService.createMedicine(request);
        return ApiResponse.success(response, "Medicine created successfully", 201);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<MedicineResponse> getMedicine(@PathVariable UUID id) {
        MedicineResponse response = medicineService.getMedicine(id);
        return ApiResponse.success(response, "Medicine retrieved successfully", 200);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<MedicineResponse> updateMedicine(
            @PathVariable UUID id,
            @Valid @RequestBody MedicineRequest request) {
        MedicineResponse response = medicineService.updateMedicine(id, request);
        return ApiResponse.success(response, "Medicine updated successfully", 200);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<Void> deleteMedicine(@PathVariable UUID id) {
        medicineService.deleteMedicine(id);
        return ApiResponse.success(null, "Medicine deleted successfully", 200);
    }
}
