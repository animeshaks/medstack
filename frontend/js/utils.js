// js/utils.js — shared utility functions

export function formatCurrency(amount) {
  if (amount == null) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function extractPage(resp) {
  // Handles both Spring Page and plain array responses
  if (!resp || !resp.data) return { content: [], page: null };
  if (Array.isArray(resp.data)) return { content: resp.data, page: null };
  if (resp.data.content !== undefined) return { content: resp.data.content, page: resp.data };
  return { content: [], page: null };
}

export function generateWhatsAppUrl(bill, storeSettings = null) {
  const storeName = bill.storeName || storeSettings?.storeName || 'MedStack Pharmacy';
  const customerName = bill.customerName || (bill.customer ? bill.customer.name : 'Walk-in Customer');
  const paid = bill.paidAmount != null ? bill.paidAmount : (bill.paymentStatus === 'PENDING' ? 0 : bill.grandTotal);
  const due = bill.dueAmount != null ? bill.dueAmount : Math.max(0, bill.grandTotal - paid);
  let dueText = '';
  if (due > 0 || bill.paymentStatus !== 'PAID') {
    dueText = `\nPaid: ${formatCurrency(paid)}\nDue: ${formatCurrency(due)}\nStatus: ${bill.paymentStatus}`;
  }
  const msg = `*${storeName} — Invoice*\nBill No: ${bill.billNumber}\nCustomer: ${customerName}\nAmount: ${formatCurrency(bill.grandTotal)}${dueText}\nDate: ${formatDateTime(bill.createdAt)}\nThank you for choosing us!`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Render clean, professional on-screen invoice HTML
 */
export function renderInvoiceHtml(bill, settings = {}) {
  const storeName = bill.storeName || settings?.storeName || 'MedStack Pharmacy';
  const tagline = settings?.tagline || 'Retail Chemists & Druggists';
  const fullAddress = bill.storeAddress || [settings?.address, settings?.city, settings?.state, settings?.pincode].filter(Boolean).join(', ') || 'Shop #12, Health Plaza, 100 Feet Road, Indiranagar, Bengaluru - 560038';
  const phone = bill.storePhone || settings?.phone || '+91 98765 43210';
  const email = bill.storeEmail || settings?.email || 'contact@medstackpharma.in';
  const gstin = bill.storeGstin || settings?.gstin || '29AABCS1429B1ZV';
  const dlNumber = bill.storeDlNumber || settings?.dlNumber || 'KA-BLR-2024-1029';
  const footerNote = settings?.footerNote || 'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!';

  const s = {
    storeName,
    tagline,
    address: fullAddress,
    phone,
    email,
    gstin,
    dlNumber,
    footerNote
  };

  const customerName = bill.customerName || (bill.customer ? bill.customer.name : 'Walk-in Customer');
  const customerPhone = bill.customerPhone || (bill.customer ? bill.customer.phone : '-');
  const doctorName = bill.prescribingDoctorName ? `Dr. ${bill.prescribingDoctorName}` : 'Self / OTC';
  const cashier = bill.createdBy || 'Staff';
  const dateStr = formatDateTime(bill.createdAt);
  const payments = bill.payments || [];
  const paymentMethodStr = payments.length > 0
    ? payments.map(p => `${p.paymentMethod} (₹${Number(p.amount).toFixed(2)})`).join(', ')
    : (bill.paymentStatus || 'PAID');

  const itemsHtml = (bill.items || []).map((it, idx) => `
    <tr>
      <td style="text-align:center;color:var(--text-muted)">${idx + 1}</td>
      <td>
        <strong style="color:var(--text-primary)">${it.medicineName || 'Medicine'}</strong>
      </td>
      <td style="text-align:center"><code style="font-size:0.75rem">${it.batchNumber || '—'}</code></td>
      <td style="text-align:center">${it.expiryDate ? formatDate(it.expiryDate) : '—'}</td>
      <td style="text-align:center">
        <strong>${it.quantity}</strong> ${it.dispenseUnit ? `<span style="font-size:0.75rem;color:var(--text-muted)">${it.dispenseUnit.toLowerCase()}</span>` : ''}
      </td>
      <td style="text-align:right">${formatCurrency(it.unitPrice)}</td>
      <td style="text-align:right"><strong>${formatCurrency(it.subtotal)}</strong></td>
    </tr>
  `).join('');

  return `
    <div class="invoice-container" style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius);padding:20px;font-family:var(--font-mono);max-width:100%">
      <!-- Store Header -->
      <div style="text-align:center;border-bottom:1px dashed var(--border-bright);padding-bottom:14px;margin-bottom:14px">
        <div style="font-size:1.35rem;font-weight:800;color:var(--accent);letter-spacing:0.5px">${s.storeName}</div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px">${s.tagline}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${fullAddress}</div>
        <div style="display:flex;justify-content:center;gap:16px;font-size:0.75rem;color:var(--text-muted);margin-top:4px;flex-wrap:wrap">
          <span>📞 ${s.phone}</span>
          <span>📧 ${s.email}</span>
          <span><strong>GSTIN:</strong> ${s.gstin}</span>
          <span><strong>D.L. No:</strong> ${s.dlNumber}</span>
        </div>
        <div style="margin-top:10px">
          <span style="font-size:0.8rem;font-weight:700;background:var(--accent-glow);color:var(--accent);padding:3px 12px;border-radius:4px;border:1px solid var(--accent);text-transform:uppercase">
            Tax Invoice / Cash Memo
          </span>
        </div>
      </div>

      <!-- Bill & Customer Meta Info -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;background:var(--bg-secondary);padding:12px;border-radius:var(--radius);border:1px solid var(--border-color);margin-bottom:14px;font-size:0.8rem">
        <div>
          <div style="color:var(--text-muted)">Invoice Number</div>
          <div style="font-size:0.95rem;font-weight:700;color:var(--accent)">${bill.billNumber}</div>
          <div style="color:var(--text-muted);margin-top:6px">Date &amp; Time</div>
          <div style="font-weight:600">${dateStr}</div>
          <div style="color:var(--text-muted);margin-top:6px">Billed By</div>
          <div>${cashier}</div>
        </div>
        <div>
          <div style="color:var(--text-muted)">Customer Name</div>
          <div style="font-size:1rem;font-weight:700;color:var(--accent)">👤 ${customerName}</div>
          <div style="color:var(--text-muted);margin-top:6px">Phone Number</div>
          <div style="font-weight:600">${customerPhone}</div>
          <div style="color:var(--text-muted);margin-top:6px">Doctor</div>
          <div>🩺 ${doctorName}</div>
        </div>
      </div>

      <!-- Itemized Table -->
      <div class="table-container" style="margin-bottom:14px">
        <table class="data-table" style="font-size:0.8rem;width:100%">
          <thead>
            <tr>
              <th style="width:35px;text-align:center">#</th>
              <th>Medicine</th>
              <th style="text-align:center">Batch</th>
              <th style="text-align:center">Expiry</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Price</th>
              <th style="text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="7" style="text-align:center">No items</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Totals & Payment Summary -->
      <div style="display:flex;justify-content:space-between;gap:16px;border-top:1px dashed var(--border-bright);padding-top:12px;flex-wrap:wrap">
        <div style="font-size:0.8rem;color:var(--text-muted);min-width:240px;flex:1">
          <div><strong style="color:var(--text-primary)">Payment Status:</strong> <span class="badge ${bill.paymentStatus === 'PAID' ? 'badge-success' : (bill.paymentStatus === 'PARTIAL' ? 'badge-warning' : 'badge-danger')}">${bill.paymentStatus || 'PAID'}</span></div>
          ${bill.earnedPoints > 0 ? `<div style="margin-top:4px;color:var(--accent);font-weight:600">★ Earned Today: +${bill.earnedPoints} Reward Pts</div>` : ''}

          <!-- Detailed Payments Collected History -->
          ${payments.length > 0 ? `
          <div style="margin-top:10px;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);max-width:440px">
            <div style="font-weight:700;font-size:0.75rem;color:var(--accent);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">
              💳 Payment Collections History
            </div>
            <table style="width:100%;font-size:0.75rem;border-collapse:collapse">
              <thead>
                <tr style="color:var(--text-muted);border-bottom:1px solid var(--border)">
                  <th style="text-align:left;padding:3px 4px">Collected Date &amp; Time</th>
                  <th style="text-align:left;padding:3px 4px">Mode</th>
                  <th style="text-align:left;padding:3px 4px">Ref / Note</th>
                  <th style="text-align:right;padding:3px 4px">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                    <td style="padding:4px;color:var(--text-primary);font-weight:600">${p.paymentTime ? formatDateTime(p.paymentTime) : formatDateTime(bill.createdAt)}</td>
                    <td style="padding:4px"><span class="badge badge-secondary" style="font-size:0.65rem">${p.paymentMethod}</span></td>
                    <td style="padding:4px;color:var(--text-muted);font-family:var(--font-mono)">${p.transactionRef || '—'}</td>
                    <td style="padding:4px;text-align:right;font-weight:700;color:var(--success)">${formatCurrency(p.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : `
          <div style="margin-top:6px"><strong style="color:var(--text-primary)">Payment Mode:</strong> ${paymentMethodStr}</div>
          `}

          <div style="margin-top:10px;font-size:0.75rem;max-width:340px;line-height:1.3;font-style:italic">
            "${s.footerNote}"
          </div>
        </div>

        <div style="min-width:240px;display:flex;flex-direction:column;gap:5px;font-size:0.85rem">
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--text-muted)">Gross Subtotal:</span>
            <span>${formatCurrency(bill.totalAmount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--text-muted)">Taxes (GST):</span>
            <span>${formatCurrency(bill.taxAmount)}</span>
          </div>
          ${bill.discountAmount > 0 ? `
          <div style="display:flex;justify-content:space-between;color:var(--danger)">
            <span>Discount Applied:</span>
            <span>-${formatCurrency(bill.discountAmount)}</span>
          </div>` : ''}
          ${bill.redeemedPoints > 0 ? `
          <div style="display:flex;justify-content:space-between;color:var(--accent)">
            <span>Points Redeemed:</span>
            <span>-${bill.redeemedPoints} pts</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:1.15rem;font-weight:700;color:var(--accent);margin-top:6px;border-top:1px solid var(--border-bright);padding-top:6px">
            <span>Net Payable:</span>
            <span>${formatCurrency(bill.grandTotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.95rem;color:var(--text-primary);margin-top:4px">
            <span>Amount Paid:</span>
            <span style="font-weight:600">${formatCurrency(bill.paidAmount != null ? bill.paidAmount : (bill.paymentStatus === 'PENDING' ? 0 : bill.grandTotal))}</span>
          </div>
          ${(bill.dueAmount != null && bill.dueAmount > 0) || bill.paymentStatus === 'PARTIAL' || bill.paymentStatus === 'PENDING' ? `
          <div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:700;color:var(--danger);margin-top:2px">
            <span>Balance Due:</span>
            <span>${formatCurrency(bill.dueAmount != null ? bill.dueAmount : Math.max(0, bill.grandTotal - (bill.paidAmount || 0)))}</span>
          </div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Clean, isolated iframe printer for full pharmacy bill/invoice.
 * Prevents main window/modal styles from interfering with the print job.
 */
export function printInvoice(bill, settings = {}) {
  const s = Object.assign({
    storeName: 'MedStack Pharmacy',
    tagline: 'Retail Chemists & Druggists',
    address: 'Shop #12, Health Plaza, 100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    phone: '+91 98765 43210',
    email: 'contact@medstackpharma.in',
    gstin: '29AABCS1429B1ZV',
    dlNumber: 'KA-BLR-2024-1029',
    footerNote: 'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!'
  }, settings);

  const fullAddress = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ');
  const customerName = bill.customerName || (bill.customer ? bill.customer.name : 'Walk-in Customer');
  const customerPhone = bill.customerPhone || (bill.customer ? bill.customer.phone : '-');
  const doctorName = bill.prescribingDoctorName ? `Dr. ${bill.prescribingDoctorName}` : 'Self / OTC';
  const cashier = bill.createdBy || 'Staff';
  const dateStr = formatDateTime(bill.createdAt);
  const payments = bill.payments || [];
  const paymentMethodStr = payments.length > 0
    ? payments.map(p => `${p.paymentMethod} (₹${Number(p.amount).toFixed(2)})`).join(', ')
    : (bill.paymentStatus || 'PAID');

  const itemsHtml = (bill.items || []).map((it, idx) => `
    <tr>
      <td style="text-align:center;width:35px">${idx + 1}</td>
      <td style="font-weight:600">
        ${it.medicineName || 'Medicine'}
      </td>
      <td style="text-align:center">${it.batchNumber || '—'}</td>
      <td style="text-align:center">${it.expiryDate ? formatDate(it.expiryDate) : '—'}</td>
      <td style="text-align:center;font-weight:bold">${it.quantity}</td>
      <td style="text-align:right">₹${Number(it.unitPrice).toFixed(2)}</td>
      <td style="text-align:right;font-weight:bold">₹${Number(it.subtotal).toFixed(2)}</td>
    </tr>
  `).join('');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.setAttribute('title', 'Print Invoice');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tax Invoice - ${bill.billNumber}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          font-size: 13px;
          line-height: 1.4;
        }
        .invoice-box {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #d1d5db;
          padding: 24px;
          background: #ffffff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .store-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #0f172a;
          text-transform: uppercase;
          margin: 0;
        }
        .tagline {
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          margin-top: 2px;
        }
        .store-address {
          font-size: 12px;
          color: #374151;
          margin-top: 4px;
        }
        .reg-details {
          font-size: 11px;
          color: #4b5563;
          margin-top: 4px;
          display: flex;
          justify-content: center;
          gap: 20px;
          font-weight: 600;
        }
        .invoice-title {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          background: #f3f4f6;
          padding: 4px 8px;
          display: inline-block;
          margin-top: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
          padding: 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }
        .meta-group { display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; font-size: 12px; }
        .meta-label { width: 110px; color: #4b5563; font-weight: 500; }
        .meta-val { font-weight: 600; color: #111827; flex: 1; }
        .meta-val-highlight { font-weight: 700; color: #047857; font-size: 13px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #d1d5db;
          padding: 8px 10px;
          font-size: 12px;
        }
        th {
          background-color: #f3f4f6;
          font-weight: 700;
          color: #1f2937;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
        }
        .summary-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-top: 8px;
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
        }
        .payment-info {
          font-size: 12px;
          max-width: 50%;
        }
        .payment-status-badge {
          display: inline-block;
          padding: 3px 8px;
          background: #d1fae5;
          color: #065f46;
          font-weight: 700;
          border-radius: 3px;
          font-size: 11px;
          margin-top: 4px;
        }
        .totals-table {
          width: 280px;
          border-collapse: collapse;
        }
        .totals-table td {
          border: none;
          padding: 4px 6px;
          font-size: 13px;
        }
        .grand-total-row {
          border-top: 2px solid #111827 !important;
          border-bottom: 2px solid #111827 !important;
          font-weight: 800;
          font-size: 16px !important;
          color: #0f172a;
        }
        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px dashed #9ca3af;
          text-align: center;
          font-size: 11px;
          color: #6b7280;
        }
        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 36px;
          font-size: 12px;
          padding: 0 10px;
        }
        .signature-line {
          width: 200px;
          border-top: 1px solid #111827;
          text-align: center;
          padding-top: 4px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <h1 class="store-name">${s.storeName}</h1>
          <div class="tagline">${s.tagline || 'Retail Chemists & Druggists'}</div>
          <div class="store-address">${fullAddress} | Tel: ${s.phone || '—'}</div>
          <div class="reg-details">
            <span>GSTIN: <strong>${s.gstin || '—'}</strong></span>
            <span>D.L. No: <strong>${s.dlNumber || '—'}</strong></span>
          </div>
          <div><span class="invoice-title">Tax Invoice / Retail Bill</span></div>
        </div>

        <div class="meta-grid">
          <div class="meta-group">
            <div class="meta-row">
              <span class="meta-label">Invoice No:</span>
              <span class="meta-val" style="font-family:monospace;font-size:13px">${bill.billNumber}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Date & Time:</span>
              <span class="meta-val">${dateStr}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Billed By:</span>
              <span class="meta-val">${cashier}</span>
            </div>
          </div>
          <div class="meta-group">
            <div class="meta-row">
              <span class="meta-label">Customer Name:</span>
              <span class="meta-val meta-val-highlight">${customerName}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Customer Phone:</span>
              <span class="meta-val">${customerPhone}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Doctor:</span>
              <span class="meta-val">${doctorName}</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:35px">#</th>
              <th>Medicine / Description</th>
              <th style="text-align:center">Batch</th>
              <th style="text-align:center">Expiry</th>
              <th style="text-align:center;width:45px">Qty</th>
              <th style="text-align:right;width:75px">Rate (₹)</th>
              <th style="text-align:right;width:85px">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="payment-info">
            <div><strong>Status:</strong> <span class="payment-status-badge" style="background:${bill.paymentStatus === 'PAID' ? '#d1fae5;color:#065f46' : (bill.paymentStatus === 'PARTIAL' ? '#fef3c7;color:#92400e' : '#fee2e2;color:#991b1b')}">${bill.paymentStatus || 'PAID'}</span></div>
            ${payments.length > 0 ? `
            <div style="margin-top:8px">
              <div style="font-weight:700;font-size:11px;color:#111827;margin-bottom:4px">Payment Collections History:</div>
              <table style="width:100%;font-size:11px;border-collapse:collapse;border:1px solid #e5e7eb">
                <thead>
                  <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
                    <th style="text-align:left;padding:3px 5px">Date &amp; Time</th>
                    <th style="text-align:left;padding:3px 5px">Mode</th>
                    <th style="text-align:left;padding:3px 5px">Ref</th>
                    <th style="text-align:right;padding:3px 5px">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.map(p => `
                    <tr style="border-bottom:1px solid #f3f4f6">
                      <td style="padding:3px 5px">${p.paymentTime ? formatDateTime(p.paymentTime) : formatDateTime(bill.createdAt)}</td>
                      <td style="padding:3px 5px">${p.paymentMethod}</td>
                      <td style="padding:3px 5px;color:#6b7280">${p.transactionRef || '—'}</td>
                      <td style="padding:3px 5px;text-align:right;font-weight:bold">₹${Number(p.amount).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>` : `
            <div><strong>Payment Mode:</strong> ${paymentMethodStr}</div>
            `}
          </div>

          <table class="totals-table">
            <tr>
              <td style="color:#4b5563">Subtotal:</td>
              <td style="text-align:right;font-weight:600">₹${Number(bill.totalAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color:#4b5563">Taxes (GST):</td>
              <td style="text-align:right;font-weight:600">₹${Number(bill.taxAmount).toFixed(2)}</td>
            </tr>
            ${bill.discountAmount > 0 ? `
            <tr>
              <td style="color:#dc2626">Discount:</td>
              <td style="text-align:right;color:#dc2626;font-weight:600">-₹${Number(bill.discountAmount).toFixed(2)}</td>
            </tr>` : ''}
            <tr class="grand-total-row">
              <td>Net Payable:</td>
              <td style="text-align:right">₹${Number(bill.grandTotal).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color:#4b5563">Amount Paid:</td>
              <td style="text-align:right;font-weight:600">₹${Number(bill.paidAmount != null ? bill.paidAmount : (bill.paymentStatus === 'PENDING' ? 0 : bill.grandTotal)).toFixed(2)}</td>
            </tr>
            ${(bill.dueAmount != null && bill.dueAmount > 0) || bill.paymentStatus === 'PARTIAL' || bill.paymentStatus === 'PENDING' ? `
            <tr style="color:#dc2626;font-weight:bold">
              <td>Balance Due:</td>
              <td style="text-align:right">₹${Number(bill.dueAmount != null ? bill.dueAmount : Math.max(0, bill.grandTotal - (bill.paidAmount || 0))).toFixed(2)}</td>
            </tr>` : ''}
          </table>
        </div>

        <div class="signature-section">
          <div>Customer Signature</div>
          <div class="signature-line">For ${s.storeName}<br><span style="font-size:10px;color:#6b7280">Authorised Signatory</span></div>
        </div>

        <div class="footer">
          <div>${s.footerNote || 'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!'}</div>
          <div style="font-size:10px;margin-top:4px;color:#9ca3af">Powered by MedStack Pharmacy System</div>
        </div>
      </div>
    </body>
    </html>
  `);
  doc.close();

  // Print once iframe finishes loading
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Error triggering print:', e);
    }
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 2000);
  }, 300);
}


/**
 * Build a simple form HTML string from field definitions.
 * @param {Array<{name, label, type?, required?, options?}>} fields
 * @param {object} [data] - pre-fill values
 */
export function buildFormHtml(fields, data = {}) {
  return fields.map(f => {
    const val = data[f.name] ?? '';
    const req = f.required ? 'required' : '';
    const id = `ff_${f.name}`;

    if (f.type === 'select') {
      const opts = f.options.map(o =>
        `<option value="${o.value}" ${val == o.value ? 'selected' : ''}>${o.label}</option>`
      ).join('');
      return `<div class="form-group">
        <label class="form-label" for="${id}">${f.label}${f.required ? ' *' : ''}</label>
        <select class="form-control" id="${id}" name="${f.name}" ${req}><option value="">— Select —</option>${opts}</select>
      </div>`;
    }

    if (f.type === 'textarea') {
      return `<div class="form-group">
        <label class="form-label" for="${id}">${f.label}${f.required ? ' *' : ''}</label>
        <textarea class="form-control" id="${id}" name="${f.name}" rows="3" ${req}>${val}</textarea>
      </div>`;
    }

    if (f.type === 'checkbox') {
      return `<div class="form-group" style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" id="${id}" name="${f.name}" ${val ? 'checked' : ''} />
        <label for="${id}" style="margin:0;cursor:pointer">${f.label}</label>
      </div>`;
    }

    return `<div class="form-group">
      <label class="form-label" for="${id}">${f.label}${f.required ? ' *' : ''}</label>
      <input class="form-control" type="${f.type || 'text'}" id="${id}" name="${f.name}"
        value="${val}" placeholder="${f.placeholder || ''}" ${req} />
    </div>`;
  }).join('');
}

/**
 * Extract form data as plain object from a form element.
 */
export function getFormData(form) {
  const data = {};
  new FormData(form).forEach((val, key) => { data[key] = val; });
  // Handle checkboxes (not included in FormData when unchecked)
  form.querySelectorAll('input[type=checkbox]').forEach(cb => {
    data[cb.name] = cb.checked;
  });
  return data;
}

/**
 * Loading state for a container
 */
export function showLoading(container, msg = 'Loading...') {
  container.innerHTML = `
    <div class="loading-overlay">
      <div>
        <div class="spinner" style="width:32px;height:32px;margin:0 auto 12px;"></div>
        <div style="font-size:0.8rem;color:var(--text-muted);text-align:center">${msg}</div>
      </div>
    </div>`;
}

export function showError(container, msg = 'Failed to load data.') {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon" style="color:var(--danger)">✕</div>
      <div class="empty-text" style="color:var(--danger)">${msg}</div>
    </div>`;
}
