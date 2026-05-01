/**
 * app.js — App bootstrap and event wiring
 */

import * as API from './api.js';
import AudioEngine from './audio.js';
import state from './state.js';
import { renderDevices, bindAddDeviceForm } from './devices.js';
import { startTimerLoop } from './timers.js';
import {
  openResultModal,
  openStopExtendModal,
  closeStopExtendModal,
  closeStartOptionsModal,
  closeTransferModal,
  closeEditModal,
  closeAllModals,
  openSessionEndedModal,
  recalcMultiplayer,
} from './modals.js';
import { toastSuccess, toastError, toastInfo } from './toast.js';
import { calcCost, getElapsedMs } from './utils.js';

let uiBound = false;
let authBound = false;

function byId(id) {
  return document.getElementById(id);
}

function showLogin(show) {
  const loginPage = byId('login-page');
  const appShell = byId('app-shell');
  if (!loginPage || !appShell) return;

  loginPage.classList.toggle('hidden', !show);
  appShell.classList.toggle('hidden', show);
}

async function loadDevices() {
  const list = await API.fetchDevices();
  state.devices = list;
  renderDevices();
}

async function initAfterLogin() {
  showLogin(false);

  if (!uiBound) {
    bindCoreUI();
    bindAddDeviceForm();
    uiBound = true;
  }

  await loadDevices();
  startTimerLoop();
}

function bindCoreUI() {
  bindFilters();
  bindStartModalActions();
  bindStopExtendActions();
  bindTransferActions();
  bindEditActions();
  bindResultModalActions();
  bindSessionEndedActions();
  bindGlobalModalDismiss();
}

function bindAuthUI() {
  if (authBound) return;
  authBound = true;

  const loginForm = byId('login-form');
  const loginError = byId('login-error');
  const logoutBtn = byId('logout-btn');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    AudioEngine.uiClick();

    const username = byId('login-username')?.value.trim() ?? '';
    const password = byId('login-password')?.value ?? '';

    if (!username || !password) {
      loginError.textContent = 'اسم المستخدم وكلمة المرور مطلوبان.';
      loginError.style.display = 'block';
      return;
    }

    try {
      await API.login(username, password);
      toastSuccess('تم تسجيل الدخول بنجاح.');
      await initAfterLogin();
    } catch (err) {
      loginError.textContent = err.message || 'فشل تسجيل الدخول.';
      loginError.style.display = 'block';
      AudioEngine.error();
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    AudioEngine.uiClick();
    try {
      await API.logout();
    } catch (_) {
      // Ignore logout API failures and clear UI anyway.
    }
    showLogin(true);
    closeAllModals();
    toastInfo('تم تسجيل الخروج.');
  });
}

function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioEngine.uiClick();
      const filter = btn.getAttribute('data-filter') || 'all';
      state.currentFilter = filter;

      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDevices();
    });
  });
}

function bindStartModalActions() {
  byId('so-open-start-btn')?.addEventListener('click', () => startPendingSession(false, 0));
  byId('so-fixed-60-btn')?.addEventListener('click', () => startPendingSession(true, 60));
  byId('so-fixed-90-btn')?.addEventListener('click', () => startPendingSession(true, 90));
  byId('so-start-custom-btn')?.addEventListener('click', () => {
    const mins = parseInt(byId('so-custom-minutes')?.value || '0', 10);
    if (!mins || mins < 1 || mins > 480) {
      toastError('المدة المخصصة يجب أن تكون بين 1 و 480 دقيقة.');
      return;
    }
    startPendingSession(true, mins);
  });

  byId('so-cancel-btn')?.addEventListener('click', closeStartOptionsModal);
}

async function startPendingSession(isFixed, fixedMinutes) {
  if (!state.pendingStartId) return;

  AudioEngine.sessionStart();
  try {
    await API.startSession(state.pendingStartId, isFixed, fixedMinutes);
    closeStartOptionsModal();
    await loadDevices();
    toastSuccess('تم بدء الجلسة.');
  } catch (err) {
    toastError(err.message || 'فشل بدء الجلسة.');
    AudioEngine.error();
  }
}

function bindStopExtendActions() {
  byId('se-close-btn')?.addEventListener('click', closeStopExtendModal);

  document.querySelectorAll('[data-extend-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.getAttribute('data-extend-minutes') || '0', 10);
      extendPendingSession(minutes);
    });
  });

  byId('se-custom-extend-btn')?.addEventListener('click', () => {
    const mins = parseInt(byId('custom-extend-input')?.value || '0', 10);
    if (!mins || mins < 1 || mins > 480) {
      toastError('المدة المخصصة يجب أن تكون بين 1 و 480 دقيقة.');
      return;
    }
    extendPendingSession(mins);
  });

  const toggle = byId('se-multi-toggle');
  const inputsWrap = byId('se-multi-inputs');

  toggle?.addEventListener('click', () => {
    state.seMultiplayerMode = !state.seMultiplayerMode;
    toggle.classList.toggle('active', state.seMultiplayerMode);
    inputsWrap.style.display = state.seMultiplayerMode ? '' : 'none';

    if (state.seMultiplayerMode) {
      AudioEngine.toggleOn();
      recalcMultiplayer();
    } else {
      AudioEngine.toggleOff();
      byId('se-multi-minutes').value = '';
      byId('se-multi-price-ph').value = '';
      recalcMultiplayer();
    }
  });

  byId('se-multi-minutes')?.addEventListener('input', () => recalcMultiplayer());
  byId('se-multi-price-ph')?.addEventListener('input', () => recalcMultiplayer());

  byId('se-confirm-end-btn')?.addEventListener('click', async () => {
    if (!state.pendingStopId) return;

    const deviceId = state.pendingStopId;
    const multiMinutes = state.seMultiplayerMode ? parseInt(byId('se-multi-minutes')?.value || '0', 10) || 0 : 0;
    const multiPricePh = state.seMultiplayerMode ? parseFloat(byId('se-multi-price-ph')?.value || '0') || 0 : 0;

    try {
      const result = await API.stopSession(deviceId, multiMinutes, multiPricePh);
      closeStopExtendModal();
      await loadDevices();
      openResultModal(result);
      toastSuccess('تم إنهاء الجلسة بنجاح.');
    } catch (err) {
      toastError(err.message || 'فشل إنهاء الجلسة.');
      AudioEngine.error();
    }
  });
}

async function extendPendingSession(minutes) {
  if (!state.pendingStopId || !minutes) return;

  try {
    await API.extendSession(state.pendingStopId, minutes);

    const d = state.devices.find(x => x.id === state.pendingStopId);
    if (d?.session) {
      d.session.extraMs = (d.session.extraMs || 0) + (minutes * 60 * 1000);
      d.session.fixedDuration = (d.session.fixedDuration || 0) + minutes;
      d.session.endAlertPlayed = false;
    }

    renderDevices();
    recalcMultiplayer();
    AudioEngine.extend();
    toastSuccess(`تمت إضافة ${minutes} دقيقة.`);
  } catch (err) {
    toastError(err.message || 'فشل التمديد.');
    AudioEngine.error();
  }
}

function bindTransferActions() {
  byId('tr-cancel-btn')?.addEventListener('click', closeTransferModal);

  byId('tr-confirm-btn')?.addEventListener('click', async () => {
    const fromDeviceId = state.pendingTransferId;
    const toDeviceId = state.selectedTransferTargetId;

    if (!fromDeviceId || !toDeviceId) {
      toastError('اختر جهازًا للنقل أولًا.');
      return;
    }

    try {
      await API.transferSession(fromDeviceId, toDeviceId);
      closeTransferModal();
      await loadDevices();
      AudioEngine.transfer();
      toastSuccess('تم نقل الجلسة بنجاح.');
    } catch (err) {
      toastError(err.message || 'فشل نقل الجلسة.');
      AudioEngine.error();
    }
  });
}

function bindEditActions() {
  byId('edit-cancel-btn')?.addEventListener('click', closeEditModal);

  byId('edit-save-btn')?.addEventListener('click', async () => {
    if (!state.pendingEditId) return;

    const id = state.pendingEditId;
    const name = byId('edit-device-name')?.value.trim() || '';
    const type = byId('edit-device-type')?.value.trim() || '';
    const price = parseFloat(byId('edit-device-price')?.value || '0');

    byId('edit-name-error').textContent = '';
    byId('edit-price-error').textContent = '';

    if (!name) {
      byId('edit-name-error').textContent = 'اسم الجهاز مطلوب.';
      return;
    }
    if (!(price > 0)) {
      byId('edit-price-error').textContent = 'السعر يجب أن يكون أكبر من صفر.';
      return;
    }

    try {
      await API.updateDevice(id, { name, type, pricePerHour: price });
      closeEditModal();
      await loadDevices();
      AudioEngine.edit();
      toastSuccess('تم حفظ التعديلات.');
    } catch (err) {
      toastError(err.message || 'فشل التعديل.');
      AudioEngine.error();
    }
  });
}

function bindResultModalActions() {
  byId('modal-close-btn')?.addEventListener('click', () => {
    byId('result-modal')?.classList.remove('open');
    AudioEngine.modalClose();
  });
}

function bindSessionEndedActions() {
  byId('sen-close-btn')?.addEventListener('click', () => {
    byId('session-ended-modal')?.classList.remove('open');
  });

  byId('sen-extend-15')?.addEventListener('click', () => extendTimeUpSession(15));
  byId('sen-extend-30')?.addEventListener('click', () => extendTimeUpSession(30));

  byId('sen-custom-extend-btn')?.addEventListener('click', () => {
    const mins = parseInt(byId('sen-custom-minutes')?.value || '0', 10);
    if (!mins || mins < 1 || mins > 480) {
      toastError('المدة المخصصة يجب أن تكون بين 1 و 480 دقيقة.');
      return;
    }
    extendTimeUpSession(mins);
  });

  byId('sen-stop-now-btn')?.addEventListener('click', () => {
    const modal = byId('session-ended-modal');
    modal?.classList.remove('open');
    if (state.pendingStopId) {
      openStopExtendModal(state.pendingStopId);
    }
  });
}

async function extendTimeUpSession(minutes) {
  if (!state.pendingStopId) return;
  try {
    await API.extendSession(state.pendingStopId, minutes);
    const modal = byId('session-ended-modal');
    modal?.classList.remove('open');
    await loadDevices();
    toastSuccess(`تمت إضافة ${minutes} دقيقة.`);
  } catch (err) {
    toastError(err.message || 'فشل التمديد.');
  }
}

function bindGlobalModalDismiss() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAllModals();
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });
}

export async function triggerTimeUp(deviceId) {
  const device = state.devices.find(d => d.id === deviceId);
  if (!device?.session) return;

  state.pendingStopId = deviceId;

  const elapsed = getElapsedMs(device);
  const cost = calcCost(elapsed, device.pricePerHour);

  try {
    await API.markEndAlert(deviceId);
  } catch (_) {
    // Failing to persist alert flag should not block UI warning.
  }

  openSessionEndedModal(device, elapsed, cost);
}

async function boot() {
  bindAuthUI();

  try {
    const authState = await API.checkAuth();
    if (authState.authenticated) {
      await initAfterLogin();
    } else {
      showLogin(true);
    }
  } catch (_) {
    showLogin(true);
  }
}

boot();
