package com.pharma.medstack.service;

import com.pharma.medstack.entity.Role;
import com.pharma.medstack.entity.User;
import com.pharma.medstack.entity.UserStatus;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.ChangePasswordRequest;
import com.pharma.medstack.model.request.UserProfileUpdateRequest;
import com.pharma.medstack.model.request.UserRequest;
import com.pharma.medstack.model.request.UserUpdateRequest;
import com.pharma.medstack.model.response.UserResponse;
import com.pharma.medstack.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserResponse createUser(UserRequest request) {
        if (userRepository.existsByUsernameAndIsDeletedFalse(request.username())) {
            throw new BusinessValidationException("Username already exists");
        }

        User user = new User();
        user.setUsername(request.username().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setRole(request.role());
        user.setStatus(UserStatus.ACTIVE);

        user = userRepository.save(user);
        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(UUID id) {
        User user = userRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> getAllUsers(Pageable pageable) {
        return userRepository.findAllByIsDeletedFalse(pageable)
                .map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUserProfile(String username) {
        User user = userRepository.findByUsernameAndIsDeletedFalse(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
        return mapToResponse(user);
    }

    public UserResponse updateCurrentUserProfile(String username, UserProfileUpdateRequest request) {
        User user = userRepository.findByUsernameAndIsDeletedFalse(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        user.setFullName(request.fullName().trim());
        user.setEmail(request.email() != null ? request.email().trim() : null);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);

        user = userRepository.save(user);
        return mapToResponse(user);
    }

    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsernameAndIsDeletedFalse(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessValidationException("Current password is incorrect");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new BusinessValidationException("New password cannot be the same as the current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public String suggestUsername(Role role, String fullName) {
        String rolePrefix = (role != null ? role.name() : "staff").toLowerCase();
        String namePart = "";
        if (fullName != null && !fullName.trim().isEmpty()) {
            String firstWord = fullName.trim().toLowerCase().split("\\s+")[0].replaceAll("[^a-z0-9]", "");
            if (!firstWord.isEmpty()) {
                namePart = firstWord.length() > 10 ? firstWord.substring(0, 10) : firstWord;
            }
        }

        String base = namePart.isEmpty() ? rolePrefix : rolePrefix + "_" + namePart;
        String candidate = base;
        int counter = 1;
        while (userRepository.existsByUsernameAndIsDeletedFalse(candidate)) {
            candidate = base + counter;
            counter++;
        }
        return candidate;
    }

    public UserResponse updateUser(UUID id, UserUpdateRequest request) {
        User user = userRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        if (request.username() != null && !request.username().trim().isEmpty()) {
            String newUsername = request.username().trim();
            if (!newUsername.equalsIgnoreCase(user.getUsername())) {
                if (userRepository.existsByUsernameAndIdNotAndIsDeletedFalse(newUsername, id)) {
                    throw new BusinessValidationException("Username is already taken by another user");
                }
                user.setUsername(newUsername);
            }
        }

        user.setFullName(request.fullName().trim());
        user.setEmail(request.email() != null ? request.email().trim() : null);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setRole(request.role());
        user.setStatus(request.status());

        user = userRepository.save(user);
        return mapToResponse(user);
    }

    public void deleteUser(UUID id) {
        User user = userRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        user.setDeleted(true);
        userRepository.save(user);
    }

    private UserResponse mapToResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }
}
