// js/pages/dues.js — Customer Dues, Balances & Credit Ledger Management
import { dueService } from '../services/dueService.js';
import { billService } from '../services/billService.js';
import { settingsService } from '../services/settingsService.js';
import { formatCurrency, formatDate, formatDateTime, extractPage, debounce, showLoading, showError, renderInvoiceHtml, generateWhatsAppUrl, printInvoice } from '../utils.js';
import { renderTable, badge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default function renderDues(container) {
  let activeTab = 'customers'; // 'customers' | 'bills'

  // State for Customer Balances Tab
  let custPage = 0;
  let custSearch = '';
  const custPageSize = 12;

  // State for Due Bills Tab
  let billPage = 0;
  let billSearch = '';
  let billStatus = 'ALL'; // 'ALL' | 'PENDING' | 'PARTIAL'
  let filterCustomerId = null;
  let filterCustomerName = null;
  const billPageSize = 12;

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title" style="margin-bottom:4px">Customer Dues &amp; Khata Ledger</h1>
        <div style="font-size:0.8rem;color:var(--text-muted)">Manage customer credit, track unpaid invoices, and collect pending balances</div>
      </div>
      <div class="page-actions" style="display:flex;gap:10px">
        <a href="#/pos" class="btn btn-primary btn-sm">⚡ Open POS Billing</a>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="kpi-grid" id="duesKpiGrid" style="margin-bottom:20px">
      <div class="kpi-card kpi-danger">
        <div class="kpi-icon">💳</div>
        <div class="kpi-value" id="kpiTotalOutstanding">₹0.00</div>
        <div class="kpi-label">Total Outstanding Dues</div>
      </div>
      <div class="kpi-card kpi-warning">
        <div class="kpi-icon">👥</div>
        <div class="kpi-value" id="kpiTotalDueCustomers">0</div>
        <div class="kpi-label">Customers with Balance</div>
      </div>
      <div class="kpi-card kpi-info">
        <div class="kpi-icon">⏳</div>
        <div class="kpi-value" id="kpiTotalDueBills">0</div>
        <div class="kpi-label">Unpaid / Partial Invoices</div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:16px">
      <button class="btn btn-primary" id="tabBtnCustomers" style="border-radius:var(--radius) var(--radius) 0 0;padding:10px 18px">
        👥 Customer Balances (<span id="custTabBadge">0</span>)
      </button>
      <button class="btn btn-secondary" id="tabBtnBills" style="border-radius:var(--radius) var(--radius) 0 0;padding:10px 18px">
        🧾 Unpaid &amp; Partial Invoices (<span id="billsTabBadge">0</span>)
      </button>
    </div>

    <!-- Tab 1: Customer Balances Container -->
    <div id="tabContentCustomers">
      <div class="table-toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div class="search-box" style="flex:1;max-width:360px">
          <input type="text" id="custSearchInput" class="form-control" placeholder="Search customer by name or phone..." />
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)">
          Showing customers with pending credit balance
        </div>
      </div>

      <div id="custTableContainer" style="margin-top:12px"></div>
      <div id="custPagination"></div>
    </div>

    <!-- Tab 2: Due Bills Container -->
    <div id="tabContentBills" style="display:none">
      <div class="table-toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div style="display:flex;gap:10px;flex:1;flex-wrap:wrap;align-items:center">
          <div class="search-box" style="flex:1;max-width:320px">
            <input type="text" id="billSearchInput" class="form-control" placeholder="Search bill # or customer..." />
          </div>
          <select id="billStatusFilter" class="form-control" style="width:160px">
            <option value="ALL">All Due Statuses</option>
            <option value="PENDING">PENDING (Unpaid)</option>
            <option value="PARTIAL">PARTIAL (Partially Paid)</option>
          </select>
          <div id="filterCustomerChip" style="display:none;align-items:center;gap:6px;background:var(--bg-tertiary);border:1px solid var(--accent);padding:4px 10px;border-radius:20px;font-size:0.8rem">
            <span>Customer: <strong id="filterCustomerChipName"></strong></span>
            <button id="btnClearCustomerFilter" style="background:transparent;border:none;cursor:pointer;color:var(--danger);font-weight:bold">&times;</button>
          </div>
        </div>
      </div>

      <div id="billTableContainer" style="margin-top:12px"></div>
      <div id="billPagination"></div>
    </div>
  `;

  // ── Tab Switching ─────────────────────────────────────────────────────────────
  const tabBtnCustomers = container.querySelector('#tabBtnCustomers');
  const tabBtnBills = container.querySelector('#tabBtnBills');
  const tabContentCustomers = container.querySelector('#tabContentCustomers');
  const tabContentBills = container.querySelector('#tabContentBills');

  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'customers') {
      tabBtnCustomers.className = 'btn btn-primary';
      tabBtnBills.className = 'btn btn-secondary';
      tabContentCustomers.style.display = 'block';
      tabContentBills.style.display = 'none';
      loadCustomers();
    } else {
      tabBtnCustomers.className = 'btn btn-secondary';
      tabBtnBills.className = 'btn btn-primary';
      tabContentCustomers.style.display = 'none';
      tabContentBills.style.display = 'block';
      loadBills();
    }
  }

  tabBtnCustomers.addEventListener('click', () => switchTab('customers'));
  tabBtnBills.addEventListener('click', () => switchTab('bills'));

  // ── Load Overall Dues KPI Summary ─────────────────────────────────────────────
  async function loadSummary() {
    try {
      const resp = await dueService.getSummary();
      if (resp?.success && resp.data) {
        const s = resp.data;
        const elTotal = container.querySelector('#kpiTotalOutstanding');
        const elCust = container.querySelector('#kpiTotalDueCustomers');
        const elBills = container.querySelector('#kpiTotalDueBills');
        const badgeCust = container.querySelector('#custTabBadge');
        const badgeBills = container.querySelector('#billsTabBadge');

        if (elTotal) elTotal.textContent = formatCurrency(s.totalOutstandingAmount);
        if (elCust) elCust.textContent = s.totalDueCustomers || 0;
        if (elBills) elBills.textContent = s.totalDueBills || 0;
        if (badgeCust) badgeCust.textContent = s.totalDueCustomers || 0;
        if (badgeBills) badgeBills.textContent = s.totalDueBills || 0;
      }
    } catch (e) {
      console.error('Error fetching dues summary:', e);
    }
  }

  // ── Tab 1: Customer Balances ──────────────────────────────────────────────────
  async function loadCustomers() {
    const tableContainer = container.querySelector('#custTableContainer');
    const paginationEl = container.querySelector('#custPagination');

    try {
      showLoading(tableContainer, 'Loading customer dues...');

      const resp = await dueService.getCustomersWithDues({
        search: custSearch,
        page: custPage,
        size: custPageSize
      });

      const { content, page } = extractPage(resp);

      const columns = [
        { key: 'customerName', label: 'Customer', render: (val) => `<strong style="color:var(--text-primary)">${val}</strong>` },
        { key: 'customerPhone', label: 'Phone', render: (val) => val ? `<span style="font-family:var(--font-mono)">${val}</span>` : '—' },
        { key: 'unpaidBillsCount', label: 'Due Invoices', render: (val) => `<span class="badge badge-warning">${val || 0} invoice(s)</span>` },
        { key: 'lastBillDate', label: 'Last Bill Date', render: (val) => val ? formatDate(val) : '—' },
        { key: 'outstandingBalance', label: 'Outstanding Due', render: (val) => `<strong style="color:var(--danger);font-size:0.95rem">${formatCurrency(val)}</strong>` },
        { key: 'actions', label: 'Actions', render: (val, c) => `
          <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm btn-settle-cust" data-id="${c.customerId}" data-name="${encodeURIComponent(c.customerName)}" data-balance="${c.outstandingBalance}">
              💰 Settle Due
            </button>
            <button class="btn btn-secondary btn-sm btn-view-cust-bills" data-id="${c.customerId}" data-name="${encodeURIComponent(c.customerName)}">
              🧾 Invoices
            </button>
            ${c.customerPhone ? `
              <button class="btn btn-secondary btn-sm btn-wa-reminder" data-name="${encodeURIComponent(c.customerName)}" data-phone="${c.customerPhone}" data-balance="${c.outstandingBalance}">
                📱 WhatsApp
              </button>
            ` : ''}
          </div>
        ` }
      ];

      renderTable(tableContainer, columns, content, { exportFilename: 'MedStack_Customer_Dues.csv' });

      // Wire Settle Due button
      tableContainer.querySelectorAll('.btn-settle-cust').forEach(btn => {
        btn.addEventListener('click', () => {
          const custId = btn.getAttribute('data-id');
          const custName = decodeURIComponent(btn.getAttribute('data-name') || '');
          const balance = parseFloat(btn.getAttribute('data-balance')) || 0;
          openSettleCustomerModal(custId, custName, balance);
        });
      });

      // Wire View Invoices button (switch to Tab 2 filtered for this customer)
      tableContainer.querySelectorAll('.btn-view-cust-bills').forEach(btn => {
        btn.addEventListener('click', () => {
          filterCustomerId = btn.getAttribute('data-id');
          filterCustomerName = decodeURIComponent(btn.getAttribute('data-name') || '');
          billPage = 0;
          switchTab('bills');
        });
      });

      // Wire WhatsApp Reminder button
      tableContainer.querySelectorAll('.btn-wa-reminder').forEach(btn => {
        btn.addEventListener('click', async () => {
          const custName = decodeURIComponent(btn.getAttribute('data-name') || 'Customer');
          const phone = btn.getAttribute('data-phone');
          const balance = parseFloat(btn.getAttribute('data-balance')) || 0;
          const settings = await settingsService.getSettings().catch(() => null);
          const storeName = settings?.storeName || 'MedStack Pharmacy';
          const upiId = settings?.upiId || '';

          let msg = `*${storeName} — Payment Reminder*\n\nDear ${custName},\nThis is a gentle reminder regarding your outstanding pharmacy balance of *${formatCurrency(balance)}*.`;
          if (upiId) {
            msg += `\n\nYou can pay via UPI to:\n*${upiId}*`;
          }
          msg += `\n\nThank you for choosing us! Wishing you good health.`;

          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, '_blank');
        });
      });

      renderPagination(paginationEl, page, (newPage) => {
        custPage = newPage;
        loadCustomers();
      });

    } catch (err) {
      console.error('Error loading customers with dues:', err);
      showError(tableContainer, 'Failed to load customer dues.');
    }
  }

  // ── Tab 2: Due Invoices (Bills) ───────────────────────────────────────────────
  async function loadBills() {
    const tableContainer = container.querySelector('#billTableContainer');
    const paginationEl = container.querySelector('#billPagination');
    const chip = container.querySelector('#filterCustomerChip');
    const chipName = container.querySelector('#filterCustomerChipName');

    if (filterCustomerId && filterCustomerName) {
      if (chip) chip.style.display = 'inline-flex';
      if (chipName) chipName.textContent = filterCustomerName;
    } else {
      if (chip) chip.style.display = 'none';
    }

    try {
      showLoading(tableContainer, 'Loading due invoices...');

      const resp = await dueService.getDueBills({
        search: billSearch,
        customerId: filterCustomerId || undefined,
        paymentStatus: billStatus !== 'ALL' ? billStatus : undefined,
        page: billPage,
        size: billPageSize
      });

      const { content, page } = extractPage(resp);

      const columns = [
        { key: 'billNumber', label: 'Bill #', render: (val) => `<strong style="color:var(--accent);font-family:var(--font-mono)">${val}</strong>` },
        { key: 'customerName', label: 'Customer', render: (val, b) => `<div><strong>${val || 'Walk-in'}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${b.customerPhone || '—'}</span></div>` },
        { key: 'createdAt', label: 'Date & Time', render: (val) => `<span style="font-size:0.8rem;color:var(--text-secondary)">${formatDateTime(val)}</span>` },
        { key: 'grandTotal', label: 'Bill Amount', render: (val) => formatCurrency(val) },
        { key: 'paidAmount', label: 'Already Paid', render: (val) => `<span style="color:var(--accent)">${formatCurrency(val || 0)}</span>` },
        { key: 'dueAmount', label: 'Balance Due', render: (val, b) => `<strong style="color:var(--danger)">${formatCurrency(val != null ? val : Math.max(0, (b.grandTotal || 0) - (b.paidAmount || 0)))}</strong>` },
        { key: 'paymentStatus', label: 'Status', render: (val) => `<span class="badge badge-${val === 'PARTIAL' ? 'warning' : 'danger'}">${val}</span>` },
        { key: 'actions', label: 'Actions', render: (val, b) => {
          const total = Number(b.grandTotal || 0);
          const paid = Number(b.paidAmount || 0);
          const due = Number(b.dueAmount != null ? b.dueAmount : Math.max(0, total - paid));
          return `
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm btn-pay-bill" data-id="${b.id}" data-bill="${b.billNumber}" data-total="${total}" data-paid="${paid}" data-due="${due}" data-customer="${encodeURIComponent(b.customerName || '')}">
                💰 Collect
              </button>
              <button class="btn btn-secondary btn-sm btn-view-invoice" data-id="${b.id}">
                👁 Receipt
              </button>
            </div>
          `;
        }}
      ];

      renderTable(tableContainer, columns, content, { exportFilename: 'MedStack_Due_Bills.csv' });

      // Wire Collect Payment for Bill button
      tableContainer.querySelectorAll('.btn-pay-bill').forEach(btn => {
        btn.addEventListener('click', () => {
          const billId = btn.getAttribute('data-id');
          const billNumber = btn.getAttribute('data-bill');
          const total = parseFloat(btn.getAttribute('data-total')) || 0;
          const paid = parseFloat(btn.getAttribute('data-paid')) || 0;
          const due = parseFloat(btn.getAttribute('data-due')) || 0;
          const customerName = decodeURIComponent(btn.getAttribute('data-customer') || 'Customer');
          openCollectBillPaymentModal(billId, billNumber, customerName, total, paid, due);
        });
      });

      // Wire View Invoice Receipt button
      tableContainer.querySelectorAll('.btn-view-invoice').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const [resp, settings] = await Promise.all([
            billService.getById(id),
            settingsService.getSettings().catch(() => null)
          ]);
          const bill = resp?.data;
          if (!bill) return;

          const waUrl = generateWhatsAppUrl(bill, settings);
          const modal = showModal({
            title: `Invoice: ${bill.billNumber}`,
            size: 'lg',
            body: `
              <div style="width:100%">
                ${renderInvoiceHtml(bill, settings)}
                <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap">
                  <a href="${waUrl}" target="_blank" class="btn btn-secondary">📱 Send WhatsApp</a>
                  <button id="btnDuesPrintInvoice" class="btn btn-primary">🖨️ Print Tax Invoice</button>
                </div>
              </div>
            `,
            buttons: [{ label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }]
          });

          document.getElementById('btnDuesPrintInvoice')?.addEventListener('click', () => {
            printInvoice(bill, settings);
          });
        });
      });

      renderPagination(paginationEl, page, (newPage) => {
        billPage = newPage;
        loadBills();
      });

    } catch (err) {
      console.error('Error loading due bills:', err);
      showError(tableContainer, 'Failed to load due invoices.');
    }
  }

  // ── Settle Customer Due Modal (Khata Ledger) ──────────────────────────────────
  async function openSettleCustomerModal(customerId, customerName, currentBalance) {
    const settings = await settingsService.getSettings().catch(() => null);
    const upiId = settings?.upiId || 'medstack@okaxis';
    const storeName = settings?.storeName || 'MedStack Pharmacy';

    let selectedMode = 'CASH';

    const modal = showModal({
      title: `Collect Payment from ${customerName}`,
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="padding:12px 16px;background:var(--bg-tertiary);border-radius:var(--radius);border-left:4px solid var(--danger)">
            <div style="font-size:0.8rem;color:var(--text-muted)">Current Total Outstanding Due</div>
            <div style="font-size:1.6rem;font-weight:bold;color:var(--danger)">${formatCurrency(currentBalance)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
              ℹ Payment will be automatically applied to oldest unpaid bills first (FIFO settlement).
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Payment Amount to Collect (₹) *</label>
            <input type="number" id="settleAmountInput" class="form-control" value="${currentBalance.toFixed(2)}" min="0.01" max="${currentBalance.toFixed(2)}" step="0.01" style="font-size:1.1rem;font-weight:bold" />
          </div>

          <!-- Payment Mode Buttons -->
          <div>
            <label class="form-label" style="margin-bottom:6px">Payment Method *</label>
            <div style="display:flex;gap:8px" id="settleModeGroup">
              <button type="button" class="btn btn-primary settle-mode-btn" data-mode="CASH">💵 Cash</button>
              <button type="button" class="btn btn-secondary settle-mode-btn" data-mode="UPI">📱 UPI</button>
              <button type="button" class="btn btn-secondary settle-mode-btn" data-mode="CARD">💳 Card</button>
              <button type="button" class="btn btn-secondary settle-mode-btn" data-mode="NETBANKING">🏦 Net Banking</button>
            </div>
          </div>

          <!-- Dynamic Mode Details (e.g. UPI QR) -->
          <div id="settleModeDetailPanel"></div>

          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Transaction Reference / Note (Optional)</label>
            <input type="text" id="settleTxnRefInput" class="form-control" placeholder="e.g. UPI UTR / Bank Ref #" />
          </div>
        </div>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: '✓ Record Payment',
          class: 'btn-primary',
          onClick: async () => {
            const amtInp = document.getElementById('settleAmountInput');
            const amt = parseFloat(amtInp?.value);
            if (isNaN(amt) || amt <= 0) {
              showToast('Please enter a valid payment amount greater than ₹0', 'error');
              return;
            }
            if (amt > currentBalance) {
              showToast(`Payment cannot exceed current balance of ${formatCurrency(currentBalance)}`, 'error');
              return;
            }

            const ref = document.getElementById('settleTxnRefInput')?.value.trim() || null;

            try {
              const resp = await dueService.settleCustomerDue(customerId, {
                paymentMethod: selectedMode,
                amount: amt,
                transactionRef: ref
              });

              if (resp?.success) {
                showToast(`Payment of ${formatCurrency(amt)} successfully recorded for ${customerName}!`, 'success');
                modal.close();
                loadSummary();
                loadCustomers();
              }
            } catch (err) {
              console.error('Error settling customer dues:', err);
              showToast(err.message || 'Failed to record payment', 'error');
            }
          }
        }
      ]
    });

    // Wire mode buttons & dynamic UPI QR
    const renderModeDetail = (mode) => {
      selectedMode = mode;
      const panel = document.getElementById('settleModeDetailPanel');
      if (!panel) return;

      const currentAmt = parseFloat(document.getElementById('settleAmountInput')?.value) || currentBalance;

      if (mode === 'UPI') {
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(storeName)}&am=${currentAmt.toFixed(2)}&cu=INR&tn=Due Settlement`;
        panel.innerHTML = `
          <div style="display:flex;gap:14px;align-items:center;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius)">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upiUrl)}" alt="UPI QR" style="width:90px;height:90px;background:#fff;padding:4px;border-radius:4px" />
            <div style="font-size:0.8rem">
              <div>Merchant: <strong>${upiId}</strong></div>
              <div>Amount: <strong style="color:var(--accent)">${formatCurrency(currentAmt)}</strong></div>
              <div style="color:var(--text-muted);font-size:0.75rem;margin-top:4px">Customer can scan to pay with any UPI app</div>
            </div>
          </div>
        `;
      } else {
        panel.innerHTML = '';
      }
    };

    document.querySelectorAll('.settle-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settle-mode-btn').forEach(b => b.className = 'btn btn-secondary settle-mode-btn');
        btn.className = 'btn btn-primary settle-mode-btn';
        renderModeDetail(btn.getAttribute('data-mode'));
      });
    });

    document.getElementById('settleAmountInput')?.addEventListener('input', () => {
      if (selectedMode === 'UPI') renderModeDetail('UPI');
    });

    renderModeDetail('CASH');
  }

  // ── Collect Payment for Specific Bill Modal ──────────────────────────────────
  async function openCollectBillPaymentModal(billId, billNumber, customerName, grandTotal, alreadyPaid, dueAmount) {
    const settings = await settingsService.getSettings().catch(() => null);
    const upiId = settings?.upiId || 'medstack@okaxis';
    const storeName = settings?.storeName || 'MedStack Pharmacy';

    let selectedMode = 'CASH';

    const modal = showModal({
      title: `Collect Payment for Bill: ${billNumber}`,
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="padding:12px 16px;background:var(--bg-tertiary);border-radius:var(--radius);border-left:4px solid var(--danger)">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px">
              <span>Customer: <strong>${customerName}</strong></span>
              <span>Bill Amount: <strong>${formatCurrency(grandTotal)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem">
              <span>Already Paid: <strong style="color:var(--accent)">${formatCurrency(alreadyPaid)}</strong></span>
              <span>Remaining Due: <strong style="color:var(--danger)">${formatCurrency(dueAmount)}</strong></span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Payment Amount to Collect (₹) *</label>
            <input type="number" id="billPayAmountInput" class="form-control" value="${dueAmount.toFixed(2)}" min="0.01" max="${dueAmount.toFixed(2)}" step="0.01" style="font-size:1.1rem;font-weight:bold" />
          </div>

          <!-- Payment Mode Buttons -->
          <div>
            <label class="form-label" style="margin-bottom:6px">Payment Method *</label>
            <div style="display:flex;gap:8px" id="billPayModeGroup">
              <button type="button" class="btn btn-primary bill-mode-btn" data-mode="CASH">💵 Cash</button>
              <button type="button" class="btn btn-secondary bill-mode-btn" data-mode="UPI">📱 UPI</button>
              <button type="button" class="btn btn-secondary bill-mode-btn" data-mode="CARD">💳 Card</button>
              <button type="button" class="btn btn-secondary bill-mode-btn" data-mode="NETBANKING">🏦 Bank</button>
            </div>
          </div>

          <!-- Dynamic UPI Preview -->
          <div id="billPayModeDetailPanel"></div>

          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Transaction Reference (Optional)</label>
            <input type="text" id="billPayTxnRefInput" class="form-control" placeholder="e.g. UTR / Approval code" />
          </div>
        </div>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: '✓ Record Payment',
          class: 'btn-primary',
          onClick: async () => {
            const amtInp = document.getElementById('billPayAmountInput');
            const amt = parseFloat(amtInp?.value);
            if (isNaN(amt) || amt <= 0) {
              showToast('Please enter a valid payment amount greater than ₹0', 'error');
              return;
            }
            if (amt > dueAmount) {
              showToast(`Payment cannot exceed bill remaining due of ${formatCurrency(dueAmount)}`, 'error');
              return;
            }

            const ref = document.getElementById('billPayTxnRefInput')?.value.trim() || null;

            try {
              const resp = await dueService.collectBillPayment(billId, {
                paymentMethod: selectedMode,
                amount: amt,
                transactionRef: ref
              });

              if (resp?.success) {
                showToast(`Payment of ${formatCurrency(amt)} recorded for Bill ${billNumber}!`, 'success');
                modal.close();
                loadSummary();
                loadBills();
              }
            } catch (err) {
              console.error('Error collecting bill payment:', err);
              showToast(err.message || 'Failed to record payment', 'error');
            }
          }
        }
      ]
    });

    const renderModeDetail = (mode) => {
      selectedMode = mode;
      const panel = document.getElementById('billPayModeDetailPanel');
      if (!panel) return;

      const currentAmt = parseFloat(document.getElementById('billPayAmountInput')?.value) || dueAmount;

      if (mode === 'UPI') {
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(storeName)}&am=${currentAmt.toFixed(2)}&cu=INR&tn=Invoice ${encodeURIComponent(billNumber)}`;
        panel.innerHTML = `
          <div style="display:flex;gap:14px;align-items:center;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius)">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upiUrl)}" alt="UPI QR" style="width:90px;height:90px;background:#fff;padding:4px;border-radius:4px" />
            <div style="font-size:0.8rem">
              <div>Merchant: <strong>${upiId}</strong></div>
              <div>Amount: <strong style="color:var(--accent)">${formatCurrency(currentAmt)}</strong></div>
              <div style="color:var(--text-muted);font-size:0.75rem;margin-top:4px">Customer can scan to pay with any UPI app</div>
            </div>
          </div>
        `;
      } else {
        panel.innerHTML = '';
      }
    };

    document.querySelectorAll('.bill-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bill-mode-btn').forEach(b => b.className = 'btn btn-secondary bill-mode-btn');
        btn.className = 'btn btn-primary bill-mode-btn';
        renderModeDetail(btn.getAttribute('data-mode'));
      });
    });

    document.getElementById('billPayAmountInput')?.addEventListener('input', () => {
      if (selectedMode === 'UPI') renderModeDetail('UPI');
    });

    renderModeDetail('CASH');
  }

  // ── Search & Filter Listeners ────────────────────────────────────────────────
  const custSearchInput = container.querySelector('#custSearchInput');
  custSearchInput?.addEventListener('input', debounce((e) => {
    custSearch = e.target.value.trim();
    custPage = 0;
    loadCustomers();
  }, 350));

  const billSearchInput = container.querySelector('#billSearchInput');
  billSearchInput?.addEventListener('input', debounce((e) => {
    billSearch = e.target.value.trim();
    billPage = 0;
    loadBills();
  }, 350));

  const billStatusFilter = container.querySelector('#billStatusFilter');
  billStatusFilter?.addEventListener('change', (e) => {
    billStatus = e.target.value;
    billPage = 0;
    loadBills();
  });

  const btnClearCustomerFilter = container.querySelector('#btnClearCustomerFilter');
  btnClearCustomerFilter?.addEventListener('click', () => {
    filterCustomerId = null;
    filterCustomerName = null;
    billPage = 0;
    loadBills();
  });

  // Initial load
  loadSummary();
  loadCustomers();
}
