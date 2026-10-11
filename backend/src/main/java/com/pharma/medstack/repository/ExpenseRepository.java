package com.pharma.medstack.repository;

import com.pharma.medstack.entity.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID>, JpaSpecificationExecutor<Expense> {
    Page<Expense> findAllByIsDeletedFalse(Pageable pageable);
    Optional<Expense> findByIdAndIsDeletedFalse(UUID id);

    @Query("SELECT e FROM Expense e WHERE e.isDeleted = false " +
           "AND e.expenseDate BETWEEN :from AND :to")
    List<Expense> findByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT SUM(e.amount) FROM Expense e WHERE e.isDeleted = false " +
           "AND e.expenseDate BETWEEN :from AND :to")
    BigDecimal sumByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT e.expenseDate as expDate, " +
           "e.category as category, " +
           "SUM(e.amount) as total, COUNT(e) as cnt " +
           "FROM Expense e " +
           "WHERE e.isDeleted = false " +
           "AND e.expenseDate BETWEEN :from AND :to " +
           "GROUP BY e.expenseDate, e.category " +
           "ORDER BY e.expenseDate ASC")
    List<Object[]> expensesByDateRangeAndCategory(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
