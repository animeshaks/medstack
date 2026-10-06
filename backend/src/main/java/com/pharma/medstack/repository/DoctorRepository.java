package com.pharma.medstack.repository;

import com.pharma.medstack.entity.Doctor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface DoctorRepository extends JpaRepository<Doctor, UUID> {
    Page<Doctor> findAllByIsDeletedFalse(Pageable pageable);

    @Query("SELECT d FROM Doctor d WHERE d.isDeleted = false AND LOWER(d.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Doctor> searchByName(@Param("search") String search, Pageable pageable);

    Optional<Doctor> findByIdAndIsDeletedFalse(UUID id);
}
