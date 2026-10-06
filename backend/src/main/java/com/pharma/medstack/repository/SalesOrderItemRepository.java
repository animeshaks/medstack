package com.pharma.medstack.repository;

import com.pharma.medstack.entity.SalesOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SalesOrderItemRepository extends JpaRepository<SalesOrderItem, UUID> {
    List<SalesOrderItem> findAllBySalesOrderIdAndIsDeletedFalse(UUID orderId);
    void deleteAllBySalesOrderId(UUID orderId);
}
