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
  let activeReportType = 'sales'; // 'sales', 'purchases', 'expenses', 'inventory'
  let activePeriodPreset = 'month'; // 'today', 'week', 'month', 'fy', 'custom'
  let activeAggregation = 'day'; // 'day', 'month', 'year'

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
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed (April is 3)
      if (currentMonth >= 3) {
        from = new Date(currentYear, 3, 1);
        to = new Date(currentYear + 1, 2, 31);
      } else {
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
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">Audit-grade financial, purchase order, expense, and inventory intelligence</div>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" id="btnExportCsv" class="btn btn-secondary">📥 Export CSV</button>
      </div>
    </div>

    <!-- Top Executive Financial Summary Row -->
    <div id="executiveSummaryArea" style="margin-bottom:20px">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value" id="kpiSales">₹0.00</div>
          <div class="kpi-label">Gross Sales Revenue</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">📥</div>
          <div class="kpi-value" id="kpiPurchases">₹0.00</div>
          <div class="kpi-label">Purchase Orders Invoiced</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">💸</div>
          <div class="kpi-value" id="kpiExpenses" style="color:var(--danger)">₹0.00</div>
          <div class="kpi-label">Operating Expenses</div>
        </div>
        <div class="kpi-card" id="kpiMarginCard">
          <div class="kpi-icon">📈</div>
          <div class="kpi-value" id="kpiMargin">₹0.00</div>
          <div class="kpi-label">Net Operating Margin</div>
        </div>
      </div>
    </div>

    <!-- Controls Toolbar -->
    <div class="card" style="padding:14px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        
        <!-- Report Type Tabs -->
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="reportTypeTabs">
          <button type="button" class="btn btn-sm btn-primary rpt-type-btn" data-type="sales">💰 Sales &amp; Bills</button>
          <button type="button" class="btn btn-sm btn-secondary rpt-type-btn" data-type="purchases">📥 Purchase Orders</button>
          <button type="button" class="btn btn-sm btn-secondary rpt-type-btn" data-type="expenses">💸 Expenses</button>
          <button type="button" class="btn btn-sm btn-secondary rpt-type-btn" data-type="inventory">📦 Inventory Alerts</button>
        </div>

        <!-- Period Selector Presets -->
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

  // ── CSV Export ─────────────────────────────────────────────────────────────
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
  exportBtn?.addEventListener('click', () => {
    if (currentExportHandler) currentExportHandler();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatPeriodLabel = (val, agg) => {
    if (!val) return '—';
    if (agg === 'year' || val.length === 4) return `Year ${val}`;
    if (agg === 'month' || val.length === 7) {
      const [year, month] = val.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
    return formatDate(val);
  };

  const aggregateData = (rows, mode = 'day', dateKey = 'date', sumKeys = []) => {
    if (mode === 'day') return rows;
    const groups = {};
    rows.forEach(r => {
      const rawDate = r[dateKey] || '';
      const key = mode === 'month' ? rawDate.substring(0, 7) : rawDate.substring(0, 4);
      if (!key) return;
      if (!groups[key]) {
        groups[key] = { [dateKey]: key };
        sumKeys.forEach(k => { groups[key][k] = 0; });
      }
      sumKeys.forEach(k => {
        groups[key][k] += (Number(r[k]) || 0);
      });
    });
    return Object.values(groups).sort((a, b) => a[dateKey].localeCompare(b[dateKey]));
  };

  const renderChart = (canvasEl, config) => {
    if (!canvasEl) return null;
    if (canvasEl._chartInstance) {
      try { canvasEl._chartInstance.destroy(); } catch (e) {}
      canvasEl._chartInstance = null;
    }
    if (typeof window.Chart === 'undefined') {
      const notice = document.createElement('div');
      notice.style.cssText = 'color:var(--text-muted);font-size:0.8rem;text-align:center;padding:12px';
      notice.textContent = 'Chart visualization will load when online.';
      canvasEl.parentElement?.appendChild(notice);
      return null;
    }
    try {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

      if (config.options?.scales) {
        Object.values(config.options.scales).forEach(scale => {
          scale.grid = { ...scale.grid, color: gridColor };
          scale.ticks = { ...scale.ticks, color: textColor };
        });
      }
      if (config.options?.plugins?.legend) {
        config.options.plugins.legend.labels = {
          ...config.options.plugins.legend.labels,
          color: textColor
        };
      }

      const chart = new window.Chart(canvasEl, config);
      canvasEl._chartInstance = chart;
      return chart;
    } catch (err) {
      console.warn('Chart creation error', err);
      return null;
    }
  };

  // ── Executive Summary Loader ───────────────────────────────────────────────
  const loadExecutiveSummary = async () => {
    try {
      const resp = await reportService.getFinancialSummary(fromDate, toDate);
      const data = resp?.data || {};

      const elSales = container.querySelector('#kpiSales');
      const elPurchases = container.querySelector('#kpiPurchases');
      const elExpenses = container.querySelector('#kpiExpenses');
      const elMargin = container.querySelector('#kpiMargin');

      const sales = Number(data.totalSales) || 0;
      const purchases = Number(data.totalPurchases) || 0;
      const expenses = Number(data.totalExpenses) || 0;
      const netProfit = Number(data.netOperatingIncome != null ? data.netOperatingIncome : data.netProfit) || 0;

      if (elSales) elSales.textContent = formatCurrency(sales);
      if (elPurchases) elPurchases.textContent = formatCurrency(purchases);
      if (elExpenses) elExpenses.textContent = formatCurrency(expenses);
      if (elMargin) {
        elMargin.textContent = formatCurrency(netProfit);
        elMargin.style.color = netProfit >= 0 ? 'var(--accent)' : 'var(--danger)';
      }
    } catch (err) {
      console.warn('Could not load financial summary', err);
    }
  };

  // ── Tabs Navigation ────────────────────────────────────────────────────────
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

  // ── Period Selector Presets ────────────────────────────────────────────────
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
        if (startDateInput) startDateInput.value = fromDate;
        if (endDateInput) endDateInput.value = toDate;
        loadExecutiveSummary();
        loadActiveReport();
      }
    });
  });

  container.querySelector('#btnApplyCustomDates')?.addEventListener('click', () => {
    if (startDateInput && endDateInput) {
      fromDate = startDateInput.value;
      toDate = endDateInput.value;
      if (fromDate && toDate) {
        loadExecutiveSummary();
        loadActiveReport();
      }
    }
  });

  // ── Load Active Report ─────────────────────────────────────────────────────
  const loadActiveReport = async () => {
    showLoading(contentArea, `Loading ${activeReportType} report...`);

    if (activeReportType === 'sales') {
      await loadSalesReport();
    } else if (activeReportType === 'purchases') {
      await loadPurchasesReport();
    } else if (activeReportType === 'expenses') {
      await loadExpensesReport();
    } else if (activeReportType === 'inventory') {
      await loadInventoryReport();
    }
  };

  // ── 1. Sales & Revenue Report ──────────────────────────────────────────────
  const loadSalesReport = async () => {
    try {
      const resp = await reportService.getSalesReport(fromDate, toDate);
      const rawRows = Array.isArray(resp?.data) ? resp.data : [];

      const renderSalesView = () => {
        const rows = aggregateData(rawRows, activeAggregation, 'date', [
          'billCount', 'totalSales', 'totalTax', 'totalDiscount', 'netRevenue'
        ]);

        const totalGrossSales = rows.reduce((s, r) => s + (Number(r.totalSales) || 0), 0);
        const totalTax = rows.reduce((s, r) => s + (Number(r.totalTax) || 0), 0);
        const totalDiscount = rows.reduce((s, r) => s + (Number(r.totalDiscount) || 0), 0);
        const totalNetRevenue = rows.reduce((s, r) => s + (Number(r.netRevenue) || 0), 0);
        const totalBills = rows.reduce((s, r) => s + (Number(r.billCount) || 0), 0);

        contentArea.innerHTML = `
          <!-- Aggregation Toggle Header -->
          <div class="card" style="padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary)">
              📊 Sales Revenue Breakdown (${fromDate} to ${toDate})
            </div>
            <div style="display:flex;gap:4px" id="salesAggBtns">
              <span style="font-size:0.8rem;color:var(--text-muted);margin-right:6px;align-self:center">Group by:</span>
              <button type="button" class="btn btn-sm ${activeAggregation === 'day' ? 'btn-primary' : 'btn-secondary'} agg-btn" data-agg="day">Daily</button>
              <button type="button" class="btn btn-sm ${activeAggregation === 'month' ? 'btn-primary' : 'btn-secondary'} agg-btn" data-agg="month">Monthly</button>
              <button type="button" class="btn btn-sm ${activeAggregation === 'year' ? 'btn-primary' : 'btn-secondary'} agg-btn" data-agg="year">Yearly</button>
            </div>
          </div>

          <!-- Chart Card -->
          <div class="card" style="padding:16px;margin-bottom:20px">
            <h3 style="margin:0 0 12px;font-size:0.85rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em">Sales Trend &amp; Volume</h3>
            <div style="position:relative;height:260px;width:100%">
              <canvas id="salesChart"></canvas>
            </div>
          </div>

          <!-- Data Table Card -->
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h3 style="margin:0;color:var(--text-primary);font-size:0.9rem">Detailed Sales Records</h3>
              <span style="font-size:0.8rem;color:var(--text-muted)">${rows.length} records</span>
            </div>

            ${rows.length === 0
              ? '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">No sales recorded in this period.</div></div>'
              : `<div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>${activeAggregation === 'year' ? 'Year' : (activeAggregation === 'month' ? 'Month' : 'Date')}</th>
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
                          <td><strong>${formatPeriodLabel(r.date, activeAggregation)}</strong></td>
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

        // Render Sales Chart
        const canvas = contentArea.querySelector('#salesChart');
        if (canvas && rows.length > 0) {
          const labels = rows.map(r => formatPeriodLabel(r.date, activeAggregation));
          const netValues = rows.map(r => Number(r.netRevenue) || 0);
          const billCounts = rows.map(r => Number(r.billCount) || 0);

          renderChart(canvas, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Net Revenue (₹)',
                  data: netValues,
                  backgroundColor: 'rgba(16, 185, 129, 0.75)',
                  borderColor: '#10b981',
                  borderWidth: 1,
                  yAxisID: 'y'
                },
                {
                  label: 'Bills Cut',
                  data: billCounts,
                  type: 'line',
                  borderColor: '#38bdf8',
                  backgroundColor: 'rgba(56, 189, 248, 0.2)',
                  tension: 0.3,
                  yAxisID: 'y1'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  type: 'linear',
                  position: 'left',
                  ticks: { callback: (v) => '₹' + v }
                },
                y1: {
                  type: 'linear',
                  position: 'right',
                  grid: { drawOnChartArea: false }
                }
              }
            }
          });
        }

        // Wire aggregation toggle buttons
        contentArea.querySelectorAll('.agg-btn').forEach(b => {
          b.addEventListener('click', () => {
            activeAggregation = b.getAttribute('data-agg');
            renderSalesView();
          });
        });

        // Set CSV Export Handler
        currentExportHandler = () => {
          let csv = 'Period,Bills Count,Gross Sales,Tax Collected,Discounts,Net Revenue\n';
          rows.forEach(r => {
            csv += `"${formatPeriodLabel(r.date, activeAggregation)}",${r.billCount || 0},${r.totalSales || 0},${r.totalTax || 0},${r.totalDiscount || 0},${r.netRevenue || 0}\n`;
          });
          csv += `"TOTAL",${totalBills},${totalGrossSales},${totalTax},${totalDiscount},${totalNetRevenue}\n`;
          downloadCsv(`Sales_Report_${fromDate}_to_${toDate}_(${activeAggregation}).csv`, csv);
        };
      };

      renderSalesView();
    } catch (err) {
      console.error(err);
      showError(contentArea, 'Failed to load sales report');
    }
  };

  // ── 2. Purchase Orders Report (Day / Month / Year + Chart) ─────────────────
  // ── 2. Purchase Orders Report (Day / Month / Year + Chart) ─────────────────
  const loadPurchasesReport = async () => {
    try {
      const resp = await reportService.getPurchasesReport(fromDate, toDate);
      const rawRows = Array.isArray(resp?.data) ? resp.data : [];

      const renderPurchasesView = () => {
        const rows = aggregateData(rawRows, activeAggregation, 'date', [
          'orderCount', 'totalAmount', 'taxAmount', 'paidAmount', 'dueAmount'
        ]);

        const totalSpend = rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
        const totalTax = rows.reduce((s, r) => s + (Number(r.taxAmount) || 0), 0);
        const totalPaid = rows.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
        const totalDue = rows.reduce((s, r) => s + (Number(r.dueAmount) || 0), 0);
        const totalPOs = rows.reduce((s, r) => s + (Number(r.orderCount) || 0), 0);

        contentArea.innerHTML = `
          <!-- Aggregation Toggle Header -->
          <div class="card" style="padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary)">
              📥 Purchase Orders Breakdown (${fromDate} to ${toDate})
            </div>
            <div style="display:flex;gap:4px">
              <span style="font-size:0.8rem;color:var(--text-muted);margin-right:6px;align-self:center">Group by:</span>
              <button type="button" class="btn btn-sm ${activeAggregation === 'day' ? 'btn-primary' : 'btn-secondary'} po-agg-btn" data-agg="day">Daily</button>
              <button type="button" class="btn btn-sm ${activeAggregation === 'month' ? 'btn-primary' : 'btn-secondary'} po-agg-btn" data-agg="month">Monthly</button>
              <button type="button" class="btn btn-sm ${activeAggregation === 'year' ? 'btn-primary' : 'btn-secondary'} po-agg-btn" data-agg="year">Yearly</button>
            </div>
          </div>

          <!-- Purchase Chart Card -->
          <div class="card" style="padding:16px;margin-bottom:20px">
            <h3 style="margin:0 0 12px;font-size:0.85rem;color:var(--info);text-transform:uppercase;letter-spacing:0.05em">Purchase Expenditure &amp; Order Volume</h3>
            <div style="position:relative;height:260px;width:100%">
              <canvas id="purchaseChart"></canvas>
            </div>
          </div>

          <!-- Data Table Card -->
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h3 style="margin:0;color:var(--text-primary);font-size:0.9rem">Purchase Invoices Table</h3>
              <span style="font-size:0.8rem;color:var(--text-muted)">${rows.length} records</span>
            </div>

            ${rows.length === 0
              ? '<div class="empty-state"><div class="empty-icon">📥</div><div class="empty-text">No purchase orders recorded in this period.</div></div>'
              : `<div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>${activeAggregation === 'year' ? 'Year' : (activeAggregation === 'month' ? 'Month' : 'Date')}</th>
                        <th style="text-align:center">Total POs</th>
                        <th style="text-align:right">Input Tax</th>
                        <th style="text-align:right">Amount Paid</th>
                        <th style="text-align:right">Payment Due</th>
                        <th style="text-align:right">Total Purchase Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows.map(r => `
                        <tr>
                          <td><strong>${formatPeriodLabel(r.date, activeAggregation)}</strong></td>
                          <td style="text-align:center"><strong>${r.orderCount || 0}</strong></td>
                          <td style="text-align:right">${formatCurrency(r.taxAmount)}</td>
                          <td style="text-align:right;color:var(--success)">${formatCurrency(r.paidAmount)}</td>
                          <td style="text-align:right;color:${(Number(r.dueAmount) || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${formatCurrency(r.dueAmount)}</td>
                          <td style="text-align:right"><strong style="color:var(--info)">${formatCurrency(r.totalAmount)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="border-top:2px solid var(--border);font-weight:700">
                        <td>TOTAL</td>
                        <td style="text-align:center">${totalPOs}</td>
                        <td style="text-align:right">${formatCurrency(totalTax)}</td>
                        <td style="text-align:right;color:var(--success)">${formatCurrency(totalPaid)}</td>
                        <td style="text-align:right;color:${totalDue > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${formatCurrency(totalDue)}</td>
                        <td style="text-align:right;color:var(--info)">${formatCurrency(totalSpend)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>`
            }
          </div>
        `;

        // Render Purchase Chart
        const canvas = contentArea.querySelector('#purchaseChart');
        if (canvas && rows.length > 0) {
          const labels = rows.map(r => formatPeriodLabel(r.date, activeAggregation));
          const spendValues = rows.map(r => Number(r.totalAmount) || 0);
          const orderCounts = rows.map(r => Number(r.orderCount) || 0);

          renderChart(canvas, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Purchase Spend (₹)',
                  data: spendValues,
                  backgroundColor: 'rgba(56, 189, 248, 0.75)',
                  borderColor: '#0284c7',
                  borderWidth: 1,
                  yAxisID: 'y'
                },
                {
                  label: 'Orders Count',
                  data: orderCounts,
                  type: 'line',
                  borderColor: '#f59e0b',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  tension: 0.3,
                  yAxisID: 'y1'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  type: 'linear',
                  position: 'left',
                  ticks: { callback: (v) => '₹' + v }
                },
                y1: {
                  type: 'linear',
                  position: 'right',
                  grid: { drawOnChartArea: false }
                }
              }
            }
          });
        }

        // Wire aggregation toggle buttons
        contentArea.querySelectorAll('.po-agg-btn').forEach(b => {
          b.addEventListener('click', () => {
            activeAggregation = b.getAttribute('data-agg');
            renderPurchasesView();
          });
        });

        // Set CSV Export Handler
        currentExportHandler = () => {
          let csv = 'Period,Total POs,Input Tax,Amount Paid,Payment Due,Total Purchase Spend\n';
          rows.forEach(r => {
            csv += `"${formatPeriodLabel(r.date, activeAggregation)}",${r.orderCount || 0},${r.taxAmount || 0},${r.paidAmount || 0},${r.dueAmount || 0},${r.totalAmount || 0}\n`;
          });
          csv += `"TOTAL",${totalPOs},${totalTax},${totalPaid},${totalDue},${totalSpend}\n`;
          downloadCsv(`Purchase_Orders_Report_${fromDate}_to_${toDate}_(${activeAggregation}).csv`, csv);
        };
      };

      renderPurchasesView();
    } catch (err) {
      console.error(err);
      showError(contentArea, 'Failed to load purchase orders report');
    }
  };

  // ── 3. Expenses Report ─────────────────────────────────────────────────────
  const loadExpensesReport = async () => {
    try {
      const resp = await reportService.getExpensesReport(fromDate, toDate);
      const rawRows = Array.isArray(resp?.data) ? resp.data : [];

      const renderExpensesView = () => {
        const rows = aggregateData(rawRows, activeAggregation, 'date', [
          'amount', 'count'
        ]);

        const totalExpenses = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const totalCount = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);

        // Compute overall category breakdown from rawRows
        const categoryTotals = {};
        rawRows.forEach(r => {
          const cat = r.category || 'General';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(r.amount) || 0);
        });

        contentArea.innerHTML = `
          <!-- Aggregation Toggle Header -->
          <div class="card" style="padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary)">
              💸 Operating Expenses Breakdown (${fromDate} to ${toDate})
            </div>
            <div style="display:flex;gap:4px">
              <span style="font-size:0.8rem;color:var(--text-muted);margin-right:6px;align-self:center">Group by:</span>
              <button type="button" class="btn btn-sm ${activeAggregation === 'day' ? 'btn-primary' : 'btn-secondary'} exp-agg-btn" data-agg="day">Daily</button>
              <button type="button" class="btn btn-sm ${activeAggregation === 'month' ? 'btn-primary' : 'btn-secondary'} exp-agg-btn" data-agg="month">Monthly</button>
              <button type="button" class="btn btn-sm ${activeAggregation === 'year' ? 'btn-primary' : 'btn-secondary'} exp-agg-btn" data-agg="year">Yearly</button>
            </div>
          </div>

          <!-- Chart Card: Dual Category & Trend -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px" id="expensesChartGrid">
            <div class="card" style="padding:16px">
              <h3 style="margin:0 0 12px;font-size:0.85rem;color:var(--danger);text-transform:uppercase;letter-spacing:0.05em">Category Distribution</h3>
              <div style="position:relative;height:240px;width:100%">
                <canvas id="expenseCatChart"></canvas>
              </div>
            </div>

            <div class="card" style="padding:16px">
              <h3 style="margin:0 0 12px;font-size:0.85rem;color:var(--warning);text-transform:uppercase;letter-spacing:0.05em">Expense Trend Over Time</h3>
              <div style="position:relative;height:240px;width:100%">
                <canvas id="expenseTrendChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Data Table Card -->
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h3 style="margin:0;color:var(--text-primary);font-size:0.9rem">Expense Log Table</h3>
              <span style="font-size:0.8rem;color:var(--text-muted)">${rows.length} periods recorded</span>
            </div>

            ${rows.length === 0
              ? '<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-text">No expenses recorded in this period.</div></div>'
              : `<div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>${activeAggregation === 'year' ? 'Year' : (activeAggregation === 'month' ? 'Month' : 'Date')}</th>
                        <th style="text-align:center">Entries Count</th>
                        <th style="text-align:right">Total Logged Expense</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows.map(r => `
                        <tr>
                          <td><strong>${formatPeriodLabel(r.date, activeAggregation)}</strong></td>
                          <td style="text-align:center"><strong>${r.count || 0}</strong></td>
                          <td style="text-align:right"><strong style="color:var(--danger)">${formatCurrency(r.amount)}</strong></td>
                        </tr>
                      `).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="border-top:2px solid var(--border);font-weight:700">
                        <td>TOTAL</td>
                        <td style="text-align:center">${totalCount}</td>
                        <td style="text-align:right;color:var(--danger)">${formatCurrency(totalExpenses)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>`
            }
          </div>
        `;

        // Render Category Doughnut Chart
        const catCanvas = contentArea.querySelector('#expenseCatChart');
        const catLabels = Object.keys(categoryTotals);
        const catValues = Object.values(categoryTotals);
        if (catCanvas && catLabels.length > 0) {
          renderChart(catCanvas, {
            type: 'doughnut',
            data: {
              labels: catLabels,
              datasets: [{
                data: catValues,
                backgroundColor: [
                  '#ef4444', '#f59e0b', '#38bdf8', '#10b981', '#a855f7', '#ec4899', '#64748b'
                ]
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              }
            }
          });
        }

        // Render Trend Line Chart
        const trendCanvas = contentArea.querySelector('#expenseTrendChart');
        if (trendCanvas && rows.length > 0) {
          renderChart(trendCanvas, {
            type: 'line',
            data: {
              labels: rows.map(r => formatPeriodLabel(r.date, activeAggregation)),
              datasets: [{
                label: 'Expenses (₹)',
                data: rows.map(r => Number(r.amount) || 0),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                tension: 0.3,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { ticks: { callback: (v) => '₹' + v } }
              }
            }
          });
        }

        // Wire aggregation toggle buttons
        contentArea.querySelectorAll('.exp-agg-btn').forEach(b => {
          b.addEventListener('click', () => {
            activeAggregation = b.getAttribute('data-agg');
            renderExpensesView();
          });
        });

        // Set CSV Export Handler
        currentExportHandler = () => {
          let csv = 'Period,Entries Count,Total Amount\n';
          rows.forEach(r => {
            csv += `"${formatPeriodLabel(r.date, activeAggregation)}",${r.count || 0},${r.amount || 0}\n`;
          });
          csv += `"TOTAL",${totalCount},${totalExpenses}\n`;
          downloadCsv(`Expenses_Report_${fromDate}_to_${toDate}_(${activeAggregation}).csv`, csv);
        };
      };

      renderExpensesView();
    } catch (err) {
      console.error(err);
      showError(contentArea, 'Failed to load expenses report');
    }
  };

  // ── 4. Inventory Report ────────────────────────────────────────────────────
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

  // Initial load
  loadExecutiveSummary();
  loadActiveReport();
}
