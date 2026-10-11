package com.pharma.medstack.repository;

import com.pharma.medstack.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsernameAndIsDeletedFalse(String username);
    boolean existsByUsernameAndIsDeletedFalse(String username);
    boolean existsByUsernameAndIdNotAndIsDeletedFalse(String username, UUID id);
    Page<User> findAllByIsDeletedFalse(Pageable pageable);
    Optional<User> findByIdAndIsDeletedFalse(UUID id);
}
