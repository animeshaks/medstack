package com.pharma.medstack.service;

import com.pharma.medstack.entity.*;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.exception.InsufficientStockException;
import com.pharma.medstack.exception.InvalidBillException;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.AddPaymentRequest;
import com.pharma.medstack.model.request.CartItemRequest;
import com.pharma.medstack.model.request.CreateBillRequest;
import com.pharma.medstack.model.request.SettleCustomerDueRequest;
import com.pharma.medstack.model.request.UpdateBillRequest;
import com.pharma.medstack.model.response.BillAuditLogResponse;
import com.pharma.medstack.model.response.BillItemResponse;
import com.pharma.medstack.model.response.BillResponse;
import com.pharma.medstack.model.response.CustomerBalanceItemResponse;
import com.pharma.medstack.model.response.CustomerDueSummaryResponse;
import com.pharma.medstack.model.response.PaymentResponse;
import com.pharma.medstack.repository.*;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillService {

    private final SalesOrderRepository salesOrderRepository;
    private final SalesOrderItemRepository salesOrderItemRepository;
    private final PaymentRepository paymentRepository;
    private final InventoryBatchRepository inventoryBatchRepository;
    private final MedicineRepository medicineRepository;
    private final CustomerRepository customerRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final BillAuditLogRepository billAuditLogRepository;
    private final StoreSettingRepository storeSettingRepository;

    private String generateBillNumber() {
        LocalDate today = LocalDate.now();
        long count = salesOrderRepository.countByDate(today);
        return String.format("MS-%s-%04d", today.format(DateTimeFormatter.BASIC_ISO_DATE), count + 1);
    }

    @Transactional
    public BillResponse createBill(CreateBillRequest request, String username) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new InvalidBillException("Cart cannot be empty");
        }

        User user = userRepository.findByUsernameAndIsDeletedFalse(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Customer customer = null;
        if (request.customerId() != null) {
            customer = customerRepository.findByIdAndIsDeletedFalse(request.customerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        }

        Doctor prescribingDoctor = null;
        if (request.prescribingDoctorId() != null) {
            prescribingDoctor = doctorRepository.findByIdAndIsDeletedFalse(request.prescribingDoctorId())
                    .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal taxAmount = BigDecimal.ZERO;

        List<SalesOrderItem> orderItemsToSave = new ArrayList<>();

        for (CartItemRequest cartItem : request.items()) {
            Medicine medicine = medicineRepository.findByIdAndIsDeletedFalse(cartItem.medicineId())
                    .orElseThrow(() -> new ResourceNotFoundException("Medicine not found with id: " + cartItem.medicineId()));

            if (medicine.isRequiresPrescription() && prescribingDoctor == null) {
                throw new InvalidBillException("Medicine " + medicine.getName() + " requires a prescription. Please provide a prescribing doctor.");
            }

            int packSize = medicine.getUnitsPerPack() > 0 ? medicine.getUnitsPerPack() : 1;
            String reqUnit = cartItem.getDispenseUnitOrDefault();
            boolean isTabletOrLoose = "TABLET".equalsIgnoreCase(reqUnit) || "LOOSE".equalsIgnoreCase(reqUnit)
                    || ("TABLET".equalsIgnoreCase(medicine.getCategory()) && !"STRIP".equalsIgnoreCase(reqUnit) && !"PACK".equalsIgnoreCase(reqUnit));

            int unitsNeeded;
            String dispenseUnit;
            if (isTabletOrLoose && packSize > 1) {
                unitsNeeded = cartItem.quantity(); // e.g. 5 tablets
                dispenseUnit = "TABLET";
            } else if ("STRIP".equalsIgnoreCase(reqUnit) || "PACK".equalsIgnoreCase(reqUnit)) {
                unitsNeeded = cartItem.quantity() * packSize; // e.g. 2 strips of 10 = 20 tablets
                dispenseUnit = "STRIP";
            } else {
                unitsNeeded = cartItem.quantity();
                dispenseUnit = "UNIT";
            }

            List<InventoryBatch> eligibleBatches = inventoryBatchRepository.findEligibleBatchesForSale(medicine.getId(), LocalDate.now());
            if (eligibleBatches.isEmpty()) {
                throw new InsufficientStockException("No stock available for: " + medicine.getName());
            }

            int remainingUnits = unitsNeeded;
            for (InventoryBatch batch : eligibleBatches) {
                if (remainingUnits <= 0) break;

                int batchPackSize = batch.getMedicine().getUnitsPerPack() > 0 ? batch.getMedicine().getUnitsPerPack() : 1;
                int batchTotalUnits = (batch.getQuantity() * batchPackSize) + batch.getLooseQuantity();
                if (batchTotalUnits <= 0) continue;

                int takeUnits = Math.min(batchTotalUnits, remainingUnits);
                int remainingInBatch = batchTotalUnits - takeUnits;

                batch.setQuantity(remainingInBatch / batchPackSize);
                batch.setLooseQuantity(remainingInBatch % batchPackSize);
                remainingUnits -= takeUnits;
                inventoryBatchRepository.save(batch);

                BigDecimal packPrice = batch.getSellingPrice();
                if (packPrice == null || packPrice.compareTo(BigDecimal.ZERO) == 0) {
                    packPrice = batch.getMrp();
                }

                BigDecimal unitPrice;
                BigDecimal lineSubtotal;
                if ("TABLET".equalsIgnoreCase(dispenseUnit) && batchPackSize > 1) {
                    unitPrice = packPrice.divide(BigDecimal.valueOf(batchPackSize), 2, RoundingMode.HALF_UP);
                    lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(takeUnits)).setScale(2, RoundingMode.HALF_UP);
                } else if ("STRIP".equalsIgnoreCase(dispenseUnit) && batchPackSize > 1) {
                    unitPrice = packPrice;
                    lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(takeUnits).divide(BigDecimal.valueOf(batchPackSize), 2, RoundingMode.HALF_UP));
                } else {
                    unitPrice = packPrice;
                    lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(takeUnits)).setScale(2, RoundingMode.HALF_UP);
                }

                totalAmount = totalAmount.add(lineSubtotal);

                BigDecimal taxRate = BigDecimal.ZERO;
                BigDecimal itemTax = lineSubtotal.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                taxAmount = taxAmount.add(itemTax);

                SalesOrderItem orderItem = SalesOrderItem.builder()
                        .inventoryBatch(batch)
                        .quantity(takeUnits)
                        .unitPrice(unitPrice)
                        .taxRate(taxRate)
                        .subtotal(lineSubtotal)
                        .dispenseUnit(dispenseUnit)
                        .packSize(batchPackSize)
                        .build();
                orderItemsToSave.add(orderItem);
            }

            if (remainingUnits > 0) {
                throw new InsufficientStockException("Insufficient stock for: " + medicine.getName() + " (requested: " + unitsNeeded + " units, short by: " + remainingUnits + ")");
            }
        }

        int redeemPoints = request.getRedeemPointsOrDefault();
        if (customer != null && redeemPoints > 0) {
            int maxAllowedPoints = totalAmount.multiply(new BigDecimal("0.10")).setScale(0, RoundingMode.FLOOR).intValue();
            if (redeemPoints > maxAllowedPoints) {
                throw new InvalidBillException("Maximum " + maxAllowedPoints + " reward points (10% of bill amount ₹" + totalAmount.setScale(2, RoundingMode.HALF_UP) + ") can be redeemed for this bill");
            }
            if (redeemPoints > customer.getRewardPoints()) {
                throw new InvalidBillException("Customer only has " + customer.getRewardPoints() + " reward points available");
            }
            customer.setRewardPoints(customer.getRewardPoints() - redeemPoints);
        } else {
            redeemPoints = 0;
        }

        BigDecimal manualDiscount = request.discountAmount() != null ? request.discountAmount() : BigDecimal.ZERO;
        BigDecimal pointsDiscount = BigDecimal.valueOf(redeemPoints);
        BigDecimal discountAmount = manualDiscount.add(pointsDiscount);
        if (discountAmount.compareTo(totalAmount) > 0) {
            discountAmount = totalAmount;
        }

        BigDecimal grandTotal = totalAmount.add(taxAmount).subtract(discountAmount);
        if (grandTotal.compareTo(BigDecimal.ZERO) < 0) grandTotal = BigDecimal.ZERO;

        // Earn 1 point per full ₹100 of grand total
        int earnedPoints = 0;
        if (customer != null && grandTotal.compareTo(BigDecimal.ZERO) > 0) {
            earnedPoints = grandTotal.divide(BigDecimal.valueOf(100), RoundingMode.FLOOR).intValue();
            customer.setRewardPoints(customer.getRewardPoints() + earnedPoints);
            customerRepository.save(customer);
            log.info("REWARD_POINTS_UPDATED customerId={} earned={} redeemed={} balance={}", customer.getId(), earnedPoints, redeemPoints, customer.getRewardPoints());
        }

        String resolvedCustomerName = customer != null ? customer.getName() 
                : (request.customerName() != null && !request.customerName().isBlank() ? request.customerName().trim() : "Walk-in Customer");
        String resolvedCustomerPhone = customer != null ? customer.getPhone() 
                : (request.customerPhone() != null && !request.customerPhone().isBlank() ? request.customerPhone().trim() : null);

        StoreSetting storeSetting = storeSettingRepository.findCurrentSettings().orElse(null);
        String storeName = storeSetting != null && storeSetting.getStoreName() != null ? storeSetting.getStoreName() : "MedStack Pharmacy";
        String storeAddress = storeSetting != null 
                ? List.of(storeSetting.getAddress() != null ? storeSetting.getAddress() : "",
                          storeSetting.getCity() != null ? storeSetting.getCity() : "",
                          storeSetting.getState() != null ? storeSetting.getState() : "",
                          storeSetting.getPincode() != null ? storeSetting.getPincode() : "")
                      .stream().filter(s -> !s.isBlank()).collect(Collectors.joining(", "))
                : "Shop #12, Health Plaza, 100 Feet Road, Indiranagar, Bengaluru - 560038";
        String storePhone = storeSetting != null && storeSetting.getPhone() != null ? storeSetting.getPhone() : "+91 98765 43210";
        String storeEmail = storeSetting != null && storeSetting.getEmail() != null ? storeSetting.getEmail() : "contact@medstackpharma.in";
        String storeGstin = storeSetting != null && storeSetting.getGstin() != null ? storeSetting.getGstin() : "29AABCS1429B1ZV";
        String storeDlNumber = storeSetting != null && storeSetting.getDlNumber() != null ? storeSetting.getDlNumber() : "KA-BLR-2024-1029";

        SalesOrder salesOrder = SalesOrder.builder()
                .billNumber(generateBillNumber())
                .customer(customer)
                .customerName(resolvedCustomerName)
                .customerPhone(resolvedCustomerPhone)
                .user(user)
                .prescribingDoctor(prescribingDoctor)
                .totalAmount(totalAmount.setScale(2, RoundingMode.HALF_UP))
                .discountAmount(discountAmount.setScale(2, RoundingMode.HALF_UP))
                .taxAmount(taxAmount.setScale(2, RoundingMode.HALF_UP))
                .grandTotal(grandTotal.setScale(2, RoundingMode.HALF_UP))
                .earnedPoints(earnedPoints)
                .redeemedPoints(redeemPoints)
                .storeName(storeName)
                .storeAddress(storeAddress)
                .storePhone(storePhone)
                .storeEmail(storeEmail)
                .storeGstin(storeGstin)
                .storeDlNumber(storeDlNumber)
                .paymentStatus(PaymentStatus.PENDING)
                .orderStatus(OrderStatus.CONFIRMED)
                .build();
        salesOrder = salesOrderRepository.save(salesOrder);

        for (SalesOrderItem item : orderItemsToSave) {
            item.setSalesOrder(salesOrder);
            salesOrderItemRepository.save(item);
        }

        BigDecimal requestedPaid = request.paidAmount();
        BigDecimal paidAmount;
        if (requestedPaid == null) {
            paidAmount = grandTotal;
        } else if (requestedPaid.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidBillException("Paid amount cannot be negative");
        } else if (requestedPaid.compareTo(grandTotal) > 0) {
            paidAmount = grandTotal;
        } else {
            paidAmount = requestedPaid;
        }

        BigDecimal dueAmount = grandTotal.subtract(paidAmount);
        if (dueAmount.compareTo(BigDecimal.ZERO) < 0) {
            dueAmount = BigDecimal.ZERO;
        }

        if (dueAmount.compareTo(BigDecimal.ZERO) > 0) {
            if (customer == null && (resolvedCustomerPhone == null || resolvedCustomerPhone.isBlank())) {
                throw new InvalidBillException("Partial payment / Pay Later requires a customer phone number to record balance due.");
            }
            if (customer != null) {
                BigDecimal currentBal = customer.getOutstandingBalance() != null ? customer.getOutstandingBalance() : BigDecimal.ZERO;
                customer.setOutstandingBalance(currentBal.add(dueAmount).setScale(2, RoundingMode.HALF_UP));
                customerRepository.save(customer);
            }
        }

        List<Payment> payments = new ArrayList<>();
        if (paidAmount.compareTo(BigDecimal.ZERO) > 0 || grandTotal.compareTo(BigDecimal.ZERO) == 0) {
            Payment payment = Payment.builder()
                    .salesOrder(salesOrder)
                    .paymentMethod(request.paymentMethod())
                    .amount(paidAmount.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(Instant.now())
                    .build();
            payment = paymentRepository.save(payment);
            payments.add(payment);
        }

        if (paidAmount.compareTo(grandTotal) >= 0) {
            salesOrder.setPaymentStatus(PaymentStatus.PAID);
        } else if (paidAmount.compareTo(BigDecimal.ZERO) > 0) {
            salesOrder.setPaymentStatus(PaymentStatus.PARTIAL);
        } else {
            salesOrder.setPaymentStatus(PaymentStatus.PENDING);
        }
        salesOrder = salesOrderRepository.save(salesOrder);

        log.info("BILL_CREATED billNumber={} grandTotal={} paidAmount={} dueAmount={} status={} user={}",
                salesOrder.getBillNumber(), grandTotal, paidAmount, dueAmount, salesOrder.getPaymentStatus(), username);

        return mapToBillResponse(salesOrder, orderItemsToSave, payments);
    }

    @Transactional(readOnly = true)
    public BillResponse getBill(UUID id) {
        SalesOrder salesOrder = salesOrderRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        List<SalesOrderItem> items = salesOrderItemRepository.findAllBySalesOrderIdAndIsDeletedFalse(id);
        List<Payment> payments = paymentRepository.findAllBySalesOrderId(id);
        return mapToBillResponse(salesOrder, items, payments);
    }

    @Transactional(readOnly = true)
    public Page<BillResponse> getAllBills(String search, UUID customerId, UUID userId, Instant startDate, Instant endDate, PaymentStatus paymentStatus, Boolean dueOnly, Pageable pageable) {
        return getAllBills(search, customerId, userId, startDate, endDate, paymentStatus, dueOnly, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<BillResponse> getAllBills(String search, UUID customerId, UUID userId, Instant startDate, Instant endDate, PaymentStatus paymentStatus, Boolean dueOnly, Boolean rxRequiredOnly, Pageable pageable) {
        Specification<SalesOrder> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("isDeleted")));

            if (customerId != null) {
                predicates.add(cb.equal(root.get("customer").get("id"), customerId));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("user").get("id"), userId));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate));
            }
            if (Boolean.TRUE.equals(dueOnly)) {
                predicates.add(root.get("paymentStatus").in(PaymentStatus.PENDING, PaymentStatus.PARTIAL));
            } else if (paymentStatus != null) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus));
            }
            if (Boolean.TRUE.equals(rxRequiredOnly)) {
                jakarta.persistence.criteria.Subquery<UUID> subquery = query.subquery(UUID.class);
                jakarta.persistence.criteria.Root<SalesOrderItem> itemRoot = subquery.from(SalesOrderItem.class);
                subquery.select(itemRoot.get("salesOrder").get("id"))
                        .where(
                            cb.isFalse(itemRoot.get("isDeleted")),
                            cb.isTrue(itemRoot.get("inventoryBatch").get("medicine").get("requiresPrescription")),
                            cb.equal(itemRoot.get("salesOrder").get("id"), root.get("id"))
                        );
                predicates.add(cb.exists(subquery));
            }
            if (search != null && !search.trim().isEmpty()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate pBill = cb.like(cb.lower(root.get("billNumber")), pattern);
                Predicate pCustName = cb.like(cb.lower(root.get("customerName")), pattern);
                Predicate pCustPhone = cb.like(cb.lower(root.get("customerPhone")), pattern);
                predicates.add(cb.or(pBill, pCustName, pCustPhone));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        org.springframework.data.domain.Pageable sortedPageable = pageable;
        if (pageable.getSort().isUnsorted()) {
            sortedPageable = org.springframework.data.domain.PageRequest.of(
                    pageable.getPageNumber(),
                    pageable.getPageSize(),
                    org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")
            );
        }

        Page<SalesOrder> salesOrders = salesOrderRepository.findAll(spec, sortedPageable);

        return salesOrders.map(so -> {
            List<SalesOrderItem> items = salesOrderItemRepository.findAllBySalesOrderIdAndIsDeletedFalse(so.getId());
            List<Payment> payments = paymentRepository.findAllBySalesOrderId(so.getId());
            return mapToBillResponse(so, items, payments);
        });
    }

    @Transactional
    public BillResponse addPayment(UUID orderId, AddPaymentRequest request) {
        SalesOrder salesOrder = salesOrderRepository.findByIdAndIsDeletedFalse(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));

        if (salesOrder.getPaymentStatus() == PaymentStatus.PAID) {
            throw new InvalidBillException("Bill is already fully paid");
        }

        List<Payment> existingPayments = paymentRepository.findAllBySalesOrderId(orderId);
        BigDecimal currentTotalPaid = existingPayments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal currentDue = salesOrder.getGrandTotal().subtract(currentTotalPaid);
        if (currentDue.compareTo(BigDecimal.ZERO) <= 0) {
            salesOrder.setPaymentStatus(PaymentStatus.PAID);
            salesOrderRepository.save(salesOrder);
            throw new InvalidBillException("Bill has no remaining balance due");
        }

        BigDecimal requestedAmount = request.amount();
        if (requestedAmount == null || requestedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidBillException("Payment amount must be greater than zero");
        }

        BigDecimal paymentForBill = requestedAmount.min(currentDue);
        BigDecimal excessAdvance = requestedAmount.subtract(paymentForBill);

        Payment payment = Payment.builder()
                .salesOrder(salesOrder)
                .customer(salesOrder.getCustomer())
                .paymentMethod(request.paymentMethod())
                .amount(paymentForBill.setScale(2, RoundingMode.HALF_UP))
                .transactionRef(request.transactionRef())
                .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                .build();
        payment = paymentRepository.save(payment);

        if (excessAdvance.compareTo(BigDecimal.ZERO) > 0 && salesOrder.getCustomer() != null) {
            Payment advancePayment = Payment.builder()
                    .salesOrder(null)
                    .customer(salesOrder.getCustomer())
                    .paymentMethod(request.paymentMethod())
                    .amount(excessAdvance.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .build();
            paymentRepository.save(advancePayment);
        }

        List<Payment> allPayments = new ArrayList<>(existingPayments);
        allPayments.add(payment);

        BigDecimal totalPaid = allPayments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalPaid.compareTo(salesOrder.getGrandTotal()) >= 0) {
            salesOrder.setPaymentStatus(PaymentStatus.PAID);
        } else {
            salesOrder.setPaymentStatus(PaymentStatus.PARTIAL);
        }
        salesOrderRepository.save(salesOrder);

        // Reduce customer outstanding balance by entire received payment
        Customer customer = salesOrder.getCustomer();
        if (customer != null) {
            BigDecimal currentBal = customer.getOutstandingBalance() != null ? customer.getOutstandingBalance() : BigDecimal.ZERO;
            BigDecimal newBal = currentBal.subtract(requestedAmount);
            customer.setOutstandingBalance(newBal.setScale(2, RoundingMode.HALF_UP));
            customerRepository.save(customer);
        }

        log.info("PAYMENT_RECEIVED billId={} amount={} status={}", orderId, requestedAmount, salesOrder.getPaymentStatus());

        List<SalesOrderItem> items = salesOrderItemRepository.findAllBySalesOrderIdAndIsDeletedFalse(orderId);
        return mapToBillResponse(salesOrder, items, allPayments);
    }

    @Transactional(readOnly = true)
    public CustomerDueSummaryResponse getDuesSummary() {
        List<SalesOrder> dueOrders = salesOrderRepository.findAllByPaymentStatusInAndIsDeletedFalse(
                List.of(PaymentStatus.PENDING, PaymentStatus.PARTIAL));

        BigDecimal totalOutstanding = BigDecimal.ZERO;
        Set<UUID> customerIdsWithDues = new HashSet<>();

        for (SalesOrder order : dueOrders) {
            List<Payment> payments = paymentRepository.findAllBySalesOrderId(order.getId());
            BigDecimal paid = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal due = order.getGrandTotal().subtract(paid);
            if (due.compareTo(BigDecimal.ZERO) > 0) {
                totalOutstanding = totalOutstanding.add(due);
                if (order.getCustomer() != null) {
                    customerIdsWithDues.add(order.getCustomer().getId());
                }
            }
        }

        List<Customer> customersWithBalance = customerRepository.findCustomersWithOutstandingBalance();
        List<CustomerBalanceItemResponse> customerItems = customersWithBalance.stream()
                .map(c -> {
                    long unpaidCount = dueOrders.stream()
                            .filter(o -> o.getCustomer() != null && o.getCustomer().getId().equals(c.getId()))
                            .count();
                    Instant lastBillDate = dueOrders.stream()
                            .filter(o -> o.getCustomer() != null && o.getCustomer().getId().equals(c.getId()))
                            .map(SalesOrder::getCreatedAt)
                            .max(Instant::compareTo)
                            .orElse(null);
                    return new CustomerBalanceItemResponse(
                            c.getId(),
                            c.getName(),
                            c.getPhone(),
                            c.getOutstandingBalance() != null ? c.getOutstandingBalance() : BigDecimal.ZERO,
                            unpaidCount,
                            lastBillDate
                    );
                })
                .sorted(Comparator.comparing(CustomerBalanceItemResponse::outstandingBalance).reversed())
                .collect(Collectors.toList());

        return new CustomerDueSummaryResponse(
                totalOutstanding.setScale(2, RoundingMode.HALF_UP),
                customerIdsWithDues.size(),
                dueOrders.size(),
                customerItems
        );
    }

    @Transactional(readOnly = true)
    public Page<CustomerBalanceItemResponse> getCustomersWithDues(String search, Pageable pageable) {
        Page<Customer> customers;
        if (search != null && !search.trim().isEmpty()) {
            customers = customerRepository.searchCustomersWithOutstandingBalance(search.trim(), pageable);
        } else {
            customers = customerRepository.findCustomersWithOutstandingBalance(pageable);
        }

        return customers.map(c -> {
            List<SalesOrder> customerDueOrders = salesOrderRepository.findAllByCustomerIdAndPaymentStatusInAndIsDeletedFalseOrderByCreatedAtAsc(
                    c.getId(), List.of(PaymentStatus.PENDING, PaymentStatus.PARTIAL));

            Instant lastBillDate = customerDueOrders.stream()
                    .map(SalesOrder::getCreatedAt)
                    .max(Instant::compareTo)
                    .orElse(null);

            return new CustomerBalanceItemResponse(
                    c.getId(),
                    c.getName(),
                    c.getPhone(),
                    c.getOutstandingBalance() != null ? c.getOutstandingBalance() : BigDecimal.ZERO,
                    customerDueOrders.size(),
                    lastBillDate
            );
        });
    }

    @Transactional
    public List<BillResponse> settleCustomerDue(UUID customerId, SettleCustomerDueRequest request) {
        Customer customer = customerRepository.findByIdAndIsDeletedFalse(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        List<SalesOrder> dueOrders = salesOrderRepository.findAllByCustomerIdAndPaymentStatusInAndIsDeletedFalseOrderByCreatedAtAsc(
                customerId, List.of(PaymentStatus.PENDING, PaymentStatus.PARTIAL));

        BigDecimal remainingPayment = request.amount();
        if (remainingPayment == null || remainingPayment.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidBillException("Payment amount must be greater than zero");
        }

        if (dueOrders.isEmpty()) {
            Payment advancePayment = Payment.builder()
                    .salesOrder(null)
                    .customer(customer)
                    .paymentMethod(request.paymentMethod())
                    .amount(remainingPayment.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .build();
            paymentRepository.save(advancePayment);

            BigDecimal currentBal = customer.getOutstandingBalance() != null ? customer.getOutstandingBalance() : BigDecimal.ZERO;
            BigDecimal newBal = currentBal.subtract(remainingPayment);
            customer.setOutstandingBalance(newBal.setScale(2, RoundingMode.HALF_UP));
            customerRepository.save(customer);

            log.info("CUSTOMER_ADVANCE_RECORDED customerId={} amount={} newBalance={}", customerId, remainingPayment, newBal);
            return Collections.emptyList();
        }

        List<BillResponse> settledBills = new ArrayList<>();

        for (SalesOrder order : dueOrders) {
            if (remainingPayment.compareTo(BigDecimal.ZERO) <= 0) break;

            List<Payment> existingPayments = paymentRepository.findAllBySalesOrderId(order.getId());
            BigDecimal paidOnOrder = existingPayments.stream()
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal orderDue = order.getGrandTotal().subtract(paidOnOrder);
            if (orderDue.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal allocate = remainingPayment.min(orderDue);
            Payment payment = Payment.builder()
                    .salesOrder(order)
                    .customer(customer)
                    .paymentMethod(request.paymentMethod())
                    .amount(allocate.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .build();
            payment = paymentRepository.save(payment);

            List<Payment> allPayments = new ArrayList<>(existingPayments);
            allPayments.add(payment);

            BigDecimal newPaid = paidOnOrder.add(allocate);
            if (newPaid.compareTo(order.getGrandTotal()) >= 0) {
                order.setPaymentStatus(PaymentStatus.PAID);
            } else {
                order.setPaymentStatus(PaymentStatus.PARTIAL);
            }
            salesOrderRepository.save(order);

            remainingPayment = remainingPayment.subtract(allocate);

            List<SalesOrderItem> items = salesOrderItemRepository.findAllBySalesOrderIdAndIsDeletedFalse(order.getId());
            settledBills.add(mapToBillResponse(order, items, allPayments));
        }

        if (remainingPayment.compareTo(BigDecimal.ZERO) > 0) {
            Payment advancePayment = Payment.builder()
                    .salesOrder(null)
                    .customer(customer)
                    .paymentMethod(request.paymentMethod())
                    .amount(remainingPayment.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .build();
            paymentRepository.save(advancePayment);
        }

        BigDecimal currentBal = customer.getOutstandingBalance() != null ? customer.getOutstandingBalance() : BigDecimal.ZERO;
        BigDecimal newBal = currentBal.subtract(request.amount());
        customer.setOutstandingBalance(newBal.setScale(2, RoundingMode.HALF_UP));
        customerRepository.save(customer);

        BigDecimal totalApplied = request.amount().subtract(remainingPayment);
        log.info("CUSTOMER_DUES_SETTLED customerId={} applied={} advanceCredit={} remainingBalance={}",
                customerId, totalApplied, remainingPayment, customer.getOutstandingBalance());

        return settledBills;
    }

    @Transactional
    public BillResponse updateBill(UUID billId, UpdateBillRequest request, String username) {
        // STEP 1: Load existing bill
        SalesOrder order = salesOrderRepository.findByIdAndIsDeletedFalse(billId)
            .orElseThrow(() -> new ResourceNotFoundException("Bill not found: " + billId));

        // STEP 2: Only CONFIRMED bills can be edited
        if (order.getOrderStatus() == OrderStatus.CANCELLED) {
            throw new InvalidBillException("Cannot edit a cancelled bill");
        }

        // STEP 2b: Return / update period check: Allowed within 7 days
        if (order.getCreatedAt() != null) {
            long daysSinceCreation = Duration.between(order.getCreatedAt(), Instant.now()).toDays();
            if (daysSinceCreation > 7) {
                throw new BusinessValidationException("Bill return/update period has expired. Bills can only be updated or returned within 7 days of creation (created " + daysSinceCreation + " days ago).");
            }
        }

        // STEP 3: Capture old snapshot (JSON) for audit
        String oldSnapshot = captureSnapshot(order);

        // STEP 4: Load and REVERSE original inventory deductions (supporting loose tablets / strip-breaking)
        List<SalesOrderItem> originalItems = salesOrderItemRepository.findAllBySalesOrderIdAndIsDeletedFalse(billId);
        for (SalesOrderItem item : originalItems) {
            InventoryBatch batch = item.getInventoryBatch();
            int batchPackSize = batch.getMedicine().getUnitsPerPack() > 0 ? batch.getMedicine().getUnitsPerPack() : 1;
            int currentTotalUnits = (batch.getQuantity() * batchPackSize) + batch.getLooseQuantity();
            int restoredTotalUnits = currentTotalUnits + item.getQuantity();
            batch.setQuantity(restoredTotalUnits / batchPackSize);
            batch.setLooseQuantity(restoredTotalUnits % batchPackSize);
            inventoryBatchRepository.save(batch);
        }
        // Delete original items
        salesOrderItemRepository.deleteAllBySalesOrderId(billId);

        // Reverse previous reward points on customer if present
        Customer oldCustomer = order.getCustomer();
        if (oldCustomer != null) {
            int currentPoints = oldCustomer.getRewardPoints();
            int adjustedPoints = Math.max(0, currentPoints + order.getRedeemedPoints() - order.getEarnedPoints());
            oldCustomer.setRewardPoints(adjustedPoints);
            customerRepository.save(oldCustomer);
        }

        // STEP 5: Update order header fields
        Customer newCustomer = null;
        if (request.customerId() != null) {
            newCustomer = customerRepository.findByIdAndIsDeletedFalse(request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
            order.setCustomer(newCustomer);
            order.setCustomerName(newCustomer.getName());
            order.setCustomerPhone(newCustomer.getPhone());
        }

        Doctor prescribingDoctor = null;
        if (request.prescribingDoctorId() != null) {
            prescribingDoctor = doctorRepository.findByIdAndIsDeletedFalse(request.prescribingDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
            order.setPrescribingDoctor(prescribingDoctor);
        } else {
            order.setPrescribingDoctor(null);
        }

        // STEP 6: Re-validate and re-allocate FIFO using loose tablet strip-breaking
        List<SalesOrderItem> newItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal taxAmount = BigDecimal.ZERO;

        for (CartItemRequest cartItem : request.items()) {
            Medicine medicine = medicineRepository.findByIdAndIsDeletedFalse(cartItem.medicineId())
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found: " + cartItem.medicineId()));

            if (medicine.isRequiresPrescription() && prescribingDoctor == null) {
                throw new InvalidBillException("Medicine '" + medicine.getName() + "' requires a prescription. Please provide a prescribing doctor.");
            }

            int packSize = medicine.getUnitsPerPack() > 0 ? medicine.getUnitsPerPack() : 1;
            String reqUnit = cartItem.getDispenseUnitOrDefault();
            boolean isTabletOrLoose = "TABLET".equalsIgnoreCase(reqUnit) || "LOOSE".equalsIgnoreCase(reqUnit)
                    || ("TABLET".equalsIgnoreCase(medicine.getCategory()) && !"STRIP".equalsIgnoreCase(reqUnit) && !"PACK".equalsIgnoreCase(reqUnit));

            int unitsNeeded;
            String dispenseUnit;
            if (isTabletOrLoose && packSize > 1) {
                unitsNeeded = cartItem.quantity();
                dispenseUnit = "TABLET";
            } else if ("STRIP".equalsIgnoreCase(reqUnit) || "PACK".equalsIgnoreCase(reqUnit)) {
                unitsNeeded = cartItem.quantity() * packSize;
                dispenseUnit = "STRIP";
            } else {
                unitsNeeded = cartItem.quantity();
                dispenseUnit = "UNIT";
            }

            List<InventoryBatch> eligibleBatches = inventoryBatchRepository.findEligibleBatchesForSale(medicine.getId(), LocalDate.now());
            if (eligibleBatches.isEmpty()) {
                throw new InsufficientStockException("No stock available for: " + medicine.getName());
            }

            int remainingUnits = unitsNeeded;
            for (InventoryBatch batch : eligibleBatches) {
                if (remainingUnits <= 0) break;

                int batchPackSize = batch.getMedicine().getUnitsPerPack() > 0 ? batch.getMedicine().getUnitsPerPack() : 1;
                int batchTotalUnits = (batch.getQuantity() * batchPackSize) + batch.getLooseQuantity();
                if (batchTotalUnits <= 0) continue;

                int takeUnits = Math.min(batchTotalUnits, remainingUnits);
                int remainingInBatch = batchTotalUnits - takeUnits;

                batch.setQuantity(remainingInBatch / batchPackSize);
                batch.setLooseQuantity(remainingInBatch % batchPackSize);
                remainingUnits -= takeUnits;
                inventoryBatchRepository.save(batch);

                BigDecimal packPrice = batch.getSellingPrice();
                if (packPrice == null || packPrice.compareTo(BigDecimal.ZERO) == 0) {
                    packPrice = batch.getMrp();
                }

                BigDecimal unitPrice;
                BigDecimal lineSubtotal;
                if ("TABLET".equalsIgnoreCase(dispenseUnit) && batchPackSize > 1) {
                    unitPrice = packPrice.divide(BigDecimal.valueOf(batchPackSize), 2, RoundingMode.HALF_UP);
                    lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(takeUnits)).setScale(2, RoundingMode.HALF_UP);
                } else if ("STRIP".equalsIgnoreCase(dispenseUnit) && batchPackSize > 1) {
                    unitPrice = packPrice;
                    lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(takeUnits).divide(BigDecimal.valueOf(batchPackSize), 2, RoundingMode.HALF_UP));
                } else {
                    unitPrice = packPrice;
                    lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(takeUnits)).setScale(2, RoundingMode.HALF_UP);
                }

                totalAmount = totalAmount.add(lineSubtotal);

                BigDecimal taxRate = BigDecimal.ZERO;
                BigDecimal itemTax = lineSubtotal.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                taxAmount = taxAmount.add(itemTax);

                SalesOrderItem newItem = SalesOrderItem.builder()
                        .salesOrder(order)
                        .inventoryBatch(batch)
                        .quantity(takeUnits)
                        .unitPrice(unitPrice)
                        .taxRate(taxRate)
                        .subtotal(lineSubtotal)
                        .dispenseUnit(dispenseUnit)
                        .packSize(batchPackSize)
                        .build();
                newItems.add(newItem);
            }

            if (remainingUnits > 0) {
                throw new InsufficientStockException("Insufficient stock for: " + medicine.getName() + " (requested: " + unitsNeeded + " units, short by: " + remainingUnits + ")");
            }
        }

        // STEP 7: Recalculate totals
        BigDecimal discountAmount = request.discountAmount() != null ? request.discountAmount() : BigDecimal.ZERO;
        if (discountAmount.compareTo(totalAmount) > 0) {
            throw new InvalidBillException("Discount cannot be greater than total amount");
        }
        BigDecimal grandTotal = totalAmount.add(taxAmount).subtract(discountAmount);
        if (grandTotal.compareTo(BigDecimal.ZERO) < 0) grandTotal = BigDecimal.ZERO;

        int newEarnedPoints = 0;
        if (newCustomer != null && grandTotal.compareTo(BigDecimal.ZERO) > 0) {
            newEarnedPoints = grandTotal.divide(BigDecimal.valueOf(100), RoundingMode.FLOOR).intValue();
            newCustomer.setRewardPoints(newCustomer.getRewardPoints() + newEarnedPoints);
            customerRepository.save(newCustomer);
        }

        order.setTotalAmount(totalAmount.setScale(2, RoundingMode.HALF_UP));
        order.setTaxAmount(taxAmount.setScale(2, RoundingMode.HALF_UP));
        order.setDiscountAmount(discountAmount.setScale(2, RoundingMode.HALF_UP));
        order.setGrandTotal(grandTotal.setScale(2, RoundingMode.HALF_UP));
        order.setEarnedPoints(newEarnedPoints);

        List<Payment> allPayments = paymentRepository.findAllBySalesOrderId(billId);
        BigDecimal totalPaid = allPayments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalPaid.compareTo(order.getGrandTotal()) >= 0) {
            order.setPaymentStatus(PaymentStatus.PAID);
        } else {
            order.setPaymentStatus(totalPaid.compareTo(BigDecimal.ZERO) > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING);
        }

        // STEP 8: Save everything
        salesOrderRepository.save(order);
        salesOrderItemRepository.saveAll(newItems);

        // STEP 9: Capture new snapshot and write audit log
        String newSnapshot = captureSnapshot(order);
        BillAuditLog auditLog = new BillAuditLog();
        auditLog.setSalesOrderId(order.getId());
        auditLog.setAction("BILL_UPDATED");
        auditLog.setOldSnapshot(oldSnapshot);
        auditLog.setNewSnapshot(newSnapshot);
        auditLog.setChangedBy(username);
        auditLog.setChangedAt(Instant.now());
        billAuditLogRepository.save(auditLog);

        log.info("BILL_UPDATED billNumber={} grandTotal={} by={}", order.getBillNumber(), grandTotal, username);

        // STEP 10: Return updated bill response
        return mapToBillResponse(order, newItems, allPayments);
    }

    @Transactional(readOnly = true)
    public List<BillAuditLogResponse> getBillAuditLog(UUID billId) {
        return billAuditLogRepository.findAllBySalesOrderIdOrderByChangedAtDesc(billId)
            .stream()
            .map(log -> new BillAuditLogResponse(
                log.getId(), log.getSalesOrderId(), log.getAction(),
                log.getOldSnapshot(), log.getNewSnapshot(),
                log.getChangedBy(), log.getChangedAt()))
            .toList();
    }

    private String captureSnapshot(SalesOrder order) {
        return String.format(
            "{\"billNumber\":\"%s\",\"grandTotal\":%s,\"status\":\"%s\",\"updatedAt\":\"%s\"}",
            order.getBillNumber(),
            order.getGrandTotal(),
            order.getOrderStatus(),
            Instant.now()
        );
    }

    private BillResponse mapToBillResponse(SalesOrder so, List<SalesOrderItem> items, List<Payment> payments) {
        List<BillItemResponse> itemResponses = items.stream().map(i -> new BillItemResponse(
                i.getId(),
                i.getInventoryBatch().getId(),
                i.getInventoryBatch().getMedicine().getId(),
                i.getInventoryBatch().getMedicine().getName(),
                i.getInventoryBatch().getBatchNumber(),
                i.getInventoryBatch().getExpiryDate(),
                i.getQuantity(),
                i.getUnitPrice(),
                i.getTaxRate(),
                i.getSubtotal(),
                i.getDispenseUnit(),
                i.getPackSize(),
                i.getInventoryBatch().getMedicine().isRequiresPrescription()
        )).collect(Collectors.toList());

        List<PaymentResponse> paymentResponses = payments.stream().map(p -> new PaymentResponse(
                p.getId(),
                p.getPaymentMethod(),
                p.getTransactionRef(),
                p.getAmount(),
                p.getPaymentTime()
        )).collect(Collectors.toList());

        String custName = so.getCustomer() != null ? so.getCustomer().getName() 
                : (so.getCustomerName() != null && !so.getCustomerName().isBlank() ? so.getCustomerName() : "Walk-in Customer");
        String custPhone = so.getCustomer() != null ? so.getCustomer().getPhone() 
                : (so.getCustomerPhone() != null ? so.getCustomerPhone() : "-");

        boolean hasRxItems = (so.getPrescribingDoctor() != null) || itemResponses.stream().anyMatch(BillItemResponse::rxRequired);

        return new BillResponse(
                so.getId(),
                so.getBillNumber(),
                so.getCustomer() != null ? so.getCustomer().getId() : null,
                custName,
                custPhone,
                so.getPrescribingDoctor() != null ? so.getPrescribingDoctor().getId() : null,
                so.getPrescribingDoctor() != null ? so.getPrescribingDoctor().getName() : null,
                so.getUser().getId(),
                so.getUser().getUsername(),
                itemResponses,
                so.getTotalAmount(),
                so.getDiscountAmount(),
                so.getTaxAmount(),
                so.getGrandTotal(),
                null,
                null,
                so.getPaymentStatus(),
                so.getOrderStatus(),
                paymentResponses,
                so.getEarnedPoints(),
                so.getRedeemedPoints(),
                so.getCreatedAt(),
                so.getStoreName(),
                so.getStoreAddress(),
                so.getStorePhone(),
                so.getStoreEmail(),
                so.getStoreGstin(),
                so.getStoreDlNumber(),
                hasRxItems
        );
    }
}
