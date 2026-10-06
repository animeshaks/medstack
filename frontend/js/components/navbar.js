// js/components/navbar.js
import { getState, setState } from '../state.js';

export function renderNavbar(container, { title }) {
  const theme = getState('theme');
  container.innerHTML = `
    <span class="topbar-title">${title}</span>
    <div class="topbar-actions">
      <button class="btn btn-secondary btn-sm" id="theme-toggle">
        ${theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>
      <button class="btn btn-secondary btn-sm" id="mobile-menu-btn">☰</button>
    </div>`;

  container.querySelector('#theme-toggle').addEventListener('click', () => {
    const current = getState('theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setState('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ms_theme', next);
    renderNavbar(container, { title }); // re-render to update button
  });

  container.querySelector('#mobile-menu-btn').addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('visible');
  });
}
