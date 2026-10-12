package com.pharma.medstack.controller;

import com.pharma.medstack.entity.Role;
import com.pharma.medstack.model.request.ChangePasswordRequest;
import com.pharma.medstack.model.request.UserProfileUpdateRequest;
import com.pharma.medstack.model.request.UserRequest;
import com.pharma.medstack.model.request.UserUpdateRequest;
import com.pharma.medstack.model.response.ApiResponse;
import com.pharma.medstack.model.response.UserResponse;
import com.pharma.medstack.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<UserResponse> getCurrentUser(Authentication authentication) {
        UserResponse response = userService.getCurrentUserProfile(authentication.getName());
        return ApiResponse.success(response, "Profile retrieved successfully", 200);
    }

    @PutMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<UserResponse> updateCurrentUserProfile(
            Authentication authentication,
            @Valid @RequestBody UserProfileUpdateRequest request) {
        UserResponse response = userService.updateCurrentUserProfile(authentication.getName(), request);
        return ApiResponse.success(response, "Profile updated successfully", 200);
    }

    @PutMapping("/me/password")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(authentication.getName(), request);
        return ApiResponse.success(null, "Password updated successfully", 200);
    }

    @GetMapping("/suggest-username")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<Map<String, String>> suggestUsername(
            @RequestParam(required = false, defaultValue = "STAFF") Role role,
            @RequestParam(required = false) String fullName,
            @RequestParam(required = false) String name) {
        String inputName = (fullName != null && !fullName.isBlank()) ? fullName : (name != null ? name : "");
        String suggestion = userService.suggestUsername(role, inputName);
        return ApiResponse.success(Map.of("username", suggestion), "Username suggestion generated", 200);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<Page<UserResponse>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<UserResponse> users = userService.getAllUsers(pageable);
        return ApiResponse.success(users, "Users retrieved successfully", 200);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<UserResponse> createUser(@Valid @RequestBody UserRequest request) {
        UserResponse response = userService.createUser(request);
        return ApiResponse.success(response, "User created successfully", 201);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OWNER')")
    public ApiResponse<UserResponse> getUser(@PathVariable UUID id) {
        UserResponse response = userService.getUser(id);
        return ApiResponse.success(response, "User retrieved successfully", 200);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserResponse> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateRequest request) {
        UserResponse response = userService.updateUser(id, request);
        return ApiResponse.success(response, "User updated successfully", 200);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ApiResponse.success(null, "User deleted successfully", 200);
    }
}
