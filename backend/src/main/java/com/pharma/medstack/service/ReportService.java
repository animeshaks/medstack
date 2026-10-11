package com.pharma.medstack.service;

import com.pharma.medstack.entity.PurchaseOrderStatus;
import com.pharma.medstack.model.response.*;
import com.pharma.medstack.repository.ExpenseRepository;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.PurchaseOrderRepository;
import com.pharma.medstack.repository.SalesOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    public List<PurchaseReportResponse> getPurchasesReport(LocalDate from, LocalDate to) {
        List<Object[]> rows = purchaseOrderRepository.purchasesByDateRange(from, to);
        return rows.stream().map(row -> {
            LocalDate date = (LocalDate) row[0];
            BigDecimal total = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            long cnt = row[2] != null ? ((Number) row[2]).longValue() : 0;
            BigDecimal tax = row[3] != null ? (BigDecimal) row[3] : BigDecimal.ZERO;
            BigDecimal paid = row[4] != null ? (BigDecimal) row[4] : BigDecimal.ZERO;
            BigDecimal due = row[5] != null ? (BigDecimal) row[5] : BigDecimal.ZERO;
            return new PurchaseReportResponse(date, total, tax, paid, due, cnt);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<ExpenseReportResponse> getExpensesReport(LocalDate from, LocalDate to) {
        List<Object[]> rows = expenseRepository.expensesByDateRangeAndCategory(from, to);
        return rows.stream().map(row -> {
            LocalDate date = (LocalDate) row[0];
            String category = (String) row[1];
            BigDecimal total = row[2] != null ? (BigDecimal) row[2] : BigDecimal.ZERO;
            long cnt = row[3] != null ? ((Number) row[3]).longValue() : 0;
            return new ExpenseReportResponse(date, category != null ? category : "General", total, cnt);
        }).toList();
    }

    @Transactional(readOnly = true)
    public FinancialSummaryReportResponse getFinancialSummary(LocalDate from, LocalDate to) {
        List<SalesReportResponse> sales = getSalesReport(from, to);
        List<PurchaseReportResponse> purchases = getPurchasesReport(from, to);
        List<ExpenseReportResponse> expenses = getExpensesReport(from, to);

        BigDecimal totalSales = sales.stream().map(SalesReportResponse::totalSales).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSalesTax = sales.stream().map(SalesReportResponse::totalTax).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSalesDiscount = sales.stream().map(SalesReportResponse::totalDiscount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netSalesRevenue = sales.stream().map(SalesReportResponse::netRevenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalBillsCount = sales.stream().mapToLong(SalesReportResponse::billCount).sum();

        BigDecimal totalPurchases = purchases.stream().map(PurchaseReportResponse::totalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPurchasesTax = purchases.stream().map(PurchaseReportResponse::taxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPurchasesPaid = purchases.stream().map(PurchaseReportResponse::paidAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPurchasesDue = purchases.stream().map(PurchaseReportResponse::dueAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalPOCount = purchases.stream().mapToLong(PurchaseReportResponse::orderCount).sum();

        BigDecimal totalExpenses = expenses.stream().map(ExpenseReportResponse::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalExpensesCount = expenses.stream().mapToLong(ExpenseReportResponse::count).sum();

        BigDecimal netOperatingIncome = netSalesRevenue.subtract(totalPurchases).subtract(totalExpenses);
        BigDecimal profitMarginPercent = BigDecimal.ZERO;
        if (netSalesRevenue.compareTo(BigDecimal.ZERO) > 0) {
            profitMarginPercent = netOperatingIncome
                    .multiply(BigDecimal.valueOf(100))
                    .divide(netSalesRevenue, 2, RoundingMode.HALF_UP);
        }

        return new FinancialSummaryReportResponse(
            totalSales, totalSalesTax, totalSalesDiscount, netSalesRevenue, totalBillsCount,
            totalPurchases, totalPurchasesTax, totalPurchasesPaid, totalPurchasesDue, totalPOCount,
            totalExpenses, totalExpensesCount,
            netOperatingIncome, profitMarginPercent
        );
    }

    @Transactional(readOnly = true)
    public InventoryReportResponse getInventoryReport() {
        LocalDate today = LocalDate.now();
        LocalDate cutoff90 = today.plusDays(90);

        var lowStockBatches = inventoryBatchRepository.findLowStock(today);
        var nearExpiryBatches = inventoryBatchRepository.findNearExpiry(today, cutoff90);
        var expiredBatches = inventoryBatchRepository.findExpired(today);

        List<InventoryBatchResponse> lowStockItems = lowStockBatches.stream()
            .map(InventoryService::mapToResponse)
            .toList();

        List<InventoryBatchResponse> nearExpiryItems = nearExpiryBatches.stream()
            .map(InventoryService::mapToResponse)
            .toList();

        long totalActive = inventoryBatchRepository.count();

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
