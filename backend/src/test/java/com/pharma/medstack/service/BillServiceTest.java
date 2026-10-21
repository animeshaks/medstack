package com.pharma.medstack.service;

import com.pharma.medstack.entity.*;
import com.pharma.medstack.exception.InsufficientStockException;
import com.pharma.medstack.exception.InvalidBillException;
import com.pharma.medstack.model.request.CartItemRequest;
import com.pharma.medstack.model.request.CreateBillRequest;
import com.pharma.medstack.entity.PaymentMethod;
import com.pharma.medstack.model.response.BillResponse;
import com.pharma.medstack.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BillServiceTest {

    @Mock private SalesOrderRepository salesOrderRepository;
    @Mock private SalesOrderItemRepository salesOrderItemRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private InventoryBatchRepository inventoryBatchRepository;
    @Mock private MedicineRepository medicineRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private DoctorRepository doctorRepository;
    @Mock private UserRepository userRepository;
    @Mock private BillAuditLogRepository billAuditLogRepository;
    @Mock private StoreSettingRepository storeSettingRepository;

    @InjectMocks
    private BillService billService;

    private User mockUser;
    private Medicine mockMedicine;
    private UUID medicineId;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setId(UUID.randomUUID());
        mockUser.setUsername("staff");

        medicineId = UUID.randomUUID();
        mockMedicine = new Medicine();
        mockMedicine.setId(medicineId);
        mockMedicine.setName("Paracetamol");
        mockMedicine.setRequiresPrescription(false);
    }

    /** Stubs the minimum saves needed for createBill to return without NPE */
    private void stubCommonSaves() {
        when(salesOrderRepository.save(any(SalesOrder.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(salesOrderItemRepository.save(any(SalesOrderItem.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(paymentRepository.save(any(Payment.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(salesOrderRepository.countByDate(any(LocalDate.class))).thenReturn(0L);
    }

    @Test
    void testCreateBill_emptyCart_throws() {
        CreateBillRequest request = new CreateBillRequest(
                null, null, Collections.emptyList(), BigDecimal.ZERO, PaymentMethod.CASH, null);

        assertThrows(InvalidBillException.class, () -> billService.createBill(request, "staff"));
    }

    @Test
    void testFifoAllocation_singleBatch_success() {
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));
        stubCommonSaves();

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(mockMedicine);
        batch.setQuantity(10);
        batch.setExpiryDate(LocalDate.now().plusYears(1));
        batch.setSellingPrice(new BigDecimal("10.00"));

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 5));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, BigDecimal.ZERO, PaymentMethod.CASH, null);

        BillResponse response = billService.createBill(request, "staff");

        assertNotNull(response);
        assertEquals(5, batch.getQuantity());
        verify(inventoryBatchRepository).save(batch);
    }

    @Test
    void testFifoAllocation_insufficientStock_throws() {
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(mockMedicine);
        batch.setQuantity(3);
        batch.setExpiryDate(LocalDate.now().plusYears(1));
        batch.setSellingPrice(new BigDecimal("10.00")); // must not be null

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 10));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, BigDecimal.ZERO, PaymentMethod.CASH, null);

        assertThrows(InsufficientStockException.class, () -> billService.createBill(request, "staff"));
    }

    @Test
    void testFifoAllocation_multipleBatches_consumesEarlierFirst() {
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));
        stubCommonSaves();

        InventoryBatch batch1 = new InventoryBatch();
        batch1.setId(UUID.randomUUID());
        batch1.setMedicine(mockMedicine);
        batch1.setQuantity(5);
        batch1.setExpiryDate(LocalDate.of(2027, 1, 1));
        batch1.setSellingPrice(new BigDecimal("10.00"));

        InventoryBatch batch2 = new InventoryBatch();
        batch2.setId(UUID.randomUUID());
        batch2.setMedicine(mockMedicine);
        batch2.setQuantity(10);
        batch2.setExpiryDate(LocalDate.of(2028, 1, 1));
        batch2.setSellingPrice(new BigDecimal("10.00"));

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch1, batch2));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 7));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, BigDecimal.ZERO, PaymentMethod.CASH, null);

        billService.createBill(request, "staff");

        assertEquals(0, batch1.getQuantity());
        assertEquals(8, batch2.getQuantity());
        verify(inventoryBatchRepository).save(batch1);
        verify(inventoryBatchRepository).save(batch2);
    }

    @Test
    void testPrescriptionRequired_noDoctorProvided_throws() {
        mockMedicine.setRequiresPrescription(true);
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 1));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, BigDecimal.ZERO, PaymentMethod.CASH, null);

        InvalidBillException ex = assertThrows(InvalidBillException.class,
                () -> billService.createBill(request, "staff"));
        assertTrue(ex.getMessage().toLowerCase().contains("prescription"));
    }

    @Test
    void testPrescriptionRequired_withDoctor_success() {
        mockMedicine.setRequiresPrescription(true);
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));
        stubCommonSaves();

        UUID doctorId = UUID.randomUUID();
        Doctor doctor = new Doctor();
        doctor.setId(doctorId);
        when(doctorRepository.findByIdAndIsDeletedFalse(doctorId)).thenReturn(Optional.of(doctor));

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(mockMedicine);
        batch.setQuantity(10);
        batch.setExpiryDate(LocalDate.now().plusYears(1));
        batch.setSellingPrice(new BigDecimal("10.00"));

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 1));
        CreateBillRequest request = new CreateBillRequest(
                null, doctorId, items, BigDecimal.ZERO, PaymentMethod.CASH, null);

        assertDoesNotThrow(() -> billService.createBill(request, "staff"));
    }

    @Test
    void testGrandTotalCalculation() {
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));
        stubCommonSaves();

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(mockMedicine);
        batch.setQuantity(10);
        batch.setExpiryDate(LocalDate.now().plusYears(1));
        batch.setSellingPrice(new BigDecimal("100.00")); // 100 each

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 2));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, new BigDecimal("20.00"), PaymentMethod.CASH, null);

        BillResponse response = billService.createBill(request, "staff");

        // Inclusive GST: Gross = 200.00, Taxable base = 200 / 1.05 = 190.48, GST (5%) = 9.52, Discount = 20.00 => GrandTotal = 180.00
        assertEquals(0, new BigDecimal("190.48").compareTo(response.totalAmount()));
        assertEquals(0, new BigDecimal("9.52").compareTo(response.taxAmount()));
        assertEquals(0, new BigDecimal("180.00").compareTo(response.grandTotal()));
        assertEquals(0, new BigDecimal("20.00").compareTo(response.discountAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(response.roundOff()));
    }

    @Test
    void testExemptedGstCalculation_condomsZeroGst() {
        mockMedicine.setGstRate(BigDecimal.ZERO); // 0% GST for condoms/contraceptives
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));
        stubCommonSaves();

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(mockMedicine);
        batch.setQuantity(10);
        batch.setExpiryDate(LocalDate.now().plusYears(1));
        batch.setSellingPrice(new BigDecimal("100.00"));

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 2));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, new BigDecimal("20.00"), PaymentMethod.CASH, null);

        BillResponse response = billService.createBill(request, "staff");

        // Subtotal = 200.00, Tax (0% GST) = 0.00, Discount = 20.00 => GrandTotal = 180.00
        assertEquals(0, new BigDecimal("200.00").compareTo(response.totalAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(response.taxAmount()));
        assertEquals(0, new BigDecimal("180.00").compareTo(response.grandTotal()));
        assertEquals(0, new BigDecimal("20.00").compareTo(response.discountAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(response.roundOff()));
    }

    @Test
    void testFloorRounding_neverCrossesMrp() {
        mockMedicine.setGstRate(new BigDecimal("5.00"));
        when(userRepository.findByUsernameAndIsDeletedFalse("staff")).thenReturn(Optional.of(mockUser));
        when(medicineRepository.findByIdAndIsDeletedFalse(medicineId)).thenReturn(Optional.of(mockMedicine));
        stubCommonSaves();

        InventoryBatch batch = new InventoryBatch();
        batch.setId(UUID.randomUUID());
        batch.setMedicine(mockMedicine);
        batch.setQuantity(10);
        batch.setExpiryDate(LocalDate.now().plusYears(1));
        batch.setSellingPrice(new BigDecimal("15.50")); // Gross price 15.50 with odd paise

        when(inventoryBatchRepository.findEligibleBatchesForSale(eq(medicineId), any()))
                .thenReturn(List.of(batch));

        List<CartItemRequest> items = List.of(new CartItemRequest(medicineId, 1));
        CreateBillRequest request = new CreateBillRequest(
                null, null, items, BigDecimal.ZERO, PaymentMethod.CASH, null);

        BillResponse response = billService.createBill(request, "staff");

        // Gross = 15.50, Taxable base = 14.76, GST = 0.74, Unrounded = 15.50
        // Floor to lower integer = 15.00, roundOff = -0.50
        assertEquals(0, new BigDecimal("14.76").compareTo(response.totalAmount()));
        assertEquals(0, new BigDecimal("0.74").compareTo(response.taxAmount()));
        assertEquals(0, new BigDecimal("15.00").compareTo(response.grandTotal()));
        assertEquals(0, new BigDecimal("-0.50").compareTo(response.roundOff()));
        assertTrue(response.grandTotal().compareTo(new BigDecimal("15.50")) <= 0, "Grand total must not cross MRP");
    }
}
