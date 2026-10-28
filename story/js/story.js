// Story / landing page: every Pokémon here runs on the app's own engine (../js/creature.js).
// One animation loop draws the live ones that are on screen; the rest are static portraits.
(function () {
  const S = window.NAKAMA_SPRITES, DEX = window.NAKAMA_POKEDEX, CFG = window.NAKAMA_CONFIG || {};
  const TEX = window.NAKAMA_TEX || 72;
  const DEMO = 'https://nakamaprints.github.io/?try&demo';   // the card on this page: a phone that scans it gets the no-camera demo
  const RARES = [6, 94, 144, 145, 146, 150];
  const ALL = Object.keys(S).map(Number).sort((a, b) => a - b);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const isRare = id => RARES.includes(id);
  const title = n => n.charAt(0) + n.slice(1).toLowerCase();
  const no = id => 'No.' + String(id).padStart(3, '0');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // the opening fills the screen below the top bar, whatever height the bar ends up
  const topBar = document.querySelector('.top');
  const setTop = () => document.documentElement.style.setProperty('--toph', topBar.offsetHeight + 'px');
  setTop();
  addEventListener('resize', setTop);

  // ---------- static portraits (colour, or a flat silhouette)
  const protos = {};
  const proto = id => protos[id] || (protos[id] = new NakamaCreature(id));
  function paint(canvas, id, fill) {
    const c = proto(id), ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(c.frames['000'], c.sx, c.sy);
    if (fill) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function canvas72() {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    c.className = 'px';
    return c;
  }

  // ---------- live creatures: one rAF loop, only for the ones on screen
  const actors = new Set();
  const seen = new WeakMap();   // host element -> visible?
  const io = new IntersectionObserver(entries => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
  }, { rootMargin: '120px' });

  // `target`: a canvas to mirror into, or an element to put the creature's own canvas in
  function live(id, target, rare, onEvent) {
    const c = new NakamaCreature(id);
    c.rare = !!rare;
    if (onEvent) c.onEvent = onEvent;
    const a = { c, mirror: target.tagName === 'CANVAS' ? target : null, host: target };
    if (!a.mirror) { target.textContent = ''; target.appendChild(c.canvas); }
    seen.has(a.host) || (seen.set(a.host, true), io.observe(a.host));
    c.appear();
    if (reduced) { for (let i = 0; i < 16; i++) c.update(100); render(a); }
    else actors.add(a);
    return a;
  }
  function stop(a) { if (a) actors.delete(a); }
  function render(a) {
    a.c.draw();
    if (a.mirror) {
      const ctx = a.mirror.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, TEX, TEX);
      ctx.drawImage(a.c.canvas, 0, 0);
    }
  }
  let last = 0;
  function frame(t) {
    const dt = last ? t - last : 16;
    last = t;
    for (const a of actors) {
      if (!seen.get(a.host)) continue;
      a.c.update(dt);
      render(a);
    }
    requestAnimationFrame(frame);
  }
  if (!reduced) requestAnimationFrame(frame);

  // run `fn` the first time `el` scrolls into view
  function onView(el, fn, opts) {
    const o = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { o.disconnect(); fn(); }
    }, opts || { threshold: 0.25 });
    o.observe(el);
  }

  // typewriter, one at a time per element
  const typing = new WeakMap();
  function type(el, text, speed) {
    const job = {};
    typing.set(el, job);
    if (reduced) { el.textContent = text; return Promise.resolve(); }
    return new Promise(async done => {
      for (let i = 1; i <= text.length; i++) {
        if (typing.get(el) !== job) return done();
        el.textContent = text.slice(0, i);
        await wait(speed || 28);
      }
      done();
    });
  }

  // ---------- sound: off until the speaker button is tapped (browsers need a tap before audio anyway).
  // Plays ../assets/sfx/release.mp3 when a ball opens and cry-<dex>.mp3 when the Pokémon lands, the
  // same files the app uses. CRIES lists the Pokémon that have a cry file so missing ones aren't fetched.
  const CRIES = new Set([]);
  const snd = { on: false, ac: null, bufs: {} };
  function sndCtx() {
    if (!snd.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      snd.ac = new AC();
    }
    if (snd.ac.state === 'suspended') snd.ac.resume();
    return snd.ac;
  }
  function sndLoad(name) {
    if (!(name in snd.bufs)) {
      snd.bufs[name] = fetch('../assets/sfx/' + name + '.mp3')
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
        .then(b => new Promise((res, rej) => sndCtx().decodeAudioData(b, res, rej)))
        .catch(() => null);
    }
    return snd.bufs[name];
  }
  async function sndPlay(name, vol) {
    if (!snd.on) return;
    const ac = sndCtx(), buf = ac && await sndLoad(name);
    if (!buf || !snd.on) return;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf;
    g.gain.value = vol || 0.8;
    src.connect(g).connect(ac.destination);
    src.start();
  }
  const cry = id => { if (CRIES.has(+id)) sndPlay('cry-' + id); };
  const sndBtn = $('sndBtn');
  sndBtn.addEventListener('click', () => {
    snd.on = !snd.on;
    sndBtn.classList.toggle('on', snd.on);
    sndBtn.setAttribute('aria-pressed', String(snd.on));
    sndBtn.setAttribute('aria-label', snd.on ? 'Sound: on. Tap to mute' : "Sound: off. Turn on to hear each Pokémon's cry");
    if (snd.on) { sndCtx(); sndLoad('release'); CRIES.has(heroId) ? cry(heroId) : sndPlay('release', 0.6); }
  });

  // ---------- hero: shake, open, pop
  const stage = $('stage'), pop = $('pop'), flash = $('flash'), heroText = $('heroText');
  const HERO = [25, 7, 4, 6, 133, 1, 143, 94, 39, 54, 150, 52, 16, 131, 145, 128, 123, 130, 146, 144];
  let heroI = 0, heroRun = 0, heroActor = null, heroTimer = 0, heroVisible = true, heroId = 0;

  async function openBall() {
    const run = ++heroRun;
    clearTimeout(heroTimer);
    const id = HERO[heroI++ % HERO.length], rare = isRare(id);
    stop(heroActor);
    pop.textContent = '';
    stage.classList.remove('open', 'rare', 'shake');
    flash.classList.remove('on', 'gold');
    type(heroText, 'Who\'s inside?');
    if (!reduced) {
      await wait(500);
      if (run !== heroRun) return;
      void stage.offsetWidth;
      stage.classList.add('shake');
      await wait(900);
      if (run !== heroRun) return;
    }
    stage.classList.remove('shake');
    stage.classList.add('open');
    if (rare) stage.classList.add('rare');
    flash.classList.toggle('gold', rare);
    void flash.offsetWidth;
    flash.classList.add('on');
    heroId = id;
    sndPlay('release', 0.6);
    if (CRIES.has(id)) sndLoad('cry-' + id);
    heroActor = live(id, pop, rare, ev => { if (ev === 'cry') cry(id); });
    await wait(reduced ? 0 : 750);
    if (run !== heroRun) return;
    await type(heroText, rare ? '★ Whoa, a rare ' + title(S[id].name) + '! ★' : 'You found ' + title(S[id].name) + '!');
    if (run !== heroRun || reduced) return;
    heroTimer = setTimeout(function next() {
      if (heroVisible && !document.hidden) openBall();
      else heroTimer = setTimeout(next, 1500);
    }, 4200);
  }
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(stage);
  openBall();

  // ---------- the card: flip, and a real QR to the demo on its front
  const flip = $('flipcard');
  flip.addEventListener('click', () => {
    const on = flip.classList.toggle('flipped');
    flip.setAttribute('aria-pressed', on);
  });
  flip.setAttribute('aria-pressed', 'false');
  function drawQr() {
    if (!window.qrcode) return;
    const q = window.qrcode(0, 'M');
    q.addData(DEMO);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    $('qr').innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path d="' + d + '" fill="#111"/></svg>';
  }
  window.qrcode ? drawQr() : window.addEventListener('load', drawQr);

  // ---------- the talking Pokédex
  const TYPE_COL = {
    Grass: '#5fa83a', Poison: '#9142a0', Fire: '#e06a1c', Water: '#3f72e0', Flying: '#7f6ad8', Electric: '#e2b800',
    Normal: '#8a8a64', Fairy: '#d2648c', Ghost: '#5f4a8c', Bug: '#8a9a12', Psychic: '#e04a74', Ice: '#3fa8b0', Dragon: '#5f2ae0',
  };
  const dex = $('dex'), dexText = $('dexText'), dexPlay = $('dexPlay'), dexPick = $('dexPick');
  let dexId = 4, dexAudio = null, dexActor = null, dexRaf = 0;

  function dexStop() {
    if (dexAudio) { dexAudio.pause(); dexAudio = null; }
    cancelAnimationFrame(dexRaf);
    dex.classList.remove('speaking');
    dexPlay.textContent = '▶ Hear it';
  }
  function dexShow(id) {
    dexStop();
    dexId = id;
    const e = DEX[id], name = S[id].name;
    $('dexNo').textContent = no(id) + (isRare(id) ? ' ★' : '');
    $('dexName').textContent = name;
    $('dexSpecies').textContent = e.species;
    $('dexTypes').innerHTML = e.types.map(t => '<span style="--t:' + (TYPE_COL[t] || '#777') + '">' + t + '</span>').join('');
    $('dexHW').textContent = 'HT ' + e.height + ' · WT ' + e.weight;
    dexText.textContent = e.text;
    stop(dexActor);
    dexActor = live(id, $('dexPortrait'), isRare(id));
    for (const b of dexPick.children) b.setAttribute('aria-pressed', String(+b.dataset.id === id));
  }
  function dexSpeak() {
    if (dexAudio) return dexStop();
    const text = DEX[dexId].text;
    const a = dexAudio = new Audio('../assets/sfx/dex-' + dexId + '.mp3');
    dex.classList.add('speaking');
    dexPlay.textContent = '■ Stop';
    dexText.textContent = '';
    const tick = () => {
      if (dexAudio !== a) return;
      const k = a.duration ? Math.min(1, (a.currentTime / a.duration) * 1.08) : 0;
      dexText.textContent = text.slice(0, Math.ceil(text.length * k));
      if (!a.ended) dexRaf = requestAnimationFrame(tick);
    };
    a.addEventListener('ended', () => { if (dexAudio === a) { dexText.textContent = text; dexStop(); } });
    a.play().then(tick).catch(() => { dexText.textContent = text; dexStop(); });
  }
  for (const id of ALL) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    b.setAttribute('aria-label', title(S[id].name));
    const c = canvas72();
    paint(c, id);
    b.appendChild(c);
    b.addEventListener('click', () => dexShow(id));
    dexPick.appendChild(b);
  }
  dexPlay.addEventListener('click', dexSpeak);
  dexShow(4);
  dexText.textContent = 'Tap ▶ Hear it (sound on).';

  // ---------- Who's that Pokémon?
  const wtp = $('guess'), wtpSil = $('wtpSil'), wtpLive = $('wtpLive'), wtpAnswer = $('wtpAnswer'), wtpBtn = $('wtpBtn');
  let wtpId = 0, wtpActor = null;
  function wtpNew() {
    let id;
    do id = ALL[Math.floor(Math.random() * ALL.length)]; while (id === wtpId);
    wtpId = id;
    stop(wtpActor);
    wtpLive.textContent = '';
    wtp.classList.remove('revealed');
    paint(wtpSil, id, '#16204a');
    wtpBtn.textContent = 'Reveal!';
  }
  wtpBtn.addEventListener('click', () => {
    if (wtp.classList.contains('revealed')) {
      wtpNew();
      type(wtpAnswer, 'And this one?');
      return;
    }
    wtp.classList.add('revealed');
    const rare = isRare(wtpId);
    wtpActor = live(wtpId, wtpLive, rare);
    type(wtpAnswer, 'It\'s ' + S[wtpId].name + '!' + (rare ? ' ★ A rare one!' : ''));
    wtpBtn.textContent = 'Another one ▸';
  });
  wtpNew();

  // ---------- My Pokédex: tap the silhouettes
  const START = [4, 7, 25, 39, 133, 6];
  const pdx = $('pdx'), grid = $('pdxGrid'), master = $('master');
  let found = new Set(START);
  const slots = {};
  function pdxCounts() {
    const n = found.size, r = RARES.filter(id => found.has(id)).length;
    $('pdxCount').textContent = n + '/' + ALL.length;
    $('pdxMeter').style.width = (n / ALL.length) * 100 + '%';
    $('pdxRare').textContent = '★ Rare found: ' + r + ' of ' + RARES.length;
    const done = n === ALL.length;
    pdx.classList.toggle('complete', done);
    return done;
  }
  function pdxSlot(id, just) {
    const b = slots[id], has = found.has(id), rare = isRare(id);
    b.className = 'slot' + (rare ? ' rare' : '') + (has ? ' caught' : '') + (just ? ' just' : '');
    paint(b.querySelector('canvas'), id, has ? null : rare ? '#4a3c14' : '#2e2e36');
    b.querySelector('.nm').textContent = has ? title(S[id].name) : rare ? '★ ???' : '???';
    b.setAttribute('aria-label', no(id) + (has ? ', ' + title(S[id].name) : ', not found yet. Tap to reveal') + (rare ? ', rare' : ''));
  }
  function pdxFind(id) {
    if (found.has(id)) return false;
    found.add(id);
    pdxSlot(id, true);
    if (pdxCounts()) setTimeout(() => { master.hidden = false; $('masterClose').focus(); }, reduced ? 0 : 500);
    return true;
  }
  for (const id of ALL) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="no">' + no(id) + '</span>';
    const c = canvas72();
    b.appendChild(c);
    const nm = document.createElement('span');
    nm.className = 'nm';
    b.appendChild(nm);
    b.addEventListener('click', () => pdxFind(id));
    slots[id] = b;
    grid.appendChild(b);
    pdxSlot(id);
  }
  pdxCounts();
  $('pdxFill').addEventListener('click', async () => {
    for (const id of ALL) {
      if (pdxFind(id) && !reduced) await wait(90);
    }
  });
  $('pdxReset').addEventListener('click', () => {
    found = new Set(START);
    master.hidden = true;
    ALL.forEach(id => pdxSlot(id));
    pdxCounts();
  });
  $('masterClose').addEventListener('click', () => { master.hidden = true; $('pdxReset').focus(); });

  // ---------- the six rares, twinkling
  const rareList = $('rareList');
  const rareCanvases = RARES.map(id => {
    const li = document.createElement('li');
    const c = canvas72();
    paint(c, id);
    li.appendChild(c);
    li.appendChild(document.createTextNode(title(S[id].name)));
    rareList.appendChild(li);
    return c;
  });
  onView(rareList, () => RARES.forEach((id, i) => setTimeout(() => live(id, rareCanvases[i], true), reduced ? 0 : i * 220)));

  // ---------- trade mock: Squirtle for Pikachu
  const tm = document.querySelector('.trade-mock'), tStatus = $('tradeStatus');
  const tA = $('tradeA'), tB = $('tradeB');
  const [labA, labB] = tm.querySelectorAll('.tm-slot > span');
  paint(tA, 7); paint(tB, 25);
  let tRun = false;
  async function tradeLoop() {
    if (tRun) return;
    tRun = true;
    let a = live(7, tA), b = live(25, tB);
    if (reduced) return;
    for (;;) {
      tm.classList.remove('swapping');
      tStatus.className = 'chip';
      tStatus.textContent = 'Offer sent…';
      labA.innerHTML = 'SQUIRTLE <em>×2</em>'; labB.textContent = 'PIKACHU';
      await wait(2200);
      tStatus.className = 'chip ok';
      tStatus.textContent = 'Priya accepted!';
      await wait(1300);
      tm.classList.add('swapping');
      stop(a); stop(b);
      a = live(25, tA); b = live(7, tB);
      labA.textContent = 'PIKACHU'; labB.textContent = 'SQUIRTLE';
      tStatus.textContent = '✓ Trade complete';
      await wait(3600);
      stop(a); stop(b);
      a = live(7, tA); b = live(25, tB);
    }
  }
  onView(tm, tradeLoop);

  // ---------- the ball-opening clip plays while it's on screen
  const clip = $('openClip');
  if (reduced) clip.controls = true;
  else new IntersectionObserver(es => {
    es[0].isIntersecting ? clip.play().catch(() => {}) : clip.pause();
  }, { threshold: 0.4 }).observe(clip);

  // ---------- outro line-up
  const row = $('outroRow');
  const LINEUP = [1, 4, 7, 25, 133, 143, 150];
  const outro = LINEUP.map(() => { const c = canvas72(); row.appendChild(c); return c; });
  onView(row, () => LINEUP.forEach((id, i) => setTimeout(() => live(id, outro[i], isRare(id)), reduced ? 0 : i * 180)));

  // ---------- fade sections in as they scroll up
  if (!reduced) {
    const els = document.querySelectorAll('.sec-head, .step, .kit, .kit-list, .pdx, .rares > *, .trade, .trade-phones, .reel > *, .cards, .want-grid');
    const ro = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (const el of els) {
      if (el.getBoundingClientRect().top < innerHeight) continue;   // already on screen: leave it be
      el.classList.add('reveal');
      ro.observe(el);
    }
  }

  // ---------- "Want one?" interest check (Supabase RPCs; the table itself is private)
  const form = $('wantForm'), wErr = $('wantError'), wBtn = $('wantBtn');
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, HANDLE = /^@?[a-z0-9._]{2,30}$/;
  function rpc(fn, body) {
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  function fail(msg, field) {
    wErr.textContent = msg;
    wErr.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  $('wantContact').addEventListener('input', e => { e.target.removeAttribute('aria-invalid'); wErr.hidden = true; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    wErr.hidden = true;
    const contactEl = $('wantContact');
    const contact = contactEl.value.trim().toLowerCase();
    if (!contact) return fail('Add your email or Instagram handle so I can reach you.', contactEl);
    if (!EMAIL.test(contact) && !HANDLE.test(contact)) return fail('That doesn\'t look like an email or an Instagram handle. Try you@email.com or @yourhandle.', contactEl);
    const name = $('wantName').value.trim();
    const pick = form.querySelector('input[name="for"]:checked');
    wBtn.disabled = true;
    wBtn.textContent = 'Sending…';
    try {
      const res = await rpc('register_interest', { p_contact: contact, p_name: name, p_for: pick ? pick.value : 'me', p_note: $('wantNote').value.trim() });
      if (res.status === 'bad_contact') return fail('That doesn\'t look like an email or an Instagram handle. Try you@email.com or @yourhandle.', contactEl);
      const hi = name ? 'Thanks, ' + name.split(/\s+/)[0] + '!' : 'Thanks!';
      $('wantDoneText').textContent = res.status === 'updated'
        ? hi + ' You were already on the list, so I\'ve updated your answers.'
        : hi + (res.count ? ' You\'re number ' + res.count + ' on the list.' : '') + ' I\'ll let you know if Nakama creatures become real.';
      form.hidden = true;
      const done = $('wantDone');
      done.hidden = false;
      live(133, $('wantSprite'));
      done.focus();
    } catch (err) {
      fail('Couldn\'t send that just now. Check your connection and try again.');
    } finally {
      wBtn.disabled = false;
      wBtn.textContent = 'I\'d want one';
    }
  });
})();
