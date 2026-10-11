// js/components/profileModal.js — User Profile & Password Modal
import { userService } from '../services/userService.js';
import { getUser, updateStoredUser } from '../auth.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

export async function openProfileModal() {
  const localUser = getUser();

  // Create modal with loading indicator first
  const modal = showModal({
    title: '👤 My Profile & Account Security',
    size: 'md',
    body: `
      <div id="profileModalLoader" style="text-align:center;padding:24px">
        <div class="spinner" style="margin:0 auto 10px"></div>
        <div style="font-size:0.85rem;color:var(--text-muted)">Loading your account details...</div>
      </div>
      <div id="profileModalContent" style="display:none"></div>
    `,
    buttons: [
      { label: 'Close', class: 'btn-secondary', onClick: () => modal.close() }
    ]
  });

  const modalEl = document.querySelector('.modal-overlay:last-child');
  const loaderEl = modalEl?.querySelector('#profileModalLoader');
  const contentEl = modalEl?.querySelector('#profileModalContent');

  let profileData = localUser || {};
  try {
    const res = await userService.getMe();
    if (res?.success && res.data) {
      profileData = res.data;
    }
  } catch (err) {
    console.warn('Failed to fetch full profile, using local state', err);
  }

  if (loaderEl) loaderEl.style.display = 'none';
  if (!contentEl) return;
  contentEl.style.display = 'block';

  contentEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px">
      <!-- Section 1: Profile Details -->
      <div class="card" style="padding:16px;background:var(--bg-tertiary);border-color:var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h4 style="margin:0;font-size:0.95rem;color:var(--text-primary)">Account Information</h4>
          <span class="user-badge role-${(profileData.role || '').toLowerCase()}">${profileData.role || 'STAFF'}</span>
        </div>

        <form id="profileInfoForm" style="display:flex;flex-direction:column;gap:12px">
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.8rem">Username <span style="font-weight:normal;color:var(--text-muted)">(Read-only)</span></label>
            <div style="position:relative">
              <input type="text" class="form-control" value="${profileData.username || ''}" disabled style="background:var(--bg-secondary);color:var(--text-muted);cursor:not-allowed;font-family:var(--font-mono)" />
              <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:0.8rem;color:var(--text-muted)" title="Username cannot be changed">🔒</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px">Username cannot be changed. Only ADMIN can manage usernames.</div>
          </div>

          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.8rem">Full Name <span style="color:var(--danger)">*</span></label>
            <input type="text" id="profFullName" class="form-control" value="${profileData.fullName || ''}" required placeholder="Your full name" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.8rem">Email Address <span style="color:var(--danger)">*</span></label>
              <input type="email" id="profEmail" class="form-control" value="${profileData.email || ''}" required placeholder="user@example.com" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.8rem">Phone Number</label>
              <input type="tel" id="profPhone" class="form-control" value="${profileData.phone || ''}" placeholder="Phone or mobile" />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:6px">
            <button type="submit" id="btnSaveProfile" class="btn btn-primary btn-sm">💾 Save Profile Details</button>
          </div>
        </form>
      </div>

      <!-- Section 2: Change Password -->
      <div class="card" style="padding:16px;background:var(--bg-tertiary);border-color:var(--border)">
        <h4 style="margin:0 0 12px;font-size:0.95rem;color:var(--text-primary)">Change Password</h4>
        <form id="changePasswordForm" style="display:flex;flex-direction:column;gap:12px">
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.8rem">Current Password <span style="color:var(--danger)">*</span></label>
            <input type="password" id="currPassword" class="form-control" required placeholder="Enter current password" autocomplete="current-password" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.8rem">New Password <span style="color:var(--danger)">*</span></label>
              <input type="password" id="newPassword" class="form-control" required minlength="6" placeholder="Min 6 characters" autocomplete="new-password" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:0.8rem">Confirm New Password <span style="color:var(--danger)">*</span></label>
              <input type="password" id="confirmPassword" class="form-control" required minlength="6" placeholder="Confirm new password" autocomplete="new-password" />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:6px">
            <button type="submit" id="btnUpdatePassword" class="btn btn-warning btn-sm">🔑 Update Password</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Wire Profile Info Form Submit
  const profileForm = contentEl.querySelector('#profileInfoForm');
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = profileForm.querySelector('#btnSaveProfile');
    const fullName = contentEl.querySelector('#profFullName').value.trim();
    const email = contentEl.querySelector('#profEmail').value.trim();
    const phone = contentEl.querySelector('#profPhone').value.trim();

    if (!fullName || !email) {
      showToast('Full name and email are required', 'warning');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Saving...';
      const res = await userService.updateMe({ fullName, email, phone });
      if (res?.success) {
        showToast('Profile updated successfully', 'success');
        updateStoredUser({ fullName, email, phone });
        const nameDisplay = document.getElementById('userNameDisplay');
        if (nameDisplay && res.data?.fullName) {
          nameDisplay.textContent = res.data.username;
        }
      } else {
        showToast(res?.message || 'Failed to update profile', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error updating profile', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Profile Details';
    }
  });

  // Wire Change Password Form Submit
  const pwForm = contentEl.querySelector('#changePasswordForm');
  pwForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = pwForm.querySelector('#btnUpdatePassword');
    const currPw = contentEl.querySelector('#currPassword').value;
    const newPw = contentEl.querySelector('#newPassword').value;
    const confirmPw = contentEl.querySelector('#confirmPassword').value;

    if (!currPw) {
      showToast('Please enter your current password', 'warning');
      return;
    }
    if (newPw.length < 6) {
      showToast('New password must be at least 6 characters', 'warning');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('New password and confirmation do not match', 'error');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Updating...';
      const res = await userService.changePassword({ currentPassword: currPw, newPassword: newPw });
      if (res?.success) {
        showToast('Password updated successfully! Please keep it secure.', 'success');
        pwForm.reset();
      } else {
        showToast(res?.message || 'Failed to update password', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error updating password', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔑 Update Password';
    }
  });
}
