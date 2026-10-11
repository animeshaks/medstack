package com.pharma.medstack.service;

import com.pharma.medstack.entity.Role;
import com.pharma.medstack.entity.User;
import com.pharma.medstack.entity.UserStatus;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.model.request.ChangePasswordRequest;
import com.pharma.medstack.model.request.UserProfileUpdateRequest;
import com.pharma.medstack.model.request.UserUpdateRequest;
import com.pharma.medstack.model.response.UserResponse;
import com.pharma.medstack.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void testGetCurrentUserProfile_success() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("staff_john");
        user.setFullName("John Doe");
        user.setEmail("john@example.com");
        user.setRole(Role.STAFF);
        user.setStatus(UserStatus.ACTIVE);

        when(userRepository.findByUsernameAndIsDeletedFalse("staff_john")).thenReturn(Optional.of(user));

        UserResponse response = userService.getCurrentUserProfile("staff_john");
        assertNotNull(response);
        assertEquals("staff_john", response.username());
        assertEquals("John Doe", response.fullName());
    }

    @Test
    void testUpdateCurrentUserProfile_success() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("staff_john");
        user.setFullName("John Doe");
        user.setEmail("old@example.com");

        when(userRepository.findByUsernameAndIsDeletedFalse("staff_john")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileUpdateRequest req = new UserProfileUpdateRequest("Johnathan Doe", "new@example.com", "9876543210");
        UserResponse response = userService.updateCurrentUserProfile("staff_john", req);

        assertNotNull(response);
        assertEquals("Johnathan Doe", response.fullName());
        assertEquals("new@example.com", response.email());
        assertEquals("9876543210", response.phone());
        assertEquals("staff_john", response.username()); // username remains unchanged
    }

    @Test
    void testChangePassword_success() {
        User user = new User();
        user.setUsername("staff_john");
        user.setPasswordHash("hashed_old");

        when(userRepository.findByUsernameAndIsDeletedFalse("staff_john")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("OldPass123", "hashed_old")).thenReturn(true);
        when(passwordEncoder.matches("NewPass123", "hashed_old")).thenReturn(false);
        when(passwordEncoder.encode("NewPass123")).thenReturn("hashed_new");

        ChangePasswordRequest req = new ChangePasswordRequest("OldPass123", "NewPass123");
        assertDoesNotThrow(() -> userService.changePassword("staff_john", req));

        verify(userRepository).save(user);
        assertEquals("hashed_new", user.getPasswordHash());
    }

    @Test
    void testChangePassword_incorrectCurrentPassword_throwsException() {
        User user = new User();
        user.setUsername("staff_john");
        user.setPasswordHash("hashed_old");

        when(userRepository.findByUsernameAndIsDeletedFalse("staff_john")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPass", "hashed_old")).thenReturn(false);

        ChangePasswordRequest req = new ChangePasswordRequest("WrongPass", "NewPass123");
        assertThrows(BusinessValidationException.class, () -> userService.changePassword("staff_john", req));
    }

    @Test
    void testSuggestUsername_basedOnRoleAndName() {
        when(userRepository.existsByUsernameAndIsDeletedFalse("staff_rahul")).thenReturn(false);

        String suggested = userService.suggestUsername(Role.STAFF, "Rahul Sharma");
        assertEquals("staff_rahul", suggested);
    }

    @Test
    void testSuggestUsername_whenTaken_appendsNumber() {
        when(userRepository.existsByUsernameAndIsDeletedFalse("staff_rahul")).thenReturn(true);
        when(userRepository.existsByUsernameAndIsDeletedFalse("staff_rahul1")).thenReturn(false);

        String suggested = userService.suggestUsername(Role.STAFF, "Rahul Sharma");
        assertEquals("staff_rahul1", suggested);
    }

    @Test
    void testAdminUpdateUser_canChangeUsername() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("old_username");
        user.setRole(Role.STAFF);

        when(userRepository.findByIdAndIsDeletedFalse(userId)).thenReturn(Optional.of(user));
        when(userRepository.existsByUsernameAndIdNotAndIsDeletedFalse("new_username", userId)).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserUpdateRequest req = new UserUpdateRequest("new_username", "New Name", "test@test.com", "123", Role.STAFF, UserStatus.ACTIVE);
        UserResponse response = userService.updateUser(userId, req);

        assertEquals("new_username", response.username());
    }
}
