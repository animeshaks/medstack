// js/pages/settings.js — Store & Invoice Profile Settings (Admin / Owner)
import { settingsService } from '../services/settingsService.js';
import { showToast } from '../components/toast.js';
import { showLoading, showError } from '../utils.js';
import { can } from '../permissions.js';

export default async function renderSettings(container) {
  const isEditable = can('manage_users'); // Admin or Owner

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Store &amp; Invoice Settings</h1>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px">
          Configure pharmacy name, address, contact numbers, GSTIN, and return policies printed on bills.
        </p>
      </div>
    </div>

    <div id="settingsContent" style="display:grid;grid-template-columns:minmax(320px, 1.2fr) minmax(300px, 1fr);gap:24px;align-items:start">
      <div id="settingsLoading"></div>
    </div>
  `;

  const contentArea = container.querySelector('#settingsContent');
  showLoading(contentArea, 'Loading store configuration...');

  try {
    const settings = await settingsService.getSettings(true);

    contentArea.innerHTML = `
      <!-- Settings Form Card -->
      <div class="card">
        <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;color:var(--text-primary);display:flex;align-items:center;gap:8px">
          <span>🏪</span> Store Profile &amp; Invoice Header
        </h2>

        <form id="storeSettingsForm" style="display:flex;flex-direction:column;gap:14px">
          <div class="form-group">
            <label class="form-label" for="settingStoreName">Pharmacy / Store Name *</label>
            <input type="text" id="settingStoreName" name="storeName" class="form-control" required
                   value="${escapeHtml(settings.storeName || '')}" ${!isEditable ? 'disabled' : ''} />
          </div>

          <div class="form-group">
            <label class="form-label" for="settingTagline">Tagline / Subheading</label>
            <input type="text" id="settingTagline" name="tagline" class="form-control"
                   placeholder="e.g. Retail Chemists &amp; Druggists"
                   value="${escapeHtml(settings.tagline || '')}" ${!isEditable ? 'disabled' : ''} />
          </div>

          <div class="form-group">
            <label class="form-label" for="settingAddress">Shop / Street Address *</label>
            <textarea id="settingAddress" name="address" class="form-control" rows="2" required
                      ${!isEditable ? 'disabled' : ''}>${escapeHtml(settings.address || '')}</textarea>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label" for="settingCity">City *</label>
              <input type="text" id="settingCity" name="city" class="form-control" required
                     value="${escapeHtml(settings.city || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label class="form-label" for="settingState">State *</label>
              <input type="text" id="settingState" name="state" class="form-control" required
                     value="${escapeHtml(settings.state || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label class="form-label" for="settingPincode">PIN Code *</label>
              <input type="text" id="settingPincode" name="pincode" class="form-control" required
                     value="${escapeHtml(settings.pincode || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label" for="settingPhone">Contact Phone *</label>
              <input type="text" id="settingPhone" name="phone" class="form-control" required
                     value="${escapeHtml(settings.phone || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label class="form-label" for="settingEmail">Email Address</label>
              <input type="email" id="settingEmail" name="email" class="form-control"
                     value="${escapeHtml(settings.email || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label" for="settingGstin">GSTIN Number</label>
              <input type="text" id="settingGstin" name="gstin" class="form-control"
                     placeholder="e.g. 29AABCS1429B1ZV"
                     value="${escapeHtml(settings.gstin || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label class="form-label" for="settingDlNumber">Drug License (D.L.) No.</label>
              <input type="text" id="settingDlNumber" name="dlNumber" class="form-control"
                     placeholder="e.g. KA-BLR-2024-1029"
                     value="${escapeHtml(settings.dlNumber || '')}" ${!isEditable ? 'disabled' : ''} />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="settingUpiId">Merchant UPI VPA / ID (For POS QR) *</label>
            <input type="text" id="settingUpiId" name="upiId" class="form-control"
                   placeholder="e.g. medstack@okaxis or 9876543210@paytm"
                   value="${escapeHtml(settings.upiId || 'medstack@okaxis')}" ${!isEditable ? 'disabled' : ''} />
            <small style="font-size:0.75rem;color:var(--text-muted)">The dynamic UPI QR code on the POS billing screen will receive payments directly to this VPA address.</small>
          </div>

          <div class="form-group">
            <label class="form-label" for="settingFooterNote">Invoice Footer &amp; Return Terms</label>
            <textarea id="settingFooterNote" name="footerNote" class="form-control" rows="2"
                      placeholder="Policy note displayed at bottom of bills"
                      ${!isEditable ? 'disabled' : ''}>${escapeHtml(settings.footerNote || '')}</textarea>
          </div>

          ${isEditable ? `
            <div style="margin-top:8px;display:flex;gap:12px">
              <button type="submit" id="saveSettingsBtn" class="btn btn-primary" style="flex:1">
                💾 Save Store Settings
              </button>
            </div>
          ` : `
            <div style="font-size:0.8rem;color:var(--text-muted);background:var(--bg-secondary);padding:10px;border-radius:var(--radius)">
              🔒 Store settings can only be modified by an Admin or Owner.
            </div>
          `}
        </form>
      </div>

      <!-- Live Invoice Header Preview -->
      <div class="card" style="border:1px solid var(--border-bright)">
        <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;color:var(--text-primary);display:flex;align-items:center;gap:8px">
          <span>🧾</span> Invoice Header Preview
        </h2>

        <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius);padding:18px;font-family:var(--font-mono)">
          <div style="text-align:center;border-bottom:1px dashed var(--border-bright);padding-bottom:14px;margin-bottom:12px">
            <div id="previewStoreName" style="font-size:1.25rem;font-weight:800;color:var(--accent);letter-spacing:0.5px">
              ${settings.storeName || 'MedStack Pharmacy'}
            </div>
            <div id="previewTagline" style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px">
              ${settings.tagline || 'Retail Chemists & Druggists'}
            </div>
            <div id="previewAddress" style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
              ${[settings.address, settings.city, settings.state, settings.pincode].filter(Boolean).join(', ')}
            </div>
            <div style="display:flex;justify-content:center;gap:12px;font-size:0.75rem;color:var(--text-muted);margin-top:4px;flex-wrap:wrap">
              <span id="previewPhone">📞 ${settings.phone || '—'}</span>
              <span id="previewEmail">📧 ${settings.email || '—'}</span>
            </div>
            <div style="display:flex;justify-content:center;gap:12px;font-size:0.75rem;color:var(--text-muted);margin-top:2px;flex-wrap:wrap">
              <span id="previewGstin"><strong>GSTIN:</strong> ${settings.gstin || '—'}</span>
              <span id="previewDl"><strong>D.L.:</strong> ${settings.dlNumber || '—'}</span>
              <span id="previewUpi"><strong>UPI:</strong> ${settings.upiId || 'medstack@okaxis'}</span>
            </div>
            <div style="margin-top:8px">
              <span style="font-size:0.75rem;font-weight:700;background:var(--accent-glow);color:var(--accent);padding:2px 8px;border-radius:4px;border:1px solid var(--accent)">
                TAX INVOICE / CASH MEMO
              </span>
            </div>
          </div>

          <div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:12px 0;border-bottom:1px dashed var(--border-bright)">
            [ Bill details &amp; Itemized medicine table will be printed here ]
          </div>

          <div id="previewFooter" style="margin-top:12px;text-align:center;font-size:0.7rem;color:var(--text-muted);font-style:italic">
            "${settings.footerNote || 'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!'}"
          </div>
        </div>
      </div>
    `;

    // Live update preview as user types
    const form = contentArea.querySelector('#storeSettingsForm');
    const updatePreview = () => {
      const name = form.querySelector('#settingStoreName').value.trim() || 'MedStack Pharmacy';
      const tagline = form.querySelector('#settingTagline').value.trim() || 'Retail Chemists & Druggists';
      const addr = form.querySelector('#settingAddress').value.trim();
      const city = form.querySelector('#settingCity').value.trim();
      const state = form.querySelector('#settingState').value.trim();
      const pin = form.querySelector('#settingPincode').value.trim();
      const phone = form.querySelector('#settingPhone').value.trim() || '—';
      const email = form.querySelector('#settingEmail').value.trim() || '—';
      const gstin = form.querySelector('#settingGstin').value.trim() || '—';
      const dl = form.querySelector('#settingDlNumber').value.trim() || '—';
      const upi = form.querySelector('#settingUpiId')?.value.trim() || 'medstack@okaxis';
      const footer = form.querySelector('#settingFooterNote').value.trim() || '';

      const previewStoreName = contentArea.querySelector('#previewStoreName');
      const previewTagline = contentArea.querySelector('#previewTagline');
      const previewAddress = contentArea.querySelector('#previewAddress');
      const previewPhone = contentArea.querySelector('#previewPhone');
      const previewEmail = contentArea.querySelector('#previewEmail');
      const previewGstin = contentArea.querySelector('#previewGstin');
      const previewDl = contentArea.querySelector('#previewDl');
      const previewUpi = contentArea.querySelector('#previewUpi');
      const previewFooter = contentArea.querySelector('#previewFooter');

      if (previewStoreName) previewStoreName.textContent = name;
      if (previewTagline) previewTagline.textContent = tagline;
      if (previewAddress) previewAddress.textContent = [addr, city, state, pin].filter(Boolean).join(', ');
      if (previewPhone) previewPhone.textContent = `📞 ${phone}`;
      if (previewEmail) previewEmail.textContent = `📧 ${email}`;
      if (previewGstin) previewGstin.innerHTML = `<strong>GSTIN:</strong> ${gstin}`;
      if (previewDl) previewDl.innerHTML = `<strong>D.L.:</strong> ${dl}`;
      if (previewUpi) previewUpi.innerHTML = `<strong>UPI:</strong> ${upi}`;
      if (previewFooter) previewFooter.textContent = `"${footer}"`;
    };

    form.addEventListener('input', updatePreview);

    // Handle form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('#saveSettingsBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving settings...';
      }

      const payload = {
        storeName: form.querySelector('#settingStoreName').value.trim(),
        tagline: form.querySelector('#settingTagline').value.trim(),
        address: form.querySelector('#settingAddress').value.trim(),
        city: form.querySelector('#settingCity').value.trim(),
        state: form.querySelector('#settingState').value.trim(),
        pincode: form.querySelector('#settingPincode').value.trim(),
        phone: form.querySelector('#settingPhone').value.trim(),
        email: form.querySelector('#settingEmail').value.trim(),
        gstin: form.querySelector('#settingGstin').value.trim(),
        dlNumber: form.querySelector('#settingDlNumber').value.trim(),
        upiId: form.querySelector('#settingUpiId')?.value.trim() || 'medstack@okaxis',
        footerNote: form.querySelector('#settingFooterNote').value.trim()
      };

      try {
        const resp = await settingsService.updateSettings(payload);
        if (resp?.success) {
          showToast('Store settings updated successfully!', 'success');
        } else {
          showToast(resp?.message || 'Failed to update store settings', 'error');
        }
      } catch (err) {
        showToast('Error saving settings: ' + (err.message || 'Unknown error'), 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '💾 Save Store Settings';
        }
      }
    });

  } catch (err) {
    console.error(err);
    showError(contentArea, 'Error loading store configuration');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
