/**
 * api.js — Centralized Fetch Wrapper for all API calls
 */

const BASE = 'api';

async function request(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res  = await fetch(`${BASE}/${endpoint}`, opts);
  const json = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));

  if (!json.success) {
    const err = new Error(json.error || 'Unknown error');
    err.status = res.status;
    throw err;
  }
  return json.data;
}

/* ─── Auth ─────────────────────────────────────── */
export const checkAuth  = ()          => request('auth?action=check');
export const login      = (u, p)      => request('auth?action=login',  'POST', { username: u, password: p });
export const logout     = ()          => request('auth?action=logout', 'POST');

/* ─── Devices ───────────────────────────────────── */
export const fetchDevices  = ()       => request('devices');
export const createDevice  = (data)   => request('devices', 'POST', data);
export const updateDevice  = (id, d)  => request(`devices?id=${id}`, 'PUT', d);
export const deleteDevice  = (id)     => request(`devices?id=${id}`, 'DELETE');

/* ─── Sessions ──────────────────────────────────── */
const sess = (action, body) => request(`sessions?action=${action}`, 'POST', body);

export const startSession    = (deviceId, isFixed, fixedMinutes) =>
  sess('start',    { deviceId, isFixed, fixedMinutes });

export const pauseSession    = (deviceId) =>
  sess('pause',    { deviceId });

export const resumeSession   = (deviceId) =>
  sess('resume',   { deviceId });

export const extendSession   = (deviceId, minutes) =>
  sess('extend',   { deviceId, minutes });

export const stopSession     = (deviceId, multiMinutes, multiPricePh) =>
  sess('stop',     { deviceId, multiMinutes, multiPricePh });

export const transferSession = (fromDeviceId, toDeviceId) =>
  sess('transfer', { fromDeviceId, toDeviceId });

export const markEndAlert    = (deviceId) =>
  sess('end_alert', { deviceId });

export const fetchHistory    = () => request('sessions?action=history');
