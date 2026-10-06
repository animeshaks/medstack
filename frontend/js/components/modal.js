// js/components/modal.js

let activeModal = null;

/**
 * Show a modal dialog.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string|HTMLElement} opts.body - HTML string or element
 * @param {Array<{label, class, onClick, type}>} [opts.buttons]
 * @param {string} [opts.size] - 'sm' | 'md' | 'lg'
 * @returns {{ close: Function, el: HTMLElement }}
 */
export function showModal({ title, body, buttons = [], size = 'md', onClose = null }) {
  closeModal();

  const sizeMap = { sm: '420px', md: '600px', lg: '800px' };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:${sizeMap[size] || sizeMap.md}">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close toggle-btn" aria-label="Close">✕</button>
      </div>
      <div class="modal-body"></div>
      ${buttons.length ? '<div class="modal-footer"></div>' : ''}
    </div>
  `;

  // Body
  const modalBody = overlay.querySelector('.modal-body');
  if (typeof body === 'string') {
    modalBody.innerHTML = body;
  } else {
    modalBody.appendChild(body);
  }

  // Buttons
  const footer = overlay.querySelector('.modal-footer');
  if (footer) {
    buttons.forEach(btn => {
      const b = document.createElement('button');
      b.className = `btn ${btn.class || 'btn-secondary'}`;
      b.textContent = btn.label;
      if (btn.type === 'submit') b.type = 'submit';
      b.addEventListener('click', () => btn.onClick?.(overlay));
      footer.appendChild(b);
    });
  }

  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    overlay.classList.remove('visible');
    overlay.querySelector('.modal')?.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
    activeModal = null;
    onClose?.();
  };

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  document.body.appendChild(overlay);
  activeModal = { close, el: overlay, element: overlay };

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    overlay.querySelector('.modal')?.classList.add('visible');
  });

  return activeModal;
}

export function closeModal() {
  if (activeModal) activeModal.close();
}

/**
 * Show a confirmation dialog. Returns a Promise<boolean>.
 */
export function confirm(message, { title = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const modal = showModal({
      title,
      body: `<p style="color:var(--text-secondary);margin:0;line-height:1.5">${message}</p>`,
      size: 'sm',
      onClose: () => safeResolve(false),
      buttons: [
        {
          label: 'Cancel',
          class: 'btn-secondary',
          onClick: () => {
            safeResolve(false);
            modal.close();
          }
        },
        {
          label: danger ? 'Delete' : 'Confirm',
          class: danger ? 'btn-danger' : 'btn-primary',
          onClick: () => {
            safeResolve(true);
            modal.close();
          }
        },
      ]
    });
  });
}
