/**
 * timers.js — RAF-Based Timer Engine
 * Updates all running/paused device card timers every second.
 */

import { getElapsedMs, fmtElapsed, calcCost } from './utils.js';
import state from './state.js';

let rafId = null;
let lastTick = 0;

export function startTimerLoop() {
  if (rafId) return;
  tick();
}

export function stopTimerLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function tick(now = 0) {
  rafId = requestAnimationFrame(tick);
  if (now - lastTick < 1000) return;
  lastTick = now;
  updateTimers();
}

function updateTimers() {
  const nowMs = Date.now();

  state.devices.forEach(device => {
    if (!device.running || !device.session) return;

    const card = document.querySelector(`[data-id="${device.id}"]`);
    if (!card) return;

    const session   = device.session;
    const elapsedMs = getElapsedMs(device, nowMs);

    // Update timer display
    const timerEl = card.querySelector('.timer-display');
    if (timerEl) timerEl.textContent = fmtElapsed(elapsedMs);

    // Update cost in footer
    const costEl = card.querySelector('.live-cost');
    if (costEl) {
      const cost = calcCost(elapsedMs, device.pricePerHour);
      costEl.textContent = `${parseFloat(cost).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج`;
    }

    // Fixed session: check if time is up
    if (session.isFixed && !session.endAlertPlayed && !session.paused) {
      const limitMs = (session.fixedDuration * 60 * 1000);
      if (elapsedMs >= limitMs) {
        session.endAlertPlayed = true;
        import('./app.js').then(m => m.triggerTimeUp(device.id));
      }
    }
  });
}
