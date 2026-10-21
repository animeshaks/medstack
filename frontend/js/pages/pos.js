// js/pages/pos.js — Point of Sale (POS) Billing
import { api } from '../api.js';
import { settingsService } from '../services/settingsService.js';
import { getState, setState } from '../state.js';
import { formatCurrency, debounce, generateWhatsAppUrl, renderInvoiceHtml, printInvoice } from '../utils.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';

let cart = [];
let customerMode = 'walkin'; // 'walkin' or 'registered'
let walkinName = 'Walk-in Customer';
let walkinPhone = '';
let selectedCustomer = null;
let selectedDoctor = null;
let discount = 0;
let redeemPointsApplied = 0;

export default function renderPOS(container) {
  // Reset state
  cart = [];
  const preselectedCust = getState('selectedCustomer');
  if (preselectedCust) {
    customerMode = 'registered';
    selectedCustomer = preselectedCust;
    setState('selectedCustomer', null);
  } else {
    customerMode = 'walkin';
    selectedCustomer = null;
  }
  walkinName = 'Walk-in Customer';
  walkinPhone = '';
  selectedDoctor = null;
  discount = 0;
  redeemPointsApplied = 0;

  container.innerHTML = `
    <div class="pos-layout">

      <!-- LEFT: Search + Cart -->
      <div style="display:flex;flex-direction:column;gap:16px;overflow:hidden">

        <!-- Medicine Search -->
        <div class="card" style="padding:16px">
          <div style="position:relative">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <label class="form-label" style="margin-bottom:0">Search Medicine (Press F2 or / to focus)</label>
              <span style="font-size:0.75rem;color:var(--text-muted)">Press Enter to select</span>
            </div>

            <!-- Quick Symptom & Indication Chips -->
            <div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;padding-bottom:4px;align-items:center" id="symptomChipsRow">
              <span style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap">Quick Find:</span>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip active" data-symptom="" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--accent);background:var(--accent-glow, rgba(0,230,153,0.15));color:var(--accent);border-radius:12px">All</button>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip" data-symptom="fever" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--border);border-radius:12px">🔥 Fever</button>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip" data-symptom="cough" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--border);border-radius:12px">🤧 Cold &amp; Cough</button>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip" data-symptom="pain" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--border);border-radius:12px">⚡ Headache &amp; Pain</button>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip" data-symptom="acidity" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--border);border-radius:12px">🤢 Acidity &amp; Gas</button>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip" data-symptom="infection" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--border);border-radius:12px">🦠 Infection</button>
              <button type="button" class="btn btn-sm btn-ghost symptom-chip" data-symptom="" data-age="PEDIATRIC" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--border);border-radius:12px">👶 Pediatric Only</button>
            </div>

            <div style="position:relative">
              <input type="text" id="posMedicineSearch" class="form-control"
                placeholder="Type medicine name, generic name, or symptom (e.g. fever, acidity, pediatric)..." autocomplete="off" />
              <div id="posSearchResults" class="pos-search-results" style="display:none"></div>
            </div>
          </div>
        </div>

        <!-- Cart Panel -->
        <div class="cart-panel" style="flex:1;min-height:0;display:flex;flex-direction:column">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--accent);font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Dispense Cart</span>
              <span id="cartCountBadge" class="badge badge-info" style="font-size:0.7rem">0 items</span>
            </div>
            <button class="btn btn-secondary btn-sm" id="clearCartBtn" style="padding:4px 8px">Clear Cart</button>
          </div>

          <div class="cart-items" id="cartItems" style="flex:1;overflow-y:auto;padding:12px">
            <div class="empty-state" style="padding:40px 16px">
              <div class="empty-icon">🛒</div>
              <div class="empty-text">Cart is empty. Search and add medicines above.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Customer, Doctor, Totals & Checkout -->
      <div class="cart-panel" style="height:100%;overflow-y:auto;display:flex;flex-direction:column">
        <div style="padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="color:var(--accent);font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Billing Details</div>

          <!-- Customer Mode Selection -->
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Customer Type</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <button type="button" class="btn btn-sm btn-primary" id="btnModeWalkin">👤 Walk-in / Counter</button>
              <button type="button" class="btn btn-sm btn-secondary" id="btnModeRegistered">🔍 Registered Account</button>
            </div>
          </div>

          <!-- Walk-in Customer Fields -->
          <div id="walkinSection" style="margin-bottom:12px">
            <div class="form-row" style="margin-bottom:8px">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" style="font-size:0.7rem">Customer Name</label>
                <input type="text" id="walkinNameInput" class="form-control" value="Walk-in Customer" placeholder="Enter customer name" style="font-size:0.85rem" />
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" style="font-size:0.7rem">Phone (optional)</label>
                <input type="text" id="walkinPhoneInput" class="form-control" placeholder="10-digit phone" style="font-size:0.85rem" />
              </div>
            </div>
          </div>

          <!-- Registered Customer Search (hidden by default) -->
          <div id="registeredSection" style="display:none;margin-bottom:12px">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" style="font-size:0.7rem">Search Registered Customer</label>
              <div style="position:relative">
                <input type="text" id="customerSearch" class="form-control" placeholder="Search by name or phone..." autocomplete="off" style="font-size:0.85rem" />
                <div id="customerResults" class="pos-search-results" style="display:none"></div>
              </div>
              <div id="selectedCustomerInfo" style="display:none;margin-top:6px;font-size:0.8rem;padding:6px 10px;background:var(--bg-tertiary);border-radius:var(--radius)"></div>
            </div>
          </div>

          <!-- Doctor / Prescription -->
          <div class="form-group" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label class="form-label" style="margin-bottom:0">Prescribing Doctor</label>
              <span id="rxWarningBadge" class="badge badge-warning" style="display:none;font-size:0.65rem">Rx Required</span>
            </div>
            <div style="position:relative">
              <input type="text" id="doctorSearch" class="form-control" placeholder="Search doctor by name (optional for OTC)..." autocomplete="off" style="font-size:0.85rem" />
              <div id="doctorResults" class="pos-search-results" style="display:none"></div>
            </div>
            <div id="selectedDoctorInfo" style="display:none;margin-top:6px;font-size:0.8rem;padding:6px 10px;background:var(--bg-tertiary);border-radius:var(--radius)"></div>
          </div>

          <!-- Discount -->
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Discount Amount (₹)</label>
            <input type="number" id="discountInput" class="form-control" value="0" min="0" step="0.01" style="font-size:0.85rem" />
          </div>
        </div>

        <!-- Totals & Proceed to Checkout -->
        <div class="cart-totals" id="cartTotals" style="margin-top:auto">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px">
            <span>Subtotal (<span id="totalUnitsCount">0</span> units)</span>
            <span id="subtotalDisplay">₹0.00</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px">
            <span>Taxes (GST)</span>
            <span id="taxDisplay">₹0.00</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">
            <span>Discount Applied</span>
            <span id="discountDisplay" style="color:var(--danger)">-₹0.00</span>
          </div>
          <div class="grand-total">
            <span>Grand Total</span>
            <span id="grandTotalDisplay">₹0.00</span>
          </div>
          <div id="ptsEarnPreview" style="display:none;font-size:0.75rem;color:var(--accent);text-align:right;margin-top:4px"></div>
        </div>

        <div style="padding:16px">
          <button class="btn btn-primary" id="finalizeBillBtn" style="width:100%;padding:14px;font-size:1rem;letter-spacing:0.05em;justify-content:center">
            ⚡ Proceed to Payment (F9)
          </button>
        </div>
      </div>
    </div>
  `;

  // Setup sub-systems
  setupMedicineSearch();
  setupCustomerToggle();
  setupCustomerSearch();
  setupDoctorSearch();

  // Clear cart button
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    cart = [];
    renderCart();
  });

  // Discount input
  document.getElementById('discountInput')?.addEventListener('input', (e) => {
    discount = Math.max(0, parseFloat(e.target.value) || 0);
    updateTotals();
  });

  // Finalize / Checkout button
  document.getElementById('finalizeBillBtn')?.addEventListener('click', openCheckoutModal);

  // Keyboard shortcut handler
  document.addEventListener('keydown', handleKeyboard);
  container._cleanup = () => document.removeEventListener('keydown', handleKeyboard);
}

function handleKeyboard(e) {
  if (e.key === 'F2' || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
    e.preventDefault();
    document.getElementById('posMedicineSearch')?.focus();
  }
  if (e.key === 'F9') {
    e.preventDefault();
    openCheckoutModal();
  }
}

// ── Customer Mode Toggle ───────────────────────────────────────────────────────
function setupCustomerToggle() {
  const btnWalkin = document.getElementById('btnModeWalkin');
  const btnRegistered = document.getElementById('btnModeRegistered');
  const walkinSection = document.getElementById('walkinSection');
  const registeredSection = document.getElementById('registeredSection');

  btnWalkin?.addEventListener('click', () => {
    customerMode = 'walkin';
    btnWalkin.className = 'btn btn-sm btn-primary';
    btnRegistered.className = 'btn btn-sm btn-secondary';
    walkinSection.style.display = 'block';
    registeredSection.style.display = 'none';
    selectedCustomer = null;
    updateTotals();
  });

  btnRegistered?.addEventListener('click', () => {
    customerMode = 'registered';
    btnRegistered.className = 'btn btn-sm btn-primary';
    btnWalkin.className = 'btn btn-sm btn-secondary';
    registeredSection.style.display = 'block';
    walkinSection.style.display = 'none';
    updateTotals();
  });

  if (customerMode === 'registered') {
    if (btnRegistered) btnRegistered.className = 'btn btn-sm btn-primary';
    if (btnWalkin) btnWalkin.className = 'btn btn-sm btn-secondary';
    if (registeredSection) registeredSection.style.display = 'block';
    if (walkinSection) walkinSection.style.display = 'none';
  }

  document.getElementById('walkinNameInput')?.addEventListener('input', (e) => {
    walkinName = e.target.value.trim() || 'Walk-in Customer';
  });

  document.getElementById('walkinPhoneInput')?.addEventListener('input', (e) => {
    walkinPhone = e.target.value.trim();
  });
}

// ── Medicine Search ────────────────────────────────────────────────────────────
function setupMedicineSearch() {
  const input = document.getElementById('posMedicineSearch');
  const results = document.getElementById('posSearchResults');
  const chipsRow = document.getElementById('symptomChipsRow');
  if (!input || !results) return;

  let activeSymptom = '';
  let activeAgeGroup = '';

  const doSearch = debounce(async (q) => {
    const query = q ? q.trim() : '';
    if (query.length < 2 && !activeSymptom && !activeAgeGroup) {
      results.style.display = 'none';
      return;
    }
    results.style.display = 'block';
    results.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:0.8rem">Searching medicines...</div>';

    try {
      let url = `/medicines?page=0&size=15`;
      if (query) url += `&search=${encodeURIComponent(query)}`;
      if (activeSymptom) url += `&symptom=${encodeURIComponent(activeSymptom)}`;
      if (activeAgeGroup) url += `&ageGroup=${encodeURIComponent(activeAgeGroup)}`;

      const resp = await api.get(url);
      const items = resp?.data?.content ?? resp?.data ?? [];

      if (!items.length) {
        results.innerHTML = '<div class="pos-result-item" style="cursor:default;color:var(--text-muted)">No medicines found matching criteria</div>';
        return;
      }

      results.innerHTML = items.map((m, i) => `
        <div class="pos-result-item" data-idx="${i}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-size:0.85rem">
              ${m.name}
              ${m.targetAgeGroup && m.targetAgeGroup !== 'ALL' ? `<span class="badge badge-warning" style="font-size:0.6rem;margin-left:6px">${m.targetAgeGroup}</span>` : ''}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted)">
              ${m.genericName || ''} · <span class="badge badge-info" style="font-size:0.65rem">${m.category || 'GENERAL'}</span>${m.unitsPerPack > 1 ? ` · <strong>${m.unitsPerPack} tabs/strip</strong>` : ''} · Rack: ${m.rackLocation || '—'}
            </div>
            ${m.symptoms ? `<div style="font-size:0.72rem;color:var(--accent);margin-top:2px">🩺 <em>${m.symptoms}</em></div>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge ${Number(m.gstRate) === 0 ? 'badge-success' : 'badge-secondary'}" style="font-size:0.65rem;font-weight:700">GST ${m.gstRate != null ? Number(m.gstRate) : 5}%</span>
            ${m.requiresPrescription ? '<span class="badge badge-warning" style="font-size:0.65rem">Rx</span>' : '<span class="badge badge-secondary" style="font-size:0.65rem">OTC</span>'}
          </div>
        </div>
      `).join('');

      results.querySelectorAll('.pos-result-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          selectMedicine(items[i]);
          results.style.display = 'none';
          input.value = '';
        });
      });
    } catch (err) {
      results.innerHTML = '<div class="pos-result-item" style="cursor:default;color:var(--danger)">Error searching medicines</div>';
    }
  }, 250);

  // Symptom chip clicks
  chipsRow?.querySelectorAll('.symptom-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chipsRow.querySelectorAll('.symptom-chip').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background = 'transparent';
        b.style.color = 'var(--text-primary)';
      });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'var(--accent-glow, rgba(0,230,153,0.15))';
      btn.style.color = 'var(--accent)';

      activeSymptom = btn.dataset.symptom || '';
      activeAgeGroup = btn.dataset.age || '';

      if (activeSymptom || activeAgeGroup) {
        doSearch(input.value);
      } else {
        if (!input.value.trim()) results.style.display = 'none';
        else doSearch(input.value);
      }
    });
  });

  input.addEventListener('input', (e) => doSearch(e.target.value.trim()));

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target) && !chipsRow?.contains(e.target)) results.style.display = 'none';
  });
}

// ── Select Medicine & Fetch Active Batches ────────────────────────────────────
async function selectMedicine(med) {
  // If already in cart, increment quantity by 1 (1 tablet or 1 unit)
  const existingIndex = cart.findIndex(i => i.medicineId === med.id);
  if (existingIndex !== -1) {
    cart[existingIndex].quantity += 1;
    renderCart();
    showToast(`Added 1 more ${cart[existingIndex].isTablet ? 'tablet' : 'unit'} of ${med.name}`, 'info', 1200);
    return;
  }

  // Fetch real active batch price and stock from backend
  let packPrice = 0;
  let batchNo = '—';
  let availablePacks = 0;
  let availableLoose = 0;
  let availableTotalUnits = 0;
  const unitsPerPack = Number(med.unitsPerPack) > 0 ? Number(med.unitsPerPack) : 1;
  const isTablet = (unitsPerPack > 1 || med.category === 'TABLET' || med.category === 'CAPSULE');

  try {
    const batchResp = await api.get(`/inventory/medicine/${med.id}`);
    const batches = Array.isArray(batchResp?.data) ? batchResp.data : [];
    if (batches.length > 0) {
      const b = batches[0]; // Earliest expiry batch (FIFO)
      packPrice = Number(b.sellingPrice) || Number(b.mrp) || 0;
      batchNo = b.batchNumber || '—';
      batches.forEach(item => {
        availablePacks += (item.quantity || 0);
        availableLoose += (item.looseQuantity || 0);
        availableTotalUnits += (item.totalUnits !== undefined ? item.totalUnits : ((item.quantity || 0) * unitsPerPack + (item.looseQuantity || 0)));
      });
    }
  } catch (e) {
    console.warn('Could not fetch active batch pricing, using default', e);
  }

  // For tablets: unit price is per-tablet!
  const defaultDispenseUnit = isTablet ? 'TABLET' : 'UNIT';
  const unitPrice = isTablet && unitsPerPack > 1
    ? Number((packPrice / unitsPerPack).toFixed(2))
    : packPrice;

  // RULE: Selecting 1 as qty means 1 tablet!
  const gstRate = Number(med.gstRate != null ? med.gstRate : 5);
  cart.push({
    medicineId: med.id,
    medicineName: med.name,
    genericName: med.genericName,
    category: med.category,
    requiresPrescription: !!med.requiresPrescription,
    batchNumber: batchNo,
    unitsPerPack: unitsPerPack,
    isTablet: isTablet,
    dispenseUnit: defaultDispenseUnit,
    packPrice: packPrice,
    unitPrice: unitPrice,
    availablePacks: availablePacks,
    availableLoose: availableLoose,
    availableTotalUnits: availableTotalUnits,
    quantity: 1, // ALWAYS default to 1 tablet / 1 unit!
    taxRate: gstRate,
  });

  renderCart();
  checkRxRequirement();
  showToast(`Added 1 ${isTablet ? 'tablet' : 'unit'} of ${med.name} to cart`, 'success', 1500);
}

// ── Check Prescription Requirement ───────────────────────────────────────────
function checkRxRequirement() {
  const hasRx = cart.some(i => i.requiresPrescription);
  const badge = document.getElementById('rxWarningBadge');
  if (badge) badge.style.display = hasRx ? 'inline-block' : 'none';
}

// ── Cart Rendering ─────────────────────────────────────────────────────────────
function renderCart() {
  const cartEl = document.getElementById('cartItems');
  const countBadge = document.getElementById('cartCountBadge');
  if (!cartEl) return;

  if (countBadge) countBadge.textContent = `${cart.length} item${cart.length === 1 ? '' : 's'}`;

  if (cart.length === 0) {
    cartEl.innerHTML = `
      <div class="empty-state" style="padding:40px 16px">
        <div class="empty-icon">🛒</div>
        <div class="empty-text">Cart is empty. Search and add medicines above.</div>
      </div>
    `;
    updateTotals();
    checkRxRequirement();
    return;
  }

  cartEl.innerHTML = cart.map((item, idx) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const isTab = item.isTablet && item.unitsPerPack > 1;

    return `
      <div class="cart-item" style="padding:12px 10px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:6px">
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.medicineName}</span>
              ${item.requiresPrescription ? '<span class="badge badge-warning" style="font-size:0.6rem">Rx</span>' : ''}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:8px;margin-top:3px">
              <span>Batch: <code style="color:var(--accent)">${item.batchNumber}</code></span>
              <span>Rate: <strong style="color:var(--text-primary)">₹${Number(item.unitPrice).toFixed(2)}</strong>/${isTab ? 'tab' : 'unit'} ${isTab ? `<span style="color:var(--text-muted)">(₹${item.packPrice.toFixed(2)}/strip of ${item.unitsPerPack})</span>` : ''}</span>
              <span class="badge ${Number(item.taxRate) === 0 ? 'badge-success' : 'badge-secondary'}" style="font-size:0.65rem;font-weight:700">GST ${item.taxRate != null ? item.taxRate : 5}%</span>
              <span class="badge ${item.availableTotalUnits > 0 ? 'badge-success' : 'badge-danger'}" style="font-size:0.65rem">
                Stock: ${item.availableTotalUnits} ${isTab ? 'tabs' : 'units'} (${item.availablePacks} strips + ${item.availableLoose} loose)
              </span>
            </div>
          </div>

          <!-- Remove button -->
          <button type="button" class="btn btn-sm btn-danger" data-remove="${idx}" title="Remove item" style="padding:2px 6px">✕</button>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px;flex-wrap:wrap">
          <!-- Quick Strip Buttons for Tablets -->
          ${isTab ? `
          <div style="display:flex;align-items:center;gap:4px">
            <button type="button" class="btn btn-sm btn-secondary pos-quick-strip" data-idx="${idx}" data-add="${item.unitsPerPack}" title="Add 1 Strip (+${item.unitsPerPack} tabs)" style="padding:2px 6px;font-size:0.75rem">
              +Strip (${item.unitsPerPack})
            </button>
            <button type="button" class="btn btn-sm btn-secondary pos-set-strip" data-idx="${idx}" data-set="${item.unitsPerPack}" title="Set exactly 1 Strip (${item.unitsPerPack} tabs)" style="padding:2px 6px;font-size:0.75rem">
              1 Strip
            </button>
          </div>` : '<div></div>'}

          <!-- Quantity Controls -->
          <div style="display:flex;align-items:center;gap:4px;margin-left:auto">
            <button type="button" class="btn btn-sm btn-secondary" data-action="dec" data-idx="${idx}" style="padding:3px 8px;min-width:28px">−</button>
            <input type="number" class="form-control pos-qty-input" data-idx="${idx}" value="${item.quantity}" min="1" max="9999"
              style="width:58px;text-align:center;padding:3px 4px;font-size:0.85rem;font-weight:700" />
            <button type="button" class="btn btn-sm btn-secondary" data-action="inc" data-idx="${idx}" style="padding:3px 8px;min-width:28px">+</button>
            <span style="font-size:0.75rem;color:var(--text-muted);min-width:35px">${isTab ? 'tab(s)' : 'unit(s)'}</span>
          </div>

          <!-- Line Subtotal -->
          <div style="min-width:80px;text-align:right;font-weight:700;color:var(--accent);font-size:0.95rem">
            ${formatCurrency(lineSubtotal)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire quick strip add (+10 tabs)
  cartEl.querySelectorAll('.pos-quick-strip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      const add = parseInt(btn.getAttribute('data-add')) || 10;
      cart[idx].quantity += add;
      renderCart();
    });
  });

  // Wire set 1 strip (10 tabs)
  cartEl.querySelectorAll('.pos-set-strip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      const set = parseInt(btn.getAttribute('data-set')) || 10;
      cart[idx].quantity = set;
      renderCart();
    });
  });

  // Wire quantity increment/decrement buttons
  cartEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      const action = btn.getAttribute('data-action');
      if (action === 'inc') {
        cart[idx].quantity += 1;
      } else if (action === 'dec') {
        cart[idx].quantity -= 1;
        if (cart[idx].quantity <= 0) {
          cart.splice(idx, 1);
        }
      }
      renderCart();
    });
  });

  // Wire quantity direct number inputs
  cartEl.querySelectorAll('.pos-qty-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.getAttribute('data-idx'));
      const val = parseInt(inp.value);
      if (isNaN(val) || val <= 0) {
        cart[idx].quantity = 1;
      } else {
        cart[idx].quantity = val;
      }
      renderCart();
    });
  });

  // Wire remove buttons
  cartEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-remove'));
      cart.splice(idx, 1);
      renderCart();
    });
  });

  updateTotals();
  checkRxRequirement();
}

// ── Reactive Totals Calculation ───────────────────────────────────────────────
function updateTotals() {
  const totalUnits = cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const subtotal = cart.reduce((s, i) => s + ((Number(i.unitPrice) || 0) * (Number(i.quantity) || 0)), 0);
  const tax = cart.reduce((s, i) => {
    const lineSubtotal = (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0);
    const rate = Number(i.taxRate != null ? i.taxRate : 5);
    return s + (lineSubtotal * rate / 100);
  }, 0);

  // Enforce 10% rule on reward points redemption
  const maxAllowedPoints = Math.floor(subtotal * 0.10);
  const customerBalance = (customerMode === 'registered' && selectedCustomer) ? (selectedCustomer.rewardPoints || 0) : 0;
  const effectiveMaxPoints = Math.min(customerBalance, maxAllowedPoints);

  const maxBadge = document.getElementById('posMaxPointsBadge');
  if (maxBadge) {
    maxBadge.textContent = `Max: ${effectiveMaxPoints} pts (10% cap)`;
  }

  // Cap points if subtotal decreased below applied points
  if (redeemPointsApplied > effectiveMaxPoints) {
    redeemPointsApplied = effectiveMaxPoints;
  }

  const manualDiscInp = document.getElementById('discountInput');
  const manualDisc = Math.max(0, parseFloat(manualDiscInp?.value) || 0);

  // Total discount = manual discount + redeemed points (₹1 per point)
  discount = manualDisc + redeemPointsApplied;

  const grandTotal = Math.max(0, subtotal + tax - discount);
  const pointsToEarn = Math.floor(grandTotal / 100);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('totalUnitsCount', totalUnits);
  set('subtotalDisplay', formatCurrency(subtotal));
  set('taxDisplay', formatCurrency(tax));
  set('discountDisplay', discount > 0 ? `-${formatCurrency(discount)}` : '₹0.00');
  set('grandTotalDisplay', formatCurrency(grandTotal));

  const notice = document.getElementById('pointsRedeemedNotice');
  const clearPtsBtn = document.getElementById('btnClearPoints');
  const ptsInp = document.getElementById('customRedeemPointsInput');

  if (notice && clearPtsBtn) {
    if (redeemPointsApplied > 0) {
      notice.style.display = 'block';
      notice.textContent = `✓ Redeemed ${redeemPointsApplied} pts as -₹${redeemPointsApplied}.00 discount`;
      clearPtsBtn.style.display = 'inline-block';
      if (ptsInp && !ptsInp.matches(':focus')) ptsInp.value = redeemPointsApplied;
    } else {
      notice.style.display = 'none';
      clearPtsBtn.style.display = 'none';
      if (ptsInp && !ptsInp.matches(':focus')) ptsInp.value = '';
    }
  }

  const ptsPreview = document.getElementById('ptsEarnPreview');
  if (ptsPreview) {
    if (customerMode === 'registered' && selectedCustomer) {
      ptsPreview.style.display = 'block';
      ptsPreview.textContent = `★ Will earn +${pointsToEarn} reward pts (1 pt per ₹100)`;
    } else {
      ptsPreview.style.display = 'none';
    }
  }
}

// ── Customer Search (Registered Mode) ─────────────────────────────────────────
function setupCustomerSearch() {
  const input = document.getElementById('customerSearch');
  const results = document.getElementById('customerResults');
  const info = document.getElementById('selectedCustomerInfo');
  if (!input || !results || !info) return;

  function displaySelectedCustomer(cust) {
    selectedCustomer = cust;
    input.value = cust.name;
    results.style.display = 'none';
    info.style.display = 'block';
    const hasDue = (cust.outstandingBalance || 0) > 0;
    info.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <span><strong>${cust.name}</strong> (${cust.phone || 'No phone'}) · ★ <strong style="color:var(--accent)">${cust.rewardPoints || 0}</strong> pts</span>
          ${hasDue ? `<div style="margin-top:2px;color:var(--danger);font-size:0.75rem;font-weight:700">⚠️ Previous Outstanding Balance: ₹${Number(cust.outstandingBalance).toFixed(2)}</div>` : ''}
        </div>
        <button type="button" class="btn btn-sm btn-danger" id="btnClearCust" style="padding:2px 6px">✕</button>
      </div>
      ${(cust.rewardPoints || 0) > 0 ? `
      <div style="margin-top:8px;padding:8px 10px;background:var(--bg-primary);border:1px dashed var(--accent);border-radius:var(--radius);font-size:0.75rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>★ Balance: <strong style="color:var(--accent)">${cust.rewardPoints}</strong> pts</span>
          <span id="posMaxPointsBadge" class="badge badge-info" style="font-size:0.65rem">Max: 10% of bill</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="customRedeemPointsInput" class="form-control" placeholder="Points" min="0" step="1" style="font-size:0.8rem;padding:4px 8px;width:80px" />
          <button type="button" class="btn btn-sm btn-primary" id="btnApplyCustomPoints" style="padding:4px 8px;font-size:0.75rem">Redeem</button>
          <button type="button" class="btn btn-sm btn-secondary" id="btnApplyMaxPoints" style="padding:4px 8px;font-size:0.75rem">Use Max</button>
          <button type="button" class="btn btn-sm btn-ghost text-danger" id="btnClearPoints" style="padding:4px 6px;font-size:0.75rem;display:none" title="Cancel redemption">✕</button>
        </div>
        <div id="pointsRedeemedNotice" style="display:none;margin-top:4px;color:var(--accent);font-size:0.7rem;font-weight:600"></div>
      </div>` : ''}
    `;

    // Wire custom point redemption buttons
    document.getElementById('btnApplyCustomPoints')?.addEventListener('click', () => {
      const subtotal = cart.reduce((s, it) => s + (Number(it.unitPrice) * Number(it.quantity)), 0);
      const maxAllowed = Math.floor(subtotal * 0.10);
      const effectiveMax = Math.min(selectedCustomer?.rewardPoints || 0, maxAllowed);
      const val = parseInt(document.getElementById('customRedeemPointsInput')?.value, 10);

      if (isNaN(val) || val <= 0) {
        showToast('Please enter a valid positive number of points to redeem', 'warning');
        return;
      }
      if (effectiveMax <= 0) {
        showToast('Bill subtotal must be at least ₹10 to redeem points (10% rule)', 'warning');
        return;
      }
      if (val > effectiveMax) {
        showToast(`Maximum ${effectiveMax} points (10% of bill amount ₹${subtotal.toFixed(2)}) can be redeemed for this bill`, 'warning');
        return;
      }

      redeemPointsApplied = val;
      updateTotals();
      showToast(`Redeemed ${val} points as ₹${val}.00 discount!`, 'success');
    });

    document.getElementById('btnApplyMaxPoints')?.addEventListener('click', () => {
      const subtotal = cart.reduce((s, it) => s + (Number(it.unitPrice) * Number(it.quantity)), 0);
      const maxAllowed = Math.floor(subtotal * 0.10);
      const effectiveMax = Math.min(selectedCustomer?.rewardPoints || 0, maxAllowed);

      if (effectiveMax <= 0) {
        showToast('Bill subtotal must be at least ₹10 to redeem points (10% rule)', 'warning');
        return;
      }

      redeemPointsApplied = effectiveMax;
      updateTotals();
      showToast(`Applied maximum ${effectiveMax} points (-₹${effectiveMax}.00 discount)!`, 'success');
    });

    document.getElementById('btnClearPoints')?.addEventListener('click', () => {
      redeemPointsApplied = 0;
      updateTotals();
      showToast('Points redemption cleared', 'info');
    });

    document.getElementById('btnClearCust')?.addEventListener('click', () => {
      selectedCustomer = null;
      redeemPointsApplied = 0;
      input.value = '';
      info.style.display = 'none';
      updateTotals();
    });

    updateTotals();
  }

  const doSearch = debounce(async (q) => {
    if (q.length < 2) { results.style.display = 'none'; return; }
    results.style.display = 'block';

    const resp = await api.get(`/customers?search=${encodeURIComponent(q)}&page=0&size=8`).catch(() => null);
    const items = resp?.data?.content ?? resp?.data ?? [];

    if (!items.length) {
      results.innerHTML = '<div class="pos-result-item" style="cursor:default;color:var(--text-muted)">No registered customers found</div>';
      return;
    }

    results.innerHTML = items.map((c, i) => `
      <div class="pos-result-item" data-idx="${i}" style="padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between">
        <div>
          <div style="font-weight:600;font-size:0.85rem">${c.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${c.phone || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:0.75rem;color:var(--accent)">★ ${c.rewardPoints || 0} pts</div>
          ${(c.outstandingBalance || 0) > 0 ? `<div style="font-size:0.72rem;color:var(--danger);font-weight:700">Due: ₹${Number(c.outstandingBalance).toFixed(2)}</div>` : ''}
        </div>
      </div>
    `).join('');

    results.querySelectorAll('.pos-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        displaySelectedCustomer(items[i]);
      });
    });
  }, 250);

  // If customer was already pre-selected (e.g. from Customer Detail screen), display them immediately
  if (selectedCustomer) {
    displaySelectedCustomer(selectedCustomer);
  }

  input.addEventListener('input', (e) => doSearch(e.target.value.trim()));
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
  });
}

// ── Doctor Search ─────────────────────────────────────────────────────────────
function setupDoctorSearch() {
  const input = document.getElementById('doctorSearch');
  const results = document.getElementById('doctorResults');
  const info = document.getElementById('selectedDoctorInfo');
  if (!input || !results || !info) return;

  const doSearch = debounce(async (q) => {
    if (q.length < 2) { results.style.display = 'none'; return; }
    results.style.display = 'block';

    const resp = await api.get(`/doctors?search=${encodeURIComponent(q)}&page=0&size=8`).catch(() => null);
    const items = resp?.data?.content ?? resp?.data ?? [];

    if (!items.length) {
      results.innerHTML = '<div class="pos-result-item" style="cursor:default;color:var(--text-muted)">No doctors found</div>';
      return;
    }

    results.innerHTML = items.map((d, i) => `
      <div class="pos-result-item" data-idx="${i}" style="padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer">
        <div style="font-weight:600;font-size:0.85rem">${d.name}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${d.specialization || ''} · ${d.clinicHospitalName || ''}</div>
      </div>
    `).join('');

    results.querySelectorAll('.pos-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        selectedDoctor = items[i];
        input.value = items[i].name;
        results.style.display = 'none';
        info.style.display = 'block';
        info.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span><strong>${items[i].name}</strong> (${items[i].specialization || 'Doctor'})</span>
            <button type="button" class="btn btn-sm btn-danger" id="btnClearDoc" style="padding:2px 6px">✕</button>
          </div>
        `;
        document.getElementById('btnClearDoc')?.addEventListener('click', () => {
          selectedDoctor = null;
          input.value = '';
          info.style.display = 'none';
        });
      });
    });
  }, 250);

  input.addEventListener('input', (e) => doSearch(e.target.value.trim()));
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
  });
}

// ── Open Checkout & Payment Summary Modal (Requirement 3) ──────────────────────
async function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('Cannot checkout: Cart is empty.', 'warning');
    document.getElementById('posMedicineSearch')?.focus();
    return;
  }

  // Prescription validation
  const rxItems = cart.filter(i => i.requiresPrescription);
  if (rxItems.length > 0 && !selectedDoctor) {
    showToast(`Prescription required for: ${rxItems.map(i => i.medicineName).join(', ')}. Please select a prescribing doctor.`, 'warning');
    document.getElementById('doctorSearch')?.focus();
    return;
  }

  const subtotal = cart.reduce((s, i) => s + ((Number(i.unitPrice) || 0) * (Number(i.quantity) || 0)), 0);
  const tax = cart.reduce((s, i) => {
    const lineSubtotal = (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0);
    const rate = Number(i.taxRate != null ? i.taxRate : 5);
    return s + (lineSubtotal * rate / 100);
  }, 0);
  const grandTotal = Math.max(0, subtotal + tax - discount);
  const totalUnits = cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const customerName = customerMode === 'registered' ? (selectedCustomer?.name || 'Registered Customer') : (walkinName || 'Walk-in Customer');
  const customerPhone = customerMode === 'registered' ? (selectedCustomer?.phone || '—') : (walkinPhone || '—');
  const doctorName = selectedDoctor ? `Dr. ${selectedDoctor.name}` : 'Self / OTC';

  // Fetch store settings for UPI ID
  let upiId = 'medstack@upi';
  let storeName = 'MedStack Pharmacy';
  try {
    const sResp = await settingsService.getSettings();
    if (sResp?.upiId) upiId = sResp.upiId;
    if (sResp?.storeName) storeName = sResp.storeName;
  } catch (e) {}

  let currentPaymentType = 'FULL'; // 'FULL' | 'PARTIAL' | 'PAY_LATER'
  let currentPaidAmount = grandTotal;
  let currentPaymentMode = 'CASH';
  const existingBalance = (customerMode === 'registered' && selectedCustomer) ? Number(selectedCustomer.outstandingBalance || 0) : 0;

  const checkoutModal = showModal({
    title: `Bill Checkout & Payment Settlement`,
    size: 'lg',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Top: Customer & Doctor Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius);font-size:0.85rem">
          <div>
            <div style="color:var(--text-muted);font-size:0.75rem">Customer</div>
            <strong style="color:var(--text-primary)">${customerName}</strong>
            <span style="color:var(--text-muted)">(${customerPhone})</span>
            ${existingBalance > 0 ? `<div style="color:var(--danger);font-size:0.75rem;font-weight:700;margin-top:2px">⚠️ Current Outstanding Due: ${formatCurrency(existingBalance)}</div>` : ''}
            ${redeemPointsApplied > 0 ? `<div style="color:var(--accent);font-size:0.75rem">★ Redeemed ${redeemPointsApplied} reward points</div>` : ''}
          </div>
          <div>
            <div style="color:var(--text-muted);font-size:0.75rem">Prescribing Doctor</div>
            <strong style="color:var(--text-primary)">${doctorName}</strong>
          </div>
        </div>

        <!-- Middle: Items Summary Table -->
        <div class="table-container" style="max-height:160px;overflow-y:auto">
          <table class="data-table" style="font-size:0.85rem">
            <thead>
              <tr>
                <th>Medicine</th>
                <th style="text-align:center">Batch</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Rate</th>
                <th style="text-align:center">GST</th>
                <th style="text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map(it => `
                <tr>
                  <td><strong>${it.medicineName}</strong></td>
                  <td style="text-align:center"><code>${it.batchNumber}</code></td>
                  <td style="text-align:center"><strong>${it.quantity}</strong> ${it.isTablet ? 'tab(s)' : 'unit(s)'}</td>
                  <td style="text-align:right">₹${Number(it.unitPrice).toFixed(2)}</td>
                  <td style="text-align:center"><span class="badge ${Number(it.taxRate) === 0 ? 'badge-success' : 'badge-secondary'}" style="font-size:0.7rem;font-weight:700">${it.taxRate != null ? it.taxRate : 5}%</span></td>
                  <td style="text-align:right"><strong>${formatCurrency(it.unitPrice * it.quantity)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Financial Summary Banner -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
          <div style="font-size:0.85rem;color:var(--text-secondary)">
            <span>Subtotal: <strong>${formatCurrency(subtotal)}</strong></span> · 
            <span>Taxes (GST): <strong style="color:var(--info)">${formatCurrency(tax)}</strong></span> · 
            <span>Discount: <strong style="color:var(--danger)">-${formatCurrency(discount)}</strong></span> · 
            <span>Items: <strong>${cart.length} (${totalUnits} units)</strong></span>
          </div>
          <div style="text-align:right">
            <span style="font-size:0.8rem;color:var(--text-muted);display:block">TOTAL BILL AMOUNT</span>
            <span style="font-size:1.5rem;font-weight:800;color:var(--accent)">${formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <!-- Payment Type Selection (Full / Partial / Pay Later) -->
        <div>
          <label class="form-label" style="font-size:0.85rem;font-weight:700">Payment Option</label>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px" id="payTypeTabs">
            <button type="button" class="btn btn-primary pay-type-tab" data-type="FULL">🟢 Full Payment</button>
            <button type="button" class="btn btn-secondary pay-type-tab" data-type="PARTIAL">🟡 Partial Payment</button>
            <button type="button" class="btn btn-secondary pay-type-tab" data-type="PAY_LATER">🔴 Pay Later (Due / Khata)</button>
          </div>
        </div>

        <!-- Partial / Pay Later Details Dynamic Box -->
        <div id="paymentBreakdownPanel" style="display:none;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px dashed var(--accent)"></div>

        <!-- Walk-in Customer Contact Notice when Due exists -->
        <div id="walkinDueWarning" style="display:none;padding:12px;background:rgba(239, 68, 68, 0.08);border:1px solid var(--danger);border-radius:var(--radius);font-size:0.8rem">
          <div style="font-weight:700;color:var(--danger);margin-bottom:4px">⚠️ Customer Phone Number Required for Dues</div>
          <div style="color:var(--text-secondary);margin-bottom:8px">Credit/dues must be linked to a contact number for ledger tracking and collection.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label class="form-label" style="font-size:0.75rem;margin-bottom:2px">Customer Name</label>
              <input type="text" id="checkoutCustNameInput" class="form-control" placeholder="Customer Name" value="${customerName !== 'Walk-in Customer' ? customerName : ''}" />
            </div>
            <div>
              <label class="form-label" style="font-size:0.75rem;margin-bottom:2px">Mobile Phone Number *</label>
              <input type="text" id="checkoutCustPhoneInput" class="form-control" placeholder="10-digit Phone #" value="${customerPhone !== '—' ? customerPhone : ''}" />
            </div>
          </div>
        </div>

        <!-- Payment Mode Selection Container (hidden when Pay Later) -->
        <div id="paymentModeSection">
          <div>
            <label class="form-label" style="font-size:0.85rem;font-weight:700" id="payModeLabel">Select Payment Mode (Paying: ${formatCurrency(grandTotal)})</label>
            <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px" id="payModeTabs">
              <button type="button" class="btn btn-primary pay-tab" data-mode="CASH">💵 Cash</button>
              <button type="button" class="btn btn-secondary pay-tab" data-mode="UPI">📱 UPI / QR</button>
              <button type="button" class="btn btn-secondary pay-tab" data-mode="CARD">💳 Card</button>
              <button type="button" class="btn btn-secondary pay-tab" data-mode="NETBANKING">🏦 Bank</button>
            </div>
          </div>

          <!-- Payment Details Dynamic Panel -->
          <div id="paymentDetailsPanel" style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid var(--border);margin-top:10px">
          </div>
        </div>

      </div>
    `,
    buttons: [
      { label: '← Back to Cart', class: 'btn-secondary', onClick: () => checkoutModal.close() },
      {
        label: '✓ Confirm & Complete Sale',
        class: 'btn-primary',
        id: 'btnConfirmCheckout',
        onClick: async () => {
          await submitFinalBill(checkoutModal, currentPaymentMode, currentPaymentType, currentPaidAmount, grandTotal);
        }
      }
    ]
  });

  const breakdownPanel = document.getElementById('paymentBreakdownPanel');
  const walkinDueWarning = document.getElementById('walkinDueWarning');
  const payModeSection = document.getElementById('paymentModeSection');
  const payModeLabel = document.getElementById('payModeLabel');

  const checkWalkinDueContact = () => {
    const isDue = currentPaymentType === 'PARTIAL' || currentPaymentType === 'PAY_LATER';
    const isWalkinWithoutPhone = customerMode === 'walkin' && !walkinPhone;
    if (walkinDueWarning) {
      walkinDueWarning.style.display = (isDue && isWalkinWithoutPhone) ? 'block' : 'none';
    }
  };

  const renderPayModePanel = (mode) => {
    currentPaymentMode = mode;
    const panel = document.getElementById('paymentDetailsPanel');
    if (!panel) return;

    const amountToCollect = currentPaymentType === 'PARTIAL' ? currentPaidAmount : grandTotal;
    if (payModeLabel) {
      payModeLabel.textContent = `Select Payment Mode (Collecting: ${formatCurrency(amountToCollect)})`;
    }

    if (mode === 'CASH') {
      panel.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">
          <div>
            <label class="form-label" style="font-size:0.8rem">Cash Tendered / Received (₹)</label>
            <input type="number" id="cashReceivedInput" class="form-control" value="${amountToCollect.toFixed(2)}" min="0" step="1" style="font-size:1.1rem;font-weight:700" />
          </div>
          <div>
            <label class="form-label" style="font-size:0.8rem">Change to Return</label>
            <div id="changeReturnDisplay" style="font-size:1.2rem;font-weight:800;color:var(--accent);padding:8px 0">₹0.00</div>
          </div>
        </div>
      `;
      const cashInp = document.getElementById('cashReceivedInput');
      const changeEl = document.getElementById('changeReturnDisplay');
      cashInp?.addEventListener('input', () => {
        const tendered = parseFloat(cashInp.value) || 0;
        const change = tendered - amountToCollect;
        if (change >= 0) {
          changeEl.textContent = formatCurrency(change);
          changeEl.style.color = 'var(--accent)';
        } else {
          changeEl.textContent = `Short by ${formatCurrency(Math.abs(change))}`;
          changeEl.style.color = 'var(--danger)';
        }
      });
      cashInp?.focus();
      cashInp?.select();
    } else if (mode === 'UPI') {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(storeName)}&am=${amountToCollect.toFixed(2)}&cu=INR&tn=MedStack Invoice`;
      panel.innerHTML = `
        <div style="display:flex;gap:16px;align-items:center">
          <div style="background:#fff;padding:8px;border-radius:var(--radius);text-align:center;box-shadow:var(--shadow)">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(upiUrl)}" alt="UPI QR" style="width:130px;height:130px;display:block" onerror="this.parentElement.innerHTML='<div style=\\'width:130px;height:130px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-size:0.7rem;text-align:center\\'>Scan to Pay ${formatCurrency(amountToCollect)}</div>'" />
          </div>
          <div style="flex:1">
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:4px">UPI Merchant ID: <strong style="color:var(--text-primary)">${upiId}</strong></div>
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">Pay Amount: <strong style="color:var(--accent);font-size:1.1rem">${formatCurrency(amountToCollect)}</strong></div>
            <label class="form-label" style="font-size:0.75rem">UPI Transaction ID / UTR (optional)</label>
            <input type="text" id="upiRefInput" class="form-control" placeholder="e.g. 428910284912" style="font-size:0.85rem" />
          </div>
        </div>
      `;
    } else if (mode === 'CARD') {
      panel.innerHTML = `
        <div>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">Swipe / Dip / Tap card for <strong>${formatCurrency(amountToCollect)}</strong> on POS terminal.</div>
          <label class="form-label" style="font-size:0.75rem">Card Approval Code / Transaction Ref (optional)</label>
          <input type="text" id="cardRefInput" class="form-control" placeholder="e.g. TXN-98421" style="font-size:0.85rem" />
        </div>
      `;
    } else if (mode === 'NETBANKING') {
      panel.innerHTML = `
        <div>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">Direct bank transfer for <strong>${formatCurrency(amountToCollect)}</strong>.</div>
          <label class="form-label" style="font-size:0.75rem">Bank Reference Number</label>
          <input type="text" id="netRefInput" class="form-control" placeholder="e.g. NEFT/IMPS Ref #" style="font-size:0.85rem" />
        </div>
      `;
    }
  };

  const updatePaymentType = (type) => {
    currentPaymentType = type;
    document.querySelectorAll('.pay-type-tab').forEach(b => {
      b.className = (b.getAttribute('data-type') === type) ? 'btn btn-primary pay-type-tab' : 'btn btn-secondary pay-type-tab';
    });

    checkWalkinDueContact();

    if (type === 'FULL') {
      currentPaidAmount = grandTotal;
      if (breakdownPanel) breakdownPanel.style.display = 'none';
      if (payModeSection) payModeSection.style.display = 'block';
      renderPayModePanel(currentPaymentMode);
    } else if (type === 'PARTIAL') {
      if (currentPaidAmount >= grandTotal || currentPaidAmount <= 0) {
        currentPaidAmount = Math.max(1, Math.round(grandTotal / 2));
      }
      if (breakdownPanel) {
        breakdownPanel.style.display = 'block';
        breakdownPanel.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">
            <div>
              <label class="form-label" style="font-size:0.8rem;margin-bottom:4px">Amount to Pay Now (₹) *</label>
              <input type="number" id="partialPayNowInput" class="form-control" value="${currentPaidAmount.toFixed(2)}" min="0.01" max="${(grandTotal - 0.01).toFixed(2)}" step="0.01" style="font-size:1.1rem;font-weight:bold" />
            </div>
            <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius);border:1px solid var(--border)">
              <div style="font-size:0.75rem;color:var(--text-muted)">Remaining Balance Due</div>
              <div id="remainingDueDisplay" style="font-size:1.2rem;font-weight:800;color:var(--danger)">${formatCurrency(grandTotal - currentPaidAmount)}</div>
            </div>
          </div>
          ${existingBalance > 0 ? `
          <div style="margin-top:8px;font-size:0.75rem;color:var(--text-secondary);display:flex;justify-content:space-between">
            <span>Previous Outstanding: <strong style="color:var(--danger)">${formatCurrency(existingBalance)}</strong></span>
            <span>New Customer Total Due: <strong id="newTotalDueDisplay" style="color:var(--danger)">${formatCurrency(existingBalance + (grandTotal - currentPaidAmount))}</strong></span>
          </div>` : ''}
        `;

        const pInp = document.getElementById('partialPayNowInput');
        const rDisp = document.getElementById('remainingDueDisplay');
        const nDisp = document.getElementById('newTotalDueDisplay');

        pInp?.addEventListener('input', () => {
          let val = parseFloat(pInp.value);
          if (isNaN(val) || val < 0) val = 0;
          if (val >= grandTotal) val = grandTotal - 0.01;
          currentPaidAmount = val;
          const rem = Math.max(0, grandTotal - currentPaidAmount);
          if (rDisp) rDisp.textContent = formatCurrency(rem);
          if (nDisp) nDisp.textContent = formatCurrency(existingBalance + rem);
          renderPayModePanel(currentPaymentMode);
        });
      }
      if (payModeSection) payModeSection.style.display = 'block';
      renderPayModePanel(currentPaymentMode);
    } else if (type === 'PAY_LATER') {
      currentPaidAmount = 0;
      if (breakdownPanel) {
        breakdownPanel.style.display = 'block';
        breakdownPanel.innerHTML = `
          <div style="padding:10px 14px;background:rgba(239, 68, 68, 0.08);border-radius:var(--radius);border:1px solid var(--danger);text-align:center">
            <div style="font-weight:700;color:var(--danger);font-size:0.95rem">Pay Later / Credit: ${formatCurrency(grandTotal)}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">No payment collected now. Bill will be recorded in customer khata/due ledger as PENDING.</div>
            ${existingBalance > 0 ? `
            <div style="margin-top:6px;font-size:0.8rem;color:var(--text-primary)">
              Previous Due: <strong>${formatCurrency(existingBalance)}</strong> → New Total Due: <strong style="color:var(--danger)">${formatCurrency(existingBalance + grandTotal)}</strong>
            </div>` : ''}
          </div>
        `;
      }
      if (payModeSection) payModeSection.style.display = 'none';
    }
  };

  // Wire payment type tabs
  document.querySelectorAll('.pay-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      updatePaymentType(tab.getAttribute('data-type'));
    });
  });

  // Wire mode tabs
  document.querySelectorAll('.pay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pay-tab').forEach(t => {
        t.className = 'btn btn-secondary pay-tab';
      });
      tab.className = 'btn btn-primary pay-tab';
      renderPayModePanel(tab.getAttribute('data-mode'));
    });
  });

  renderPayModePanel('CASH');
}

// ── Submit Final Bill & Process Receipt ────────────────────────────────────────
async function submitFinalBill(checkoutModal, paymentMode, paymentType, paidAmount, grandTotal) {
  const confirmBtn = document.getElementById('btnConfirmCheckout');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing Sale...';
  }

  // Handle customer contact for partial or pay-later credit
  let finalCustName = customerMode === 'registered' ? (selectedCustomer?.name || null) : (walkinName || 'Walk-in Customer');
  let finalCustPhone = customerMode === 'registered' ? (selectedCustomer?.phone || null) : (walkinPhone || null);

  if (paymentType === 'PARTIAL' || paymentType === 'PAY_LATER') {
    const modalNameInp = document.getElementById('checkoutCustNameInput');
    const modalPhoneInp = document.getElementById('checkoutCustPhoneInput');
    if (modalNameInp?.value.trim()) finalCustName = modalNameInp.value.trim();
    if (modalPhoneInp?.value.trim()) finalCustPhone = modalPhoneInp.value.trim();

    if (!finalCustPhone) {
      showToast('A customer phone number is required to record dues in credit ledger.', 'warning');
      document.getElementById('checkoutCustPhoneInput')?.focus();
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✓ Confirm & Complete Sale';
      }
      return;
    }
  }

  // Determine final paidAmount
  let finalPaidAmount = grandTotal;
  if (paymentType === 'PAY_LATER') {
    finalPaidAmount = 0;
  } else if (paymentType === 'PARTIAL') {
    finalPaidAmount = Math.max(0, Number(paidAmount) || 0);
  }

  // Extract transaction ref if present
  let txnRef = null;
  if (paymentType !== 'PAY_LATER') {
    if (paymentMode === 'UPI') {
      txnRef = document.getElementById('upiRefInput')?.value.trim() || null;
    } else if (paymentMode === 'CARD') {
      txnRef = document.getElementById('cardRefInput')?.value.trim() || null;
    } else if (paymentMode === 'NETBANKING') {
      txnRef = document.getElementById('netRefInput')?.value.trim() || null;
    }
  }

  try {
    const manualDiscAmt = Math.max(0, parseFloat(document.getElementById('discountInput')?.value) || 0);
    const payload = {
      customerId: customerMode === 'registered' ? (selectedCustomer?.id ?? null) : null,
      customerName: finalCustName,
      customerPhone: finalCustPhone,
      prescribingDoctorId: selectedDoctor?.id ?? null,
      discountAmount: manualDiscAmt,
      paymentMethod: paymentType === 'PAY_LATER' ? 'CASH' : (paymentMode || 'CASH'),
      transactionRef: txnRef,
      paidAmount: finalPaidAmount,
      items: cart.map(i => ({
        medicineId: i.medicineId,
        quantity: i.quantity,
        dispenseUnit: i.dispenseUnit || (i.isTablet ? 'TABLET' : 'UNIT'),
      })),
      redeemPoints: redeemPointsApplied,
    };

    const resp = await api.post('/bills', payload);

    if (resp?.success) {
      checkoutModal.close();
      const bill = resp.data;
      const storeSettings = await settingsService.getSettings();
      const waUrl = generateWhatsAppUrl(bill, storeSettings);

      // Show comprehensive invoice modal
      const receiptModal = showModal({
        title: `Receipt: ${bill.billNumber}`,
        size: 'lg',
        body: `
          <div style="width:100%">
            ${renderInvoiceHtml(bill, storeSettings)}
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap">
              <a href="${waUrl}" target="_blank" class="btn btn-secondary">📱 Send WhatsApp Bill</a>
              <button id="btnPosPrintInvoice" class="btn btn-primary">🖨️ Print Tax Invoice</button>
            </div>
          </div>
        `,
        buttons: [
          {
            label: 'New Transaction',
            class: 'btn-primary',
            onClick: () => {
              receiptModal.close();
              resetPos();
            }
          }
        ]
      });

      document.getElementById('btnPosPrintInvoice')?.addEventListener('click', () => {
        printInvoice(bill, storeSettings);
      });

      resetPos();
      if (bill.dueAmount > 0) {
        showToast(`Bill created! Collected: ${formatCurrency(bill.paidAmount)}, Due: ${formatCurrency(bill.dueAmount)}`, 'info', 4000);
      } else {
        showToast('Bill finalized and payment processed successfully!', 'success');
      }
    } else {
      showToast(resp?.message || 'Failed to finalize bill', 'error');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✓ Confirm & Complete Sale';
      }
    }
  } catch (err) {
    showToast('Transaction error: ' + (err.message || 'Unknown error'), 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '✓ Confirm & Complete Sale';
    }
  }
}

function resetPos() {
  cart = [];
  selectedCustomer = null;
  selectedDoctor = null;
  discount = 0;
  redeemPointsApplied = 0;
  const medSearch = document.getElementById('posMedicineSearch');
  if (medSearch) medSearch.value = '';
  const discInp = document.getElementById('discountInput');
  if (discInp) discInp.value = '0';
  if (document.getElementById('walkinNameInput')) document.getElementById('walkinNameInput').value = 'Walk-in Customer';
  if (document.getElementById('walkinPhoneInput')) document.getElementById('walkinPhoneInput').value = '';
  if (document.getElementById('selectedCustomerInfo')) document.getElementById('selectedCustomerInfo').style.display = 'none';
  if (document.getElementById('selectedDoctorInfo')) document.getElementById('selectedDoctorInfo').style.display = 'none';
  renderCart();
  document.getElementById('posMedicineSearch')?.focus();
}
