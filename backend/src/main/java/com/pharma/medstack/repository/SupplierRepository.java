package com.pharma.medstack.repository;

import com.pharma.medstack.entity.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {
    Page<Supplier> findAllByIsDeletedFalse(Pageable pageable);

    @Query("SELECT s FROM Supplier s WHERE s.isDeleted = false AND LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Supplier> searchByName(@Param("search") String search, Pageable pageable);

    Optional<Supplier> findByIdAndIsDeletedFalse(UUID id);
}
