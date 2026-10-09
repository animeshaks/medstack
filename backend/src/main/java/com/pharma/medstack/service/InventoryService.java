package com.pharma.medstack.service;

import com.pharma.medstack.entity.InventoryBatch;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.RetireBatchRequest;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.MedicineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final InventoryBatchRepository inventoryBatchRepository;
    private final MedicineRepository medicineRepository;

    @Transactional(readOnly = true)
    public Page<InventoryBatchResponse> getInventory(Pageable pageable) {
        return inventoryBatchRepository.findActiveInventory(LocalDate.now(), pageable)
                .map(InventoryService::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<InventoryBatchResponse> searchInventory(String query, Pageable pageable) {
        return inventoryBatchRepository.searchInventory(query, pageable)
                .map(InventoryService::mapToResponse);
    }

    @Transactional(readOnly = true)
    public List<InventoryBatchResponse> getBatchesByMedicine(UUID medicineId) {
        return inventoryBatchRepository.findActiveBatchesByMedicine(medicineId, LocalDate.now())
                .stream()
                .map(InventoryService::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InventoryBatchResponse> getNearExpiry(int days) {
        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.plusDays(days);
        return inventoryBatchRepository.findNearExpiry(today, cutoff).stream()
                .map(InventoryService::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InventoryBatchResponse> getExpired() {
        return inventoryBatchRepository.findExpired(LocalDate.now()).stream()
                .map(InventoryService::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InventoryBatchResponse> getLowStock() {
        return inventoryBatchRepository.findLowStock(LocalDate.now()).stream()
                .map(InventoryService::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void retireBatches(RetireBatchRequest request, String username) {
        for (UUID batchId : request.batchIds()) {
            InventoryBatch batch = inventoryBatchRepository.findById(batchId)
                    .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + batchId));
            batch.setRetired(true);
            inventoryBatchRepository.save(batch);
            log.info("RETIRE_BATCH batchId={} user={}", batchId, username);
        }
    }

    public static InventoryBatchResponse mapToResponse(InventoryBatch batch) {
        int unitsPerPack = batch.getMedicine().getUnitsPerPack() > 0 ? batch.getMedicine().getUnitsPerPack() : 1;
        int looseQty = batch.getLooseQuantity();
        int totalUnits = (batch.getQuantity() * unitsPerPack) + looseQty;
        boolean lowStock = batch.getQuantity() <= batch.getMedicine().getMinStockAlertLevel();
        return new InventoryBatchResponse(
                batch.getId(),
                batch.getMedicine().getId(),
                batch.getMedicine().getName(),
                batch.getMedicine().getGenericName(),
                batch.getBatchNumber(),
                batch.getExpiryDate(),
                batch.getMrp(),
                batch.getCostPrice(),
                batch.getSellingPrice(),
                batch.getQuantity(),
                looseQty,
                unitsPerPack,
                totalUnits,
                batch.isRetired(),
                batch.getMedicine().getMinStockAlertLevel(),
                lowStock
        );
    }
}
