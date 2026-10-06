package com.pharma.medstack.repository;

import com.pharma.medstack.entity.BillAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BillAuditLogRepository extends JpaRepository<BillAuditLog, UUID> {
    List<BillAuditLog> findAllBySalesOrderIdOrderByChangedAtDesc(UUID salesOrderId);
}
