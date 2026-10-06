// Sound effects. Each sound plays an audio file from assets/sfx/ if one is there
// (release.mp3, cry-1.mp3, cry-4.mp3, ...), otherwise a tiny chiptune made live with Web Audio.
(function () {
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem('np-muted') === '1'; } catch (e) {}

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // one note: frequency (or [from, to] slide), start offset, duration, wave, volume
  function note(f, at, dur, type = 'square', vol = 0.06) {
    const a = ctx();
    if (!a || muted) return;
    const t0 = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    if (Array.isArray(f)) {
      o.frequency.setValueAtTime(f[0], t0);
      o.frequency.exponentialRampToValueAtTime(f[1], t0 + dur);
    } else {
      o.frequency.setValueAtTime(f, t0);
    }
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // ---- audio files (optional) ----
  const samples = {};   // name -> AudioBuffer once loaded, null while loading or missing

  function load(name) {
    if (name in samples) return;
    samples[name] = null;
    const a = ctx();
    if (!a) return;
    fetch(`assets/sfx/${name}.mp3`)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
      .then(buf => new Promise((res, rej) => a.decodeAudioData(buf, res, rej)))
      .then(decoded => { samples[name] = decoded; })
      .catch(() => {});  // no file: the chiptune fallback is used
  }

  // Plays a loaded file. Returns true if the file exists (even when muted), so callers
  // know not to also play the chiptune.
  function play(name, vol = 0.9) {
    const buf = samples[name];
    if (!buf) return false;
    const a = ctx();
    if (a && !muted) {
      const src = a.createBufferSource();
      const g = a.createGain();
      src.buffer = buf;
      g.gain.value = vol;
      src.connect(g).connect(a.destination);
      src.start();
    }
    return true;
  }

  const CRIES = {
    1: () => { note([520, 380], 0, 0.14); note([600, 300], 0.13, 0.22); },           // soft, low
    4: () => { note([700, 980], 0, 0.1); note([980, 620], 0.1, 0.2); note([760, 520], 0.28, 0.12); }, // bright
    7: () => { note([620, 820], 0, 0.12); note([820, 560], 0.12, 0.12); note([660, 880], 0.24, 0.16); }, // bubbly
  };

  window.NakamaSfx = {
    unlock() { ctx(); },
    // call after a tap, e.g. preload(['release', 'cry-4'])
    preload(names) { names.forEach(load); },
    // Plays a longer clip (like a Pokédex voice line) and returns { duration, stop } so it can be cut short,
    // or null when there's no file (or sound is off).
    clip(name, vol = 1) {
      const buf = samples[name];
      const a = ctx();
      if (!buf || !a || muted) return null;
      const src = a.createBufferSource();
      const g = a.createGain();
      src.buffer = buf;
      g.gain.value = vol;
      src.connect(g).connect(a.destination);
      src.start();
      return { duration: buf.duration, stop() { try { src.stop(); } catch (e) {} } };
    },
    release() {
      if (play('release')) return;
      [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.06, 0.09, 'square', 0.05));
      note([180, 60], 0, 0.25, 'triangle', 0.12);
    },
    cry(id) {
      if (play('cry-' + id)) return;
      (CRIES[id] || CRIES[4])();
    },
    move(type, kind) {
      if (kind === 'tailwhip') { for (let i = 0; i < 4; i++) note([900, 400], i * 0.13, 0.07, 'triangle', 0.05); return; }
      if (kind === 'bubble') for (let i = 0; i < 5; i++) note([500 + Math.random() * 500, 1400], 0.25 + i * 0.15, 0.06, 'sine', 0.05);
      if (type === 'fire') for (let i = 0; i < 6; i++) note([300 - i * 20, 120], i * 0.07, 0.07, 'sawtooth', 0.025);
      if (type === 'water' && !kind) for (let i = 0; i < 5; i++) note([500 + Math.random() * 500, 1400], i * 0.11, 0.06, 'sine', 0.05);
      if (type === 'grass') for (let i = 0; i < 4; i++) note([1200, 700], i * 0.12, 0.08, 'triangle', 0.04);
    },
    blip() { note(1200, 0, 0.02, 'square', 0.02); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('np-muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
  };
})();
