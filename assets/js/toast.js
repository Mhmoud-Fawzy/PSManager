/**
 * toast.js — Toast Notification System
 */

export function toast(msg, type = 'info', icon = '<i class="fas fa-bell"></i>') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => el.remove(), 3100);
}

export const toastSuccess = (msg) =>
  toast(msg, 'success', '<i class="fas fa-check-circle"></i>');

export const toastError = (msg) =>
  toast(msg, 'error', '<i class="fas fa-exclamation-circle"></i>');

export const toastWarning = (msg) =>
  toast(msg, 'warning', '<i class="fas fa-exclamation-triangle"></i>');

export const toastInfo = (msg) =>
  toast(msg, 'info', '<i class="fas fa-info-circle"></i>');
