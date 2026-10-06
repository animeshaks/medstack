/**
 * Searchable Select Component for MedStack
 * Lightweight, zero-dependency searchable combobox / dropdown.
 * Uses fixed positioning to guarantee zero clipping inside overflow containers or tables.
 */

export function createSearchableSelect(container, config = {}) {
  const {
    placeholder = '— Select or Search —',
    options = [], // [{ value: any, label: string, sublabel?: string, badge?: string }]
    selectedValue = '',
    onChange = () => {},
    required = false,
    name = '',
    className = ''
  } = config;

  let currentOptions = [...options];
  let currentVal = selectedValue;
  let isOpen = false;
  let focusedIndex = -1;

  // Build root element
  const root = document.createElement('div');
  root.className = `searchable-select-root ${className}`.trim();
  root.style.position = 'relative';
  root.style.width = '100%';
  root.style.userSelect = 'none';

  // Hidden input for form integration
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  if (name) hiddenInput.name = name;
  hiddenInput.value = currentVal;
  if (required) hiddenInput.required = true;
  root.appendChild(hiddenInput);

  // Trigger element (looks like form-control)
  const trigger = document.createElement('div');
  trigger.className = 'form-control searchable-select-trigger';
  trigger.tabIndex = 0;
  trigger.style.cursor = 'pointer';
  trigger.style.display = 'flex';
  trigger.style.alignItems = 'center';
  trigger.style.justifyContent = 'space-between';
  trigger.style.padding = '6px 10px';
  trigger.style.fontSize = '0.82rem';
  trigger.style.minHeight = '34px';
  trigger.style.background = 'var(--bg-secondary)';
  trigger.style.borderColor = 'var(--border)';
  trigger.style.borderRadius = 'var(--radius)';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'searchable-select-label';
  labelSpan.style.overflow = 'hidden';
  labelSpan.style.textOverflow = 'ellipsis';
  labelSpan.style.whiteSpace = 'nowrap';
  labelSpan.style.marginRight = '8px';

  const chevron = document.createElement('span');
  chevron.className = 'searchable-select-arrow';
  chevron.innerHTML = '▾';
  chevron.style.fontSize = '0.75rem';
  chevron.style.color = 'var(--text-muted)';
  chevron.style.transition = 'transform 0.15s ease';

  trigger.appendChild(labelSpan);
  trigger.appendChild(chevron);
  root.appendChild(trigger);

  // Dropdown panel
  const dropdown = document.createElement('div');
  dropdown.className = 'searchable-select-dropdown';
  dropdown.style.display = 'none';
  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '99999';
  dropdown.style.background = 'var(--surface)';
  dropdown.style.border = '1px solid var(--border)';
  dropdown.style.borderRadius = 'var(--radius)';
  dropdown.style.boxShadow = '0 8px 30px rgba(0,0,0,0.35)';
  dropdown.style.maxHeight = '280px';
  dropdown.style.flexDirection = 'column';
  dropdown.style.overflow = 'hidden';

  // Search input header inside dropdown
  const searchWrap = document.createElement('div');
  searchWrap.style.padding = '8px';
  searchWrap.style.borderBottom = '1px solid var(--border)';
  searchWrap.style.background = 'var(--bg-secondary)';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'form-control';
  searchInput.placeholder = 'Type to filter...';
  searchInput.style.fontSize = '0.8rem';
  searchInput.style.padding = '6px 8px';
  searchInput.style.width = '100%';
  searchWrap.appendChild(searchInput);
  dropdown.appendChild(searchWrap);

  // Options list
  const listWrap = document.createElement('div');
  listWrap.className = 'searchable-select-list';
  listWrap.style.overflowY = 'auto';
  listWrap.style.maxHeight = '210px';
  dropdown.appendChild(listWrap);

  document.body.appendChild(dropdown);
  container.appendChild(root);

  function positionDropdown() {
    if (!isOpen) return;
    const rect = trigger.getBoundingClientRect();
    const dropdownHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      dropdown.style.top = `${rect.top - dropdownHeight - 4}px`;
    } else {
      dropdown.style.top = `${rect.bottom + 4}px`;
    }

    dropdown.style.left = `${Math.max(10, rect.left)}px`;
    dropdown.style.width = `${Math.max(rect.width, 240)}px`;
  }

  // Helper to update label
  function updateTriggerLabel() {
    const sel = currentOptions.find(o => String(o.value) === String(currentVal));
    if (sel) {
      labelSpan.textContent = sel.label;
      labelSpan.style.color = 'var(--text-primary)';
      labelSpan.style.fontWeight = '500';
    } else {
      labelSpan.textContent = placeholder;
      labelSpan.style.color = 'var(--text-muted)';
      labelSpan.style.fontWeight = 'normal';
    }
  }

  function renderList(filtered) {
    listWrap.innerHTML = '';
    focusedIndex = -1;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.style.padding = '12px';
      empty.style.textAlign = 'center';
      empty.style.fontSize = '0.8rem';
      empty.style.color = 'var(--text-muted)';
      empty.textContent = 'No matching items';
      listWrap.appendChild(empty);
      return;
    }

    filtered.forEach((opt, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'searchable-select-option';
      itemEl.dataset.idx = idx;
      itemEl.style.padding = '8px 12px';
      itemEl.style.fontSize = '0.82rem';
      itemEl.style.cursor = 'pointer';
      itemEl.style.borderBottom = '1px solid var(--border-light, rgba(255,255,255,0.05))';
      itemEl.style.display = 'flex';
      itemEl.style.justifyContent = 'space-between';
      itemEl.style.alignItems = 'center';
      itemEl.style.transition = 'background 0.1s ease';

      const isSelected = String(opt.value) === String(currentVal);
      if (isSelected) {
        itemEl.style.background = 'var(--accent-glow, rgba(0, 230, 153, 0.15))';
        itemEl.style.fontWeight = '600';
      }

      itemEl.innerHTML = `
        <div style="flex:1;min-width:0;margin-right:8px">
          <div style="color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${opt.label}</div>
          ${opt.sublabel ? `<div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${opt.sublabel}</div>` : ''}
        </div>
        ${opt.badge ? `<span class="badge" style="font-size:0.65rem">${opt.badge}</span>` : ''}
        ${isSelected ? '<span style="color:var(--accent);font-size:0.9rem">✓</span>' : ''}
      `;

      itemEl.addEventListener('mouseenter', () => {
        highlightIndex(idx, filtered);
      });

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(opt);
      });

      listWrap.appendChild(itemEl);
    });
  }

  function highlightIndex(idx, filtered) {
    focusedIndex = idx;
    const items = listWrap.querySelectorAll('.searchable-select-option');
    items.forEach((el, i) => {
      if (i === idx) {
        el.style.background = 'var(--bg-tertiary)';
        el.scrollIntoView({ block: 'nearest' });
      } else if (String(filtered[i]?.value) !== String(currentVal)) {
        el.style.background = 'transparent';
      }
    });
  }

  function selectOption(opt) {
    currentVal = opt ? opt.value : '';
    hiddenInput.value = currentVal;
    updateTriggerLabel();
    closeDropdown();
    onChange(opt || null, currentVal);
  }

  function openDropdown() {
    if (isOpen) return;
    isOpen = true;
    dropdown.style.display = 'flex';
    chevron.style.transform = 'rotate(180deg)';
    trigger.style.borderColor = 'var(--accent)';
    positionDropdown();
    searchInput.value = '';
    renderList(currentOptions);
    setTimeout(() => searchInput.focus(), 30);
  }

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    dropdown.style.display = 'none';
    chevron.style.transform = 'none';
    trigger.style.borderColor = 'var(--border)';
  }

  // Filter input event
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = currentOptions.filter(o => 
      o.label.toLowerCase().includes(q) || 
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
    renderList(filtered);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = currentOptions.filter(o => 
      o.label.toLowerCase().includes(q) || 
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!filtered.length) return;
      focusedIndex = (focusedIndex + 1) % filtered.length;
      highlightIndex(focusedIndex, filtered);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!filtered.length) return;
      focusedIndex = (focusedIndex - 1 + filtered.length) % filtered.length;
      highlightIndex(focusedIndex, filtered);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filtered.length) {
        selectOption(filtered[focusedIndex]);
      } else if (filtered.length === 1) {
        selectOption(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      trigger.focus();
    }
  });

  // Trigger events
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) closeDropdown();
    else openDropdown();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
    }
  });

  // Reposition on scroll or resize
  window.addEventListener('scroll', positionDropdown, true);
  window.addEventListener('resize', positionDropdown);

  // Close when clicking outside
  const onDocClick = (e) => {
    if (!root.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  };
  document.addEventListener('click', onDocClick);

  updateTriggerLabel();

  return {
    root,
    getValue: () => currentVal,
    getSelectedOption: () => currentOptions.find(o => String(o.value) === String(currentVal)) || null,
    setValue: (val) => {
      currentVal = val;
      hiddenInput.value = val;
      updateTriggerLabel();
    },
    setOptions: (newOpts) => {
      currentOptions = [...newOpts];
      updateTriggerLabel();
      if (isOpen) {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = currentOptions.filter(o => 
          o.label.toLowerCase().includes(q) || 
          (o.sublabel && o.sublabel.toLowerCase().includes(q))
        );
        renderList(filtered);
      }
    },
    destroy: () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', positionDropdown, true);
      window.removeEventListener('resize', positionDropdown);
      dropdown.remove();
      root.remove();
    }
  };
}
