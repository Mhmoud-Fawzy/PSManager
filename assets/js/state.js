/**
 * state.js — Centralized Application State
 */

const state = {
  devices:        [],        // Array from API
  currentFilter:  'all',     // 'all' | 'running' | 'available'

  // Modal context
  pendingStartId:    null,
  pendingStopId:     null,
  pendingEditId:     null,
  pendingTransferId: null,
  selectedTransferTargetId: null,

  seMultiplayerMode: false,  // multiplayer toggle in stop modal
};

export default state;

/* Convenience getters */
export function getDevice(id) {
  return state.devices.find(d => d.id === id) ?? null;
}

export function getActiveDevices() {
  return state.devices.filter(d => d.running);
}

export function getAvailableDevices() {
  return state.devices.filter(d => !d.running);
}

export function updateDevice(id, patch) {
  const idx = state.devices.findIndex(d => d.id === id);
  if (idx !== -1) Object.assign(state.devices[idx], patch);
}

export function replaceDevices(list) {
  state.devices = list;
}
