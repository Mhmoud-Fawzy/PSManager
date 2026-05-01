/**
 * devices.js — Device Card Rendering & CRUD UI Logic
 */

import { escapeHTML, fmtTime, getElapsedMs, fmtElapsed, calcCost } from './utils.js';
import { toastSuccess, toastError } from './toast.js';
import AudioEngine from './audio.js';
import state, { replaceDevices } from './state.js';
import * as API from './api.js';
import { openStartOptionsModal, openStopExtendModal, openTransferModal, openEditModal } from './modals.js';

/* ─── Render Grid ───────────────────────────────── */
export function renderDevices() {
  const grid = document.getElementById('devices-grid');
  if (!grid) return;

  let devices = [...state.devices];

  // Apply filter
  if (state.currentFilter === 'running')
    devices = devices.filter(d => d.running);
  else if (state.currentFilter === 'available')
    devices = devices.filter(d => !d.running);

  // Update header stats
  const allDevices  = state.devices;
  const runningNow  = allDevices.filter(d => d.running && (!d.session || d.session.status !== 'paused')).length;
  const availableNow= allDevices.filter(d => !d.running).length;

  document.getElementById('available-count').textContent = availableNow;
  document.getElementById('running-count').textContent   = runningNow;
  document.getElementById('total-count').textContent     = `${allDevices.length} أجهزة`;

  grid.innerHTML = '';

  if (devices.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎮</div>
        <h3>${state.currentFilter === 'all' ? 'لا توجد أجهزة بعد' : 'لا توجد أجهزة في هذه الفئة'}</h3>
        <p>${state.currentFilter === 'all' ? 'أضف جهازك الأول من اللوحة على اليمين.' : 'جرب تصفية مختلفة.'}</p>
      </div>`;
    return;
  }

  devices.forEach(device => grid.appendChild(buildCard(device)));
}

/* ─── Build Single Card ─────────────────────────── */
function buildCard(device) {
  const session    = device.session;
  const isRunning  = device.running && session?.status === 'running';
  const isPaused   = device.running && session?.status === 'paused';
  const elapsedMs  = device.running ? getElapsedMs(device) : 0;

  const statusClass = isRunning ? 'running' : isPaused ? 'paused' : '';
  const statusLabel = isRunning ? 'شغال' : isPaused ? 'موقف مؤقت' : 'متاح';
  const statusBadge = isRunning ? 'running' : isPaused ? 'paused' : 'available';

  const hasExt      = session && session.extraMs > 0;

  // Action buttons depending on state
  let actionBtns = '';
  if (!device.running) {
    actionBtns = `
      <button class="btn btn-start btn-action-start" data-id="${device.id}">
        <i class="fas fa-play"></i> تشغيل
      </button>
      <button class="btn btn-edit btn-action-edit" data-id="${device.id}">
        <i class="fas fa-pen"></i>
      </button>
      <button class="btn btn-danger-outline btn-action-delete" data-id="${device.id}">
        <i class="fas fa-trash"></i>
      </button>`;
  } else if (isRunning) {
    actionBtns = `
      <button class="btn btn-stop btn-action-stop" data-id="${device.id}">
        <i class="fas fa-hand"></i> إيقاف
      </button>
      <button class="btn btn-pause btn-action-pause" data-id="${device.id}">
        <i class="fas fa-pause"></i>
      </button>
      <button class="btn btn-transfer btn-action-transfer" data-id="${device.id}">
        <i class="fas fa-exchange-alt"></i>
      </button>`;
  } else if (isPaused) {
    actionBtns = `
      <button class="btn btn-stop btn-action-stop" data-id="${device.id}">
        <i class="fas fa-hand"></i> إيقاف
      </button>
      <button class="btn btn-start btn-action-resume" data-id="${device.id}">
        <i class="fas fa-play"></i> استئناف
      </button>`;
  }

  const startTimeTxt = session
    ? `<span class="start-time-label"><i class="fas fa-clock"></i> بدأت ${fmtTime(session.startTime)}</span>`
    : `<span class="start-time-label">—</span>`;

  const li = document.createElement('div');
  li.className     = `device-card ${statusClass} ${hasExt ? 'has-extension' : ''}`;
  li.dataset.id    = device.id;
  li.setAttribute('role', 'article');
  li.setAttribute('aria-label', `جهاز ${device.name}`);

  li.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-name">${escapeHTML(device.name)}</div>
        <div class="card-price">
          <span class="ps-badge"><i class="fas fa-gamepad"></i> ${escapeHTML(device.type)}</span>
          <span class="price-val">${device.pricePerHour}</span> ج/س
        </div>
      </div>
      <span class="status-badge ${statusBadge}">${statusLabel}</span>
    </div>

    <div class="timer-block">
      <span class="timer-icon"><i class="fas fa-circle-notch"></i></span>
      <div>
        <div class="timer-display">${isRunning || isPaused ? fmtElapsed(elapsedMs) : '00:00'}</div>
        <div class="timer-label">${isPaused ? 'موقف مؤقت' : 'منقضي'}</div>
      </div>
      ${device.running ? `<div style="margin-right:auto;text-align:left;">
        <div class="live-cost" style="font-size:0.85rem;font-weight:700;color:var(--gold);direction:ltr;">
          ${parseFloat(calcCost(elapsedMs, device.pricePerHour)).toLocaleString('ar-EG',{minimumFractionDigits:2})} ج
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);">تكلفة حالية</div>
      </div>` : ''}
    </div>

    <div class="card-actions">${actionBtns}</div>

    <div class="card-footer">
      ${startTimeTxt}
      ${hasExt ? `<div class="extra-time-indicator"><i class="fas fa-plus-circle"></i> وقت إضافي</div>` : ''}
    </div>`;

  // Bind button events
  li.querySelector('.btn-action-start')?.addEventListener('click', () => {
    AudioEngine.uiClick();
    openStartOptionsModal(device.id);
  });

  li.querySelector('.btn-action-stop')?.addEventListener('click', () => {
    AudioEngine.uiClick();
    openStopExtendModal(device.id);
  });

  li.querySelector('.btn-action-pause')?.addEventListener('click', () => {
    AudioEngine.pause();
    handlePause(device.id);
  });

  li.querySelector('.btn-action-resume')?.addEventListener('click', () => {
    AudioEngine.resume();
    handleResume(device.id);
  });

  li.querySelector('.btn-action-transfer')?.addEventListener('click', () => {
    AudioEngine.uiClick();
    openTransferModal(device.id);
  });

  li.querySelector('.btn-action-edit')?.addEventListener('click', () => {
    AudioEngine.uiClick();
    openEditModal(device.id);
  });

  li.querySelector('.btn-action-delete')?.addEventListener('click', () => {
    AudioEngine.uiClick();
    handleDelete(device.id);
  });

  return li;
}

/* ─── Add Device Form ───────────────────────────── */
export function bindAddDeviceForm() {
  const form = document.getElementById('add-device-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    AudioEngine.uiClick();

    const name  = document.getElementById('device-name').value.trim();
    const type  = document.getElementById('device-type').value.trim();
    const price = parseFloat(document.getElementById('device-price').value);

    if (!name)       return toastError('اسم الجهاز مطلوب.');
    if (!(price > 0)) return toastError('السعر يجب أن يكون أكبر من صفر.');

    try {
      const newDevice = await API.createDevice({ name, type, pricePerHour: price });
      state.devices.push({ ...newDevice });
      renderDevices();
      form.reset();
      AudioEngine.addDevice();
      toastSuccess(`تم إضافة ${name} بنجاح!`);
    } catch (err) {
      toastError(err.message || 'فشل إضافة الجهاز.');
      AudioEngine.error();
    }
  });
}

/* ─── Pause / Resume ────────────────────────────── */
async function handlePause(deviceId) {
  try {
    const res = await API.pauseSession(deviceId);
    const dev = state.devices.find(d => d.id === deviceId);
    if (dev && dev.session) {
      dev.session.paused       = true;
      dev.session.pausedTimeMs = res.pausedTimeMs;
      dev.session.status       = 'paused';
    }
    renderDevices();
    toastSuccess('تم إيقاف الجلسة مؤقتاً.');
  } catch (err) {
    toastError(err.message || 'فشل الإيقاف المؤقت.');
    AudioEngine.error();
  }
}

async function handleResume(deviceId) {
  try {
    const res = await API.resumeSession(deviceId);
    const dev = state.devices.find(d => d.id === deviceId);
    if (dev && dev.session) {
      dev.session.paused       = false;
      dev.session.pausedTimeMs = 0;
      dev.session.startTime    = res.newStartTime;
      dev.session.extraMs      = 0;
      dev.session.status       = 'running';
    }
    renderDevices();
    toastSuccess('تم استئناف الجلسة.');
  } catch (err) {
    toastError(err.message || 'فشل الاستئناف.');
    AudioEngine.error();
  }
}

/* ─── Delete ────────────────────────────────────── */
async function handleDelete(deviceId) {
  const device = state.devices.find(d => d.id === deviceId);
  if (!device) return;
  if (!confirm(`هل تريد حذف "${device.name}" بشكل نهائي؟`)) return;

  try {
    await API.deleteDevice(deviceId);
    state.devices = state.devices.filter(d => d.id !== deviceId);
    renderDevices();
    AudioEngine.deleteDevice();
    toastSuccess(`تم حذف ${device.name}.`);
  } catch (err) {
    toastError(err.message || 'فشل الحذف.');
    AudioEngine.error();
  }
}
