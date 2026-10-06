package com.pharma.medstack.repository;

import com.pharma.medstack.entity.PurchaseOrder;
import com.pharma.medstack.entity.PurchaseOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {
    @Query("SELECT p FROM PurchaseOrder p WHERE p.isDeleted = false ORDER BY p.createdAt DESC")
    Page<PurchaseOrder> findAllByIsDeletedFalse(Pageable pageable);
    Optional<PurchaseOrder> findByIdAndIsDeletedFalse(UUID id);
    long countByStatusAndIsDeletedFalse(PurchaseOrderStatus status);
}
