package com.pharma.medstack.service;

import com.pharma.medstack.entity.*;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.*;
import com.pharma.medstack.model.response.*;
import com.pharma.medstack.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final PurchasePaymentRepository purchasePaymentRepository;
    private final InventoryBatchRepository inventoryBatchRepository;
    private final SupplierRepository supplierRepository;
    private final MedicineRepository medicineRepository;

    @Transactional
    public PurchaseOrderResponse createPurchaseOrder(PurchaseOrderRequest request) {
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(request.supplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));

        PurchaseOrder po = PurchaseOrder.builder()
                .supplier(supplier)
                .invoiceNumber(request.invoiceNumber())
                .invoiceDate(request.invoiceDate())
                .status(PurchaseOrderStatus.PENDING)
                .subtotal(BigDecimal.ZERO)
                .discountPercent(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(BigDecimal.ZERO)
                .taxAmount(BigDecimal.ZERO)
                .paidAmount(BigDecimal.ZERO)
                .dueAmount(BigDecimal.ZERO)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();
        po = purchaseOrderRepository.save(po);

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        List<PurchaseOrderItem> savedItems = new ArrayList<>();

        for (PurchaseOrderItemRequest itemReq : request.items()) {
            Medicine medicine = medicineRepository.findByIdAndIsDeletedFalse(itemReq.medicineId())
                    .orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));

            int billedQty = itemReq.quantity();
            int freeQty = itemReq.freeQuantity() != null && itemReq.freeQuantity() > 0 ? itemReq.freeQuantity() : 0;
            String scheme = itemReq.scheme();

            BigDecimal costPrice = itemReq.costPrice();
            BigDecimal taxPercent = itemReq.taxPercent() != null ? itemReq.taxPercent() : BigDecimal.ZERO;
            BigDecimal discountPercent = itemReq.discountPercent() != null ? itemReq.discountPercent() : BigDecimal.ZERO;
            BigDecimal schemeDiscountPercent = itemReq.schemeDiscountPercent() != null ? itemReq.schemeDiscountPercent() : BigDecimal.ZERO;

            // Gross line amount is strictly on billed quantity (free quantity is not billed)
            BigDecimal grossLine = costPrice.multiply(BigDecimal.valueOf(billedQty));

            // Item-level discounts: Dis % and Sch %
            BigDecimal itemDisc = grossLine.multiply(discountPercent).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal schemeDisc = grossLine.multiply(schemeDiscountPercent).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal lineDiscount = itemDisc.add(schemeDisc).setScale(2, RoundingMode.HALF_UP);

            // Taxable Amount = Gross Line - Line Discount
            BigDecimal taxableAmount = grossLine.subtract(lineDiscount);
            if (taxableAmount.compareTo(BigDecimal.ZERO) < 0) taxableAmount = BigDecimal.ZERO;
            taxableAmount = taxableAmount.setScale(2, RoundingMode.HALF_UP);

            // Tax on Taxable Amount
            BigDecimal itemTax = taxableAmount.multiply(taxPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            BigDecimal itemTotal = taxableAmount.add(itemTax).setScale(2, RoundingMode.HALF_UP);

            subtotal = subtotal.add(taxableAmount);
            totalTax = totalTax.add(itemTax);

            PurchaseOrderItem item = PurchaseOrderItem.builder()
                    .purchaseOrder(po)
                    .medicine(medicine)
                    .batchNumber(itemReq.batchNumber())
                    .expiryDate(itemReq.expiryDate())
                    .quantity(billedQty)
                    .freeQuantity(freeQty)
                    .scheme(scheme)
                    .costPrice(costPrice)
                    .taxPercent(taxPercent)
                    .discountPercent(discountPercent)
                    .schemeDiscountPercent(schemeDiscountPercent)
                    .discountAmount(lineDiscount)
                    .taxableAmount(taxableAmount)
                    .taxAmount(itemTax)
                    .totalAmount(itemTotal)
                    .mrp(itemReq.mrp())
                    .build();
            savedItems.add(purchaseOrderItemRepository.save(item));
        }

        // PO-Level Overall Bill Discount
        BigDecimal poDiscountPercent = request.discountPercent() != null ? request.discountPercent() : BigDecimal.ZERO;
        BigDecimal poDiscountAmount = BigDecimal.ZERO;
        if (poDiscountPercent.compareTo(BigDecimal.ZERO) > 0) {
            poDiscountAmount = subtotal.multiply(poDiscountPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else if (request.discountAmount() != null && request.discountAmount().compareTo(BigDecimal.ZERO) > 0) {
            poDiscountAmount = request.discountAmount().min(subtotal).setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal grandTotal = subtotal.subtract(poDiscountAmount).add(totalTax);
        if (grandTotal.compareTo(BigDecimal.ZERO) < 0) grandTotal = BigDecimal.ZERO;

        po.setSubtotal(subtotal.setScale(2, RoundingMode.HALF_UP));
        po.setDiscountPercent(poDiscountPercent.setScale(2, RoundingMode.HALF_UP));
        po.setDiscountAmount(poDiscountAmount.setScale(2, RoundingMode.HALF_UP));
        po.setTaxAmount(totalTax.setScale(2, RoundingMode.HALF_UP));
        po.setTotalAmount(grandTotal.setScale(2, RoundingMode.HALF_UP));
        po.setPaidAmount(BigDecimal.ZERO);
        po.setDueAmount(grandTotal.setScale(2, RoundingMode.HALF_UP));
        po.setPaymentStatus(PaymentStatus.UNPAID);
        po = purchaseOrderRepository.save(po);

        log.info("PURCHASE_CREATED id={} invoice={} subtotal={} poDiscount={} tax={} grandTotal={}",
                po.getId(), po.getInvoiceNumber(), po.getSubtotal(), po.getDiscountAmount(), po.getTaxAmount(), po.getTotalAmount());

        return mapToResponse(po, savedItems, Collections.emptyList());
    }

    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponse> getAllPurchaseOrders(Pageable pageable) {
        return getAllPurchaseOrders(null, null, null, null, null, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponse> getAllPurchaseOrders(UUID supplierId, PaymentStatus paymentStatus, Pageable pageable) {
        return getAllPurchaseOrders(null, supplierId, paymentStatus, null, null, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponse> getAllPurchaseOrders(
            String search,
            UUID supplierId,
            PaymentStatus paymentStatus,
            PurchaseOrderStatus status,
            LocalDate fromDate,
            LocalDate toDate,
            Pageable pageable) {

        Pageable sortedPageable = pageable;
        if (pageable.getSort().isUnsorted()) {
            sortedPageable = PageRequest.of(
                    pageable.getPageNumber(),
                    pageable.getPageSize(),
                    Sort.by(Sort.Direction.DESC, "createdAt")
            );
        }

        Specification<PurchaseOrder> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("isDeleted")));

            if (supplierId != null) {
                predicates.add(cb.equal(root.get("supplier").get("id"), supplierId));
            }

            if (paymentStatus != null) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (search != null && !search.trim().isEmpty()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate pInvoice = cb.like(cb.lower(root.get("invoiceNumber")), pattern);
                Predicate pSupplier = cb.like(cb.lower(root.get("supplier").get("name")), pattern);
                predicates.add(cb.or(pInvoice, pSupplier));
            }

            if (fromDate != null) {
                Instant fromInstant = fromDate.atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
                Predicate pInv = cb.and(cb.isNotNull(root.get("invoiceDate")), cb.greaterThanOrEqualTo(root.get("invoiceDate"), fromDate));
                Predicate pCreated = cb.and(cb.isNull(root.get("invoiceDate")), cb.greaterThanOrEqualTo(root.get("createdAt"), fromInstant));
                predicates.add(cb.or(pInv, pCreated));
            }

            if (toDate != null) {
                Instant toInstant = toDate.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
                Predicate pInv = cb.and(cb.isNotNull(root.get("invoiceDate")), cb.lessThanOrEqualTo(root.get("invoiceDate"), toDate));
                Predicate pCreated = cb.and(cb.isNull(root.get("invoiceDate")), cb.lessThan(root.get("createdAt"), toInstant));
                predicates.add(cb.or(pInv, pCreated));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<PurchaseOrder> page = purchaseOrderRepository.findAll(spec, sortedPageable);

        return page.map(po -> {
            List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
            return mapToResponse(po, items, null);
        });
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderResponse> getSupplierPurchaseOrders(UUID supplierId) {
        return purchaseOrderRepository.findAllBySupplierIdAndIsDeletedFalseOrderByInvoiceDateDescCreatedAtDesc(supplierId)
                .stream()
                .map(po -> {
                    List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
                    return mapToResponse(po, items, null);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PurchasePaymentResponse> getSupplierPayments(UUID supplierId) {
        return purchasePaymentRepository.findAllBySupplierIdAndIsDeletedFalseOrderByPaymentTimeDesc(supplierId)
                .stream()
                .map(this::mapToPaymentResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PurchasePaymentResponse> getOrderPayments(UUID orderId) {
        return purchasePaymentRepository.findAllByPurchaseOrderIdAndIsDeletedFalseOrderByPaymentTimeAsc(orderId)
                .stream()
                .map(this::mapToPaymentResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse getPurchaseOrder(UUID id) {
        PurchaseOrder po = purchaseOrderRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Order not found"));
        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
        return mapToResponse(po, items, null);
    }

    @Transactional
    public PurchaseOrderResponse receivePurchaseOrder(UUID id) {
        return receivePurchaseOrder(id, null);
    }

    @Transactional
    public PurchaseOrderResponse receivePurchaseOrder(UUID id, ReceivePurchaseOrderRequest request) {
        PurchaseOrder po = purchaseOrderRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Order not found"));

        if (po.getStatus() == PurchaseOrderStatus.RECEIVED || po.getStatus() == PurchaseOrderStatus.PARTIALLY_RECEIVED) {
            throw new BusinessValidationException("Purchase order already received");
        }

        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
        Map<UUID, ReceiveItemRequest> reqMap = new HashMap<>();
        if (request != null && request.items() != null) {
            for (ReceiveItemRequest r : request.items()) {
                if (r.itemId() != null) {
                    reqMap.put(r.itemId(), r);
                }
            }
        }

        int fullyReceivedCount = 0;
        int partiallyReceivedCount = 0;
        int notReceivedCount = 0;
        int totalItemsStocked = 0;

        for (PurchaseOrderItem item : items) {
            ReceiveItemRequest itemReq = reqMap.get(item.getId());

            int actualBilledQty = item.getQuantity();
            int actualFreeQty = item.getFreeQuantity();
            String batchNumber = item.getBatchNumber();
            LocalDate expiryDate = item.getExpiryDate();
            String remarks = null;
            String itemStatus = "RECEIVED_FULL";

            if (itemReq != null) {
                if (Boolean.FALSE.equals(itemReq.included())) {
                    actualBilledQty = 0;
                    actualFreeQty = 0;
                    itemStatus = "NOT_RECEIVED";
                    remarks = itemReq.remarks() != null && !itemReq.remarks().isBlank()
                            ? itemReq.remarks().trim() : "Item missing / not supplied";
                } else {
                    actualBilledQty = itemReq.receivedQuantity() != null ? Math.max(0, itemReq.receivedQuantity()) : item.getQuantity();
                    actualFreeQty = itemReq.receivedFreeQuantity() != null ? Math.max(0, itemReq.receivedFreeQuantity()) : item.getFreeQuantity();
                    if (itemReq.batchNumber() != null && !itemReq.batchNumber().isBlank()) {
                        batchNumber = itemReq.batchNumber().trim();
                    }
                    if (itemReq.expiryDate() != null) {
                        expiryDate = itemReq.expiryDate();
                    }
                    remarks = itemReq.remarks() != null ? itemReq.remarks().trim() : null;

                    int orderedTotal = item.getQuantity() + item.getFreeQuantity();
                    int receivedTotal = actualBilledQty + actualFreeQty;

                    if (receivedTotal == 0) {
                        itemStatus = "NOT_RECEIVED";
                        if (remarks == null || remarks.isBlank()) remarks = "Item missing / not supplied";
                    } else if (receivedTotal < orderedTotal) {
                        itemStatus = "RECEIVED_PARTIAL";
                        if (remarks == null || remarks.isBlank()) remarks = "Shortage received (" + receivedTotal + "/" + orderedTotal + ")";
                    } else {
                        itemStatus = "RECEIVED_FULL";
                    }
                }
            }

            // Persist verified receiving details onto PurchaseOrderItem
            item.setReceivedQuantity(actualBilledQty);
            item.setReceivedFreeQuantity(actualFreeQty);
            item.setItemStatus(itemStatus);
            item.setRemarks(remarks);
            item.setBatchNumber(batchNumber);
            item.setExpiryDate(expiryDate);
            purchaseOrderItemRepository.save(item);

            int totalInwardUnits = actualBilledQty + actualFreeQty;

            if ("RECEIVED_FULL".equals(itemStatus)) {
                fullyReceivedCount++;
            } else if ("RECEIVED_PARTIAL".equals(itemStatus)) {
                partiallyReceivedCount++;
            } else {
                notReceivedCount++;
            }

            // Increment inventory batch ONLY if actual inward stock > 0
            if (totalInwardUnits > 0) {
                totalItemsStocked++;
                Optional<InventoryBatch> batchOpt = inventoryBatchRepository
                        .findByMedicineIdAndBatchNumberAndIsDeletedFalse(item.getMedicine().getId(), batchNumber);

                if (batchOpt.isPresent()) {
                    InventoryBatch batch = batchOpt.get();
                    batch.setQuantity(batch.getQuantity() + totalInwardUnits);
                    if (expiryDate != null) {
                        batch.setExpiryDate(expiryDate);
                    }
                    inventoryBatchRepository.save(batch);
                } else {
                    BigDecimal sellingPrice = item.getMrp();
                    InventoryBatch newBatch = InventoryBatch.builder()
                            .medicine(item.getMedicine())
                            .batchNumber(batchNumber)
                            .expiryDate(expiryDate)
                            .mrp(item.getMrp())
                            .costPrice(item.getCostPrice())
                            .sellingPrice(sellingPrice != null && sellingPrice.compareTo(BigDecimal.ZERO) > 0 ? sellingPrice : item.getMrp())
                            .quantity(totalInwardUnits)
                            .looseQuantity(0)
                            .isRetired(false)
                            .build();
                    inventoryBatchRepository.save(newBatch);
                }
            }
        }

        if (request != null && request.notes() != null && !request.notes().isBlank()) {
            po.setReceivingNotes(request.notes().trim());
        }

        if (partiallyReceivedCount > 0 || notReceivedCount > 0) {
            po.setStatus(PurchaseOrderStatus.PARTIALLY_RECEIVED);
        } else {
            po.setStatus(PurchaseOrderStatus.RECEIVED);
        }

        // Establish payment due amount upon receiving
        BigDecimal poTotal = po.getTotalAmount() != null ? po.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal paid = po.getPaidAmount() != null ? po.getPaidAmount() : BigDecimal.ZERO;
        BigDecimal due = poTotal.subtract(paid);
        if (due.compareTo(BigDecimal.ZERO) < 0) due = BigDecimal.ZERO;

        po.setDueAmount(due.setScale(2, RoundingMode.HALF_UP));
        po.setPaymentStatus(due.compareTo(BigDecimal.ZERO) == 0 ? PaymentStatus.PAID
                : (paid.compareTo(BigDecimal.ZERO) > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID));
        po = purchaseOrderRepository.save(po);

        // Check if supplier has any unallocated advance payments to automatically apply
        if (po.getSupplier() != null && po.getDueAmount().compareTo(BigDecimal.ZERO) > 0) {
            applySupplierAdvancesToOrder(po);
        }

        // Update supplier balance
        if (po.getSupplier() != null) {
            recalculateSupplierBalance(po.getSupplier().getId());
        }

        log.info("PURCHASE_RECEIVED orderId={} status={} full={} partial={} missing={} stockedItems={}",
                id, po.getStatus(), fullyReceivedCount, partiallyReceivedCount, notReceivedCount, totalItemsStocked);

        return mapToResponse(po, items, null);
    }

    private void applySupplierAdvancesToOrder(PurchaseOrder po) {
        if (po == null || po.getSupplier() == null) return;
        List<PurchasePayment> advances = purchasePaymentRepository
                .findAllBySupplierIdAndPurchaseOrderIsNullAndIsDeletedFalseOrderByPaymentTimeAsc(po.getSupplier().getId());
        if (advances.isEmpty()) return;

        BigDecimal currentDue = po.getDueAmount() != null ? po.getDueAmount() : po.getTotalAmount();
        BigDecimal currentPaid = po.getPaidAmount() != null ? po.getPaidAmount() : BigDecimal.ZERO;

        for (PurchasePayment adv : advances) {
            if (currentDue.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal advAmt = adv.getAmount();
            if (advAmt == null || advAmt.compareTo(BigDecimal.ZERO) <= 0) continue;

            if (advAmt.compareTo(currentDue) <= 0) {
                // Whole advance voucher consumed by this PO
                adv.setPurchaseOrder(po);
                adv.setNotes("Allocated from advance credit: " + (adv.getNotes() != null ? adv.getNotes() : "Advance"));
                purchasePaymentRepository.save(adv);

                currentPaid = currentPaid.add(advAmt);
                currentDue = currentDue.subtract(advAmt);
            } else {
                // Partial advance voucher consumed: split into consumed portion and remaining advance
                BigDecimal remainingAdv = advAmt.subtract(currentDue);
                adv.setPurchaseOrder(po);
                adv.setAmount(currentDue.setScale(2, RoundingMode.HALF_UP));
                adv.setNotes("Allocated from advance credit: " + (adv.getNotes() != null ? adv.getNotes() : "Advance"));
                purchasePaymentRepository.save(adv);

                currentPaid = currentPaid.add(currentDue);

                PurchasePayment remVoucher = PurchasePayment.builder()
                        .purchaseOrder(null)
                        .supplier(po.getSupplier())
                        .paymentMethod(adv.getPaymentMethod())
                        .amount(remainingAdv.setScale(2, RoundingMode.HALF_UP))
                        .transactionRef(adv.getTransactionRef())
                        .paymentTime(adv.getPaymentTime())
                        .notes("Remaining advance credit after allocation to Invoice #" + po.getInvoiceNumber())
                        .build();
                purchasePaymentRepository.save(remVoucher);

                currentDue = BigDecimal.ZERO;
            }
        }

        po.setPaidAmount(currentPaid.setScale(2, RoundingMode.HALF_UP));
        po.setDueAmount(currentDue.setScale(2, RoundingMode.HALF_UP));
        po.setPaymentStatus(currentDue.compareTo(BigDecimal.ZERO) == 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL);
        purchaseOrderRepository.save(po);
    }

    @Transactional
    public PurchaseOrderResponse payPurchaseOrder(UUID orderId, PayPurchaseOrderRequest request, String username) {
        PurchaseOrder po = purchaseOrderRepository.findByIdAndIsDeletedFalse(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Order not found"));

        if (po.getPaymentStatus() == PaymentStatus.PAID) {
            throw new BusinessValidationException("Purchase order bill is already fully paid");
        }

        List<PurchasePayment> existingPayments = purchasePaymentRepository
                .findAllByPurchaseOrderIdAndIsDeletedFalseOrderByPaymentTimeAsc(orderId);
        BigDecimal totalPaidSoFar = existingPayments.stream()
                .map(PurchasePayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal orderTotal = po.getTotalAmount() != null ? po.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal currentDue = orderTotal.subtract(totalPaidSoFar);
        if (currentDue.compareTo(BigDecimal.ZERO) <= 0) {
            po.setPaidAmount(orderTotal);
            po.setDueAmount(BigDecimal.ZERO);
            po.setPaymentStatus(PaymentStatus.PAID);
            purchaseOrderRepository.save(po);
            if (po.getSupplier() != null) {
                recalculateSupplierBalance(po.getSupplier().getId());
            }
            throw new BusinessValidationException("Purchase order has no remaining balance due");
        }

        BigDecimal requestedAmount = request.amount();
        if (requestedAmount == null || requestedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessValidationException("Payment amount must be greater than zero");
        }

        BigDecimal paymentForBill = requestedAmount.min(currentDue);
        BigDecimal excessAdvance = requestedAmount.subtract(paymentForBill);

        PurchasePayment payment = PurchasePayment.builder()
                .purchaseOrder(po)
                .supplier(po.getSupplier())
                .paymentMethod(request.paymentMethod())
                .amount(paymentForBill.setScale(2, RoundingMode.HALF_UP))
                .transactionRef(request.transactionRef())
                .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                .notes(request.notes() != null && !request.notes().isBlank() ? request.notes().trim() : "PO Bill Payment")
                .build();
        payment = purchasePaymentRepository.save(payment);

        if (excessAdvance.compareTo(BigDecimal.ZERO) > 0) {
            // Record excess as advance payment voucher for supplier Khata
            PurchasePayment advancePayment = PurchasePayment.builder()
                    .purchaseOrder(null)
                    .supplier(po.getSupplier())
                    .paymentMethod(request.paymentMethod())
                    .amount(excessAdvance.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .notes("Advance credit (Overpayment of " + requestedAmount + " on Invoice #" + po.getInvoiceNumber() + ")")
                    .build();
            purchasePaymentRepository.save(advancePayment);
        }

        BigDecimal newPaid = totalPaidSoFar.add(paymentForBill).setScale(2, RoundingMode.HALF_UP);
        BigDecimal newDue = orderTotal.subtract(newPaid).setScale(2, RoundingMode.HALF_UP);
        if (newDue.compareTo(BigDecimal.ZERO) < 0) newDue = BigDecimal.ZERO;

        po.setPaidAmount(newPaid);
        po.setDueAmount(newDue);
        po.setPaymentStatus(newDue.compareTo(BigDecimal.ZERO) == 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL);
        po = purchaseOrderRepository.save(po);

        if (po.getSupplier() != null) {
            recalculateSupplierBalance(po.getSupplier().getId());
        }

        log.info("PURCHASE_PAYMENT_RECORDED orderId={} appliedToBill={} excessAdvance={} status={} user={}",
                orderId, paymentForBill, excessAdvance, po.getPaymentStatus(), username);

        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(orderId);
        List<PurchasePayment> allPayments = new ArrayList<>(existingPayments);
        allPayments.add(payment);
        return mapToResponse(po, items, allPayments);
    }

    @Transactional
    public List<PurchaseOrderResponse> settleSupplierDues(UUID supplierId, SettleSupplierDuesRequest request, String username) {
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));

        BigDecimal remainingPayment = request.amount();
        if (remainingPayment == null || remainingPayment.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessValidationException("Settlement amount must be greater than zero");
        }

        // Fetch unpaid or partially paid purchase orders in FIFO order (oldest invoice date first, then creation time)
        List<PurchaseOrder> dueOrders = purchaseOrderRepository
                .findAllBySupplierIdAndPaymentStatusInAndIsDeletedFalseOrderByInvoiceDateAscCreatedAtAsc(
                        supplierId, List.of(PaymentStatus.UNPAID, PaymentStatus.PARTIAL, PaymentStatus.PENDING));

        List<PurchaseOrderResponse> settledOrders = new ArrayList<>();

        if (dueOrders.isEmpty()) {
            // No due orders: record entire amount as advance payment for supplier Khata
            PurchasePayment advancePayment = PurchasePayment.builder()
                    .purchaseOrder(null)
                    .supplier(supplier)
                    .paymentMethod(request.paymentMethod())
                    .amount(remainingPayment.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .notes(request.notes() != null && !request.notes().isBlank() ? request.notes().trim() : "Advance Payment / Khata Credit")
                    .build();
            purchasePaymentRepository.save(advancePayment);
            recalculateSupplierBalance(supplierId);
            log.info("SUPPLIER_ADVANCE_RECORDED supplierId={} amount={} user={}", supplierId, remainingPayment, username);
            return Collections.emptyList();
        }

        for (PurchaseOrder po : dueOrders) {
            if (remainingPayment.compareTo(BigDecimal.ZERO) <= 0) break;

            List<PurchasePayment> existingPayments = purchasePaymentRepository
                    .findAllByPurchaseOrderIdAndIsDeletedFalseOrderByPaymentTimeAsc(po.getId());
            BigDecimal paidOnPo = existingPayments.stream()
                    .map(PurchasePayment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal poTotal = po.getTotalAmount() != null ? po.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal poDue = poTotal.subtract(paidOnPo);
            if (poDue.compareTo(BigDecimal.ZERO) <= 0) {
                po.setPaidAmount(poTotal);
                po.setDueAmount(BigDecimal.ZERO);
                po.setPaymentStatus(PaymentStatus.PAID);
                purchaseOrderRepository.save(po);
                continue;
            }

            BigDecimal allocate = remainingPayment.min(poDue);
            PurchasePayment payment = PurchasePayment.builder()
                    .purchaseOrder(po)
                    .supplier(supplier)
                    .paymentMethod(request.paymentMethod())
                    .amount(allocate.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .notes(request.notes() != null && !request.notes().isBlank() ? request.notes().trim() : "FIFO Khata Lump-Sum Settlement")
                    .build();
            payment = purchasePaymentRepository.save(payment);

            List<PurchasePayment> allPayments = new ArrayList<>(existingPayments);
            allPayments.add(payment);

            BigDecimal newPaid = paidOnPo.add(allocate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal newDue = poTotal.subtract(newPaid).setScale(2, RoundingMode.HALF_UP);
            if (newDue.compareTo(BigDecimal.ZERO) < 0) newDue = BigDecimal.ZERO;

            po.setPaidAmount(newPaid);
            po.setDueAmount(newDue);
            po.setPaymentStatus(newDue.compareTo(BigDecimal.ZERO) == 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL);
            purchaseOrderRepository.save(po);

            remainingPayment = remainingPayment.subtract(allocate);

            List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
            settledOrders.add(mapToResponse(po, items, allPayments));
        }

        if (remainingPayment.compareTo(BigDecimal.ZERO) > 0) {
            // Overpayment excess: record remaining payment as advance payment voucher for supplier Khata
            PurchasePayment advancePayment = PurchasePayment.builder()
                    .purchaseOrder(null)
                    .supplier(supplier)
                    .paymentMethod(request.paymentMethod())
                    .amount(remainingPayment.setScale(2, RoundingMode.HALF_UP))
                    .transactionRef(request.transactionRef())
                    .paymentTime(request.paymentTime() != null ? request.paymentTime() : Instant.now())
                    .notes(request.notes() != null && !request.notes().isBlank() ? request.notes().trim() : "Advance Payment / Khata Credit (Excess settlement)")
                    .build();
            purchasePaymentRepository.save(advancePayment);
        }

        recalculateSupplierBalance(supplierId);

        BigDecimal totalApplied = request.amount().subtract(remainingPayment);
        log.info("SUPPLIER_DUES_SETTLED supplierId={} appliedToBills={} advanceCredit={} user={}",
                supplierId, totalApplied, remainingPayment, username);

        return settledOrders;
    }

    @Transactional(readOnly = true)
    public SupplierKhataSummaryResponse getSupplierKhataSummary(UUID supplierId) {
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));

        List<PurchaseOrder> orders = purchaseOrderRepository.findAllBySupplierIdAndIsDeletedFalse(supplierId);
        List<PurchasePayment> payments = purchasePaymentRepository.findAllBySupplierIdAndIsDeletedFalseOrderByPaymentTimeDesc(supplierId);

        long totalOrdersCount = orders.size();
        long unpaidOrdersCount = orders.stream()
                .filter(o -> o.getPaymentStatus() == PaymentStatus.UNPAID || o.getPaymentStatus() == PaymentStatus.PARTIAL)
                .count();

        BigDecimal totalPurchased = orders.stream()
                .filter(p -> p.getStatus() == PurchaseOrderStatus.RECEIVED || p.getStatus() == PurchaseOrderStatus.PARTIALLY_RECEIVED)
                .map(o -> o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPaid = payments.stream()
                .map(PurchasePayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Instant lastPurchaseDate = orders.stream()
                .map(PurchaseOrder::getCreatedAt)
                .max(Instant::compareTo)
                .orElse(null);

        Instant lastPaymentDate = payments.stream()
                .map(PurchasePayment::getPaymentTime)
                .max(Instant::compareTo)
                .orElse(null);

        return new SupplierKhataSummaryResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getContactPerson(),
                supplier.getPhone(),
                supplier.getEmail(),
                supplier.getGstin(),
                supplier.getDlNumber(),
                supplier.getAddress(),
                supplier.getOutstandingBalance() != null ? supplier.getOutstandingBalance() : BigDecimal.ZERO,
                totalOrdersCount,
                unpaidOrdersCount,
                totalPurchased,
                totalPaid,
                lastPurchaseDate,
                lastPaymentDate
        );
    }

    public void recalculateSupplierBalance(UUID supplierId) {
        if (supplierId == null) return;
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(supplierId).orElse(null);
        if (supplier == null) return;

        List<PurchaseOrder> orders = purchaseOrderRepository.findAllBySupplierIdAndIsDeletedFalse(supplierId);
        List<PurchasePayment> unallocatedAdvances = purchasePaymentRepository
                .findAllBySupplierIdAndPurchaseOrderIsNullAndIsDeletedFalseOrderByPaymentTimeAsc(supplierId);

        BigDecimal totalDueOnOrders = orders.stream()
                .filter(p -> p.getStatus() == PurchaseOrderStatus.RECEIVED || p.getStatus() == PurchaseOrderStatus.PARTIALLY_RECEIVED)
                .map(p -> p.getDueAmount() != null ? p.getDueAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalAdvanceCredit = unallocatedAdvances.stream()
                .map(PurchasePayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Balance = Pending bills due - unallocated advance credits (can be negative if advance > due)
        BigDecimal balance = totalDueOnOrders.subtract(totalAdvanceCredit);

        supplier.setOutstandingBalance(balance.setScale(2, RoundingMode.HALF_UP));
        supplierRepository.save(supplier);
    }

    private PurchaseOrderResponse mapToResponse(PurchaseOrder po, List<PurchaseOrderItem> items, List<PurchasePayment> payments) {
        List<PurchaseOrderItemResponse> itemResponses = items.stream()
                .map(i -> {
                    int orderedTotal = i.getQuantity() + i.getFreeQuantity();
                    Integer recQty = i.getReceivedQuantity();
                    Integer recFree = i.getReceivedFreeQuantity();
                    Integer recTotal = (recQty != null || recFree != null)
                            ? ((recQty != null ? recQty : 0) + (recFree != null ? recFree : 0))
                            : null;

                    return new PurchaseOrderItemResponse(
                            i.getId(),
                            i.getMedicine().getId(),
                            i.getMedicine().getName(),
                            i.getBatchNumber(),
                            i.getExpiryDate(),
                            i.getQuantity(),
                            i.getFreeQuantity(),
                            orderedTotal,
                            i.getScheme(),
                            i.getCostPrice(),
                            i.getTaxPercent(),
                            i.getMrp(),
                            i.getDiscountPercent() != null ? i.getDiscountPercent() : BigDecimal.ZERO,
                            i.getSchemeDiscountPercent() != null ? i.getSchemeDiscountPercent() : BigDecimal.ZERO,
                            i.getDiscountAmount() != null ? i.getDiscountAmount() : BigDecimal.ZERO,
                            i.getTaxableAmount() != null ? i.getTaxableAmount() : i.getCostPrice().multiply(BigDecimal.valueOf(i.getQuantity())),
                            i.getTaxAmount() != null ? i.getTaxAmount() : BigDecimal.ZERO,
                            i.getTotalAmount() != null ? i.getTotalAmount() : i.getCostPrice().multiply(BigDecimal.valueOf(i.getQuantity())),
                            recQty,
                            recFree,
                            recTotal,
                            i.getItemStatus() != null ? i.getItemStatus() : "PENDING",
                            i.getRemarks()
                    );
                })
                .collect(Collectors.toList());

        List<PurchasePayment> poPayments = payments != null ? payments
                : (po.getId() != null && purchasePaymentRepository != null ? purchasePaymentRepository.findAllByPurchaseOrderIdAndIsDeletedFalseOrderByPaymentTimeAsc(po.getId()) : Collections.emptyList());

        List<PurchasePaymentResponse> paymentResponses = poPayments.stream()
                .map(this::mapToPaymentResponse)
                .collect(Collectors.toList());

        BigDecimal subtotal = po.getSubtotal() != null ? po.getSubtotal()
                : (po.getTotalAmount() != null && po.getTaxAmount() != null ? po.getTotalAmount().subtract(po.getTaxAmount()) : BigDecimal.ZERO);

        BigDecimal paid = po.getPaidAmount() != null ? po.getPaidAmount()
                : paymentResponses.stream().map(PurchasePaymentResponse::amount).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal total = po.getTotalAmount() != null ? po.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal due = po.getDueAmount() != null ? po.getDueAmount() : total.subtract(paid);
        if (due.compareTo(BigDecimal.ZERO) < 0) due = BigDecimal.ZERO;

        PaymentStatus pStatus = po.getPaymentStatus() != null ? po.getPaymentStatus()
                : (due.compareTo(BigDecimal.ZERO) == 0 ? PaymentStatus.PAID : (paid.compareTo(BigDecimal.ZERO) > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID));

        return new PurchaseOrderResponse(
                po.getId(),
                po.getSupplier() != null ? po.getSupplier().getId() : null,
                po.getSupplier() != null ? po.getSupplier().getName() : null,
                po.getInvoiceNumber(),
                po.getInvoiceDate(),
                subtotal,
                po.getDiscountPercent() != null ? po.getDiscountPercent() : BigDecimal.ZERO,
                po.getDiscountAmount() != null ? po.getDiscountAmount() : BigDecimal.ZERO,
                po.getTotalAmount(),
                po.getTaxAmount(),
                paid,
                due,
                pStatus,
                po.getStatus(),
                itemResponses,
                paymentResponses,
                po.getCreatedAt(),
                po.getReceivingNotes()
        );
    }

    private PurchasePaymentResponse mapToPaymentResponse(PurchasePayment p) {
        return new PurchasePaymentResponse(
                p.getId(),
                p.getPurchaseOrder() != null ? p.getPurchaseOrder().getId() : null,
                p.getPurchaseOrder() != null ? p.getPurchaseOrder().getInvoiceNumber() : null,
                p.getSupplier() != null ? p.getSupplier().getId() : null,
                p.getSupplier() != null ? p.getSupplier().getName() : null,
                p.getPaymentMethod(),
                p.getAmount(),
                p.getTransactionRef(),
                p.getPaymentTime(),
                p.getNotes(),
                p.getCreatedAt()
        );
    }
}
