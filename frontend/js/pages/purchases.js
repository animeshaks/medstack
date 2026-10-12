// js/pages/purchases.js — Purchase Orders & Reorder/Shortage Basket
import { purchaseService } from '../services/purchaseService.js';
import { supplierService } from '../services/supplierService.js';
import { medicineService } from '../services/medicineService.js';
import { inventoryService } from '../services/inventoryService.js';
import { formatCurrency, formatDate, extractPage, buildFormHtml, getFormData, showLoading, showError } from '../utils.js';
import { renderTable, statusBadge } from '../components/table.js';
import { renderPagination } from '../components/pagination.js';
import { showModal, confirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createSearchableSelect } from '../components/searchableSelect.js';
import { can } from '../permissions.js';
import { openPayPoModal } from './supplierDetail.js';

const SHORTAGE_STORAGE_KEY = 'medstack_po_shortage_basket';

function getShortageBasket() {
  try {
    return JSON.parse(localStorage.getItem(SHORTAGE_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveShortageBasket(items) {
  localStorage.setItem(SHORTAGE_STORAGE_KEY, JSON.stringify(items));
}

export default function renderPurchases(container) {
  let activeTab = 'orders'; // 'orders' | 'shortage'
  let currentPage = 0;
  const pageSize = 15;

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Purchases &amp; Procurement</h1>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:2px">
          Manage supplier purchase orders, stock receiving, and procurement shortage wishlist.
        </p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        ${can('manage_purchases') ? `
          <button class="btn btn-secondary" id="openShortageBtn">
            📋 Reorder Basket <span class="badge badge-warning" id="shortageBadge" style="margin-left:6px">0</span>
          </button>
          <button class="btn btn-primary" id="addPurchaseBtn">
            + New Purchase Order
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Sub-navigation tabs -->
    <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:18px">
      <button class="btn btn-tab active" id="tabOrders" style="border-radius:var(--radius) var(--radius) 0 0;padding:8px 16px;border-bottom:2px solid var(--accent);background:var(--bg-secondary);font-weight:600">
        📦 Purchase Orders
      </button>
      <button class="btn btn-tab" id="tabShortage" style="border-radius:var(--radius) var(--radius) 0 0;padding:8px 16px;border-bottom:2px solid transparent;background:transparent;color:var(--text-secondary)">
        📋 Shortage &amp; Reorder List (<span id="tabShortageCount">0</span>)
      </button>
    </div>

    <!-- Orders Tab Content -->
    <div id="ordersSection" class="card">
      <div id="purchaseTableContainer"></div>
      <div id="purchasePagination"></div>
    </div>

    <!-- Shortage Wishlist Tab Content -->
    <div id="shortageSection" class="card" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h3 style="font-size:1.05rem;font-weight:700;margin:0">Items Flagged for Reorder / Shortage</h3>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:2px 0 0">
            Keep medicines here that need distributor purchase. Select items to raise a Purchase Order instantly.
          </p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" id="scanLowStockBtn">⚡ Auto-Scan Low Stock</button>
          <button class="btn btn-sm btn-secondary" id="addItemToShortageBtn">+ Add Medicine to List</button>
          <button class="btn btn-sm btn-primary" id="raisePoFromShortageBtn">🛒 Create PO for Selected Items</button>
          <button class="btn btn-sm btn-ghost text-danger" id="clearShortageBtn">🗑️ Clear List</button>
        </div>
      </div>
      <div id="shortageTableContainer"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#purchaseTableContainer');
  const paginationContainer = container.querySelector('#purchasePagination');
  const addBtn = container.querySelector('#addPurchaseBtn');
  const openShortageBtn = container.querySelector('#openShortageBtn');
  const tabOrders = container.querySelector('#tabOrders');
  const tabShortage = container.querySelector('#tabShortage');
  const ordersSection = container.querySelector('#ordersSection');
  const shortageSection = container.querySelector('#shortageSection');
  const shortageBadge = container.querySelector('#shortageBadge');
  const tabShortageCount = container.querySelector('#tabShortageCount');
  const shortageTableContainer = container.querySelector('#shortageTableContainer');

  const updateShortageBadges = () => {
    const count = getShortageBasket().length;
    if (shortageBadge) shortageBadge.textContent = count;
    if (tabShortageCount) tabShortageCount.textContent = count;
  };

  const switchTab = (tab) => {
    activeTab = tab;
    if (tab === 'orders') {
      tabOrders.style.borderBottomColor = 'var(--accent)';
      tabOrders.style.background = 'var(--bg-secondary)';
      tabOrders.style.color = 'var(--text-primary)';
      tabShortage.style.borderBottomColor = 'transparent';
      tabShortage.style.background = 'transparent';
      tabShortage.style.color = 'var(--text-secondary)';
      ordersSection.style.display = 'block';
      shortageSection.style.display = 'none';
      loadData(currentPage);
    } else {
      tabShortage.style.borderBottomColor = 'var(--accent)';
      tabShortage.style.background = 'var(--bg-secondary)';
      tabShortage.style.color = 'var(--text-primary)';
      tabOrders.style.borderBottomColor = 'transparent';
      tabOrders.style.background = 'transparent';
      tabOrders.style.color = 'var(--text-secondary)';
      ordersSection.style.display = 'none';
      shortageSection.style.display = 'block';
      renderShortageTable();
    }
  };

  if (tabOrders) tabOrders.addEventListener('click', () => switchTab('orders'));
  if (tabShortage) tabShortage.addEventListener('click', () => switchTab('shortage'));
  if (openShortageBtn) openShortageBtn.addEventListener('click', () => switchTab('shortage'));

  // ----------------------------------------------------
  // Purchase Orders Table
  // ----------------------------------------------------
  const loadData = async (page = 0) => {
    currentPage = page;
    showLoading(tableContainer, 'Loading purchase orders...');

    try {
      const resp = await purchaseService.getAll({ page, size: pageSize });
      const { content, page: pageMeta } = extractPage(resp);

      const columns = [
        { key: 'invoiceNumber', label: 'Invoice #', render: (val) => `<strong style="color:var(--accent);font-family:var(--font-mono)">${val || '—'}</strong>` },
        {
          key: 'supplierName',
          label: 'Distributor / Supplier',
          render: (val, row) => row.supplierId
            ? `<a href="#/supplier-detail?id=${row.supplierId}" style="color:var(--text-primary);font-weight:700;text-decoration:none" title="View Supplier Khata & Invoices">🏢 ${val || '—'}</a>`
            : `<strong>${val || '—'}</strong>`
        },
        { key: 'invoiceDate', label: 'Invoice Date', render: (val) => formatDate(val) },
        { key: 'subtotal', label: 'Subtotal', render: (val) => formatCurrency(val) },
        {
          key: 'discountAmount',
          label: 'Bill Discount',
          render: (val, row) => {
            const amt = Number(val) || 0;
            const pct = Number(row?.discountPercent) || 0;
            if (amt > 0) return `<span style="color:var(--danger);font-weight:600">-${formatCurrency(amt)}</span>`;
            if (pct > 0) return `<span style="color:var(--danger);font-weight:600">-${pct}%</span>`;
            return '<span style="color:var(--text-muted)">—</span>';
          }
        },
        { key: 'taxAmount', label: 'GST Tax', render: (val) => formatCurrency(val) },
        { key: 'totalAmount', label: 'Grand Total', render: (val) => `<strong style="color:var(--text-primary)">${formatCurrency(val)}</strong>` },
        {
          key: 'dueAmount',
          label: 'Payment Due',
          render: (val, row) => {
            const total = Number(row.totalAmount) || 0;
            const paid = Number(row.paidAmount != null ? row.paidAmount : (row.paymentStatus === 'PAID' ? total : 0));
            const due = Number(row.dueAmount != null ? row.dueAmount : Math.max(0, total - paid));
            const isPaid = row.paymentStatus === 'PAID' || due <= 0;
            const isPartial = row.paymentStatus === 'PARTIAL' && due > 0;
            const badgeClass = isPaid ? 'badge-success' : (isPartial ? 'badge-warning' : 'badge-danger');
            const badgeText = isPaid ? 'PAID' : (isPartial ? `PARTIAL (${formatCurrency(due)})` : `DUE: ${formatCurrency(due)}`);
            return `<span class="badge ${badgeClass}">${badgeText}</span>`;
          }
        },
        {
          key: 'status',
          label: 'Delivery',
          render: (val) => statusBadge(val)
        }
      ];

      const actions = [
        {
          label: 'View',
          class: 'btn-secondary',
          icon: '👁️ View',
          onClick: (po) => openDetailModal(po)
        }
      ];

      if (can('manage_purchases')) {
        actions.unshift({
          label: 'Receive',
          class: 'btn-primary',
          icon: '📥 Receive',
          onClick: (po) => {
            if (po.status !== 'PENDING') {
              showToast('Purchase order is already received', 'info');
              return;
            }
            openReceiveModal(po);
          }
        });

        actions.push({
          label: 'Clear Bill',
          class: 'btn-secondary',
          icon: '💳 Clear Bill',
          onClick: (po) => {
            const total = Number(po.totalAmount) || 0;
            const paid = Number(po.paidAmount != null ? po.paidAmount : (po.paymentStatus === 'PAID' ? total : 0));
            const due = Number(po.dueAmount != null ? po.dueAmount : Math.max(0, total - paid));
            if (due <= 0) {
              showToast('Purchase order is already fully paid', 'info');
              return;
            }
            openPayPoModal(po, due, { id: po.supplierId, name: po.supplierName }, () => {
              loadData(currentPage);
            });
          }
        });
      }

      renderTable(tableContainer, columns, content, { actions, defaultSortKey: 'invoiceDate', defaultSortDir: 'desc', exportFilename: 'MedStack_Purchase_Orders.csv' });
      renderPagination(paginationContainer, pageMeta, (newPage) => loadData(newPage));
    } catch (err) {
      console.error(err);
      showError(tableContainer, 'Error loading purchase orders');
    }
  };

  const openDetailModal = async (po) => {
    let itemsHtml = '<div class="spinner" style="margin:20px auto"></div>';
    const isPending = po.status === 'PENDING';
    const modalButtons = [
      { label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }
    ];
    const total = Number(po.totalAmount) || 0;
    const paid = Number(po.paidAmount != null ? po.paidAmount : (po.paymentStatus === 'PAID' ? total : 0));
    const due = Number(po.dueAmount != null ? po.dueAmount : Math.max(0, total - paid));

    if (due > 0 && can('manage_purchases')) {
      modalButtons.push({
        label: '💳 Record Payment / Clear Bill',
        class: 'btn-secondary',
        onClick: () => {
          modal.close();
          openPayPoModal(po, due, { id: po.supplierId, name: po.supplierName }, () => {
            loadData(currentPage);
          });
        }
      });
    }

    if (isPending && can('manage_purchases')) {
      modalButtons.push({
        label: '📥 Receive Inward Stock',
        class: 'btn-primary',
        onClick: () => {
          modal.close();
          openReceiveModal(po);
        }
      });
    }

    const modal = showModal({
      title: `Purchase Order Tax Invoice: #${po.invoiceNumber}`,
      size: 'lg',
      body: `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;font-size:0.85rem">
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Distributor / Supplier:</span>
              <strong style="color:var(--text-primary);font-size:0.95rem">🏢 ${po.supplierName || '—'}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Supplier Invoice #:</span>
              <strong style="color:var(--accent);font-family:var(--font-mono)">${po.invoiceNumber}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Invoice Date:</span>
              <strong>${formatDate(po.invoiceDate)}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Receiving Status:</span>
              ${statusBadge(po.status)}
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Payment Status:</span>
              <strong style="color:${due > 0 ? 'var(--danger)' : 'var(--success)'}">
                ${due > 0 ? `DUE: ${formatCurrency(due)} (Paid: ${formatCurrency(paid)})` : `✓ FULLY PAID (${formatCurrency(paid)})`}
              </strong>
            </div>
          </div>
          ${po.receivingNotes ? `
            <div style="margin-top:10px;padding:8px 12px;background:var(--bg-tertiary);border-left:3px solid var(--accent);border-radius:var(--radius);font-size:0.8rem">
              <strong>📝 Delivery &amp; Receiving Notes:</strong> ${po.receivingNotes}
            </div>
          ` : ''}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px">
          <h4 style="margin:0;font-size:0.85rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px">
            Wholesale Invoice Line Items
          </h4>
          <span style="font-size:0.75rem;color:var(--text-muted)">
            ${isPending ? 'GST &amp; Scheme Breakdown' : 'Ordered vs Verified Inward Stock'}
          </span>
        </div>
        <div id="poItemsContainer">${itemsHtml}</div>

        <div id="poDetailTotalsSummary"></div>
      `,
      buttons: modalButtons
    });

    try {
      const itemsResp = await purchaseService.getItems(po.id);
      const items = Array.isArray(itemsResp?.data) ? itemsResp.data : (itemsResp?.data?.content ?? []);
      const itemsBox = document.querySelector('#poItemsContainer');
      const totalsBox = document.querySelector('#poDetailTotalsSummary');
      if (!itemsBox) return;

      if (!items.length) {
        itemsBox.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:20px;text-align:center">No line items found for this purchase order.</div>';
        return;
      }

      let totalBilledUnits = 0;
      let totalFreeUnits = 0;
      let totalStockUnits = 0;
      let totalLineDiscount = 0;
      let totalActualInwardUnits = 0;

      items.forEach(it => {
        const bQty = Number(it.quantity) || 0;
        const fQty = Number(it.freeQuantity) || 0;
        totalBilledUnits += bQty;
        totalFreeUnits += fQty;
        totalStockUnits += (it.totalQuantity || (bQty + fQty));
        totalLineDiscount += (Number(it.discountAmount) || 0);

        if (it.receivedTotalQuantity != null) {
          totalActualInwardUnits += it.receivedTotalQuantity;
        } else if (it.receivedQuantity != null || it.receivedFreeQuantity != null) {
          totalActualInwardUnits += ((it.receivedQuantity || 0) + (it.receivedFreeQuantity || 0));
        } else {
          totalActualInwardUnits += (bQty + fQty);
        }
      });

      itemsBox.innerHTML = `
        <div class="table-container" style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px">
          <table class="data-table" style="font-size:0.8rem">
            <thead>
              <tr style="position:sticky;top:0;background:var(--bg-tertiary);z-index:2">
                <th>Product / Medicine</th>
                <th>Batch #</th>
                <th>Expiry</th>
                <th style="text-align:center">${isPending ? 'Ordered Qty' : 'Ordered'}</th>
                ${!isPending ? '<th style="text-align:center">Received</th>' : ''}
                <th style="text-align:right">Stock Inward</th>
                ${!isPending ? '<th>Item Status / Remarks</th>' : ''}
                <th style="text-align:right">Rate (₹)</th>
                <th style="text-align:right">MRP (₹)</th>
                <th style="text-align:right">Dis %</th>
                <th style="text-align:right">Sch %</th>
                <th style="text-align:right">Tax %</th>
                <th style="text-align:right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => {
                const bQty = it.quantity || 0;
                const fQty = it.freeQuantity || 0;
                const totUnits = it.totalQuantity || (bQty + fQty);

                const hasRecData = it.receivedQuantity != null || it.receivedFreeQuantity != null;
                const recB = hasRecData ? (it.receivedQuantity || 0) : bQty;
                const recF = hasRecData ? (it.receivedFreeQuantity || 0) : fQty;
                const actualInward = hasRecData ? (recB + recF) : totUnits;
                const isMissing = it.itemStatus === 'NOT_RECEIVED' || (hasRecData && actualInward === 0);

                return `
                  <tr style="${isMissing ? 'opacity:0.65;background:rgba(239, 68, 68, 0.04)' : ''}">
                    <td>
                      <strong>${it.medicineName || 'Medicine Item'}</strong>
                      ${it.scheme ? `<div style="font-size:0.7rem;color:var(--text-muted)">Scheme: ${it.scheme}</div>` : ''}
                    </td>
                    <td><code>${it.batchNumber || '—'}</code></td>
                    <td>${formatDate(it.expiryDate)}</td>
                    <td style="text-align:center">
                      ${bQty}${fQty > 0 ? ` <span style="color:var(--success)">+${fQty}f</span>` : ''}
                    </td>
                    ${!isPending ? `
                      <td style="text-align:center">
                        ${isMissing ? '<span class="badge badge-danger">0 (Missing)</span>'
                          : `<span class="badge ${actualInward < totUnits ? 'badge-warning' : 'badge-success'}">${recB}${recF > 0 ? ` +${recF}f` : ''}</span>`}
                      </td>
                    ` : ''}
                    <td style="text-align:right">
                      <strong style="color:${isMissing ? 'var(--danger)' : 'var(--accent)'}">${isMissing ? '0 units' : `${actualInward} units`}</strong>
                    </td>
                    ${!isPending ? `
                      <td>
                        ${statusBadge(it.itemStatus || po.status)}
                        ${it.remarks ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${it.remarks}</div>` : ''}
                      </td>
                    ` : ''}
                    <td style="text-align:right">${formatCurrency(it.costPrice)}</td>
                    <td style="text-align:right">${formatCurrency(it.mrp)}</td>
                    <td style="text-align:right">${it.discountPercent > 0 ? it.discountPercent + '%' : '—'}</td>
                    <td style="text-align:right">${it.schemeDiscountPercent > 0 ? it.schemeDiscountPercent + '%' : '—'}</td>
                    <td style="text-align:right">${it.taxPercent || 0}%</td>
                    <td style="text-align:right;font-weight:700">${formatCurrency(it.totalAmount || (it.costPrice * bQty))}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (totalsBox) {
        totalsBox.innerHTML = `
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-size:0.85rem">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px">
              <div>
                <span style="color:var(--text-muted)">Ordered Units:</span>
                <strong>${totalBilledUnits} billed</strong> + <strong style="color:var(--success)">${totalFreeUnits} free scheme</strong> = <strong>${totalStockUnits} units</strong>
              </div>
              ${!isPending ? `
                <div>
                  <span style="color:var(--text-muted)">Verified Physical Inward:</span>
                  <strong style="color:var(--accent);font-size:1.05rem">📦 ${totalActualInwardUnits} units credited to stock</strong>
                </div>
              ` : ''}
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px">
              <div>
                <span style="color:var(--text-muted);display:block;font-size:0.75rem">Taxable Subtotal:</span>
                <strong>${formatCurrency(po.subtotal)}</strong>
              </div>
              <div>
                <span style="color:var(--text-muted);display:block;font-size:0.75rem">Item Discounts:</span>
                <span style="color:var(--danger)">-${formatCurrency(totalLineDiscount)}</span>
              </div>
              <div>
                <span style="color:var(--text-muted);display:block;font-size:0.75rem">Bill Discount:</span>
                <span style="color:var(--danger)">${po.discountAmount > 0 ? `-${formatCurrency(po.discountAmount)}` : (po.discountPercent > 0 ? `-${po.discountPercent}%` : '₹0.00')}</span>
              </div>
              <div>
                <span style="color:var(--text-muted);display:block;font-size:0.75rem">GST Payable:</span>
                <strong style="color:var(--warning)">+${formatCurrency(po.taxAmount)}</strong>
              </div>
              <div style="text-align:right">
                <span style="color:var(--text-muted);display:block;font-size:0.75rem">Grand Total:</span>
                <strong style="color:var(--accent);font-size:1.25rem">${formatCurrency(po.totalAmount)}</strong>
              </div>
            </div>
          </div>
        `;
      }
    } catch (e) {
      const itemsBox = document.querySelector('#poItemsContainer');
      if (itemsBox) itemsBox.innerHTML = '<div style="color:var(--danger)">Error loading line items</div>';
    }
  };

  // ---------------------------------------------------------------------------
  // RECEIVE PURCHASE ORDER MODAL (MISSING ITEMS, SHORT QUANTITY & VERIFICATION)
  // ---------------------------------------------------------------------------
  const openReceiveModal = async (po) => {
    let rawItems = [];
    try {
      const itemsResp = await purchaseService.getItems(po.id);
      rawItems = Array.isArray(itemsResp?.data) ? itemsResp.data : (itemsResp?.data?.content ?? []);
    } catch (e) {
      console.error(e);
      showToast('Error loading purchase order items for receiving', 'error');
      return;
    }

    if (!rawItems.length) {
      showToast('No items found in this purchase order to receive', 'warning');
      return;
    }

    const modalBodyHtml = `
      <form id="receivePoForm">
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-left:4px solid var(--warning);padding:10px 14px;border-radius:var(--radius);margin-bottom:14px;font-size:0.8rem;color:var(--text-secondary)">
          <strong>📦 Physical Stock Inward Verification:</strong>
          Inspect items against delivered packages. If an item is missing/unavailable, uncheck it or select <em>Missing</em>. If received with shortage/less quantity, adjust the count. 
          <strong>Only actual verified units will be credited to inventory batches.</strong>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="font-size:0.8rem;color:var(--text-muted)">
            Supplier: <strong>🏢 ${po.supplierName || '—'}</strong> · Invoice: <strong style="color:var(--accent)">#${po.invoiceNumber}</strong> (${rawItems.length} items)
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-sm btn-secondary" id="recMarkAllFullBtn">
              ✅ Receive All (Full)
            </button>
            <button type="button" class="btn btn-sm btn-secondary" id="recMarkAllMissingBtn">
              ❌ Mark All Missing
            </button>
          </div>
        </div>

        <div class="table-container" style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px">
          <table class="data-table" style="font-size:0.8rem">
            <thead>
              <tr style="position:sticky;top:0;background:var(--bg-tertiary);z-index:2">
                <th style="width:40px;text-align:center" title="Include / Receive item">Recv?</th>
                <th>Medicine / Product</th>
                <th style="text-align:center">Ordered</th>
                <th style="text-align:right" title="Actual billed units received">Recv Billed Qty *</th>
                <th style="text-align:right" title="Actual free units received from scheme">Recv Free Qty</th>
                <th style="text-align:center" title="Stock units that will be added to inventory">Stock Inward</th>
                <th>Batch # *</th>
                <th>Expiry *</th>
                <th>Discrepancy / Remarks</th>
              </tr>
            </thead>
            <tbody id="receiveRowsContainer">
              ${rawItems.map(it => {
                const bQty = Number(it.quantity) || 0;
                const fQty = Number(it.freeQuantity) || 0;
                const ordTotal = it.totalQuantity || (bQty + fQty);
                return `
                  <tr data-item-id="${it.id}" style="border-bottom:1px solid var(--border)">
                    <td style="text-align:center;padding:8px 4px">
                      <input type="checkbox" class="rec-checkbox" checked style="width:16px;height:16px;cursor:pointer" title="Check if item was received" />
                    </td>
                    <td style="padding:8px">
                      <strong style="display:block;color:var(--text-primary)">${it.medicineName || 'Medicine'}</strong>
                      ${it.scheme ? `<span class="badge badge-secondary" style="font-size:0.7rem;margin-top:2px">Scheme: ${it.scheme}</span>` : ''}
                    </td>
                    <td style="text-align:center;padding:8px;white-space:nowrap;color:var(--text-muted)">
                      ${bQty}${fQty > 0 ? ` + ${fQty}f` : ''} = <strong>${ordTotal}u</strong>
                    </td>
                    <td style="text-align:right;padding:8px">
                      <input type="number" class="form-control rec-billed-qty" min="0" value="${bQty}" data-ordered="${bQty}" style="font-size:0.8rem;padding:5px;width:65px;text-align:right" title="Billed quantity physically received" required />
                    </td>
                    <td style="text-align:right;padding:8px">
                      <input type="number" class="form-control rec-free-qty" min="0" value="${fQty}" data-ordered="${fQty}" style="font-size:0.8rem;padding:5px;width:55px;text-align:right" title="Free scheme units physically received" />
                    </td>
                    <td style="text-align:center;padding:8px;white-space:nowrap">
                      <div class="rec-stock-badge" style="font-weight:700;color:var(--success)">
                        ✅ ${ordTotal} units to stock
                      </div>
                    </td>
                    <td style="padding:8px">
                      <input type="text" class="form-control rec-batch" value="${it.batchNumber || ''}" style="font-size:0.8rem;padding:5px;width:95px" placeholder="Batch #" required />
                    </td>
                    <td style="padding:8px">
                      <input type="date" class="form-control rec-expiry" value="${it.expiryDate || ''}" style="font-size:0.8rem;padding:5px;width:125px" required />
                    </td>
                    <td style="padding:8px;min-width:200px">
                      <div style="display:flex;flex-direction:column;gap:4px">
                        <select class="form-control rec-status-select" style="font-size:0.75rem;padding:4px">
                          <option value="RECEIVED_FULL">✅ Full Delivery (OK)</option>
                          <option value="RECEIVED_PARTIAL">⚠️ Short Quantity Received</option>
                          <option value="NOT_RECEIVED">❌ Missing / Not Supplied</option>
                          <option value="DAMAGED">🚫 Damaged / Rejected</option>
                        </select>
                        <input type="text" class="form-control rec-remarks" placeholder="Optional remark / reason" style="font-size:0.75rem;padding:4px" />
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Realtime Receiving Summary -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-size:0.85rem;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px">
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Verification Breakdown:</span>
              <strong id="recSummaryCounts">Calculating...</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Physical Stock Added to Inventory:</span>
              <strong id="recSummaryTotalUnits" style="color:var(--success);font-size:1.15rem">0 units</strong>
            </div>
            <div style="text-align:right">
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">PO Final Status:</span>
              <span id="recSummaryStatusBadge"><span class="badge badge-success">RECEIVED</span></span>
            </div>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.8rem">Delivery &amp; Discrepancy Notes (Optional)</label>
            <input type="text" id="recPoNotes" class="form-control" placeholder="e.g. 1 item out of stock with vendor. Balance promised on next invoice." style="font-size:0.85rem" />
          </div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: `Receive Inward Stock: PO #${po.invoiceNumber}`,
      size: 'lg',
      body: modalBodyHtml,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: '📥 Confirm & Update Inventory',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#receivePoForm');
            if (!form.reportValidity()) return;

            const rows = form.querySelectorAll('#receiveRowsContainer tr');
            const itemsPayload = [];
            let totalStockUnits = 0;
            let missingCount = 0;

            for (const r of rows) {
              const itemId = r.getAttribute('data-item-id');
              const chk = r.querySelector('.rec-checkbox');
              const isIncluded = chk ? chk.checked : true;
              const billedQty = parseInt(r.querySelector('.rec-billed-qty').value, 10) || 0;
              const freeQty = parseInt(r.querySelector('.rec-free-qty').value, 10) || 0;
              const batchNumber = r.querySelector('.rec-batch').value.trim();
              const expiryDate = r.querySelector('.rec-expiry').value;
              const statusSelect = r.querySelector('.rec-status-select').value;
              const remarks = r.querySelector('.rec-remarks').value.trim();

              const effectiveIncluded = isIncluded && (billedQty > 0 || freeQty > 0);
              const recBilled = effectiveIncluded ? billedQty : 0;
              const recFree = effectiveIncluded ? freeQty : 0;
              const itemTotal = recBilled + recFree;

              if (effectiveIncluded) {
                totalStockUnits += itemTotal;
              } else {
                missingCount++;
              }

              itemsPayload.push({
                itemId,
                included: effectiveIncluded,
                receivedQuantity: recBilled,
                receivedFreeQuantity: recFree,
                batchNumber,
                expiryDate,
                itemStatus: (!effectiveIncluded) ? 'NOT_RECEIVED' : statusSelect,
                remarks
              });
            }

            const confirmMsg = missingCount > 0
              ? `Confirm receiving? ${totalStockUnits} units will be added to inventory (${missingCount} missing/short item(s) will be recorded as discrepancy).`
              : `Confirm receiving? ${totalStockUnits} units across ${itemsPayload.length} items will be added to inventory batches.`;

            const ok = await confirm(confirmMsg, { title: 'Confirm Inward Stock' });
            if (!ok) return;

            try {
              const notes = document.querySelector('#recPoNotes')?.value.trim() || null;
              const res = await purchaseService.receive(po.id, {
                items: itemsPayload,
                notes
              });

              if (res?.success) {
                showToast(`Inventory updated! ${totalStockUnits} units credited to stock.`, 'success');
                modal.close();
                loadData(currentPage);
              } else {
                showToast(res?.message || 'Failed to update inventory', 'error');
              }
            } catch (err) {
              showToast(err.message || 'Error receiving stock', 'error');
            }
          }
        }
      ]
    });

    // Wire up interactive behavior in Receive Modal
    const modalEl = document.querySelector('#receivePoForm');
    if (!modalEl) return;

    const recalculateReceiveSummary = () => {
      let fullCount = 0;
      let partialCount = 0;
      let missingCount = 0;
      let totalStockUnits = 0;

      modalEl.querySelectorAll('#receiveRowsContainer tr').forEach(r => {
        const chk = r.querySelector('.rec-checkbox');
        const bInput = r.querySelector('.rec-billed-qty');
        const fInput = r.querySelector('.rec-free-qty');
        const ordBilled = parseInt(bInput.getAttribute('data-ordered'), 10) || 0;
        const ordFree = parseInt(fInput.getAttribute('data-ordered'), 10) || 0;
        const ordTotal = ordBilled + ordFree;

        const isChecked = chk.checked;
        const bQty = isChecked ? (parseInt(bInput.value, 10) || 0) : 0;
        const fQty = isChecked ? (parseInt(fInput.value, 10) || 0) : 0;
        const curTotal = bQty + fQty;
        const badgeEl = r.querySelector('.rec-stock-badge');
        const statusSel = r.querySelector('.rec-status-select');

        if (!isChecked || curTotal === 0) {
          missingCount++;
          r.style.opacity = '0.6';
          r.style.background = 'rgba(239, 68, 68, 0.05)';
          if (badgeEl) badgeEl.innerHTML = '<span style="color:var(--danger)">❌ 0 units (Missing)</span>';
          if (statusSel && isChecked) statusSel.value = 'NOT_RECEIVED';
        } else if (curTotal < ordTotal) {
          partialCount++;
          totalStockUnits += curTotal;
          r.style.opacity = '1';
          r.style.background = 'rgba(245, 158, 11, 0.05)';
          if (badgeEl) badgeEl.innerHTML = `<span style="color:var(--warning)">⚠️ ${curTotal}/${ordTotal}u (Shortage)</span>`;
          if (statusSel) statusSel.value = 'RECEIVED_PARTIAL';
        } else {
          fullCount++;
          totalStockUnits += curTotal;
          r.style.opacity = '1';
          r.style.background = 'transparent';
          if (badgeEl) badgeEl.innerHTML = `<span style="color:var(--success)">✅ ${curTotal} units to stock</span>`;
          if (statusSel) statusSel.value = 'RECEIVED_FULL';
        }
      });

      const countsEl = document.querySelector('#recSummaryCounts');
      if (countsEl) {
        countsEl.innerHTML = `<span style="color:var(--success)">${fullCount} Full</span>, <span style="color:var(--warning)">${partialCount} Short</span>, <span style="color:var(--danger)">${missingCount} Missing</span>`;
      }

      const unitsEl = document.querySelector('#recSummaryTotalUnits');
      if (unitsEl) unitsEl.textContent = `${totalStockUnits} units`;

      const statusBadgeEl = document.querySelector('#recSummaryStatusBadge');
      if (statusBadgeEl) {
        if (partialCount > 0 || missingCount > 0) {
          statusBadgeEl.innerHTML = '<span class="badge badge-warning">PARTIALLY RECEIVED</span>';
        } else {
          statusBadgeEl.innerHTML = '<span class="badge badge-success">RECEIVED</span>';
        }
      }
    };

    modalEl.querySelectorAll('#receiveRowsContainer tr').forEach(r => {
      const chk = r.querySelector('.rec-checkbox');
      const bInput = r.querySelector('.rec-billed-qty');
      const fInput = r.querySelector('.rec-free-qty');
      const statusSel = r.querySelector('.rec-status-select');
      const remarksInput = r.querySelector('.rec-remarks');

      chk.addEventListener('change', () => {
        if (!chk.checked) {
          bInput.value = '0';
          fInput.value = '0';
          statusSel.value = 'NOT_RECEIVED';
          if (!remarksInput.value) remarksInput.value = 'Item missing / not supplied';
        } else {
          bInput.value = bInput.getAttribute('data-ordered');
          fInput.value = fInput.getAttribute('data-ordered');
          statusSel.value = 'RECEIVED_FULL';
          remarksInput.value = '';
        }
        recalculateReceiveSummary();
      });

      bInput.addEventListener('input', () => {
        const val = parseInt(bInput.value, 10) || 0;
        const fVal = parseInt(fInput.value, 10) || 0;
        const ordB = parseInt(bInput.getAttribute('data-ordered'), 10) || 0;
        const ordF = parseInt(fInput.getAttribute('data-ordered'), 10) || 0;
        if (val === 0 && fVal === 0) {
          chk.checked = false;
          statusSel.value = 'NOT_RECEIVED';
        } else {
          chk.checked = true;
          if (val + fVal < ordB + ordF) {
            statusSel.value = 'RECEIVED_PARTIAL';
            if (!remarksInput.value) remarksInput.value = `Shortage (${val + fVal}/${ordB + ordF})`;
          } else {
            statusSel.value = 'RECEIVED_FULL';
          }
        }
        recalculateReceiveSummary();
      });

      fInput.addEventListener('input', () => {
        const val = parseInt(bInput.value, 10) || 0;
        const fVal = parseInt(fInput.value, 10) || 0;
        const ordB = parseInt(bInput.getAttribute('data-ordered'), 10) || 0;
        const ordF = parseInt(fInput.getAttribute('data-ordered'), 10) || 0;
        if (val === 0 && fVal === 0) {
          chk.checked = false;
          statusSel.value = 'NOT_RECEIVED';
        } else {
          chk.checked = true;
          if (val + fVal < ordB + ordF) {
            statusSel.value = 'RECEIVED_PARTIAL';
          } else {
            statusSel.value = 'RECEIVED_FULL';
          }
        }
        recalculateReceiveSummary();
      });

      statusSel.addEventListener('change', () => {
        const ordB = bInput.getAttribute('data-ordered');
        const ordF = fInput.getAttribute('data-ordered');
        if (statusSel.value === 'NOT_RECEIVED' || statusSel.value === 'DAMAGED') {
          chk.checked = false;
          bInput.value = '0';
          fInput.value = '0';
          if (!remarksInput.value) {
            remarksInput.value = statusSel.value === 'DAMAGED' ? 'Damaged / rejected goods' : 'Item missing / not supplied';
          }
        } else if (statusSel.value === 'RECEIVED_FULL') {
          chk.checked = true;
          bInput.value = ordB;
          fInput.value = ordF;
          remarksInput.value = '';
        } else if (statusSel.value === 'RECEIVED_PARTIAL') {
          chk.checked = true;
        }
        recalculateReceiveSummary();
      });
    });

    const markAllFullBtn = document.querySelector('#recMarkAllFullBtn');
    if (markAllFullBtn) {
      markAllFullBtn.addEventListener('click', () => {
        modalEl.querySelectorAll('#receiveRowsContainer tr').forEach(r => {
          const chk = r.querySelector('.rec-checkbox');
          const bInput = r.querySelector('.rec-billed-qty');
          const fInput = r.querySelector('.rec-free-qty');
          const statusSel = r.querySelector('.rec-status-select');
          const remarks = r.querySelector('.rec-remarks');
          chk.checked = true;
          bInput.value = bInput.getAttribute('data-ordered');
          fInput.value = fInput.getAttribute('data-ordered');
          statusSel.value = 'RECEIVED_FULL';
          remarks.value = '';
        });
        recalculateReceiveSummary();
      });
    }

    const markAllMissingBtn = document.querySelector('#recMarkAllMissingBtn');
    if (markAllMissingBtn) {
      markAllMissingBtn.addEventListener('click', () => {
        modalEl.querySelectorAll('#receiveRowsContainer tr').forEach(r => {
          const chk = r.querySelector('.rec-checkbox');
          const bInput = r.querySelector('.rec-billed-qty');
          const fInput = r.querySelector('.rec-free-qty');
          const statusSel = r.querySelector('.rec-status-select');
          const remarks = r.querySelector('.rec-remarks');
          chk.checked = false;
          bInput.value = '0';
          fInput.value = '0';
          statusSel.value = 'NOT_RECEIVED';
          remarks.value = 'Item missing / not supplied';
        });
        recalculateReceiveSummary();
      });
    }

    recalculateReceiveSummary();
  };

  // ----------------------------------------------------
  // MULTI-ITEM PURCHASE ORDER MODAL (SCHEME + DISCOUNTS)
  // ----------------------------------------------------
  const openAddModal = async (initialItems = []) => {
    let supplierOpts = [];
    let medicineList = [];

    try {
      const [supResp, medResp] = await Promise.all([
        supplierService.getAll({ page: 0, size: 100 }),
        medicineService.getAll({ page: 0, size: 200 })
      ]);
      supplierOpts = supResp?.data?.content ?? supResp?.data ?? [];
      medicineList = medResp?.data?.content ?? medResp?.data ?? [];
    } catch (e) {
      console.error('Error fetching suppliers/medicines', e);
    }

    if (!supplierOpts.length) {
      showToast('Please add at least one supplier before creating a purchase order', 'warning');
      return;
    }

    // Default expiry 2 years from today
    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 2);
    const defaultExpiryStr = expDate.toISOString().split('T')[0];

    // Maintain multi-items state
    let items = initialItems.length > 0
      ? initialItems.map((item, idx) => ({
          medicineId: item.medicineId || item.id,
          medicineName: item.name || item.medicineName || 'Selected Item',
          batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDate: defaultExpiryStr,
          quantity: item.suggestedQty || item.quantity || 10,
          freeQuantity: item.freeQuantity || 0,
          scheme: item.scheme || '',
          costPrice: item.costPrice || 25.00,
          discountPercent: 0,
          schemeDiscountPercent: 0,
          taxPercent: 12.0,
          mrp: item.mrp || 40.00
        }))
      : [
          {
            medicineId: medicineList[0]?.id || '',
            medicineName: medicineList[0]?.name || '',
            batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
            expiryDate: defaultExpiryStr,
            quantity: 10,
            freeQuantity: 2,
            scheme: '10+2',
            costPrice: 50.00,
            discountPercent: 0,
            schemeDiscountPercent: 0,
            taxPercent: 12.0,
            mrp: 75.00
          }
        ];

    // Searchable Select options
    const medSelectOptions = medicineList.map(m => ({
      value: m.id,
      label: m.name,
      sublabel: `${m.genericName || ''} · ${m.manufacturer || ''}`,
      badge: m.category || 'MEDICINE'
    }));

    const supplierSelectOptions = supplierOpts.map(s => ({
      value: s.id,
      label: s.name,
      sublabel: `${s.contactPerson || ''} ${s.phone || ''}`.trim(),
      badge: 'SUPPLIER'
    }));

    const generateRowHtml = (it, index) => {
      const bQty = Number(it.quantity) || 10;
      const fQty = Number(it.freeQuantity) || 0;
      const scheme = it.scheme || (fQty > 0 ? `${bQty}+${fQty}` : '');
      const totUnits = bQty + fQty;

      return `
        <tr data-index="${index}" style="border-bottom:1px solid var(--border)">
          <td style="padding:6px;min-width:200px">
            <div class="med-select-mount" data-idx="${index}" data-initial="${it.medicineId || ''}"></div>
          </td>
          <td style="padding:6px">
            <input type="text" class="form-control item-batch" data-idx="${index}" value="${it.batchNumber}" placeholder="Batch #" style="font-size:0.8rem;padding:6px;width:100px" required />
          </td>
          <td style="padding:6px">
            <input type="date" class="form-control item-expiry" data-idx="${index}" value="${it.expiryDate}" style="font-size:0.8rem;padding:6px;width:125px" required />
          </td>
          <td style="padding:6px">
            <input type="number" class="form-control item-qty" data-idx="${index}" min="1" value="${bQty}" style="font-size:0.8rem;padding:6px;width:70px;text-align:right" title="Billed Quantity" required />
          </td>
          <td style="padding:6px">
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" class="form-control item-free-qty" data-idx="${index}" min="0" value="${fQty}" placeholder="Free" title="Free units from scheme (e.g. 2 in 10+2)" style="font-size:0.8rem;padding:6px;width:55px;text-align:right" />
              <input type="text" class="form-control item-scheme" data-idx="${index}" value="${scheme}" placeholder="10+2" title="Scheme notation (e.g. 10+2)" style="font-size:0.75rem;padding:6px;width:60px;text-align:center" />
            </div>
            <div class="item-stock-badge" data-idx="${index}" style="font-size:0.7rem;color:var(--success);font-weight:600;margin-top:2px;white-space:nowrap">
              Stock: ${totUnits}u ${fQty > 0 ? `(${bQty}+${fQty})` : ''}
            </div>
          </td>
          <td style="padding:6px">
            <input type="number" class="form-control item-cost" data-idx="${index}" min="0" step="0.01" value="${it.costPrice}" style="font-size:0.8rem;padding:6px;width:80px;text-align:right" title="Cost Price / Rate per billed unit" required />
          </td>
          <td style="padding:6px">
            <input type="number" class="form-control item-mrp" data-idx="${index}" min="0" step="0.01" value="${it.mrp}" style="font-size:0.8rem;padding:6px;width:80px;text-align:right" required />
          </td>
          <td style="padding:6px">
            <input type="number" class="form-control item-dis" data-idx="${index}" min="0" max="100" step="0.1" value="${it.discountPercent || 0}" placeholder="Dis %" style="font-size:0.8rem;padding:6px;width:55px;text-align:right" title="Item Discount %" />
          </td>
          <td style="padding:6px">
            <input type="number" class="form-control item-sch" data-idx="${index}" min="0" max="100" step="0.1" value="${it.schemeDiscountPercent || 0}" placeholder="Sch %" style="font-size:0.8rem;padding:6px;width:55px;text-align:right" title="Scheme Discount %" />
          </td>
          <td style="padding:6px">
            <input type="number" class="form-control item-tax" data-idx="${index}" min="0" max="100" step="0.5" value="${it.taxPercent != null ? it.taxPercent : 12}" style="font-size:0.8rem;padding:6px;width:55px;text-align:right" title="GST %" />
          </td>
          <td style="padding:6px;text-align:right">
            <div class="item-line-total" data-idx="${index}" style="font-weight:700;font-size:0.85rem;min-width:75px">₹0.00</div>
          </td>
          <td style="padding:6px;text-align:center">
            <button type="button" class="btn btn-sm btn-ghost text-danger remove-item-btn" data-idx="${index}" title="Remove line item">✕</button>
          </td>
        </tr>
      `;
    };

    const modalBodyHtml = `
      <form id="multiPoForm">
        <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 1.2fr;gap:12px;margin-bottom:16px;background:var(--bg-secondary);padding:14px;border-radius:var(--radius);border:1px solid var(--border)">
          <div class="form-group" style="margin:0">
            <label class="form-label">Distributor / Supplier *</label>
            <div id="supplierSelectMount"></div>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Supplier Invoice / PO # *</label>
            <input type="text" class="form-control" name="invoiceNumber" value="INV-${Date.now().toString().slice(-6)}" required />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Invoice Date *</label>
            <input type="date" class="form-control" name="invoiceDate" value="${new Date().toISOString().split('T')[0]}" required />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Overall Bill Discount</label>
            <div style="display:flex;gap:4px">
              <select id="poDiscountType" class="form-control" style="width:75px;padding:6px;font-size:0.8rem">
                <option value="AMOUNT">₹ Flat</option>
                <option value="PERCENT">% Off</option>
              </select>
              <input type="number" id="poDiscountValue" class="form-control" min="0" step="0.01" value="0" placeholder="0.00" style="font-size:0.85rem;padding:6px;text-align:right" />
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px">
          <div>
            <h4 style="margin:0;font-size:0.85rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px">
              Wholesale Line Items (<span id="poItemsCount">${items.length}</span>)
            </h4>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
              Enter Scheme (e.g. 10+2 for 10 purchased + 2 free units), Dis % and Sch % matching your supplier invoice.
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-secondary" id="addNewItemRowBtn">
            + Add Another Item
          </button>
        </div>

        <div class="table-container" style="max-height:290px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px">
          <table class="data-table" style="font-size:0.8rem">
            <thead>
              <tr style="position:sticky;top:0;background:var(--bg-tertiary);z-index:2">
                <th>Medicine *</th>
                <th>Batch # *</th>
                <th>Expiry *</th>
                <th style="text-align:right">Billed Qty *</th>
                <th style="text-align:center" title="Free units & Scheme notation (e.g. 10+2)">Scheme / Free</th>
                <th style="text-align:right">Rate (₹) *</th>
                <th style="text-align:right">MRP (₹) *</th>
                <th style="text-align:right" title="Item Discount %">Dis %</th>
                <th style="text-align:right" title="Scheme Discount %">Sch %</th>
                <th style="text-align:right">GST %</th>
                <th style="text-align:right">Amount (₹)</th>
                <th style="width:36px;text-align:center"></th>
              </tr>
            </thead>
            <tbody id="poRowsContainer">
              ${items.map((it, idx) => generateRowHtml(it, idx)).join('')}
            </tbody>
          </table>
        </div>

        <!-- Live Totals Summary Footer matching wholesale bill -->
        <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;font-size:0.85rem">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:0.8rem">
              <span>Items: <strong id="summaryItemCount">${items.length}</strong></span>
              <span>Billed Units: <strong id="summaryBilledUnits">0</strong></span>
              <span>Free Units: <strong id="summaryFreeUnits" style="color:var(--success)">+0</strong></span>
              <span>Total Inward Stock: <strong id="summaryTotalUnits" style="color:var(--accent);font-weight:700">0 units</strong></span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;font-size:0.8rem">
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Gross Subtotal:</span>
              <strong id="summaryGrossSubtotal">₹0.00</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Line Discounts:</span>
              <span id="summaryItemDiscounts" style="color:var(--danger)">-₹0.00</span>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Taxable Base:</span>
              <strong id="summaryTaxableSubtotal">₹0.00</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">PO Bill Discount:</span>
              <span id="summaryPoDiscount" style="color:var(--danger)">-₹0.00</span>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">GST Payable:</span>
              <strong id="summaryTotalGst" style="color:var(--warning)">+₹0.00</strong>
            </div>
            <div style="text-align:right">
              <span style="color:var(--text-muted);display:block;font-size:0.75rem">Grand Total:</span>
              <strong id="summaryPoTotal" style="color:var(--accent);font-size:1.25rem">₹0.00</strong>
            </div>
          </div>
        </div>
      </form>
    `;

    const modal = showModal({
      title: 'Create Purchase Order (Multi-Item with Scheme & Discounts)',
      body: modalBodyHtml,
      size: 'lg',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Create Purchase Order',
          class: 'btn-primary',
          onClick: async () => {
            const form = document.querySelector('#multiPoForm');
            if (!form.reportValidity()) return;

            // Collect line items
            const rowsEl = form.querySelectorAll('#poRowsContainer tr');
            if (!rowsEl.length) {
              showToast('Please add at least one line item to the purchase order', 'warning');
              return;
            }

            const parsedItems = [];
            for (const r of rowsEl) {
              const medId = r.querySelector('.med-select-mount input[type="hidden"]')?.value || '';
              const batchNumber = r.querySelector('.item-batch').value.trim();
              const expiryDate = r.querySelector('.item-expiry').value;
              const quantity = parseInt(r.querySelector('.item-qty').value, 10);
              const freeQuantity = parseInt(r.querySelector('.item-free-qty')?.value, 10) || 0;
              const scheme = r.querySelector('.item-scheme')?.value.trim() || (freeQuantity > 0 ? `${quantity}+${freeQuantity}` : null);
              const costPrice = parseFloat(r.querySelector('.item-cost').value);
              const mrp = parseFloat(r.querySelector('.item-mrp').value);
              const discountPercent = parseFloat(r.querySelector('.item-dis')?.value) || 0;
              const schemeDiscountPercent = parseFloat(r.querySelector('.item-sch')?.value) || 0;
              const taxPercent = parseFloat(r.querySelector('.item-tax').value) || 0;

              if (!medId) {
                showToast('Please select a medicine for each row', 'warning');
                return;
              }
              if (!batchNumber) {
                showToast('Please provide a batch number for each row', 'warning');
                return;
              }
              if (!expiryDate) {
                showToast('Please select an expiry date for each row', 'warning');
                return;
              }
              if (isNaN(quantity) || quantity <= 0) {
                showToast('Billed quantity must be greater than 0', 'warning');
                return;
              }
              if (isNaN(costPrice) || costPrice < 0) {
                showToast('Cost price must be non-negative', 'warning');
                return;
              }
              if (isNaN(mrp) || mrp < costPrice) {
                showToast('MRP must be equal to or greater than Cost Price', 'warning');
                return;
              }

              parsedItems.push({
                medicineId: medId,
                batchNumber,
                expiryDate,
                quantity,
                freeQuantity,
                scheme,
                costPrice,
                taxPercent,
                discountPercent,
                schemeDiscountPercent,
                mrp
              });
            }

            const supplierId = form.querySelector('#supplierSelectMount input[type="hidden"]')?.value || '';
            if (!supplierId) {
              showToast('Please select a supplier', 'warning');
              return;
            }
            const invoiceNumber = form.querySelector('[name="invoiceNumber"]').value.trim();
            const invoiceDate = form.querySelector('[name="invoiceDate"]').value;

            const poDiscType = form.querySelector('#poDiscountType')?.value || 'AMOUNT';
            const poDiscVal = parseFloat(form.querySelector('#poDiscountValue')?.value) || 0;

            const payload = {
              supplierId,
              invoiceNumber,
              invoiceDate,
              discountPercent: poDiscType === 'PERCENT' ? poDiscVal : 0,
              discountAmount: poDiscType === 'AMOUNT' ? poDiscVal : 0,
              items: parsedItems
            };

            try {
              const res = await purchaseService.create(payload);
              if (res?.success) {
                showToast(`Purchase Order created with ${parsedItems.length} items!`, 'success');
                modal.close();

                // If created from shortage basket, remove ordered medicines from shortage basket
                if (initialItems.length > 0) {
                  const orderedIds = new Set(parsedItems.map(p => p.medicineId));
                  const remaining = getShortageBasket().filter(b => !orderedIds.has(b.id));
                  saveShortageBasket(remaining);
                  updateShortageBadges();
                  if (activeTab === 'shortage') renderShortageTable();
                }

                loadData(0);
              } else {
                showToast(res?.message || 'Failed to create PO', 'error');
              }
            } catch (e) {
              showToast(e.message || 'Error creating PO', 'error');
            }
          }
        }
      ]
    });

    // Mount Searchable Select for Supplier
    const supplierMount = document.querySelector('#supplierSelectMount');
    if (supplierMount) {
      createSearchableSelect(supplierMount, {
        placeholder: '🔍 Search distributor...',
        options: supplierSelectOptions,
        selectedValue: supplierOpts[0]?.id || '',
        name: 'supplierId',
        required: true
      });
    }

    // Helper to calculate totals inside modal
    const recomputeModalTotals = () => {
      const rows = document.querySelectorAll('#poRowsContainer tr');
      let totalBilled = 0;
      let totalFree = 0;
      let totalGross = 0;
      let totalLineDiscounts = 0;
      let totalTaxable = 0;
      let totalTax = 0;

      rows.forEach(r => {
        const qty = parseFloat(r.querySelector('.item-qty')?.value) || 0;
        const freeQty = parseFloat(r.querySelector('.item-free-qty')?.value) || 0;
        const cost = parseFloat(r.querySelector('.item-cost')?.value) || 0;
        const disPct = parseFloat(r.querySelector('.item-dis')?.value) || 0;
        const schPct = parseFloat(r.querySelector('.item-sch')?.value) || 0;
        const taxPct = parseFloat(r.querySelector('.item-tax')?.value) || 0;

        const gross = qty * cost;
        const disAmt = gross * (disPct / 100);
        const schAmt = gross * (schPct / 100);
        const lineDiscAmt = disAmt + schAmt;
        const taxable = Math.max(0, gross - lineDiscAmt);
        const taxAmt = taxable * (taxPct / 100);
        const lineTotal = taxable + taxAmt;

        totalBilled += qty;
        totalFree += freeQty;
        totalGross += gross;
        totalLineDiscounts += lineDiscAmt;
        totalTaxable += taxable;
        totalTax += taxAmt;

        const lineTotalEl = r.querySelector('.item-line-total');
        if (lineTotalEl) lineTotalEl.textContent = formatCurrency(lineTotal);

        const stockBadgeEl = r.querySelector('.item-stock-badge');
        if (stockBadgeEl) {
          const totU = qty + freeQty;
          stockBadgeEl.textContent = `Stock: ${totU}u ${freeQty > 0 ? `(${qty}+${freeQty})` : ''}`;
        }
      });

      // PO-Level Discount
      const discType = document.querySelector('#poDiscountType')?.value || 'AMOUNT';
      const discVal = parseFloat(document.querySelector('#poDiscountValue')?.value) || 0;
      let poDiscAmt = 0;
      if (discType === 'PERCENT') {
        poDiscAmt = totalTaxable * (discVal / 100);
      } else {
        poDiscAmt = Math.min(totalTaxable, discVal);
      }

      const grandTotal = Math.max(0, totalTaxable - poDiscAmt + totalTax);

      const countEl = document.querySelector('#poItemsCount');
      const sumCountEl = document.querySelector('#summaryItemCount');
      const sumBilledEl = document.querySelector('#summaryBilledUnits');
      const sumFreeEl = document.querySelector('#summaryFreeUnits');
      const sumTotalUnitsEl = document.querySelector('#summaryTotalUnits');
      const sumGrossEl = document.querySelector('#summaryGrossSubtotal');
      const sumItemDiscEl = document.querySelector('#summaryItemDiscounts');
      const sumTaxableEl = document.querySelector('#summaryTaxableSubtotal');
      const sumPoDiscEl = document.querySelector('#summaryPoDiscount');
      const sumGstEl = document.querySelector('#summaryTotalGst');
      const sumPoTotalEl = document.querySelector('#summaryPoTotal');

      if (countEl) countEl.textContent = rows.length;
      if (sumCountEl) sumCountEl.textContent = rows.length;
      if (sumBilledEl) sumBilledEl.textContent = totalBilled;
      if (sumFreeEl) sumFreeEl.textContent = `+${totalFree}`;
      if (sumTotalUnitsEl) sumTotalUnitsEl.textContent = `${totalBilled + totalFree} units`;
      if (sumGrossEl) sumGrossEl.textContent = formatCurrency(totalGross);
      if (sumItemDiscEl) sumItemDiscEl.textContent = `-${formatCurrency(totalLineDiscounts)}`;
      if (sumTaxableEl) sumTaxableEl.textContent = formatCurrency(totalTaxable);
      if (sumPoDiscEl) sumPoDiscEl.textContent = `-${formatCurrency(poDiscAmt)}`;
      if (sumGstEl) sumGstEl.textContent = `+${formatCurrency(totalTax)}`;
      if (sumPoTotalEl) sumPoTotalEl.textContent = formatCurrency(grandTotal);
    };

    document.querySelector('#poDiscountType')?.addEventListener('change', recomputeModalTotals);
    document.querySelector('#poDiscountValue')?.addEventListener('input', recomputeModalTotals);

    // Wire add item button
    const rowsContainer = document.querySelector('#poRowsContainer');
    const addNewItemBtn = document.querySelector('#addNewItemRowBtn');

    const attachRowListeners = (row, initialMedId) => {
      const mount = row.querySelector('.med-select-mount');
      if (mount && !mount.hasChildNodes()) {
        const initVal = initialMedId || mount.dataset.initial || medicineList[0]?.id || '';
        createSearchableSelect(mount, {
          placeholder: '🔍 Search medicine...',
          options: medSelectOptions,
          selectedValue: initVal,
          required: true,
          onChange: () => recomputeModalTotals()
        });
      }

      const schemeInput = row.querySelector('.item-scheme');
      const qtyInput = row.querySelector('.item-qty');
      const freeQtyInput = row.querySelector('.item-free-qty');

      if (schemeInput) {
        schemeInput.addEventListener('input', (e) => {
          const val = e.target.value.trim();
          const matchPlus = val.match(/^(\d+)\s*\+\s*(\d+)$/);
          if (matchPlus) {
            if (qtyInput) qtyInput.value = matchPlus[1];
            if (freeQtyInput) freeQtyInput.value = matchPlus[2];
          } else {
            const matchOnlyFree = val.match(/^\+?\s*(\d+)$/);
            if (matchOnlyFree && freeQtyInput) {
              freeQtyInput.value = matchOnlyFree[1];
            }
          }
          recomputeModalTotals();
        });
      }

      if (freeQtyInput) {
        freeQtyInput.addEventListener('input', () => {
          const fq = parseInt(freeQtyInput.value) || 0;
          const q = parseInt(qtyInput?.value) || 0;
          if (fq > 0 && schemeInput && (!schemeInput.value || schemeInput.value.includes('+'))) {
            schemeInput.value = `${q}+${fq}`;
          }
          recomputeModalTotals();
        });
      }

      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', recomputeModalTotals);
      });

      row.querySelector('.remove-item-btn')?.addEventListener('click', () => {
        if (rowsContainer.children.length <= 1) {
          showToast('PO must have at least one line item', 'warning');
          return;
        }
        row.remove();
        recomputeModalTotals();
      });
    };

    if (addNewItemBtn) {
      addNewItemBtn.addEventListener('click', () => {
        const newIdx = rowsContainer.children.length;
        const defaultItem = {
          medicineId: medicineList[0]?.id || '',
          batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDate: defaultExpiryStr,
          quantity: 10,
          freeQuantity: 0,
          scheme: '',
          costPrice: 50.00,
          discountPercent: 0,
          schemeDiscountPercent: 0,
          taxPercent: 12.0,
          mrp: 75.00
        };
        const tempDiv = document.createElement('tbody');
        tempDiv.innerHTML = generateRowHtml(defaultItem, newIdx);
        const newRow = tempDiv.firstElementChild;
        rowsContainer.appendChild(newRow);
        attachRowListeners(newRow, defaultItem.medicineId);
        recomputeModalTotals();
      });
    }

    rowsContainer.querySelectorAll('tr').forEach(r => {
      const initId = r.querySelector('.med-select-mount')?.dataset.initial;
      attachRowListeners(r, initId);
    });
    recomputeModalTotals();
  };

  if (addBtn) addBtn.addEventListener('click', () => openAddModal());

  // ----------------------------------------------------
  // REORDER / SHORTAGE BASKET (PO WISHLIST)
  // ----------------------------------------------------
  const renderShortageTable = () => {
    updateShortageBadges();
    const basket = getShortageBasket();

    if (!basket.length) {
      shortageTableContainer.innerHTML = `
        <div class="empty-state" style="padding:40px 20px">
          <div class="empty-icon">📋</div>
          <div class="empty-text" style="font-weight:600;font-size:1.05rem">Reorder &amp; Shortage Basket is Empty</div>
          <p style="color:var(--text-muted);font-size:0.85rem;max-width:440px;margin:8px auto 16px">
            Keep track of medicines you need to order from distributors. Click <strong>Auto-Scan Low Stock</strong> to pull medicines running low, or add medicines manually.
          </p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="btn btn-primary" id="emptyScanBtn">⚡ Auto-Scan Low Stock</button>
            <button class="btn btn-secondary" id="emptyAddBtn">+ Add Medicine</button>
          </div>
        </div>
      `;

      const emptyScanBtn = shortageTableContainer.querySelector('#emptyScanBtn');
      const emptyAddBtn = shortageTableContainer.querySelector('#emptyAddBtn');
      if (emptyScanBtn) emptyScanBtn.addEventListener('click', scanLowStock);
      if (emptyAddBtn) emptyAddBtn.addEventListener('click', openAddToShortageModal);
      return;
    }

    const rowsHtml = basket.map((item, idx) => `
      <tr data-med-id="${item.id}" style="border-bottom:1px solid var(--border)">
        <td style="width:40px;text-align:center">
          <input type="checkbox" class="shortage-checkbox" data-idx="${idx}" checked />
        </td>
        <td>
          <strong>${item.name}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted)">${item.genericName || '—'} • ${item.category || 'General'}</div>
        </td>
        <td>
          <span class="badge ${item.currentStock <= 0 ? 'badge-danger' : (item.currentStock <= (item.minStockAlertLevel || 10) ? 'badge-warning' : 'badge-info')}">
            ${item.currentStock ?? 0} units
          </span>
        </td>
        <td style="color:var(--text-muted)">${item.minStockAlertLevel || 10} units</td>
        <td>
          <input type="number" class="form-control shortage-qty" data-idx="${idx}" min="1" value="${item.suggestedQty || 50}" style="width:90px;font-size:0.85rem;padding:4px 8px" />
        </td>
        <td>${formatCurrency(item.costPrice || 25.00)}</td>
        <td style="text-align:right">
          <button class="btn btn-sm btn-ghost text-danger remove-shortage-btn" data-idx="${idx}" title="Remove from wishlist">
            🗑️ Remove
          </button>
        </td>
      </tr>
    `).join('');

    shortageTableContainer.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;text-align:center">
                <input type="checkbox" id="selectAllShortage" checked title="Select / Deselect All" />
              </th>
              <th>Medicine Name</th>
              <th>Current Stock</th>
              <th>Alert Level</th>
              <th>Target Order Qty</th>
              <th>Est. Cost Price</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    // Wire select all
    const selectAll = shortageTableContainer.querySelector('#selectAllShortage');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        shortageTableContainer.querySelectorAll('.shortage-checkbox').forEach(cb => {
          cb.checked = e.target.checked;
        });
      });
    }

    // Wire quantity changes
    shortageTableContainer.querySelectorAll('.shortage-qty').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        const newQty = parseInt(e.target.value, 10) || 1;
        const b = getShortageBasket();
        if (b[idx]) {
          b[idx].suggestedQty = newQty;
          saveShortageBasket(b);
        }
      });
    });

    // Wire item remove
    shortageTableContainer.querySelectorAll('.remove-shortage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const b = getShortageBasket();
        b.splice(idx, 1);
        saveShortageBasket(b);
        showToast('Item removed from shortage list', 'info');
        renderShortageTable();
      });
    });
  };

  const openAddToShortageModal = async () => {
    let medicines = [];
    try {
      const resp = await medicineService.getAll({ page: 0, size: 200 });
      medicines = resp?.data?.content ?? resp?.data ?? [];
    } catch (e) {
      console.error(e);
    }

    const fields = [
      {
        name: 'medicineId',
        label: 'Select Medicine *',
        type: 'select',
        required: true,
        options: medicines.map(m => ({ value: m.id, label: `${m.name} (${m.category || 'Medicine'})` }))
      },
      { name: 'suggestedQty', label: 'Desired Order Quantity *', type: 'number', required: true, value: 50 },
      { name: 'costPrice', label: 'Expected Cost Price (₹)', type: 'number', step: '0.01', value: 30.00 }
    ];

    const modal = showModal({
      title: 'Add Medicine to Reorder List',
      body: `<form id="addShortageForm">${buildFormHtml(fields)}</form>`,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => modal.close() },
        {
          label: 'Add to Wishlist',
          class: 'btn-primary',
          onClick: () => {
            const form = document.querySelector('#addShortageForm');
            if (!form.reportValidity()) return;
            const data = getFormData(form);
            const med = medicines.find(m => m.id === data.medicineId);
            if (!med) return;

            const basket = getShortageBasket();
            if (basket.some(b => b.id === med.id)) {
              showToast('Medicine is already in the reorder list', 'info');
              modal.close();
              return;
            }

            basket.push({
              id: med.id,
              name: med.name,
              genericName: med.genericName,
              category: med.category,
              currentStock: 0,
              minStockAlertLevel: med.minStockAlertLevel || 10,
              suggestedQty: Number(data.suggestedQty) || 50,
              costPrice: Number(data.costPrice) || 30.00,
              mrp: (Number(data.costPrice) || 30.00) * 1.4
            });

            saveShortageBasket(basket);
            showToast(`${med.name} added to Reorder List!`, 'success');
            modal.close();
            renderShortageTable();
          }
        }
      ]
    });
  };

  const scanLowStock = async () => {
    try {
      showToast('Scanning inventory for low stock & out-of-stock items...', 'info');
      const resp = await inventoryService.getLowStock();
      const lowItems = Array.isArray(resp?.data) ? resp.data : (resp?.data?.content ?? []);

      if (!lowItems.length) {
        showToast('All medicines are currently well-stocked!', 'success');
        return;
      }

      const basket = getShortageBasket();
      let addedCount = 0;

      lowItems.forEach(item => {
        const medId = item.medicineId || item.id;
        if (!basket.some(b => b.id === medId)) {
          basket.push({
            id: medId,
            name: item.medicineName || item.name || 'Medicine',
            genericName: item.genericName || '',
            category: item.category || 'Medicine',
            currentStock: item.currentStock ?? item.quantity ?? 0,
            minStockAlertLevel: item.minStockAlertLevel || 10,
            suggestedQty: Math.max(50, (item.minStockAlertLevel || 10) * 2),
            costPrice: item.costPrice || 25.00,
            mrp: item.mrp || 40.00
          });
          addedCount++;
        }
      });

      saveShortageBasket(basket);
      showToast(`Scanned and added ${addedCount} low-stock medicines to Reorder List!`, 'success');
      renderShortageTable();
    } catch (e) {
      showToast('Error scanning low stock: ' + (e.message || 'Unknown error'), 'error');
    }
  };

  // Wire shortage toolbar buttons
  const scanLowStockBtn = container.querySelector('#scanLowStockBtn');
  const addItemToShortageBtn = container.querySelector('#addItemToShortageBtn');
  const raisePoFromShortageBtn = container.querySelector('#raisePoFromShortageBtn');
  const clearShortageBtn = container.querySelector('#clearShortageBtn');

  if (scanLowStockBtn) scanLowStockBtn.addEventListener('click', scanLowStock);
  if (addItemToShortageBtn) addItemToShortageBtn.addEventListener('click', openAddToShortageModal);

  if (clearShortageBtn) {
    clearShortageBtn.addEventListener('click', async () => {
      const ok = await confirm('Are you sure you want to clear all items from the Reorder Basket?', { danger: true });
      if (ok) {
        saveShortageBasket([]);
        showToast('Reorder list cleared', 'info');
        renderShortageTable();
      }
    });
  }

  if (raisePoFromShortageBtn) {
    raisePoFromShortageBtn.addEventListener('click', () => {
      const checkboxes = shortageTableContainer.querySelectorAll('.shortage-checkbox:checked');
      if (!checkboxes.length) {
        showToast('Please select at least one item from the shortage list to raise a PO', 'warning');
        return;
      }

      const basket = getShortageBasket();
      const selectedItems = [];
      checkboxes.forEach(cb => {
        const idx = parseInt(cb.getAttribute('data-idx'), 10);
        if (basket[idx]) selectedItems.push(basket[idx]);
      });

      openAddModal(selectedItems);
    });
  }

  // Initial load
  updateShortageBadges();
  loadData();
}
