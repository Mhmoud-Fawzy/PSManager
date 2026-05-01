/**
 * audio.js — Web Audio Engine (synthesised sounds, no external files)
 */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let activeNodes = [];
  let lastMethodCall = {};
  const MIN_INTERVAL = 0.12;

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { return null; }
    } else {
      if (ctx.state === 'suspended') ctx.resume();
    }
    return ctx;
  }

  function getMasterGain() {
    const ac = getCtx();
    if (!ac) return null;
    if (!masterGain) {
      masterGain = ac.createGain();
      masterGain.connect(ac.destination);
      masterGain.gain.value = 0.5;
    }
    return masterGain;
  }

  function stopAll() {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    activeNodes.forEach(p => {
      try { p.osc.stop(now); } catch {}
      try { p.osc.disconnect(); } catch {}
      try { p.gain.disconnect(); } catch {}
    });
    activeNodes = [];
  }

  function play(freq = 440, dur = 0.18, type = 'sine', vol = 0.18, delay = 0, shape = 'soft') {
    const ac = getCtx();
    if (!ac) return;
    const mg = getMasterGain();
    if (!mg) return;

    const start = ac.currentTime + delay;
    const osc   = ac.createOscillator();
    const gain  = ac.createGain();

    osc.connect(gain);
    gain.connect(mg);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    if (shape === 'click') {
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    } else if (shape === 'pluck') {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    } else {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + dur * 0.3);
      gain.gain.linearRampToValueAtTime(0, start + dur);
    }

    osc.start(start);
    osc.stop(start + dur + 0.01);

    const pair = { osc, gain };
    activeNodes.push(pair);
    setTimeout(() => {
      activeNodes = activeNodes.filter(n => n !== pair);
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    }, (dur + delay) * 1000 + 50);
  }

  const baseAPI = {
    uiClick()     { play(660, 0.07, 'sine', 0.10, 0, 'click'); },
    modalOpen()   { play(520,0.18,'sine',0.10,0,'soft'); play(780,0.18,'sine',0.10,0.10,'soft'); },
    modalClose()  { play(480, 0.14, 'sine', 0.08, 0, 'soft'); },
    sessionStart(){ [440,554,659,880].forEach((f,i)=>play(f,0.16,'sine',0.12,i*0.07,'pluck')); },
    sessionEnd()  { [660,550,440].forEach((f,i)=>play(f,0.18,'sine',0.10,i*0.09,'soft')); },
    pause()       { play(520,0.15,'sine',0.10,0,'soft'); play(380,0.15,'sine',0.08,0.12,'soft'); },
    resume()      { play(380,0.13,'sine',0.08,0,'pluck'); play(520,0.13,'sine',0.10,0.10,'pluck'); play(660,0.13,'sine',0.08,0.20,'pluck'); },
    edit()        { play(700,0.12,'sine',0.10,0,'pluck'); play(900,0.10,'sine',0.08,0.09,'pluck'); },
    extend()      { play(600,0.1,'sine',0.10,0,'pluck'); play(800,0.1,'sine',0.10,0.08,'pluck'); },
    addDevice()   { play(700,0.12,'sine',0.10,0,'pluck'); play(880,0.12,'sine',0.08,0.10,'pluck'); },
    deleteDevice(){ play(300, 0.2, 'sine', 0.08, 0, 'soft'); },
    error()       { play(220,0.10,'sawtooth',0.06,0,'click'); play(200,0.10,'sawtooth',0.06,0.10,'click'); },
    info()        { play(750, 0.12, 'sine', 0.08, 0, 'pluck'); },
    timeUp()      { [880,880,880].forEach((f,i)=>play(f,0.15,'square',0.12,i*0.22,'click')); },
    toggleOn()    { play(550,0.10,'sine',0.10,0,'pluck'); play(730,0.10,'sine',0.08,0.08,'pluck'); },
    toggleOff()   { play(440, 0.10, 'sine', 0.08, 0, 'soft'); },
    transfer()    { play(600,0.12,'sine',0.10,0,'pluck'); play(900,0.12,'sine',0.10,0.09,'pluck'); play(1200,0.10,'sine',0.08,0.18,'pluck'); },
  };

  // Wrap with debounce protection
  const api = {};
  Object.keys(baseAPI).forEach(name => {
    api[name] = function() {
      const now  = performance.now() / 1000;
      const last = lastMethodCall[name] || 0;
      if (now - last < MIN_INTERVAL) return;
      lastMethodCall[name] = now;
      stopAll();
      baseAPI[name].call(this);
    };
  });

  return api;
})();

export default AudioEngine;
