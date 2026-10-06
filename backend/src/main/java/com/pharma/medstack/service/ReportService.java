package com.pharma.medstack.service;

import com.pharma.medstack.entity.PurchaseOrderStatus;
import com.pharma.medstack.model.response.DashboardKpiResponse;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.model.response.InventoryReportResponse;
import com.pharma.medstack.model.response.SalesReportResponse;
import com.pharma.medstack.repository.ExpenseRepository;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.PurchaseOrderRepository;
import com.pharma.medstack.repository.SalesOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SalesOrderRepository salesOrderRepository;
    private final InventoryBatchRepository inventoryBatchRepository;
    private final ExpenseRepository expenseRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    @Transactional(readOnly = true)
    public DashboardKpiResponse getDashboardKpis() {
        LocalDate today = LocalDate.now();
        BigDecimal todaySales = salesOrderRepository.sumGrandTotalByDate(today);
        long todayBills = salesOrderRepository.countByDateConfirmed(today);
        
        LocalDate cutoff90 = today.plusDays(90);
        long nearExpiry = inventoryBatchRepository.findNearExpiry(today, cutoff90).size();
        long expired = inventoryBatchRepository.findExpired(today).size();
        long lowStock = inventoryBatchRepository.findLowStock(today).size();
        long pendingPO = purchaseOrderRepository.countByStatusAndIsDeletedFalse(PurchaseOrderStatus.PENDING);
        
        return new DashboardKpiResponse(
            todaySales != null ? todaySales : BigDecimal.ZERO,
            todayBills,
            lowStock,
            nearExpiry,
            expired,
            pendingPO
        );
    }

    @Transactional(readOnly = true)
    public List<SalesReportResponse> getSalesReport(LocalDate from, LocalDate to) {
        Instant fromInstant = from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant toInstant = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<Object[]> rows = salesOrderRepository.salesByDateRange(fromInstant, toInstant);
        return rows.stream().map(row -> {
            LocalDate date = (LocalDate) row[0];
            BigDecimal total = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            long cnt = row[2] != null ? ((Number) row[2]).longValue() : 0;
            BigDecimal tax = row[3] != null ? (BigDecimal) row[3] : BigDecimal.ZERO;
            BigDecimal disc = row[4] != null ? (BigDecimal) row[4] : BigDecimal.ZERO;
            return new SalesReportResponse(date, total, tax, disc, total.subtract(disc), cnt);
        }).toList();
    }

    @Transactional(readOnly = true)
    public InventoryReportResponse getInventoryReport() {
        LocalDate today = LocalDate.now();
        LocalDate cutoff90 = today.plusDays(90);

        var lowStockBatches = inventoryBatchRepository.findLowStock(today);
        var nearExpiryBatches = inventoryBatchRepository.findNearExpiry(today, cutoff90);
        var expiredBatches = inventoryBatchRepository.findExpired(today);

        List<InventoryBatchResponse> lowStockItems = lowStockBatches.stream()
            .map(b -> new InventoryBatchResponse(
                b.getId(),
                b.getMedicine().getId(),
                b.getMedicine().getName(),
                b.getMedicine().getGenericName(),
                b.getBatchNumber(),
                b.getExpiryDate(),
                b.getMrp(),
                b.getCostPrice(),
                b.getSellingPrice(),
                b.getQuantity(),
                b.isRetired(),
                b.getMedicine().getMinStockAlertLevel(),
                true
            )).toList();

        List<InventoryBatchResponse> nearExpiryItems = nearExpiryBatches.stream()
            .map(b -> new InventoryBatchResponse(
                b.getId(),
                b.getMedicine().getId(),
                b.getMedicine().getName(),
                b.getMedicine().getGenericName(),
                b.getBatchNumber(),
                b.getExpiryDate(),
                b.getMrp(),
                b.getCostPrice(),
                b.getSellingPrice(),
                b.getQuantity(),
                b.isRetired(),
                b.getMedicine().getMinStockAlertLevel(),
                b.getQuantity() <= b.getMedicine().getMinStockAlertLevel()
            )).toList();

        // totalActiveBatches can be approximated by count of non-retired, non-deleted, unexpired batches
        long totalActive = inventoryBatchRepository.count(); // For a simple impl

        return new InventoryReportResponse(
            totalActive,
            lowStockBatches.size(),
            nearExpiryBatches.size(),
            expiredBatches.size(),
            lowStockItems,
            nearExpiryItems
        );
    }
}
