package com.pharma.medstack.service;

import com.pharma.medstack.entity.InventoryBatch;
import com.pharma.medstack.entity.Medicine;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.RetireBatchRequest;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.MedicineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock
    private InventoryBatchRepository inventoryBatchRepository;
    
    @Mock
    private MedicineRepository medicineRepository;

    @InjectMocks
    private InventoryService inventoryService;

    @Test
    void testGetNearExpiry_returnsCorrectBatches() {
        Medicine med = new Medicine();
        med.setId(UUID.randomUUID());
        med.setName("Med");
        med.setMinStockAlertLevel(5);

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(med);
        batch.setBatchNumber("B123");
        batch.setExpiryDate(LocalDate.now().plusDays(10));
        batch.setMrp(BigDecimal.TEN);
        batch.setCostPrice(BigDecimal.ONE);
        batch.setSellingPrice(BigDecimal.TEN);
        batch.setQuantity(10);

        when(inventoryBatchRepository.findNearExpiry(any(), any())).thenReturn(List.of(batch));

        List<InventoryBatchResponse> responses = inventoryService.getNearExpiry(30);

        assertNotNull(responses);
        assertEquals(1, responses.size());
        assertEquals("B123", responses.get(0).batchNumber());
    }

    @Test
    void testRetireBatches_success() {
        UUID batchId = UUID.randomUUID();
        InventoryBatch batch = new InventoryBatch();
        batch.setId(batchId);
        batch.setRetired(false);

        when(inventoryBatchRepository.findById(batchId)).thenReturn(Optional.of(batch));

        RetireBatchRequest request = new RetireBatchRequest(List.of(batchId));
        inventoryService.retireBatches(request, "admin");

        assertTrue(batch.isRetired());
        verify(inventoryBatchRepository, times(1)).save(batch);
    }

    @Test
    void testRetireBatches_invalidId_throws() {
        UUID batchId = UUID.randomUUID();
        when(inventoryBatchRepository.findById(batchId)).thenReturn(Optional.empty());

        RetireBatchRequest request = new RetireBatchRequest(List.of(batchId));

        assertThrows(ResourceNotFoundException.class, () -> inventoryService.retireBatches(request, "admin"));
    }
}
