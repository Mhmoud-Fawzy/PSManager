/**
 * utils.js — Formatting & Utility Helpers
 */

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ar-EG', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export function fmtDuration(ms) {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(`${h}س`);
  if (m || h) parts.push(`${m}د`);
  parts.push(`${s}ث`);
  return parts.join(' ');
}

export function fmtElapsed(ms) {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function calcCost(ms, pricePerHour) {
  const hours = Math.max(0, ms) / 3_600_000;
  return (hours * pricePerHour).toFixed(2);
}

export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getElapsedMs(device, now = Date.now()) {
  if (!device.running || !device.session) return 0;
  const s = device.session;
  if (s.paused && s.pausedTimeMs !== undefined) return s.pausedTimeMs;
  return (now - s.startTime) + (s.extraMs || 0);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
