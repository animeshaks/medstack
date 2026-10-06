package com.pharma.medstack.repository;

import com.pharma.medstack.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Page<Customer> findAllByIsDeletedFalse(Pageable pageable);

    @Query("SELECT c FROM Customer c WHERE c.isDeleted = false AND " +
           "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "c.phone LIKE CONCAT('%', :search, '%') OR " +
           "(c.email IS NOT NULL AND LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%'))))")
    Page<Customer> searchByNameOrPhone(@Param("search") String search, Pageable pageable);

    Optional<Customer> findByIdAndIsDeletedFalse(UUID id);
    
    boolean existsByPhoneAndIsDeletedFalse(String phone);
    
    Optional<Customer> findByPhoneAndIsDeletedFalse(String phone);

    @Query("SELECT c FROM Customer c WHERE c.isDeleted = false AND c.outstandingBalance > 0 ORDER BY c.outstandingBalance DESC")
    java.util.List<Customer> findCustomersWithOutstandingBalance();

    @Query("SELECT c FROM Customer c WHERE c.isDeleted = false AND c.outstandingBalance > 0 ORDER BY c.outstandingBalance DESC")
    Page<Customer> findCustomersWithOutstandingBalance(Pageable pageable);

    @Query("SELECT c FROM Customer c WHERE c.isDeleted = false AND c.outstandingBalance > 0 AND " +
           "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "c.phone LIKE CONCAT('%', :search, '%') OR " +
           "(c.email IS NOT NULL AND LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "ORDER BY c.outstandingBalance DESC")
    Page<Customer> searchCustomersWithOutstandingBalance(@Param("search") String search, Pageable pageable);
}
