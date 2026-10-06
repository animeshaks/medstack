package com.pharma.medstack.repository;

import com.pharma.medstack.entity.InventoryBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryBatchRepository extends JpaRepository<InventoryBatch, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM InventoryBatch b WHERE b.medicine.id = :medicineId " +
           "AND b.isRetired = false AND b.isDeleted = false " +
           "AND b.expiryDate > :today AND (b.quantity > 0 OR b.looseQuantity > 0) " +
           "ORDER BY b.expiryDate ASC, b.id ASC")
    List<InventoryBatch> findEligibleBatchesForSale(
        @Param("medicineId") UUID medicineId,
        @Param("today") LocalDate today);

    @Query("SELECT b FROM InventoryBatch b WHERE b.medicine.id = :medicineId " +
           "AND b.isRetired = false AND b.isDeleted = false " +
           "AND b.expiryDate > :today AND (b.quantity > 0 OR b.looseQuantity > 0) " +
           "ORDER BY b.expiryDate ASC, b.id ASC")
    List<InventoryBatch> findActiveBatchesByMedicine(
        @Param("medicineId") UUID medicineId,
        @Param("today") LocalDate today);

    Optional<InventoryBatch> findByMedicineIdAndBatchNumberAndIsDeletedFalse(
        UUID medicineId, String batchNumber);

    @Query("SELECT b FROM InventoryBatch b WHERE b.isRetired = false " +
           "AND b.isDeleted = false AND (b.quantity > 0 OR b.looseQuantity > 0) " +
           "AND b.expiryDate <= :cutoff AND b.expiryDate > :today " +
           "ORDER BY b.expiryDate ASC")
    List<InventoryBatch> findNearExpiry(
        @Param("today") LocalDate today,
        @Param("cutoff") LocalDate cutoff);

    @Query("SELECT b FROM InventoryBatch b WHERE b.isRetired = false " +
           "AND b.isDeleted = false AND (b.quantity > 0 OR b.looseQuantity > 0) " +
           "AND b.expiryDate <= :today ORDER BY b.expiryDate ASC")
    List<InventoryBatch> findExpired(@Param("today") LocalDate today);

    @Query("SELECT b FROM InventoryBatch b JOIN b.medicine m " +
           "WHERE b.isRetired = false AND b.isDeleted = false " +
           "AND b.expiryDate > :today AND b.quantity <= m.minStockAlertLevel " +
           "AND (b.quantity > 0 OR b.looseQuantity > 0)")
    List<InventoryBatch> findLowStock(@Param("today") LocalDate today);

    @Query(value = "SELECT b FROM InventoryBatch b JOIN b.medicine m WHERE b.isDeleted = false " +
           "AND b.isRetired = false AND b.expiryDate > :today " +
           "ORDER BY m.name ASC, b.expiryDate ASC",
           countQuery = "SELECT count(b) FROM InventoryBatch b WHERE b.isDeleted = false " +
           "AND b.isRetired = false AND b.expiryDate > :today")
    Page<InventoryBatch> findActiveInventory(
        @Param("today") LocalDate today, Pageable pageable);

    @Query(value = "SELECT b FROM InventoryBatch b JOIN b.medicine m WHERE b.isDeleted = false " +
           "AND (LOWER(m.name) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR LOWER(b.batchNumber) LIKE LOWER(CONCAT('%',:q,'%'))) " +
           "ORDER BY m.name ASC, b.expiryDate ASC",
           countQuery = "SELECT count(b) FROM InventoryBatch b JOIN b.medicine m WHERE b.isDeleted = false " +
           "AND (LOWER(m.name) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR LOWER(b.batchNumber) LIKE LOWER(CONCAT('%',:q,'%')))")
    Page<InventoryBatch> searchInventory(@Param("q") String q, Pageable pageable);
}
