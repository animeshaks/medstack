package com.pharma.medstack.controller;

import com.pharma.medstack.model.request.UpdateStoreSettingRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.StoreSettingResponse;
import com.pharma.medstack.service.StoreSettingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settings")
@Tag(name = "Store Settings")
public class StoreSettingController {

    private final StoreSettingService storeSettingService;

    public StoreSettingController(StoreSettingService storeSettingService) {
        this.storeSettingService = storeSettingService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER','STAFF')")
    public ApiResponse<StoreSettingResponse> getSettings() {
        StoreSettingResponse response = storeSettingService.getSettings();
        return ApiResponse.success(response, "Store settings retrieved successfully", 200);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<StoreSettingResponse> updateSettings(@Valid @RequestBody UpdateStoreSettingRequest request) {
        StoreSettingResponse response = storeSettingService.updateSettings(request);
        return ApiResponse.success(response, "Store settings updated successfully", 200);
    }
}
