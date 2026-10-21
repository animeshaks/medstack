package com.pharma.medstack.model.response;

import com.pharma.medstack.entity.OrderStatus;
import com.pharma.medstack.entity.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record BillResponse(
    UUID id,
    String billNumber,
    UUID customerId,
    String customerName,
    String customerPhone,
    UUID prescribingDoctorId,
    String prescribingDoctorName,
    UUID userId,
    String createdBy,
    List<BillItemResponse> items,
    BigDecimal totalAmount,
    BigDecimal discountAmount,
    BigDecimal taxAmount,
    BigDecimal roundOff,
    BigDecimal grandTotal,
    BigDecimal paidAmount,
    BigDecimal dueAmount,
    PaymentStatus paymentStatus,
    OrderStatus orderStatus,
    List<PaymentResponse> payments,
    int earnedPoints,
    int redeemedPoints,
    Instant createdAt,
    String storeName,
    String storeAddress,
    String storePhone,
    String storeEmail,
    String storeGstin,
    String storeDlNumber,
    boolean rxRequired
) {
    public BillResponse {
        if (roundOff == null) {
            roundOff = BigDecimal.ZERO;
        }
        if (paidAmount == null) {
            paidAmount = (payments != null && !payments.isEmpty())
                ? payments.stream().map(PaymentResponse::amount).reduce(BigDecimal.ZERO, BigDecimal::add)
                : BigDecimal.ZERO;
        }
        if (dueAmount == null) {
            BigDecimal due = (grandTotal != null ? grandTotal : BigDecimal.ZERO).subtract(paidAmount);
            dueAmount = due.compareTo(BigDecimal.ZERO) > 0 ? due : BigDecimal.ZERO;
        }
    }

    public BillResponse(UUID id, String billNumber, UUID customerId, String customerName, String customerPhone,
                        UUID prescribingDoctorId, String prescribingDoctorName, UUID userId, String createdBy,
                        List<BillItemResponse> items, BigDecimal totalAmount, BigDecimal discountAmount,
                        BigDecimal taxAmount, BigDecimal grandTotal, PaymentStatus paymentStatus,
                        OrderStatus orderStatus, List<PaymentResponse> payments, int earnedPoints,
                        int redeemedPoints, Instant createdAt, String storeName, String storeAddress,
                        String storePhone, String storeEmail, String storeGstin, String storeDlNumber) {
        this(id, billNumber, customerId, customerName, customerPhone, prescribingDoctorId, prescribingDoctorName,
             userId, createdBy, items, totalAmount, discountAmount, taxAmount, BigDecimal.ZERO, grandTotal, null, null, paymentStatus,
             orderStatus, payments, earnedPoints, redeemedPoints, createdAt, storeName, storeAddress, storePhone, storeEmail, storeGstin, storeDlNumber, false);
    }

    public BillResponse(UUID id, String billNumber, UUID customerId, String customerName, String customerPhone,
                        UUID prescribingDoctorId, String prescribingDoctorName, UUID userId, String createdBy,
                        List<BillItemResponse> items, BigDecimal totalAmount, BigDecimal discountAmount,
                        BigDecimal taxAmount, BigDecimal grandTotal, PaymentStatus paymentStatus,
                        OrderStatus orderStatus, List<PaymentResponse> payments, int earnedPoints,
                        int redeemedPoints, Instant createdAt) {
        this(id, billNumber, customerId, customerName, customerPhone, prescribingDoctorId, prescribingDoctorName,
             userId, createdBy, items, totalAmount, discountAmount, taxAmount, BigDecimal.ZERO, grandTotal, null, null, paymentStatus,
             orderStatus, payments, earnedPoints, redeemedPoints, createdAt, null, null, null, null, null, null, false);
    }

    public BillResponse(UUID id, String billNumber, UUID customerId, String customerName, String customerPhone,
                        UUID prescribingDoctorId, String prescribingDoctorName, UUID userId, String createdBy,
                        List<BillItemResponse> items, BigDecimal totalAmount, BigDecimal discountAmount,
                        BigDecimal taxAmount, BigDecimal grandTotal, PaymentStatus paymentStatus,
                        OrderStatus orderStatus, List<PaymentResponse> payments, Instant createdAt) {
        this(id, billNumber, customerId, customerName, customerPhone, prescribingDoctorId, prescribingDoctorName,
             userId, createdBy, items, totalAmount, discountAmount, taxAmount, BigDecimal.ZERO, grandTotal, null, null, paymentStatus,
             orderStatus, payments, 0, 0, createdAt, null, null, null, null, null, null, false);
    }
}
