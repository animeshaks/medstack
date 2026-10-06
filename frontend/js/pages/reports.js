// js/pages/reports.js — Comprehensive Reports & Analytics
import { reportService } from '../services/reportService.js';
import { billService } from '../services/billService.js';
import { inventoryService } from '../services/inventoryService.js';
import { formatCurrency, formatDate, formatDateTime, showLoading, showError } from '../utils.js';
import { can } from '../permissions.js';

export default async function renderReports(container) {
  if (!can('view_reports')) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">🔒</div>
        <div class="empty-text" style="color:var(--danger)">Access Denied: You do not have permission to view store reports.</div>
      </div>
    `;
    return;
  }

  // State
  let activeReportType = 'revenue'; // 'revenue', 'inventory', 'bills'
  let activePeriodPreset = 'month'; // 'today', 'week', 'month', 'fy', 'custom'

  const computeDateRange = (preset) => {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    if (preset === 'today') {
      from = new Date(today);
      to = new Date(today);
    } else if (preset === 'week') {
      from.setDate(today.getDate() - 7);
    } else if (preset === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === 'fy') {
      // Indian Financial Year: April 1 to March 31
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed (April is 3)
      if (currentMonth >= 3) { // Apr - Dec
        from = new Date(currentYear, 3, 1);
        to = new Date(currentYear + 1, 2, 31);
      } else { // Jan - Mar
        from = new Date(currentYear - 1, 3, 1);
        to = new Date(currentYear, 2, 31);
      }
    }
    return {
      fromDate: from.toISOString().split('T')[0],
      toDate: to.toISOString().split('T')[0]
    };
  };

  let { fromDate, toDate } = computeDateRange('month');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Reports &amp; Analytics</h1>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">Audit-grade financial, inventory, and billing operational intelligence</div>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" id="btnExportCsv" class="btn btn-secondary">📥 Export CSV</button>
      </div>
    </div>

    <!-- Controls Toolbar -->
    <div class="card" style="padding:14px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        
        <!-- Report Type Tabs -->
        <div style="display:flex;gap:6px" id="reportTypeTabs">
          <button type="button" class="btn btn-sm btn-primary rpt-type-btn" data-type="revenue">💰 Revenue Report</button>
          <button type="button" class="btn btn-sm btn-secondary rpt-type-btn" data-type="inventory">📦 Inventory Report</button>
          <button type="button" class="btn btn-sm btn-secondary rpt-type-btn" data-type="bills">🧾 Bills Report</button>
        </div>

        <!-- Period Selector Presets (Shown for date-sensitive reports) -->
        <div id="periodControls" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <div style="display:flex;gap:4px" id="presetButtons">
            <button type="button" class="btn btn-sm btn-secondary preset-btn" data-preset="today">Today</button>
            <button type="button" class="btn btn-sm btn-secondary preset-btn" data-preset="week">This Week</button>
            <button type="button" class="btn btn-sm btn-primary preset-btn" data-preset="month">This Month</button>
            <button type="button" class="btn btn-sm btn-secondary preset-btn" data-preset="fy">This FY</button>
            <button type="button" class="btn btn-sm btn-secondary preset-btn" data-preset="custom">Custom</button>
          </div>

          <div id="customDateInputs" style="display:none;align-items:center;gap:4px">
            <input type="date" id="rptStartDate" class="form-control" style="font-size:0.8rem;padding:3px 6px;width:auto" value="${fromDate}" />
            <span style="font-size:0.75rem;color:var(--text-muted)">to</span>
            <input type="date" id="rptEndDate" class="form-control" style="font-size:0.8rem;padding:3px 6px;width:auto" value="${toDate}" />
            <button type="button" id="btnApplyCustomDates" class="btn btn-sm btn-primary" style="padding:3px 8px">Apply</button>
          </div>
        </div>

      </div>
    </div>

    <!-- Active Report Content Container -->
    <div id="reportContentArea"></div>
  `;

  const contentArea = container.querySelector('#reportContentArea');
  const customDateInputs = container.querySelector('#customDateInputs');
  const startDateInput = container.querySelector('#rptStartDate');
  const endDateInput = container.querySelector('#rptEndDate');
  const exportBtn = container.querySelector('#btnExportCsv');

  // Wire Report Type Tabs
  container.querySelectorAll('.rpt-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.rpt-type-btn').forEach(b => b.className = 'btn btn-sm btn-secondary rpt-type-btn');
      btn.className = 'btn btn-sm btn-primary rpt-type-btn';
      activeReportType = btn.getAttribute('data-type');
      
      const periodCtrl = container.querySelector('#periodControls');
      if (activeReportType === 'inventory') {
        if (periodCtrl) periodCtrl.style.display = 'none';
      } else {
        if (periodCtrl) periodCtrl.style.display = 'flex';
      }

      loadActiveReport();
    });
  });

  // Wire Period Presets
  container.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.preset-btn').forEach(b => b.className = 'btn btn-sm btn-secondary preset-btn');
      btn.className = 'btn btn-sm btn-primary preset-btn';
      activePeriodPreset = btn.getAttribute('data-preset');

      if (activePeriodPreset === 'custom') {
        customDateInputs.style.display = 'flex';
      } else {
        customDateInputs.style.display = 'none';
        const range = computeDateRange(activePeriodPreset);
        fromDate = range.fromDate;
        toDate = range.toDate;
        startDateInput.value = fromDate;
        endDateInput.value = toDate;
        loadActiveReport();
      }
    });
  });

  container.querySelector('#btnApplyCustomDates')?.addEventListener('click', () => {
    fromDate = startDateInput.value;
    toDate = endDateInput.value;
    if (fromDate && toDate) {
      loadActiveReport();
    }
  });

  // ── CSV Export Functionality ───────────────────────────────────────────────
  const downloadCsv = (filename, csvContent) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  let currentExportHandler = null;
  exportBtn.addEventListener('click', () => {
    if (currentExportHandler) currentExportHandler();
  });

  // ── Load Active Report ─────────────────────────────────────────────────────
  const loadActiveReport = async () => {
    showLoading(contentArea, `Generating ${activeReportType} report...`);

    if (activeReportType === 'revenue') {
      await loadRevenueReport();
    } else if (activeReportType === 'inventory') {
      await loadInventoryReport();
    } else if (activeReportType === 'bills') {
      await loadBillsReport();
    }
  };

  // ── 1. Revenue Report ──────────────────────────────────────────────────────
  const loadRevenueReport = async () => {
    try {
      const resp = await reportService.getSalesReport(fromDate, toDate);
      const rows = Array.isArray(resp?.data) ? resp.data : [];

      const totalGrossSales = rows.reduce((s, r) => s + (Number(r.totalSales) || 0), 0);
      const totalTax = rows.reduce((s, r) => s + (Number(r.totalTax) || 0), 0);
      const totalDiscount = rows.reduce((s, r) => s + (Number(r.totalDiscount) || 0), 0);
      const totalNetRevenue = rows.reduce((s, r) => s + (Number(r.netRevenue) || 0), 0);
      const totalBills = rows.reduce((s, r) => s + (Number(r.billCount) || 0), 0);
      const avgBill = totalBills > 0 ? (totalNetRevenue / totalBills) : 0;

      contentArea.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value">${formatCurrency(totalNetRevenue)}</div>
            <div class="kpi-label">Net Sales Revenue</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🧾</div>
            <div class="kpi-value">${totalBills}</div>
            <div class="kpi-label">Total Bills Cut</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🎯</div>
            <div class="kpi-value">${formatCurrency(avgBill)}</div>
            <div class="kpi-label">Average Bill Size</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🏷️</div>
            <div class="kpi-value" style="color:var(--danger)">-${formatCurrency(totalDiscount)}</div>
            <div class="kpi-label">Discounts Given</div>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Daily Revenue Breakdown (${fromDate} to ${toDate})</h3>
            <span style="font-size:0.8rem;color:var(--text-muted)">${rows.length} days recorded</span>
          </div>

          ${rows.length === 0
            ? '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">No revenue recorded in this date range.</div></div>'
            : `<div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style="text-align:center">Bills Count</th>
                      <th style="text-align:right">Gross Sales</th>
                      <th style="text-align:right">Tax Collected</th>
                      <th style="text-align:right">Discounts</th>
                      <th style="text-align:right">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(r => `
                      <tr>
                        <td><strong>${formatDate(r.date)}</strong></td>
                        <td style="text-align:center"><strong>${r.billCount || 0}</strong></td>
                        <td style="text-align:right">${formatCurrency(r.totalSales)}</td>
                        <td style="text-align:right">${formatCurrency(r.totalTax)}</td>
                        <td style="text-align:right;color:var(--danger)">-${formatCurrency(r.totalDiscount)}</td>
                        <td style="text-align:right"><strong style="color:var(--accent)">${formatCurrency(r.netRevenue)}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="border-top:2px solid var(--border);font-weight:700">
                      <td>TOTAL</td>
                      <td style="text-align:center">${totalBills}</td>
                      <td style="text-align:right">${formatCurrency(totalGrossSales)}</td>
                      <td style="text-align:right">${formatCurrency(totalTax)}</td>
                      <td style="text-align:right;color:var(--danger)">-${formatCurrency(totalDiscount)}</td>
                      <td style="text-align:right;color:var(--accent)">${formatCurrency(totalNetRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>`
          }
        </div>
      `;

      currentExportHandler = () => {
        let csv = 'Date,Bills Count,Gross Sales,Tax Collected,Discounts,Net Revenue\n';
        rows.forEach(r => {
          csv += `"${r.date}",${r.billCount || 0},${r.totalSales || 0},${r.totalTax || 0},${r.totalDiscount || 0},${r.netRevenue || 0}\n`;
        });
        csv += `"TOTAL",${totalBills},${totalGrossSales},${totalTax},${totalDiscount},${totalNetRevenue}\n`;
        downloadCsv(`Revenue_Report_${fromDate}_to_${toDate}.csv`, csv);
      };

    } catch (err) {
      console.error(err);
      showError(contentArea, 'Failed to load revenue report');
    }
  };

  // ── 2. Inventory Report ────────────────────────────────────────────────────
  const loadInventoryReport = async () => {
    try {
      const [invResp, nearResp, expResp] = await Promise.all([
        reportService.getInventoryReport().catch(() => null),
        inventoryService.getNearExpiry(90).catch(() => null),
        inventoryService.getExpired().catch(() => null)
      ]);

      const inv = invResp?.data || {};
      const nearBatches = Array.isArray(nearResp?.data) ? nearResp.data : [];
      const expiredBatches = Array.isArray(expResp?.data) ? expResp.data : [];
      const lowStockBatches = inv.lowStockItems || [];

      contentArea.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">📦</div>
            <div class="kpi-value">${inv.totalActiveBatches || 0}</div>
            <div class="kpi-label">Active Batches</div>
          </div>
          <div class="kpi-card kpi-warning">
            <div class="kpi-icon">⏰</div>
            <div class="kpi-value">${nearBatches.length || inv.nearExpiryCount || 0}</div>
            <div class="kpi-label">Near Expiry (90d)</div>
          </div>
          <div class="kpi-card kpi-danger">
            <div class="kpi-icon">⚠️</div>
            <div class="kpi-value">${expiredBatches.length || inv.expiredCount || 0}</div>
            <div class="kpi-label">Expired Batches</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📉</div>
            <div class="kpi-value">${lowStockBatches.length || inv.lowStockCount || 0}</div>
            <div class="kpi-label">Low Stock Medicines</div>
          </div>
        </div>

        <!-- Near Expiry Inventory Table -->
        <div class="card" style="margin-top:20px">
          <h3 style="margin:0 0 16px;color:var(--accent);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Near Expiry Inventory Alert (Next 90 Days)</h3>
          ${nearBatches.length === 0
            ? '<div style="color:var(--text-muted);font-size:0.85rem">No items currently near expiry.</div>'
            : `<div class="table-container">
                <table class="data-table">
                  <thead><tr><th>Medicine</th><th>Batch #</th><th>Expiry Date</th><th>Stock Qty</th><th>MRP</th><th>Selling Price</th></tr></thead>
                  <tbody>
                    ${nearBatches.map(b => `
                      <tr>
                        <td><strong>${b.medicineName}</strong></td>
                        <td><code>${b.batchNumber}</code></td>
                        <td style="color:var(--warning);font-weight:700">${formatDate(b.expiryDate)}</td>
                        <td><strong>${b.quantity}</strong> pack(s)${b.looseQuantity > 0 ? ` + ${b.looseQuantity} tabs` : ''}</td>
                        <td>${formatCurrency(b.mrp)}</td>
                        <td><strong>${formatCurrency(b.sellingPrice)}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

        <!-- Expired Batches Table -->
        <div class="card" style="margin-top:20px">
          <h3 style="margin:0 0 16px;color:var(--danger);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Expired Batches (Action Required)</h3>
          ${expiredBatches.length === 0
            ? '<div style="color:var(--text-muted);font-size:0.85rem">No expired batches found in active inventory.</div>'
            : `<div class="table-container">
                <table class="data-table">
                  <thead><tr><th>Medicine</th><th>Batch #</th><th>Expired Date</th><th>Stock Qty</th><th>MRP</th></tr></thead>
                  <tbody>
                    ${expiredBatches.map(b => `
                      <tr>
                        <td><strong>${b.medicineName}</strong></td>
                        <td><code>${b.batchNumber}</code></td>
                        <td style="color:var(--danger);font-weight:700">${formatDate(b.expiryDate)}</td>
                        <td><strong>${b.quantity}</strong> pack(s)${b.looseQuantity > 0 ? ` + ${b.looseQuantity} tabs` : ''}</td>
                        <td>${formatCurrency(b.mrp)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>
      `;

      currentExportHandler = () => {
        let csv = 'Report Type,Medicine,Batch Number,Expiry Date,Packs,Loose,MRP,Selling Price\n';
        nearBatches.forEach(b => {
          csv += `"NEAR_EXPIRY","${b.medicineName}","${b.batchNumber}","${b.expiryDate}",${b.quantity},${b.looseQuantity || 0},${b.mrp},${b.sellingPrice}\n`;
        });
        expiredBatches.forEach(b => {
          csv += `"EXPIRED","${b.medicineName}","${b.batchNumber}","${b.expiryDate}",${b.quantity},${b.looseQuantity || 0},${b.mrp},${b.sellingPrice}\n`;
        });
        downloadCsv(`Inventory_Alerts_Report_${new Date().toISOString().split('T')[0]}.csv`, csv);
      };

    } catch (err) {
      console.error(err);
      showError(contentArea, 'Failed to load inventory report');
    }
  };

  // ── 3. Bills Report ────────────────────────────────────────────────────────
  const loadBillsReport = async () => {
    try {
      const resp = await billService.getAll({
        page: 0,
        size: 200,
        startDate: new Date(fromDate).toISOString(),
        endDate: new Date(toDate + 'T23:59:59.999Z').toISOString()
      });

      const bills = resp?.data?.content || resp?.data || [];
      const totalAmountSum = bills.reduce((s, b) => s + (Number(b.grandTotal) || 0), 0);
      const paidBillsCount = bills.filter(b => b.paymentStatus === 'PAID').length;

      contentArea.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">🧾</div>
            <div class="kpi-value">${bills.length}</div>
            <div class="kpi-label">Bills in Period</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value">${formatCurrency(totalAmountSum)}</div>
            <div class="kpi-label">Total Invoiced Amount</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">✓</div>
            <div class="kpi-value">${paidBillsCount} / ${bills.length}</div>
            <div class="kpi-label">Paid Bills</div>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em">Bills Invoiced (${fromDate} to ${toDate})</h3>
            <span style="font-size:0.8rem;color:var(--text-muted)">${bills.length} bills</span>
          </div>

          ${bills.length === 0
            ? '<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-text">No bills recorded in this period.</div></div>'
            : `<div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Bill #</th>
                      <th>Date &amp; Time</th>
                      <th>Customer</th>
                      <th>Cashier</th>
                      <th style="text-align:center">Items</th>
                      <th style="text-align:right">Subtotal</th>
                      <th style="text-align:right">Discount</th>
                      <th style="text-align:right">Grand Total</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${bills.map(b => `
                      <tr>
                        <td><strong style="color:var(--accent);font-family:var(--font-mono)">${b.billNumber}</strong></td>
                        <td style="color:var(--text-muted);font-size:0.8rem">${formatDateTime(b.createdAt)}</td>
                        <td><strong>${b.customerName || 'Walk-in'}</strong></td>
                        <td style="color:var(--text-secondary);font-size:0.8rem">${b.createdBy || 'Staff'}</td>
                        <td style="text-align:center">${(b.items || []).length}</td>
                        <td style="text-align:right">${formatCurrency(b.totalAmount)}</td>
                        <td style="text-align:right;color:var(--danger)">${b.discountAmount > 0 ? `-${formatCurrency(b.discountAmount)}` : '—'}</td>
                        <td style="text-align:right"><strong>${formatCurrency(b.grandTotal)}</strong></td>
                        <td><span class="badge badge-${b.paymentStatus === 'PAID' ? 'success' : 'warning'}">${b.paymentStatus}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>
      `;

      currentExportHandler = () => {
        let csv = 'Bill Number,Date Time,Customer,Cashier,Items Count,Subtotal,Discount,Grand Total,Payment Status\n';
        bills.forEach(b => {
          csv += `"${b.billNumber}","${b.createdAt}","${b.customerName || 'Walk-in'}","${b.createdBy || 'Staff'}",${(b.items || []).length},${b.totalAmount},${b.discountAmount},${b.grandTotal},"${b.paymentStatus}"\n`;
        });
        downloadCsv(`Bills_Report_${fromDate}_to_${toDate}.csv`, csv);
      };

    } catch (err) {
      console.error(err);
      showError(contentArea, 'Failed to load bills report');
    }
  };

  loadActiveReport();
}
