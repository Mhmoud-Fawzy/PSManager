/**
 * modals.js — Modal Open/Close Controller + Live Previews
 */

import AudioEngine from './audio.js';
import state from './state.js';
import { getElapsedMs, fmtElapsed, calcCost, fmtDuration, fmtTime, escapeHTML } from './utils.js';
import { toastError } from './toast.js';

/* ─── Generic open/close ────────────────────────── */
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  AudioEngine.modalOpen();
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  AudioEngine.modalClose();
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
  stopSePreview();
}

/* ─── Result Modal ──────────────────────────────── */
export function openResultModal(data) {
  document.getElementById('modal-device-name').textContent = `${data.deviceName} — ملخص الجلسة`;
  document.getElementById('modal-start').textContent    = fmtTime(data.startTime);
  document.getElementById('modal-end').textContent      = fmtTime(data.endTime);
  document.getElementById('modal-duration').textContent = fmtDuration(data.elapsedMs);
  document.getElementById('modal-cost').textContent     =
    `${parseFloat(data.totalCost).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} جنيه`;

  // Extra time row
  const extraRow = document.getElementById('modal-extra-row');
  if (data.extraMs > 0) {
    extraRow.style.display = '';
    document.getElementById('modal-extra').textContent = fmtDuration(data.extraMs);
  } else {
    extraRow.style.display = 'none';
  }

  // Multiplayer row
  const multiRow = document.getElementById('modal-multi-row');
  if (data.multiMinutes > 0) {
    multiRow.style.display = '';
    document.getElementById('modal-multi-info').textContent =
      `${data.multiMinutes} د × ${data.multiPricePh} ج/س = ` +
      data.multiCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج';
  } else {
    multiRow.style.display = 'none';
  }

  // Segment breakdown (transfer history)
  const segSection = document.getElementById('modal-segments-section');
  if (data.segments && data.segments.length > 1) {
    let html = '';
    data.segments.forEach(seg => {
      const dur = (seg.end_time || Date.now()) - seg.start_time;
      html += `<div class="segment-row">
        <span><i class="fas fa-gamepad" style="margin-left:5px;color:var(--cyan);"></i>${escapeHTML(seg.device_name)}</span>
        <span>${fmtDuration(dur)}</span>
      </div>`;
    });
    segSection.innerHTML = `<div class="segment-breakdown">
      <div class="segment-breakdown-title"><i class="fas fa-route"></i> مسار الجلسة (${data.segments.length} أجهزة)</div>
      ${html}
    </div>`;
    segSection.style.display = '';
  } else {
    segSection.style.display = 'none';
    segSection.innerHTML = '';
  }

  const overlay = document.getElementById('result-modal');
  overlay.classList.add('open');
  document.getElementById('modal-close-btn').focus();
  AudioEngine.sessionEnd();
}

/* ─── Stop/Extend Modal ─────────────────────────── */
let sePreviewRaf = null;

export function openStopExtendModal(deviceId) {
  state.pendingStopId    = deviceId;
  state.seMultiplayerMode = false;

  const device = state.devices.find(d => d.id === deviceId);
  if (!device) return;

  document.getElementById('se-device-name').textContent = `${device.name} — إيقاف أو تمديد`;
  document.getElementById('custom-extend-input').value  = '';

  // Reset multiplayer
  document.getElementById('se-multi-toggle').classList.remove('active');
  document.getElementById('se-multi-inputs').style.display = 'none';
  document.getElementById('se-multi-minutes').value         = '';
  document.getElementById('se-multi-price-ph').value        = '';
  resetBreakdown();

  document.getElementById('stop-extend-modal').classList.add('open');
  AudioEngine.modalOpen();
  startSePreview(device);
}

export function closeStopExtendModal() {
  document.getElementById('stop-extend-modal').classList.remove('open');
  stopSePreview();
  state.pendingStopId = null;
  AudioEngine.modalClose();
}

export function resetBreakdown() {
  document.getElementById('bd-normal-time').textContent  = '— دقيقة';
  document.getElementById('bd-normal-price').textContent = '0.00 ج';
  document.getElementById('bd-multi-time').textContent   = '— دقيقة';
  document.getElementById('bd-multi-price').textContent  = '0.00 ج';
  document.getElementById('bd-total-price').textContent  = '0.00 جنيه';
}

function startSePreview(device) {
  stopSePreview();
  function tick() {
    if (!state.pendingStopId) return;
    const elapsed      = getElapsedMs(device);
    const totalMinutes = Math.floor(elapsed / 60000);

    document.getElementById('se-live-time').textContent =
      fmtElapsed(elapsed);
    document.getElementById('se-live-cost').textContent =
      parseFloat(calcCost(elapsed, device.pricePerHour))
        .toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج';

    document.getElementById('se-end-duration').textContent =
      fmtDuration(elapsed);
    document.getElementById('se-end-normal-price').textContent =
      parseFloat(calcCost(elapsed, device.pricePerHour))
        .toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج';
    document.getElementById('se-multi-minutes-hint').textContent =
      `الحد الأقصى: ${totalMinutes} دقيقة`;

    if (state.seMultiplayerMode) recalcMultiplayer(device);
    sePreviewRaf = requestAnimationFrame(tick);
  }
  sePreviewRaf = requestAnimationFrame(tick);
}

function stopSePreview() {
  if (sePreviewRaf) { cancelAnimationFrame(sePreviewRaf); sePreviewRaf = null; }
}

export function recalcMultiplayer(device) {
  if (!device) {
    device = state.devices.find(d => d.id === state.pendingStopId);
    if (!device) return;
  }
  const elapsed      = getElapsedMs(device);
  const totalMinutes = Math.floor(elapsed / 60000);
  const rawMulti     = parseInt(document.getElementById('se-multi-minutes').value, 10);
  const multiPriceH  = parseFloat(document.getElementById('se-multi-price-ph').value) || 0;
  const multiMin     = isNaN(rawMulti) ? 0 : Math.max(0, Math.min(rawMulti, totalMinutes));
  const normalMin    = totalMinutes - multiMin;
  const normalPrice  = (normalMin  / 60) * device.pricePerHour;
  const multiPrice   = (multiMin   / 60) * multiPriceH;
  const total        = normalPrice + multiPrice;
  const fmt          = n => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  document.getElementById('bd-normal-time').textContent  = `${normalMin} دقيقة`;
  document.getElementById('bd-normal-price').textContent = fmt(normalPrice) + ' ج';
  document.getElementById('bd-multi-time').textContent   = `${multiMin} دقيقة`;
  document.getElementById('bd-multi-price').textContent  = fmt(multiPrice) + ' ج';
  document.getElementById('bd-total-price').textContent  = fmt(total) + ' جنيه';
}

/* ─── Start Options Modal ───────────────────────── */
export function openStartOptionsModal(deviceId) {
  state.pendingStartId = deviceId;
  const device = state.devices.find(d => d.id === deviceId);
  if (!device) return;
  document.getElementById('so-title').textContent       = `تشغيل ${device.name}`;
  document.getElementById('so-device-name').textContent = `${device.type} — اختر نوع الجلسة`;
  document.getElementById('so-custom-minutes').value    = '';
  document.getElementById('start-options-modal').classList.add('open');
  AudioEngine.modalOpen();
}

export function closeStartOptionsModal() {
  document.getElementById('start-options-modal').classList.remove('open');
  state.pendingStartId = null;
  AudioEngine.modalClose();
}

/* ─── Session Ended Modal (time-up) ─────────────── */
export function openSessionEndedModal(device, elapsedMs, currentCost) {
  document.getElementById('sen-device-name').textContent = `${device.name} — انتهى الوقت المحدد!`;
  document.getElementById('sen-duration').textContent    = fmtElapsed(elapsedMs);
  document.getElementById('sen-cost').textContent        =
    parseFloat(currentCost).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' جنيه';
  document.getElementById('sen-custom-minutes').value    = '';
  document.getElementById('session-ended-modal').classList.add('open');
  AudioEngine.timeUp();
}

/* ─── Transfer Modal ────────────────────────────── */
export function openTransferModal(fromDeviceId) {
  state.pendingTransferId       = fromDeviceId;
  state.selectedTransferTargetId = null;

  const fromDevice = state.devices.find(d => d.id === fromDeviceId);
  if (!fromDevice) return;

  document.getElementById('tr-subtitle').textContent =
    `نقل جلسة ${fromDevice.name} إلى جهاز متاح`;

  const available = state.devices.filter(d => !d.running && d.id !== fromDeviceId);
  const listEl    = document.getElementById('tr-device-list');
  const noEl      = document.getElementById('tr-no-devices');
  const confirmEl = document.getElementById('tr-confirm-btn');

  listEl.innerHTML = '';
  confirmEl.disabled = true;

  if (available.length === 0) {
    noEl.style.display = '';
    listEl.style.display = 'none';
  } else {
    noEl.style.display   = 'none';
    listEl.style.display = '';

    available.forEach(dev => {
      const item = document.createElement('div');
      item.className = 'transfer-device-item';
      item.dataset.targetId = dev.id;
      item.innerHTML = `
        <div class="td-icon"><i class="fas fa-gamepad"></i></div>
        <div>
          <div class="td-name">${escapeHTML(dev.name)}</div>
          <div class="td-price">${dev.pricePerHour} ج/س — ${escapeHTML(dev.type)}</div>
        </div>
        <div class="transfer-device-radio"></div>`;

      item.addEventListener('click', () => {
        listEl.querySelectorAll('.transfer-device-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        state.selectedTransferTargetId = dev.id;
        confirmEl.disabled = false;
      });

      listEl.appendChild(item);
    });
  }

  document.getElementById('transfer-modal').classList.add('open');
  AudioEngine.modalOpen();
}

export function closeTransferModal() {
  document.getElementById('transfer-modal').classList.remove('open');
  state.pendingTransferId        = null;
  state.selectedTransferTargetId = null;
  AudioEngine.modalClose();
}

/* ─── Edit Modal ────────────────────────────────── */
export function openEditModal(deviceId) {
  state.pendingEditId = deviceId;
  const device = state.devices.find(d => d.id === deviceId);
  if (!device) return;

  document.getElementById('edit-device-name').value  = device.name;
  document.getElementById('edit-device-type').value  = device.type;
  document.getElementById('edit-device-price').value = device.pricePerHour;
  document.getElementById('edit-name-error').textContent  = '';
  document.getElementById('edit-price-error').textContent = '';

  document.getElementById('edit-modal').classList.add('open');
  AudioEngine.modalOpen();
}

export function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  state.pendingEditId = null;
  AudioEngine.modalClose();
}
