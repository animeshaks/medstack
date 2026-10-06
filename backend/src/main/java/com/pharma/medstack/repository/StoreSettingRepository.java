package com.pharma.medstack.repository;

import com.pharma.medstack.entity.StoreSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StoreSettingRepository extends JpaRepository<StoreSetting, UUID> {

    Optional<StoreSetting> findFirstByIsDeletedFalseOrderByCreatedAtAsc();

    default Optional<StoreSetting> findCurrentSettings() {
        return findFirstByIsDeletedFalseOrderByCreatedAtAsc();
    }
}
