package com.pharma.medstack.model.response;

import java.math.BigDecimal;

public record FinancialSummaryReportResponse(
    BigDecimal totalSales,
    BigDecimal totalSalesTax,
    BigDecimal totalSalesDiscount,
    BigDecimal netSalesRevenue,
    long totalBillsCount,
    
    BigDecimal totalPurchases,
    BigDecimal totalPurchasesTax,
    BigDecimal totalPurchasesPaid,
    BigDecimal totalPurchasesDue,
    long totalPOCount,
    
    BigDecimal totalExpenses,
    long totalExpensesCount,
    
    BigDecimal netOperatingIncome,
    BigDecimal profitMarginPercent
) {}
