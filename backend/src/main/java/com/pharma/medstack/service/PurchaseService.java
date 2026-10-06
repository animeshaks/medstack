package com.pharma.medstack.service;

import com.pharma.medstack.entity.*;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.PurchaseOrderItemRequest;
import com.pharma.medstack.model.request.PurchaseOrderRequest;
import com.pharma.medstack.model.request.ReceivePurchaseOrderRequest;
import com.pharma.medstack.model.request.ReceiveItemRequest;
import com.pharma.medstack.model.response.PurchaseOrderItemResponse;
import com.pharma.medstack.model.response.PurchaseOrderResponse;
import com.pharma.medstack.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
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
        po = purchaseOrderRepository.save(po);

        log.info("PURCHASE_CREATED id={} invoice={} subtotal={} poDiscount={} tax={} grandTotal={}",
                po.getId(), po.getInvoiceNumber(), po.getSubtotal(), po.getDiscountAmount(), po.getTaxAmount(), po.getTotalAmount());

        return mapToResponse(po, savedItems);
    }

    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponse> getAllPurchaseOrders(Pageable pageable) {
        org.springframework.data.domain.Pageable sortedPageable = pageable;
        if (pageable.getSort().isUnsorted()) {
            sortedPageable = org.springframework.data.domain.PageRequest.of(
                    pageable.getPageNumber(),
                    pageable.getPageSize(),
                    org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")
            );
        }
        return purchaseOrderRepository.findAllByIsDeletedFalse(sortedPageable)
                .map(po -> {
                    List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
                    return mapToResponse(po, items);
                });
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse getPurchaseOrder(UUID id) {
        PurchaseOrder po = purchaseOrderRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase Order not found"));
        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findAllByPurchaseOrderIdAndIsDeletedFalse(po.getId());
        return mapToResponse(po, items);
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
        po = purchaseOrderRepository.save(po);

        log.info("PURCHASE_RECEIVED orderId={} status={} full={} partial={} missing={} stockedItems={}",
                id, po.getStatus(), fullyReceivedCount, partiallyReceivedCount, notReceivedCount, totalItemsStocked);

        return mapToResponse(po, items);
    }

    private PurchaseOrderResponse mapToResponse(PurchaseOrder po, List<PurchaseOrderItem> items) {
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

        BigDecimal subtotal = po.getSubtotal() != null ? po.getSubtotal()
                : (po.getTotalAmount() != null && po.getTaxAmount() != null ? po.getTotalAmount().subtract(po.getTaxAmount()) : BigDecimal.ZERO);

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
                po.getStatus(),
                itemResponses,
                po.getCreatedAt(),
                po.getReceivingNotes()
        );
    }
}
