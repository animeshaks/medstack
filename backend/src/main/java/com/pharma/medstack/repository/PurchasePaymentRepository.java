package com.pharma.medstack.repository;

import com.pharma.medstack.entity.PurchasePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, UUID> {
    List<PurchasePayment> findAllByPurchaseOrderIdAndIsDeletedFalseOrderByPaymentTimeAsc(UUID purchaseOrderId);
    List<PurchasePayment> findAllBySupplierIdAndIsDeletedFalseOrderByPaymentTimeDesc(UUID supplierId);
}
