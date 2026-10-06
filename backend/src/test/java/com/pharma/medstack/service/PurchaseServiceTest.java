package com.pharma.medstack.service;

import com.pharma.medstack.entity.*;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.entity.PurchaseOrderStatus;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.MedicineRepository;
import com.pharma.medstack.repository.PurchaseOrderItemRepository;
import com.pharma.medstack.repository.PurchaseOrderRepository;
import com.pharma.medstack.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
class PurchaseServiceTest {

    @Mock private PurchaseOrderRepository purchaseOrderRepository;
    @Mock private PurchaseOrderItemRepository purchaseOrderItemRepository;
    @Mock private InventoryBatchRepository inventoryBatchRepository;
    @Mock private SupplierRepository supplierRepository;
    @Mock private MedicineRepository medicineRepository;

    @InjectMocks
    private PurchaseService purchaseService;

    @Test
    void testReceivePurchaseOrder_alreadyReceived_throws() {
        UUID id = UUID.randomUUID();
        PurchaseOrder po = new PurchaseOrder();
        po.setId(id);
        po.setStatus(PurchaseOrderStatus.RECEIVED);

        when(purchaseOrderRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.of(po));

        assertThrows(BusinessValidationException.class, () -> purchaseService.receivePurchaseOrder(id));
    }

    @Test
    void testReceivePurchaseOrder_newBatch_createsInventory() {
        UUID id = UUID.randomUUID();
        PurchaseOrder po = new PurchaseOrder();
        po.setId(id);
        po.setStatus(PurchaseOrderStatus.PENDING);

        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setId(UUID.randomUUID());
        item.setPurchaseOrder(po);
        item.setMedicine(medicine);
        item.setBatchNumber("BATCH-1");
        item.setExpiryDate(LocalDate.now().plusYears(1));
        item.setQuantity(100);
        item.setMrp(new BigDecimal("10.00"));
        item.setCostPrice(new BigDecimal("8.00"));

        when(purchaseOrderRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.of(po));
        when(purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(id))
                .thenReturn(List.of(item));
        when(inventoryBatchRepository.findByMedicineIdAndBatchNumberAndIsDeletedFalse(
                medicine.getId(), "BATCH-1")).thenReturn(Optional.empty());
        // stub save so po.getId() is not null after save
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        purchaseService.receivePurchaseOrder(id);

        ArgumentCaptor<InventoryBatch> batchCaptor = ArgumentCaptor.forClass(InventoryBatch.class);
        verify(inventoryBatchRepository).save(batchCaptor.capture());
        InventoryBatch savedBatch = batchCaptor.getValue();

        assertEquals("BATCH-1", savedBatch.getBatchNumber());
        assertEquals(100, savedBatch.getQuantity());
        assertEquals(PurchaseOrderStatus.RECEIVED, po.getStatus());
        verify(purchaseOrderRepository).save(po);
    }

    @Test
    void testReceivePurchaseOrder_existingBatch_incrementsQuantity() {
        UUID id = UUID.randomUUID();
        PurchaseOrder po = new PurchaseOrder();
        po.setId(id);
        po.setStatus(PurchaseOrderStatus.PENDING);

        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setId(UUID.randomUUID());
        item.setPurchaseOrder(po);
        item.setMedicine(medicine);
        item.setBatchNumber("BATCH-2");
        item.setQuantity(50);
        item.setMrp(new BigDecimal("10.00"));
        item.setCostPrice(new BigDecimal("8.00"));

        InventoryBatch existingBatch = new InventoryBatch();
        existingBatch.setId(UUID.randomUUID());
        existingBatch.setBatchNumber("BATCH-2");
        existingBatch.setQuantity(10);

        when(purchaseOrderRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.of(po));
        when(purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(id))
                .thenReturn(List.of(item));
        when(inventoryBatchRepository.findByMedicineIdAndBatchNumberAndIsDeletedFalse(
                medicine.getId(), "BATCH-2")).thenReturn(Optional.of(existingBatch));
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        purchaseService.receivePurchaseOrder(id);

        assertEquals(60, existingBatch.getQuantity());
        verify(inventoryBatchRepository).save(existingBatch);
        assertEquals(PurchaseOrderStatus.RECEIVED, po.getStatus());
        verify(purchaseOrderRepository).save(po);
    }

    @Test
    void testReceivePurchaseOrder_partialQuantity_updatesInventoryWithLessQuantityAndMarksPartial() {
        UUID id = UUID.randomUUID();
        PurchaseOrder po = new PurchaseOrder();
        po.setId(id);
        po.setStatus(PurchaseOrderStatus.PENDING);

        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());

        UUID itemId = UUID.randomUUID();
        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setId(itemId);
        item.setPurchaseOrder(po);
        item.setMedicine(medicine);
        item.setBatchNumber("BATCH-PARTIAL");
        item.setExpiryDate(LocalDate.now().plusYears(1));
        item.setQuantity(20);
        item.setFreeQuantity(0);
        item.setMrp(new BigDecimal("50.00"));
        item.setCostPrice(new BigDecimal("35.00"));

        when(purchaseOrderRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.of(po));
        when(purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(id))
                .thenReturn(List.of(item));
        when(inventoryBatchRepository.findByMedicineIdAndBatchNumberAndIsDeletedFalse(
                medicine.getId(), "BATCH-PARTIAL")).thenReturn(Optional.empty());
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Actual received billed quantity is 14 instead of 20
        var req = new com.pharma.medstack.model.request.ReceivePurchaseOrderRequest(
                List.of(new com.pharma.medstack.model.request.ReceiveItemRequest(
                        itemId, true, 14, 0, "BATCH-PARTIAL", LocalDate.now().plusYears(1), null, "6 boxes short in shipment"
                )),
                "Partial delivery"
        );

        var res = purchaseService.receivePurchaseOrder(id, req);

        ArgumentCaptor<InventoryBatch> batchCaptor = ArgumentCaptor.forClass(InventoryBatch.class);
        verify(inventoryBatchRepository).save(batchCaptor.capture());
        InventoryBatch savedBatch = batchCaptor.getValue();

        assertEquals(14, savedBatch.getQuantity()); // Only 14 units added to stock
        assertEquals(PurchaseOrderStatus.PARTIALLY_RECEIVED, po.getStatus());
        assertEquals("RECEIVED_PARTIAL", item.getItemStatus());
        assertEquals(14, item.getReceivedQuantity());
    }

    @Test
    void testReceivePurchaseOrder_missingItem_doesNotUpdateInventoryForMissingItem() {
        UUID id = UUID.randomUUID();
        PurchaseOrder po = new PurchaseOrder();
        po.setId(id);
        po.setStatus(PurchaseOrderStatus.PENDING);

        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());

        UUID itemId = UUID.randomUUID();
        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setId(itemId);
        item.setPurchaseOrder(po);
        item.setMedicine(medicine);
        item.setBatchNumber("BATCH-MISSING");
        item.setExpiryDate(LocalDate.now().plusYears(1));
        item.setQuantity(10);
        item.setFreeQuantity(2);
        item.setMrp(new BigDecimal("100.00"));
        item.setCostPrice(new BigDecimal("70.00"));

        when(purchaseOrderRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.of(po));
        when(purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(id))
                .thenReturn(List.of(item));
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Item missing / not available: included = false
        var req = new com.pharma.medstack.model.request.ReceivePurchaseOrderRequest(
                List.of(new com.pharma.medstack.model.request.ReceiveItemRequest(
                        itemId, false, 0, 0, "BATCH-MISSING", null, null, "Item out of stock with distributor"
                )),
                "1 item omitted"
        );

        var res = purchaseService.receivePurchaseOrder(id, req);

        // Verify inventory was NOT updated for this missing item
        verify(inventoryBatchRepository, never()).save(any(InventoryBatch.class));
        assertEquals(PurchaseOrderStatus.PARTIALLY_RECEIVED, po.getStatus());
        assertEquals("NOT_RECEIVED", item.getItemStatus());
        assertEquals(0, item.getReceivedQuantity());
        assertEquals(0, item.getReceivedFreeQuantity());
    }
}
