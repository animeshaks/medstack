package com.pharma.medstack.service;

import com.pharma.medstack.entity.*;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.entity.PurchaseOrderStatus;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.MedicineRepository;
import com.pharma.medstack.repository.PurchaseOrderItemRepository;
import com.pharma.medstack.repository.PurchaseOrderRepository;
import com.pharma.medstack.repository.PurchasePaymentRepository;
import com.pharma.medstack.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
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
    @Mock private PurchasePaymentRepository purchasePaymentRepository;
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

    @Test
    void testPayPurchaseOrder_partialAndFullPayment() {
        UUID orderId = UUID.randomUUID();
        Supplier supplier = new Supplier();
        supplier.setId(UUID.randomUUID());
        supplier.setOutstandingBalance(new BigDecimal("1000.00"));

        PurchaseOrder po = PurchaseOrder.builder()
                .id(orderId)
                .supplier(supplier)
                .invoiceNumber("INV-001")
                .totalAmount(new BigDecimal("1000.00"))
                .paidAmount(BigDecimal.ZERO)
                .dueAmount(new BigDecimal("1000.00"))
                .status(PurchaseOrderStatus.RECEIVED)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        when(purchaseOrderRepository.findByIdAndIsDeletedFalse(orderId)).thenReturn(Optional.of(po));
        when(purchasePaymentRepository.findAllByPurchaseOrderIdAndIsDeletedFalseOrderByPaymentTimeAsc(orderId))
                .thenReturn(Collections.emptyList());
        when(purchasePaymentRepository.save(any(PurchasePayment.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(supplierRepository.findByIdAndIsDeletedFalse(supplier.getId())).thenReturn(Optional.of(supplier));
        when(purchaseOrderRepository.findAllBySupplierIdAndIsDeletedFalse(supplier.getId())).thenReturn(List.of(po));

        // Pay 400.00
        var req = new com.pharma.medstack.model.request.PayPurchaseOrderRequest(
                PaymentMethod.CASH, new BigDecimal("400.00"), "TXN-1", null, "Partial pay"
        );
        var resp = purchaseService.payPurchaseOrder(orderId, req, "owner");

        assertEquals(new BigDecimal("400.00"), po.getPaidAmount());
        assertEquals(new BigDecimal("600.00"), po.getDueAmount());
        assertEquals(PaymentStatus.PARTIAL, po.getPaymentStatus());
        assertEquals(new BigDecimal("600.00"), supplier.getOutstandingBalance());
    }

    @Test
    void testSettleSupplierDues_fifoAllocation() {
        UUID supplierId = UUID.randomUUID();
        Supplier supplier = new Supplier();
        supplier.setId(supplierId);
        supplier.setOutstandingBalance(new BigDecimal("1500.00"));

        // Order 1: older bill (1000 total, 0 paid, 1000 due)
        PurchaseOrder po1 = PurchaseOrder.builder()
                .id(UUID.randomUUID())
                .supplier(supplier)
                .invoiceNumber("INV-OLD")
                .invoiceDate(LocalDate.now().minusDays(10))
                .totalAmount(new BigDecimal("1000.00"))
                .paidAmount(BigDecimal.ZERO)
                .dueAmount(new BigDecimal("1000.00"))
                .status(PurchaseOrderStatus.RECEIVED)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        // Order 2: newer bill (500 total, 0 paid, 500 due)
        PurchaseOrder po2 = PurchaseOrder.builder()
                .id(UUID.randomUUID())
                .supplier(supplier)
                .invoiceNumber("INV-NEW")
                .invoiceDate(LocalDate.now().minusDays(2))
                .totalAmount(new BigDecimal("500.00"))
                .paidAmount(BigDecimal.ZERO)
                .dueAmount(new BigDecimal("500.00"))
                .status(PurchaseOrderStatus.RECEIVED)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        when(supplierRepository.findByIdAndIsDeletedFalse(supplierId)).thenReturn(Optional.of(supplier));
        when(purchaseOrderRepository.findAllBySupplierIdAndPaymentStatusInAndIsDeletedFalseOrderByInvoiceDateAscCreatedAtAsc(
                eq(supplierId), anyList())).thenReturn(List.of(po1, po2));
        when(purchasePaymentRepository.save(any(PurchasePayment.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(purchaseOrderRepository.save(any(PurchaseOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(purchaseOrderRepository.findAllBySupplierIdAndIsDeletedFalse(supplierId)).thenReturn(List.of(po1, po2));

        // Settle lump sum 1200: should fully clear PO1 (1000) and partially clear PO2 (200 paid, 300 due)
        var req = new com.pharma.medstack.model.request.SettleSupplierDuesRequest(
                PaymentMethod.UPI, new BigDecimal("1200.00"), "UPI-LUMP-1", null, "Lump sum settle"
        );

        var settled = purchaseService.settleSupplierDues(supplierId, req, "owner");

        assertEquals(2, settled.size());
        assertEquals(PaymentStatus.PAID, po1.getPaymentStatus());
        assertEquals(new BigDecimal("1000.00"), po1.getPaidAmount());
        assertEquals(new BigDecimal("0.00"), po1.getDueAmount());

        assertEquals(PaymentStatus.PARTIAL, po2.getPaymentStatus());
        assertEquals(new BigDecimal("200.00"), po2.getPaidAmount());
        assertEquals(new BigDecimal("300.00"), po2.getDueAmount());

        // Supplier balance remaining should be 300.00
        assertEquals(new BigDecimal("300.00"), supplier.getOutstandingBalance());
    }
}
