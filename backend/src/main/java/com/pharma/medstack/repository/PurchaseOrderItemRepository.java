package com.pharma.medstack.repository;

import com.pharma.medstack.entity.PurchaseOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, UUID> {
    List<PurchaseOrderItem> findAllByPurchaseOrderIdAndIsDeletedFalse(UUID purchaseOrderId);
}
