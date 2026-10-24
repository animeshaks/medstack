package com.pharma.medstack.repository;

import com.pharma.medstack.entity.Medicine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MedicineRepository extends JpaRepository<Medicine, UUID>, JpaSpecificationExecutor<Medicine> {
    Page<Medicine> findAllByIsDeletedFalse(Pageable pageable);

    @Query("SELECT m FROM Medicine m WHERE m.isDeleted = false AND " +
           "(LOWER(m.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.genericName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.manufacturer) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.symptoms) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Medicine> search(@Param("search") String search, Pageable pageable);

    Optional<Medicine> findByIdAndIsDeletedFalse(UUID id);

    Optional<Medicine> findByNameIgnoreCaseAndIsDeletedFalse(String name);
}
