package com.pharma.medstack.repository;

import com.pharma.medstack.entity.PaymentStatus;
import com.pharma.medstack.entity.PurchaseOrder;
import com.pharma.medstack.entity.PurchaseOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {
    @Query("SELECT p FROM PurchaseOrder p WHERE p.isDeleted = false ORDER BY p.createdAt DESC")
    Page<PurchaseOrder> findAllByIsDeletedFalse(Pageable pageable);

    Optional<PurchaseOrder> findByIdAndIsDeletedFalse(UUID id);

    long countByStatusAndIsDeletedFalse(PurchaseOrderStatus status);

    Page<PurchaseOrder> findAllBySupplierIdAndIsDeletedFalse(UUID supplierId, Pageable pageable);

    Page<PurchaseOrder> findAllBySupplierIdAndPaymentStatusAndIsDeletedFalse(UUID supplierId, PaymentStatus paymentStatus, Pageable pageable);

    List<PurchaseOrder> findAllBySupplierIdAndIsDeletedFalse(UUID supplierId);

    List<PurchaseOrder> findAllBySupplierIdAndIsDeletedFalseOrderByInvoiceDateDescCreatedAtDesc(UUID supplierId);

    List<PurchaseOrder> findAllBySupplierIdAndPaymentStatusInAndIsDeletedFalseOrderByInvoiceDateAscCreatedAtAsc(
            UUID supplierId, List<PaymentStatus> statuses);

    @Query("SELECT COALESCE(p.invoiceDate, CAST(p.createdAt AS LocalDate)) as poDate, " +
           "SUM(p.totalAmount) as total, COUNT(p) as cnt, " +
           "SUM(p.taxAmount) as tax, SUM(p.paidAmount) as paid, SUM(p.dueAmount) as due " +
           "FROM PurchaseOrder p " +
           "WHERE p.isDeleted = false " +
           "AND COALESCE(p.invoiceDate, CAST(p.createdAt AS LocalDate)) BETWEEN :from AND :to " +
           "GROUP BY COALESCE(p.invoiceDate, CAST(p.createdAt AS LocalDate)) " +
           "ORDER BY COALESCE(p.invoiceDate, CAST(p.createdAt AS LocalDate)) ASC")
    List<Object[]> purchasesByDateRange(
            @org.springframework.data.repository.query.Param("from") java.time.LocalDate from,
            @org.springframework.data.repository.query.Param("to") java.time.LocalDate to);
}
