// js/pages/customerDetail.js — Dedicated Customer Profile, Ledger & Purchase History
import { customerService } from '../services/customerService.js';
import { billService } from '../services/billService.js';
import { dueService } from '../services/dueService.js';
import { doctorService } from '../services/doctorService.js';
import { settingsService } from '../services/settingsService.js';
import { getState, setState } from '../state.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  buildFormHtml,
  getFormData,
  showLoading,
  showError,
  renderInvoiceHtml,
  generateWhatsAppUrl,
  printInvoice,
  debounce
} from '../utils.js';
import { statusBadge } from '../components/table.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { can } from '../permissions.js';

export default async function renderCustomerDetail(container, params = {}) {
  const customerId = params?.id || new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');

  // If no customer ID is specified, show customer selector interface
  if (!customerId) {
    renderCustomerSelector(container);
    return;
  }

  showLoading(container, 'Loading customer profile & purchase history...');

  try {
    const custResp = await customerService.getById(customerId);
    const customer = custResp?.data;

    if (!customer) {
      container.innerHTML = `
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon" style="font-size:3rem">🔍</div>
          <div class="empty-title" style="font-size:1.2rem;font-weight:700;margin-top:10px">Customer Not Found</div>
          <div class="empty-text" style="color:var(--text-muted);margin:8px 0 20px">The requested customer could not be found or has been removed.</div>
          <a href="#/customers" class="btn btn-primary">← Back to All Customers</a>
        </div>
      `;
      return;
    }

    // Load Doctor details (if assigned) and All Bills for this customer
    const [billsResp, doctorResp, settings] = await Promise.all([
      billService.getAll({ customerId: customer.id, size: 200, sort: 'createdAt,desc' }).catch(() => null),
      customer.preferredDoctorId ? doctorService.getById(customer.preferredDoctorId).catch(() => null) : Promise.resolve(null),
      settingsService.getSettings().catch(() => ({}))
    ]);

    const bills = billsResp?.data?.content || billsResp?.data || [];
    const preferredDoctor = doctorResp?.data || null;

    // Financial & Loyalty calculations
    const totalBills = bills.length;
    const totalLifetimeSpent = bills.reduce((sum, b) => sum + (Number(b.grandTotal) || 0), 0);
    const totalPaid = bills.reduce((sum, b) => sum + (Number(b.paidAmount != null ? b.paidAmount : (b.paymentStatus === 'PENDING' ? 0 : b.grandTotal)) || 0), 0);
    const outstandingDue = Number(customer.outstandingBalance || 0);
    const rewardPoints = customer.rewardPoints || 0;
    const totalPointsRedeemed = bills.reduce((sum, b) => sum + (Number(b.redeemedPoints) || 0), 0);
    const totalDiscounts = bills.reduce((sum, b) => sum + (Number(b.discountAmount) || 0), 0);

    // Aggregate Purchased Medicines / Medication History
    const medicineStatsMap = new Map();
    bills.forEach(bill => {
      const billDate = bill.createdAt;
      (bill.items || []).forEach(item => {
        const key = item.medicineId || item.medicineName;
        const qty = Number(item.quantity) || 0;
        const subtotal = Number(item.subtotal) || (qty * Number(item.unitPrice || 0));
        const unit = item.dispenseUnit || (item.packSize > 1 ? 'tabs' : 'units');

        if (!medicineStatsMap.has(key)) {
          medicineStatsMap.set(key, {
            name: item.medicineName,
            totalQty: 0,
            timesPurchased: 0,
            totalSpent: 0,
            lastDate: billDate,
            lastPrice: item.unitPrice,
            dispenseUnit: unit,
            packSize: item.packSize || 1
          });
        }

        const stat = medicineStatsMap.get(key);
        stat.totalQty += qty;
        stat.timesPurchased += 1;
        stat.totalSpent += subtotal;
        if (new Date(billDate) > new Date(stat.lastDate)) {
          stat.lastDate = billDate;
          stat.lastPrice = item.unitPrice;
        }
      });
    });

    const medicineStats = Array.from(medicineStatsMap.values()).sort((a, b) => b.totalQty - a.totalQty);

    // Due / Unpaid bills subset
    const dueBills = bills.filter(b => (b.dueAmount > 0) || b.paymentStatus === 'PARTIAL' || b.paymentStatus === 'PENDING');

    // Render Page Skeleton
    container.innerHTML = `
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px">
        <div>
          <div style="margin-bottom:6px">
            <a href="#/customers" class="btn btn-secondary btn-sm" style="padding:4px 10px;font-size:0.8rem">
              ← Back to Customers
            </a>
          </div>
          <h1 class="page-title" style="margin-bottom:4px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span>👤 ${customer.name}</span>
            ${outstandingDue > 0 
              ? `<span class="badge badge-danger" style="font-size:0.75rem">⚠️ Due: ${formatCurrency(outstandingDue)}</span>` 
              : `<span class="badge badge-success" style="font-size:0.75rem">✓ Khata Clear</span>`}
            <span class="badge badge-info" style="font-size:0.75rem">★ ${rewardPoints} Points</span>
          </h1>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            Member since ${formatDate(customer.createdAt)} · Customer ID: <code style="font-size:0.75rem">${customer.id.substring(0, 8)}</code>
          </div>
        </div>

        <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" id="btnNewBillForCust">
            ⚡ New POS Bill
          </button>
          ${outstandingDue > 0 ? `
          <button class="btn btn-danger" id="btnSettleCustDue">
            💰 Settle Dues (${formatCurrency(outstandingDue)})
          </button>` : ''}
          <button class="btn btn-secondary" id="btnEditCustProfile">
            ✏️ Edit Profile
          </button>
          ${customer.phone ? `
          <a href="https://wa.me/91${customer.phone.replace(/\D/g, '')}" target="_blank" class="btn btn-secondary" title="Chat on WhatsApp">
            📱 WhatsApp
          </a>` : ''}
        </div>
      </div>

      <!-- Customer Overview: Profile Card & KPI Cards -->
      <div style="display:grid;grid-template-columns:340px 1fr;gap:20px;margin-bottom:24px" class="cust-overview-grid">
        
        <!-- Left: Customer Profile Information -->
        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);padding-bottom:14px">
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg, var(--accent), var(--accent-dim));display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.4rem;font-weight:700">
              ${customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:700;font-size:1.1rem;color:var(--text-primary)">${customer.name}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Registered Account</div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;font-size:0.875rem">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Mobile Number</div>
              <div style="font-weight:600;margin-top:2px">
                ${customer.phone 
                  ? `<a href="tel:${customer.phone}" style="color:var(--accent);text-decoration:none">📞 ${customer.phone}</a>` 
                  : '<span style="color:var(--text-muted)">Not provided</span>'}
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Email Address</div>
              <div style="margin-top:2px">
                ${customer.email 
                  ? `<a href="mailto:${customer.email}" style="color:var(--text-primary);text-decoration:none">✉️ ${customer.email}</a>` 
                  : '<span style="color:var(--text-muted)">Not provided</span>'}
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Residential Address</div>
              <div style="color:var(--text-secondary);margin-top:2px;line-height:1.4">
                ${customer.address || '<span style="color:var(--text-muted)">No address recorded</span>'}
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Preferred Doctor</div>
              <div style="margin-top:2px;font-weight:600;color:var(--text-primary)">
                ${preferredDoctor 
                  ? `🩺 Dr. ${preferredDoctor.name} <span style="font-size:0.75rem;color:var(--text-muted);font-weight:normal">(${preferredDoctor.specialization || 'General'})</span>` 
                  : '<span style="color:var(--text-muted)">Self / OTC (No doctor assigned)</span>'}
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Loyalty Program</div>
              <div style="margin-top:2px;display:flex;align-items:center;justify-content:space-between">
                <span>Current Points: <strong style="color:var(--accent)">★ ${rewardPoints} pts</strong></span>
                <span style="font-size:0.75rem;color:var(--text-muted)">Redeemed: ${totalPointsRedeemed} pts</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: KPI Summary Metric Cards -->
        <div>
          <div class="kpi-grid" style="margin-bottom:16px">
            <div class="kpi-card ${outstandingDue > 0 ? 'kpi-danger' : 'kpi-success'}" style="padding:16px">
              <div class="kpi-icon">${outstandingDue > 0 ? '⚠️' : '✅'}</div>
              <div class="kpi-value" style="font-size:1.6rem;color:${outstandingDue > 0 ? 'var(--danger)' : 'var(--success)'}">
                ${formatCurrency(outstandingDue)}
              </div>
              <div class="kpi-label">Outstanding Khata Balance</div>
              <div class="kpi-delta ${outstandingDue > 0 ? 'down' : 'up'}" style="font-size:0.75rem">
                ${outstandingDue > 0 ? `${dueBills.length} invoice(s) pending payment` : 'All invoices fully settled'}
              </div>
            </div>

            <div class="kpi-card" style="padding:16px">
              <div class="kpi-icon">🛍️</div>
              <div class="kpi-value" style="font-size:1.6rem">${formatCurrency(totalLifetimeSpent)}</div>
              <div class="kpi-label">Lifetime Purchases</div>
              <div class="kpi-delta up" style="font-size:0.75rem">Across ${totalBills} bills</div>
            </div>

            <div class="kpi-card" style="padding:16px">
              <div class="kpi-icon">💳</div>
              <div class="kpi-value" style="font-size:1.6rem">${formatCurrency(totalPaid)}</div>
              <div class="kpi-label">Total Amount Paid</div>
              <div class="kpi-delta up" style="font-size:0.75rem">Collected to date</div>
            </div>

            <div class="kpi-card" style="padding:16px">
              <div class="kpi-icon">🧾</div>
              <div class="kpi-value" style="font-size:1.6rem">${totalBills}</div>
              <div class="kpi-label">Total Invoices</div>
              <div class="kpi-delta up" style="font-size:0.75rem">${medicineStats.length} distinct medicines</div>
            </div>
          </div>

          <!-- Secondary Loyalty & Savings Highlight Bar -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);padding:12px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
              <div>
                <span style="font-size:0.75rem;color:var(--text-muted)">Total Discounts Given:</span>
                <strong style="color:var(--text-primary);margin-left:4px">${formatCurrency(totalDiscounts)}</strong>
              </div>
              <div>
                <span style="font-size:0.75rem;color:var(--text-muted)">Points Discount Value:</span>
                <strong style="color:var(--accent);margin-left:4px">₹${totalPointsRedeemed}.00</strong>
              </div>
              <div>
                <span style="font-size:0.75rem;color:var(--text-muted)">Available Redemption:</span>
                <strong style="color:var(--accent);margin-left:4px">₹${rewardPoints}.00</strong>
              </div>
            </div>
            ${outstandingDue > 0 ? `
            <button class="btn btn-sm btn-primary" id="btnQuickSettleDue" style="font-size:0.8rem">
              💰 Pay Due Balance
            </button>` : ''}
          </div>
        </div>
      </div>

      <!-- Navigation Tabs for Customer Data -->
      <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:16px">
        <button class="btn btn-primary cust-tab-btn" data-tab="purchases" style="border-radius:var(--radius) var(--radius) 0 0;padding:10px 18px">
          🧾 Invoices &amp; Purchases (${bills.length})
        </button>
        <button class="btn btn-secondary cust-tab-btn" data-tab="medicines" style="border-radius:var(--radius) var(--radius) 0 0;padding:10px 18px">
          💊 Purchased Medicines (${medicineStats.length})
        </button>
        <button class="btn btn-secondary cust-tab-btn" data-tab="dues" style="border-radius:var(--radius) var(--radius) 0 0;padding:10px 18px">
          💳 Dues &amp; Khata Ledger (${dueBills.length})
        </button>
      </div>

      <!-- TAB 1: Invoices & Purchases -->
      <div id="tabContentPurchases" class="cust-tab-content">
        <div class="card" style="padding:16px;margin-bottom:16px">
          <!-- Filter toolbar -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex:1">
              <input type="text" id="custBillSearchInput" class="form-control" placeholder="Search bill # or doctor..." style="max-width:240px;font-size:0.85rem" />
              <select id="custBillStatusFilter" class="form-control" style="width:160px;font-size:0.85rem">
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">PAID (Full)</option>
                <option value="PARTIAL">PARTIAL (Partially Paid)</option>
                <option value="PENDING">PENDING (Unpaid)</option>
              </select>
              <input type="date" id="custBillStartDate" class="form-control" style="width:145px;font-size:0.85rem" title="From Date" />
              <input type="date" id="custBillEndDate" class="form-control" style="width:145px;font-size:0.85rem" title="To Date" />
              <button class="btn btn-secondary btn-sm" id="btnResetBillFilters" style="padding:6px 12px">Reset</button>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted)" id="custBillCountSummary">
              Showing ${bills.length} invoices
            </div>
          </div>
        </div>

        <div class="card">
          <div id="custBillsTableContainer"></div>
        </div>
      </div>

      <!-- TAB 2: Purchased Medicines & Medication Frequency -->
      <div id="tabContentMedicines" class="cust-tab-content" style="display:none">
        <div class="card" style="padding:16px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <input type="text" id="custMedSearchInput" class="form-control" placeholder="Search medicine name..." style="max-width:280px;font-size:0.85rem" />
            <div style="font-size:0.8rem;color:var(--text-muted)">
              Overview of all medications dispensed to this customer
            </div>
          </div>
        </div>

        <div class="card">
          <div id="custMedsTableContainer"></div>
        </div>
      </div>

      <!-- TAB 3: Dues & Khata Ledger -->
      <div id="tabContentDues" class="cust-tab-content" style="display:none">
        <div id="custDuesTableContainer"></div>
      </div>
    `;

    // ── Tab Navigation Handler ───────────────────────────────────────────────────
    const tabBtns = container.querySelectorAll('.cust-tab-btn');
    const tabContents = {
      purchases: container.querySelector('#tabContentPurchases'),
      medicines: container.querySelector('#tabContentMedicines'),
      dues: container.querySelector('#tabContentDues')
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => {
          b.className = b.dataset.tab === tab ? 'btn btn-primary cust-tab-btn' : 'btn btn-secondary cust-tab-btn';
        });
        Object.keys(tabContents).forEach(key => {
          if (tabContents[key]) tabContents[key].style.display = key === tab ? 'block' : 'none';
        });
      });
    });

    // ── Tab 1: Render Bills Table with Filters ────────────────────────────────────
    const billsContainer = container.querySelector('#custBillsTableContainer');
    const searchInput = container.querySelector('#custBillSearchInput');
    const statusFilter = container.querySelector('#custBillStatusFilter');
    const startDateInput = container.querySelector('#custBillStartDate');
    const endDateInput = container.querySelector('#custBillEndDate');
    const resetFiltersBtn = container.querySelector('#btnResetBillFilters');
    const countSummaryEl = container.querySelector('#custBillCountSummary');

    const renderBillsList = () => {
      const q = (searchInput?.value || '').toLowerCase().trim();
      const st = statusFilter?.value || 'ALL';
      const fromDate = startDateInput?.value ? new Date(startDateInput.value) : null;
      const toDate = endDateInput?.value ? new Date(endDateInput.value + 'T23:59:59') : null;

      const filtered = bills.filter(b => {
        if (q) {
          const matchNum = (b.billNumber || '').toLowerCase().includes(q);
          const matchDoc = (b.prescribingDoctorName || '').toLowerCase().includes(q);
          if (!matchNum && !matchDoc) return false;
        }
        if (st !== 'ALL' && b.paymentStatus !== st) return false;
        if (fromDate || toDate) {
          const bDate = new Date(b.createdAt);
          if (fromDate && bDate < fromDate) return false;
          if (toDate && bDate > toDate) return false;
        }
        return true;
      });

      if (countSummaryEl) {
        countSummaryEl.textContent = `Showing ${filtered.length} of ${bills.length} invoices`;
      }

      if (!filtered.length) {
        billsContainer.innerHTML = `
          <div class="empty-state" style="padding:40px 16px">
            <div class="empty-icon">🧾</div>
            <div class="empty-text">No invoices match the selected filters</div>
          </div>
        `;
        return;
      }

      billsContainer.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date &amp; Time</th>
                <th>Prescribing Doctor</th>
                <th>Items Dispensed</th>
                <th style="text-align:right">Subtotal</th>
                <th style="text-align:right">Discount</th>
                <th style="text-align:right">Grand Total</th>
                <th style="text-align:right">Paid</th>
                <th style="text-align:right">Due</th>
                <th>Status</th>
                <th style="text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(b => {
                const paid = Number(b.paidAmount != null ? b.paidAmount : (b.paymentStatus === 'PENDING' ? 0 : b.grandTotal)) || 0;
                const due = Number(b.dueAmount != null ? b.dueAmount : Math.max(0, (Number(b.grandTotal) || 0) - paid)) || 0;
                const itemsCount = (b.items || []).length;
                const totalUnits = (b.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

                return `
                  <tr>
                    <td>
                      <strong style="color:var(--accent);font-family:var(--font-mono)">${b.billNumber}</strong>
                    </td>
                    <td style="font-size:0.8rem">${formatDateTime(b.createdAt)}</td>
                    <td>${b.prescribingDoctorName ? `🩺 Dr. ${b.prescribingDoctorName}` : '<span style="color:var(--text-muted)">Self / OTC</span>'}</td>
                    <td>
                      <span class="badge badge-secondary" style="font-size:0.75rem">${itemsCount} item${itemsCount === 1 ? '' : 's'} (${totalUnits} units)</span>
                    </td>
                    <td style="text-align:right;font-size:0.85rem">${formatCurrency(b.totalAmount)}</td>
                    <td style="text-align:right;font-size:0.85rem">
                      ${b.discountAmount > 0 
                        ? `<span style="color:var(--danger)">-${formatCurrency(b.discountAmount)}</span>` 
                        : (b.redeemedPoints > 0 ? `<span style="color:var(--accent)">-₹${b.redeemedPoints}.00</span>` : '—')}
                    </td>
                    <td style="text-align:right">
                      <strong>${formatCurrency(b.grandTotal)}</strong>
                    </td>
                    <td style="text-align:right;color:var(--success)">
                      <div>${formatCurrency(paid)}</div>
                      ${b.payments && b.payments.length ? `
                        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px" title="Latest payment collection date">
                          🕒 ${formatDateTime(b.payments[b.payments.length - 1].paymentTime || b.payments[b.payments.length - 1].createdAt || b.createdAt)}
                        </div>
                      ` : ''}
                    </td>
                    <td style="text-align:right">
                      ${due > 0 ? `<strong style="color:var(--danger)">${formatCurrency(due)}</strong>` : '<span style="color:var(--text-muted)">₹0.00</span>'}
                    </td>
                    <td>${statusBadge(b.paymentStatus || 'PAID')}</td>
                    <td style="text-align:center">
                      <div style="display:flex;gap:4px;justify-content:center">
                        <button type="button" class="btn btn-sm btn-secondary btn-view-bill" data-id="${b.id}" title="View & Print Tax Invoice" style="padding:4px 8px;font-size:0.75rem">
                          👁️ View
                        </button>
                        ${due > 0 ? `
                        <button type="button" class="btn btn-sm btn-danger btn-pay-bill-due" data-id="${b.id}" data-billnum="${b.billNumber}" data-due="${due}" title="Collect Payment for this Bill" style="padding:4px 8px;font-size:0.75rem">
                          💰 Pay
                        </button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Attach row action handlers
      billsContainer.querySelectorAll('.btn-view-bill').forEach(btn => {
        btn.addEventListener('click', () => openInvoiceModal(btn.dataset.id, settings));
      });

      billsContainer.querySelectorAll('.btn-pay-bill-due').forEach(btn => {
        btn.addEventListener('click', () => {
          openCollectBillPaymentModal(btn.dataset.id, btn.dataset.billnum, parseFloat(btn.dataset.due), customer, () => {
            renderCustomerDetail(container, params);
          });
        });
      });
    };

    searchInput?.addEventListener('input', debounce(renderBillsList, 250));
    statusFilter?.addEventListener('change', renderBillsList);
    startDateInput?.addEventListener('change', renderBillsList);
    endDateInput?.addEventListener('change', renderBillsList);
    resetFiltersBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = 'ALL';
      if (startDateInput) startDateInput.value = '';
      if (endDateInput) endDateInput.value = '';
      renderBillsList();
    });

    renderBillsList();

    // ── Tab 2: Render Purchased Medicines & Medication Frequency ──────────────────
    const medsContainer = container.querySelector('#custMedsTableContainer');
    const medSearchInput = container.querySelector('#custMedSearchInput');

    const renderMedsList = () => {
      const q = (medSearchInput?.value || '').toLowerCase().trim();
      const filteredMeds = medicineStats.filter(m => !q || m.name.toLowerCase().includes(q));

      if (!filteredMeds.length) {
        medsContainer.innerHTML = `
          <div class="empty-state" style="padding:40px 16px">
            <div class="empty-icon">💊</div>
            <div class="empty-text">No medicines match your search criteria</div>
          </div>
        `;
        return;
      }

      medsContainer.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th style="text-align:center">Orders Frequency</th>
                <th style="text-align:right">Total Quantity Dispensed</th>
                <th style="text-align:right">Total Amount Spent</th>
                <th>Last Purchased Date</th>
                <th style="text-align:right">Last Unit Rate</th>
              </tr>
            </thead>
            <tbody>
              ${filteredMeds.map(m => `
                <tr>
                  <td>
                    <strong>${m.name}</strong>
                    ${m.packSize > 1 ? `<span style="font-size:0.75rem;color:var(--text-muted);display:block">Strip of ${m.packSize}</span>` : ''}
                  </td>
                  <td style="text-align:center">
                    <span class="badge badge-info" style="font-size:0.75rem">${m.timesPurchased} time${m.timesPurchased === 1 ? '' : 's'}</span>
                  </td>
                  <td style="text-align:right;font-weight:700">
                    ${m.totalQty} <span style="font-size:0.75rem;color:var(--text-muted);font-weight:normal">${m.dispenseUnit}</span>
                  </td>
                  <td style="text-align:right;font-weight:600">
                    ${formatCurrency(m.totalSpent)}
                  </td>
                  <td>${formatDateTime(m.lastDate)}</td>
                  <td style="text-align:right">${formatCurrency(m.lastPrice)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    medSearchInput?.addEventListener('input', debounce(renderMedsList, 250));
    renderMedsList();

    // ── Tab 3: Render Dues & Khata Ledger ─────────────────────────────────────────
    const duesContainer = container.querySelector('#custDuesTableContainer');

    const renderDuesTab = () => {
      if (outstandingDue <= 0 && !dueBills.length) {
        duesContainer.innerHTML = `
          <div class="card" style="padding:40px 20px;text-align:center">
            <div style="font-size:3rem;margin-bottom:10px">✅</div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--success)">No Pending Dues</div>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:6px">
              Customer "${customer.name}" has paid all past invoices in full. Khata ledger balance is ₹0.00.
            </div>
          </div>
        `;
        return;
      }

      duesContainer.innerHTML = `
        <div class="card" style="padding:18px 20px;margin-bottom:16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.25)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-size:0.8rem;color:var(--danger);font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Total Outstanding Balance</div>
              <div style="font-size:2rem;font-weight:800;color:var(--danger);font-family:var(--font-mono)">
                ${formatCurrency(outstandingDue)}
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">
                Distributed across ${dueBills.length} unpaid / partially paid invoices
              </div>
            </div>
            <button class="btn btn-primary" id="btnSettleTabDues" style="padding:10px 18px">
              💰 Settle Outstanding Dues Now
            </button>
          </div>
        </div>

        <div class="card">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-weight:700;font-size:0.9rem">
            Pending Invoices Breakdown
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Date &amp; Time</th>
                  <th>Prescribing Doctor</th>
                  <th style="text-align:right">Grand Total</th>
                  <th style="text-align:right">Paid So Far</th>
                  <th style="text-align:right">Pending Due</th>
                  <th>Status</th>
                  <th style="text-align:center">Action</th>
                </tr>
              </thead>
              <tbody>
                ${dueBills.map(b => {
                  const paid = Number(b.paidAmount != null ? b.paidAmount : (b.paymentStatus === 'PENDING' ? 0 : b.grandTotal)) || 0;
                  const due = Number(b.dueAmount != null ? b.dueAmount : Math.max(0, (Number(b.grandTotal) || 0) - paid)) || 0;
                  return `
                    <tr>
                      <td><strong style="color:var(--accent);font-family:var(--font-mono)">${b.billNumber}</strong></td>
                      <td style="font-size:0.8rem">${formatDateTime(b.createdAt)}</td>
                      <td>${b.prescribingDoctorName ? `Dr. ${b.prescribingDoctorName}` : 'Self / OTC'}</td>
                      <td style="text-align:right">${formatCurrency(b.grandTotal)}</td>
                      <td style="text-align:right;color:var(--success)">
                        <div>${formatCurrency(paid)}</div>
                        ${b.payments && b.payments.length ? `
                          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px" title="Latest payment collection date">
                            🕒 ${formatDateTime(b.payments[b.payments.length - 1].paymentTime || b.payments[b.payments.length - 1].createdAt || b.createdAt)}
                          </div>
                        ` : ''}
                      </td>
                      <td style="text-align:right"><strong style="color:var(--danger);font-size:0.95rem">${formatCurrency(due)}</strong></td>
                      <td>${statusBadge(b.paymentStatus)}</td>
                      <td style="text-align:center">
                        <button type="button" class="btn btn-sm btn-danger btn-pay-tab-due" data-id="${b.id}" data-billnum="${b.billNumber}" data-due="${due}" style="padding:4px 10px;font-size:0.75rem">
                          💰 Pay ${formatCurrency(due)}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      duesContainer.querySelector('#btnSettleTabDues')?.addEventListener('click', () => {
        openSettleDuesModal(customer, outstandingDue, () => renderCustomerDetail(container, params));
      });

      duesContainer.querySelectorAll('.btn-pay-tab-due').forEach(btn => {
        btn.addEventListener('click', () => {
          openCollectBillPaymentModal(btn.dataset.id, btn.dataset.billnum, parseFloat(btn.dataset.due), customer, () => {
            renderCustomerDetail(container, params);
          });
        });
      });
    };

    renderDuesTab();

    // ── Global Header Button Actions ──────────────────────────────────────────────
    // 1. New POS Bill
    container.querySelector('#btnNewBillForCust')?.addEventListener('click', () => {
      setState('selectedCustomer', customer);
      showToast(`Selected "${customer.name}" for new POS bill`, 'info', 1500);
      window.location.hash = '#/pos';
    });

    // 2. Settle Customer Dues Modal
    const handleSettleDues = () => {
      openSettleDuesModal(customer, outstandingDue, () => {
        renderCustomerDetail(container, params);
      });
    };
    container.querySelector('#btnSettleCustDue')?.addEventListener('click', handleSettleDues);
    container.querySelector('#btnQuickSettleDue')?.addEventListener('click', handleSettleDues);

    // 3. Edit Customer Profile Modal
    container.querySelector('#btnEditCustProfile')?.addEventListener('click', () => {
      openEditCustomerModal(customer, () => {
        renderCustomerDetail(container, params);
      });
    });

  } catch (err) {
    console.error('Error rendering customer detail:', err);
    showError(container, 'Failed to load customer profile and purchase history: ' + (err.message || 'Unknown error'));
  }
}

// ── Customer Selector Page (Fallback if no ?id=) ──────────────────────────────
function renderCustomerSelector(container) {
  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Customer Profile &amp; Purchases</h1>
        <div style="font-size:0.8rem;color:var(--text-muted)">Search or select a customer to view their complete profile, credit ledger, and purchase invoices</div>
      </div>
      <div>
        <a href="#/customers" class="btn btn-secondary btn-sm">← Back to All Customers</a>
      </div>
    </div>

    <div class="card" style="padding:24px;max-width:680px;margin:20px auto">
      <h3 style="margin-bottom:12px;font-size:1.05rem">🔍 Search Customer by Name, Mobile Number, or Email</h3>
      <div style="position:relative">
        <input type="text" id="custSelectSearchInput" class="form-control" placeholder="Type customer name, phone number, or email..." style="font-size:1rem;padding:12px 14px" autocomplete="off" />
        <div id="custSelectDropdown" class="pos-search-results" style="display:none;width:100%;max-height:360px;margin-top:4px;z-index:100"></div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:10px">
        Tip: Search by 10-digit mobile number, first name, last name, or email address with live auto-suggest.
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-weight:700">
        Recent Registered Customers
      </div>
      <div id="recentCustTableBox" style="padding:20px;text-align:center">
        <div class="spinner"></div>
      </div>
    </div>
  `;

  const input = container.querySelector('#custSelectSearchInput');
  const dropdown = container.querySelector('#custSelectDropdown');
  const recentTableBox = container.querySelector('#recentCustTableBox');

  // Load Recent Customers
  customerService.getAll({ page: 0, size: 10 }).then(resp => {
    const list = resp?.data?.content || resp?.data || [];
    if (!list.length) {
      recentTableBox.innerHTML = '<div style="color:var(--text-muted)">No customers found</div>';
      return;
    }
    recentTableBox.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Reward Points</th>
              <th style="text-align:right">Outstanding Due</th>
              <th style="text-align:center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone || '—'}</td>
                <td>${c.email || '—'}</td>
                <td><span class="badge badge-success">★ ${c.rewardPoints || 0} pts</span></td>
                <td style="text-align:right">
                  ${(c.outstandingBalance || 0) > 0 
                    ? `<strong style="color:var(--danger)">${formatCurrency(c.outstandingBalance)}</strong>` 
                    : '<span style="color:var(--text-muted)">₹0.00</span>'}
                </td>
                <td style="text-align:center">
                  <a href="#/customer-detail?id=${c.id}" class="btn btn-sm btn-primary" style="padding:4px 10px;font-size:0.75rem">
                    👤 View Profile &amp; Purchases
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).catch(() => {
    recentTableBox.innerHTML = '<div style="color:var(--danger)">Failed to load customers</div>';
  });

  // Auto-suggest search handler
  const doSearch = debounce(async (q) => {
    if (q.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.style.display = 'block';
    dropdown.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:0.8rem">Searching customers...</div>';

    try {
      const resp = await customerService.getAll({ page: 0, size: 8, search: q });
      const items = resp?.data?.content || resp?.data || [];

      if (!items.length) {
        dropdown.innerHTML = '<div class="pos-result-item" style="cursor:default;color:var(--text-muted)">No registered customers found matching criteria</div>';
        return;
      }

      dropdown.innerHTML = items.map((c, i) => `
        <div class="pos-result-item" data-idx="${i}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary)">${c.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;gap:10px;margin-top:2px">
              <span>📞 ${c.phone || 'No phone'}</span>
              ${c.email ? `<span>✉️ ${c.email}</span>` : ''}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--accent)">★ ${c.rewardPoints || 0} pts</div>
            ${(c.outstandingBalance || 0) > 0 
              ? `<span class="badge badge-danger" style="font-size:0.65rem">Due: ${formatCurrency(c.outstandingBalance)}</span>` 
              : '<span class="badge badge-success" style="font-size:0.65rem">Clear</span>'}
          </div>
        </div>
      `).join('');

      dropdown.querySelectorAll('.pos-result-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          window.location.hash = `#/customer-detail?id=${items[i].id}`;
        });
      });
    } catch (err) {
      dropdown.innerHTML = '<div class="pos-result-item" style="color:var(--danger)">Search error</div>';
    }
  }, 250);

  input?.addEventListener('input', (e) => doSearch(e.target.value.trim()));
  document.addEventListener('click', (e) => {
    if (!input?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

// ── Helper: Format Local ISO Datetime for Inputs ─────────────────────────────
function getLocalDateTimeString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ── Open Single Bill Invoice Modal ────────────────────────────────────────────
async function openInvoiceModal(billId, settings = {}) {
  const invModal = showModal({
    title: 'Tax Invoice Details',
    size: 'lg',
    body: '<div style="display:flex;align-items:center;justify-content:center;min-height:220px"><div class="spinner"></div></div>',
    buttons: [{ label: 'Close', class: 'btn-secondary', onClick: () => invModal.close() }]
  });

  const modalEl = invModal.element || invModal.el || document.querySelector('.modal-overlay:last-child');

  try {
    let appSettings = settings;
    if (!appSettings || !appSettings.storeName) {
      try {
        const sResp = await settingsService.getSettings();
        if (sResp) appSettings = sResp;
      } catch (_) {}
    }

    const resp = await billService.getById(billId);
    const bill = resp?.data;
    if (!bill) throw new Error('Invoice not found');

    const waUrl = generateWhatsAppUrl(bill, appSettings);
    const bodyEl = modalEl?.querySelector('.modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="width:100%">
          ${renderInvoiceHtml(bill, appSettings)}
          <div style="display:flex;gap:12px;justify-content:center;align-items:center;margin-top:18px;flex-wrap:wrap">
            <a href="${waUrl}" target="_blank" class="btn btn-secondary">📱 Share via WhatsApp</a>
            <button id="btnPrintInvoiceFromModal" class="btn btn-primary">🖨️ Print Tax Invoice</button>
          </div>
        </div>
      `;
    }

    modalEl?.querySelector('#btnPrintInvoiceFromModal')?.addEventListener('click', () => {
      printInvoice(bill, appSettings);
    });
  } catch (err) {
    console.error('Error loading tax invoice:', err);
    const bodyEl = modalEl?.querySelector('.modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = `<div class="alert alert-danger">${err.message || 'Error loading tax invoice'}</div>`;
    }
  }
}

// ── Settle Entire Customer Dues Modal ─────────────────────────────────────────
function openSettleDuesModal(customer, currentBalance, onSuccess) {
  let selectedMode = 'CASH';
  const defaultDateTime = getLocalDateTimeString();

  const modal = showModal({
    title: `Settle Dues: ${customer.name}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="padding:12px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.75rem;color:var(--danger);font-weight:700">Current Outstanding Dues</div>
            <strong style="font-size:1.3rem;color:var(--danger);font-family:var(--font-mono)">${formatCurrency(currentBalance)}</strong>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--text-muted)">Customer Phone</div>
            <strong style="font-size:0.9rem">${customer.phone || '—'}</strong>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Amount to Collect (₹) *</label>
          <input type="number" id="settleDueAmountInput" class="form-control" value="${currentBalance.toFixed(2)}" min="0.01" max="${currentBalance.toFixed(2)}" step="0.01" style="font-size:1.15rem;font-weight:bold" />
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Collected Date &amp; Time *</label>
          <input type="datetime-local" id="settleDuePaymentTime" class="form-control" value="${defaultDateTime}" />
        </div>

        <div>
          <label class="form-label" style="margin-bottom:6px">Payment Mode *</label>
          <div style="display:flex;gap:8px" id="settleDueModeGroup">
            <button type="button" class="btn btn-primary settle-due-mode-btn" data-mode="CASH">💵 Cash</button>
            <button type="button" class="btn btn-secondary settle-due-mode-btn" data-mode="UPI">📱 UPI</button>
            <button type="button" class="btn btn-secondary settle-due-mode-btn" data-mode="CARD">💳 Card</button>
            <button type="button" class="btn btn-secondary settle-due-mode-btn" data-mode="NETBANKING">🏦 Net Banking</button>
          </div>
        </div>

        <div id="settleDueModeDetailPanel"></div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Transaction Reference / UTR (Optional)</label>
          <input type="text" id="settleDueTxnRef" class="form-control" placeholder="e.g. UTR / Bank Reference Number" />
        </div>
      </div>
    `,
    buttons: [
      { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
      {
        label: '✓ Record Payment',
        class: 'btn-primary',
        onClick: async () => {
          const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
          const amtInp = modalEl?.querySelector('#settleDueAmountInput') || document.getElementById('settleDueAmountInput');
          const amt = parseFloat(amtInp?.value);
          if (isNaN(amt) || amt <= 0) {
            showToast('Please enter a valid payment amount greater than ₹0', 'error');
            return;
          }

          const ref = (modalEl?.querySelector('#settleDueTxnRef') || document.getElementById('settleDueTxnRef'))?.value.trim() || null;
          const dtVal = (modalEl?.querySelector('#settleDuePaymentTime') || document.getElementById('settleDuePaymentTime'))?.value;
          let paymentTime = null;
          if (dtVal) {
            const d = new Date(dtVal);
            if (!isNaN(d.getTime())) {
              paymentTime = d.toISOString();
            }
          }

          try {
            const resp = await dueService.settleCustomerDue(customer.id, {
              paymentMethod: selectedMode,
              amount: amt,
              transactionRef: ref,
              paymentTime: paymentTime
            });

            if (resp?.success) {
              const curBal = Math.max(0, currentBalance);
              const excess = amt > curBal ? (amt - curBal) : 0;
              const msg = excess > 0
                ? `Payment of ${formatCurrency(amt)} recorded (${curBal > 0 ? 'Dues cleared + ' : ''}${formatCurrency(excess)} Advance Credit added to Khata)!`
                : `Payment of ${formatCurrency(amt)} successfully recorded for ${customer.name}!`;
              showToast(msg, 'success');
              modal.close();
              if (typeof onSuccess === 'function') onSuccess();
            }
          } catch (err) {
            console.error('Error settling dues:', err);
            showToast(err.message || 'Failed to record payment', 'error');
          }
        }
      }
    ]
  });

  const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');

  const renderModeDetail = (mode) => {
    selectedMode = mode;
    modalEl?.querySelectorAll('.settle-due-mode-btn').forEach(btn => {
      btn.className = btn.dataset.mode === mode ? 'btn btn-primary settle-due-mode-btn' : 'btn btn-secondary settle-due-mode-btn';
    });

    const panel = modalEl?.querySelector('#settleDueModeDetailPanel');
    if (!panel) return;

    if (mode === 'UPI') {
      panel.innerHTML = `
        <div style="background:var(--bg-tertiary);border:1px dashed var(--accent);border-radius:var(--radius);padding:12px;text-align:center">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Scan QR with Google Pay, PhonePe, Paytm, or BHIM:</div>
          <div id="settleUpiQrBox" style="display:inline-block;padding:8px;background:#fff;border-radius:8px"></div>
          <div style="font-size:0.75rem;color:var(--accent);margin-top:6px;font-family:var(--font-mono)" id="settleUpiVpaText">Loading VPA...</div>
        </div>
      `;

      settingsService.getSettings().then(st => {
        const vpa = st?.upiId || 'pharmacy@upi';
        const vpaEl = modalEl?.querySelector('#settleUpiVpaText');
        const qrBox = modalEl?.querySelector('#settleUpiQrBox');
        if (vpaEl) vpaEl.textContent = `UPI VPA: ${vpa}`;
        const amt = parseFloat(modalEl?.querySelector('#settleDueAmountInput')?.value) || currentBalance;
        const upiUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(st?.storeName || 'MedStack')}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Due Settlement ' + customer.name)}`;
        if (qrBox) {
          qrBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(upiUri)}" alt="UPI QR" style="display:block;width:140px;height:140px" />`;
        }
      }).catch(() => {});
    } else {
      panel.innerHTML = '';
    }
  };

  modalEl?.querySelectorAll('.settle-due-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => renderModeDetail(btn.dataset.mode));
  });

  modalEl?.querySelector('#settleDueAmountInput')?.addEventListener('input', () => {
    if (selectedMode === 'UPI') renderModeDetail('UPI');
  });
}

// ── Collect Payment for a Single Specific Bill ────────────────────────────────
function openCollectBillPaymentModal(billId, billNumber, billDue, customer, onSuccess) {
  let selectedMode = 'CASH';
  const defaultDateTime = getLocalDateTimeString();

  const modal = showModal({
    title: `Collect Payment for Bill #${billNumber}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="padding:12px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.75rem;color:var(--danger);font-weight:700">Bill #${billNumber} Pending Due</div>
            <strong style="font-size:1.3rem;color:var(--danger);font-family:var(--font-mono)">${formatCurrency(billDue)}</strong>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--text-muted)">Customer</div>
            <strong style="font-size:0.9rem">${customer.name}</strong>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Amount (₹) *</label>
          <input type="number" id="singleBillAmountInput" class="form-control" value="${billDue.toFixed(2)}" min="0.01" step="0.01" style="font-size:1.15rem;font-weight:bold" />
        </div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Payment Collected Date &amp; Time *</label>
          <input type="datetime-local" id="singleBillPaymentTime" class="form-control" value="${defaultDateTime}" />
        </div>

        <div>
          <label class="form-label" style="margin-bottom:6px">Payment Mode *</label>
          <div style="display:flex;gap:8px" id="singleBillModeGroup">
            <button type="button" class="btn btn-primary single-bill-mode-btn" data-mode="CASH">💵 Cash</button>
            <button type="button" class="btn btn-secondary single-bill-mode-btn" data-mode="UPI">📱 UPI</button>
            <button type="button" class="btn btn-secondary single-bill-mode-btn" data-mode="CARD">💳 Card</button>
            <button type="button" class="btn btn-secondary single-bill-mode-btn" data-mode="NETBANKING">🏦 Net Banking</button>
          </div>
        </div>

        <div id="singleBillModeDetailPanel"></div>

        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Transaction Reference / UTR (Optional)</label>
          <input type="text" id="singleBillTxnRef" class="form-control" placeholder="e.g. UPI UTR / Bank Reference" />
        </div>
      </div>
    `,
    buttons: [
      { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
      {
        label: '✓ Record Bill Payment',
        class: 'btn-primary',
        onClick: async () => {
          const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');
          const amtInp = modalEl?.querySelector('#singleBillAmountInput') || document.getElementById('singleBillAmountInput');
          const amt = parseFloat(amtInp?.value);
          if (isNaN(amt) || amt <= 0) {
            showToast('Please enter a valid payment amount greater than ₹0', 'error');
            return;
          }

          const ref = (modalEl?.querySelector('#singleBillTxnRef') || document.getElementById('singleBillTxnRef'))?.value.trim() || null;
          const dtVal = (modalEl?.querySelector('#singleBillPaymentTime') || document.getElementById('singleBillPaymentTime'))?.value;
          let paymentTime = null;
          if (dtVal) {
            const d = new Date(dtVal);
            if (!isNaN(d.getTime())) {
              paymentTime = d.toISOString();
            }
          }

          try {
            const resp = await dueService.collectBillPayment(billId, {
              paymentMethod: selectedMode,
              amount: amt,
              transactionRef: ref,
              paymentTime: paymentTime
            });

            if (resp?.success) {
              const excess = amt > billDue ? (amt - billDue) : 0;
              const msg = excess > 0
                ? `Payment of ${formatCurrency(amt)} recorded (Bill #${billNumber} cleared + ${formatCurrency(excess)} Advance Credit added to Khata)!`
                : `Payment of ${formatCurrency(amt)} recorded for Bill #${billNumber}!`;
              showToast(msg, 'success');
              modal.close();
              if (typeof onSuccess === 'function') onSuccess();
            }
          } catch (err) {
            console.error('Error adding bill payment:', err);
            showToast(err.message || 'Failed to record bill payment', 'error');
          }
        }
      }
    ]
  });

  const modalEl = modal.element || modal.el || document.querySelector('.modal-overlay:last-child');

  const renderSingleModeDetail = (mode) => {
    selectedMode = mode;
    modalEl?.querySelectorAll('.single-bill-mode-btn').forEach(b => {
      b.className = b.dataset.mode === selectedMode ? 'btn btn-primary single-bill-mode-btn' : 'btn btn-secondary single-bill-mode-btn';
    });

    const panel = modalEl?.querySelector('#singleBillModeDetailPanel');
    if (!panel) return;

    if (mode === 'UPI') {
      panel.innerHTML = `
        <div style="background:var(--bg-tertiary);border:1px dashed var(--accent);border-radius:var(--radius);padding:12px;text-align:center">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Scan QR with Google Pay, PhonePe, Paytm, or BHIM:</div>
          <div id="singleBillUpiQrBox" style="display:inline-block;padding:8px;background:#fff;border-radius:8px"></div>
          <div style="font-size:0.75rem;color:var(--accent);margin-top:6px;font-family:var(--font-mono)" id="singleBillUpiVpaText">Loading VPA...</div>
        </div>
      `;

      settingsService.getSettings().then(st => {
        const vpa = st?.upiId || 'pharmacy@upi';
        const vpaEl = modalEl?.querySelector('#singleBillUpiVpaText');
        const qrBox = modalEl?.querySelector('#singleBillUpiQrBox');
        if (vpaEl) vpaEl.textContent = `UPI VPA: ${vpa}`;
        const amt = parseFloat(modalEl?.querySelector('#singleBillAmountInput')?.value) || billDue;
        const upiUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(st?.storeName || 'MedStack')}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill Payment ' + billNumber)}`;
        if (qrBox) {
          qrBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(upiUri)}" alt="UPI QR" style="display:block;width:140px;height:140px" />`;
        }
      }).catch(() => {});
    } else {
      panel.innerHTML = '';
    }
  };

  modalEl?.querySelectorAll('.single-bill-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      renderSingleModeDetail(btn.dataset.mode);
    });
  });

  modalEl?.querySelector('#singleBillAmountInput')?.addEventListener('input', () => {
    if (selectedMode === 'UPI') renderSingleModeDetail('UPI');
  });
}

// ── Edit Customer Profile Modal ───────────────────────────────────────────────
function openEditCustomerModal(customer, onSuccess) {
  const fields = [
    { name: 'name', label: 'Full Name', required: true },
    { name: 'phone', label: 'Phone Number (10 digits)', required: true, placeholder: '9810012301' },
    { name: 'email', label: 'Email Address', type: 'email' },
    { name: 'address', label: 'Residential Address', type: 'textarea' },
    { name: 'rewardPoints', label: 'Reward Points', type: 'number' }
  ];

  const formHtml = `<form id="editCustDetailForm">${buildFormHtml(fields, customer)}</form>`;
  const modal = showModal({
    title: `Edit Customer: ${customer.name}`,
    body: formHtml,
    buttons: [
      { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
      {
        label: 'Update Profile',
        class: 'btn-primary',
        onClick: async () => {
          const form = document.querySelector('#editCustDetailForm');
          if (!form.reportValidity()) return;
          const data = getFormData(form);
          data.rewardPoints = Number(data.rewardPoints) || 0;

          try {
            const res = await customerService.update(customer.id, data);
            if (res?.success) {
              showToast('Customer profile updated successfully', 'success');
              modal.close();
              if (typeof onSuccess === 'function') onSuccess();
            } else {
              showToast(res?.message || 'Failed to update customer', 'error');
            }
          } catch (e) {
            showToast(e.message || 'Error updating customer', 'error');
          }
        }
      }
    ]
  });
}
