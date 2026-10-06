package com.pharma.medstack.repository;

import com.pharma.medstack.entity.SalesOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.UUID;

public interface SalesOrderRepository extends JpaRepository<SalesOrder, UUID>, JpaSpecificationExecutor<SalesOrder> {
    Optional<SalesOrder> findByIdAndIsDeletedFalse(UUID id);
    Optional<SalesOrder> findByBillNumberAndIsDeletedFalse(String billNumber);
    @Query("SELECT s FROM SalesOrder s WHERE s.isDeleted = false ORDER BY s.createdAt DESC")
    Page<SalesOrder> findAllByIsDeletedFalse(Pageable pageable);

    @Query("SELECT s FROM SalesOrder s LEFT JOIN s.customer c WHERE s.isDeleted = false " +
           "AND (LOWER(s.billNumber) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR (c.name IS NOT NULL AND LOWER(c.name) LIKE LOWER(CONCAT('%',:q,'%'))) " +
           "OR (s.customerName IS NOT NULL AND LOWER(s.customerName) LIKE LOWER(CONCAT('%',:q,'%'))) " +
           "OR (s.customerPhone IS NOT NULL AND LOWER(s.customerPhone) LIKE LOWER(CONCAT('%',:q,'%')))) " +
           "ORDER BY s.createdAt DESC")
    Page<SalesOrder> search(@Param("q") String q, Pageable pageable);

    @Query("SELECT COUNT(s) FROM SalesOrder s WHERE DATE(s.createdAt) = :today")
    long countByDate(@Param("today") LocalDate today);

    @Query("SELECT COALESCE(SUM(s.grandTotal), 0) FROM SalesOrder s " +
           "WHERE s.isDeleted = false AND s.orderStatus = 'CONFIRMED' " +
           "AND CAST(s.createdAt AS LocalDate) = :date")
    BigDecimal sumGrandTotalByDate(@Param("date") LocalDate date);

    @Query("SELECT COUNT(s) FROM SalesOrder s " +
           "WHERE s.isDeleted = false AND s.orderStatus = 'CONFIRMED' " +
           "AND CAST(s.createdAt AS LocalDate) = :date")
    long countByDateConfirmed(@Param("date") LocalDate date);

    @Query("SELECT CAST(s.createdAt AS LocalDate) as saleDate, " +
           "SUM(s.grandTotal) as total, COUNT(s) as cnt, " +
           "SUM(s.taxAmount) as tax, SUM(s.discountAmount) as disc " +
           "FROM SalesOrder s " +
           "WHERE s.isDeleted = false AND s.orderStatus = 'CONFIRMED' " +
           "AND s.createdAt >= :from AND s.createdAt < :to " +
           "GROUP BY CAST(s.createdAt AS LocalDate) " +
           "ORDER BY CAST(s.createdAt AS LocalDate) ASC")
    List<Object[]> salesByDateRange(
        @Param("from") Instant from,
        @Param("to") Instant to);

    List<SalesOrder> findAllByPaymentStatusInAndIsDeletedFalse(List<com.pharma.medstack.entity.PaymentStatus> statuses);

    List<SalesOrder> findAllByCustomerIdAndPaymentStatusInAndIsDeletedFalseOrderByCreatedAtAsc(
            UUID customerId, List<com.pharma.medstack.entity.PaymentStatus> statuses);
}
