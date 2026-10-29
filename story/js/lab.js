// Story / landing page: every Pokémon here runs on the app's own engine (creature.js).
// One animation loop draws the live ones that are on screen; the rest are static portraits.
(function () {
  const S = window.NAKAMA_SPRITES, CFG = window.NAKAMA_CONFIG || {};
  const TEX = window.NAKAMA_TEX || 72;
  const RARES = [6, 94, 144, 145, 146, 150];
  const ALL = Object.keys(S).map(Number).sort((a, b) => a - b);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const isRare = id => RARES.includes(id);
  const title = n => n.charAt(0) + n.slice(1).toLowerCase();
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // the opening fills the screen below the top bar, whatever height the bar ends up
  const topBar = document.querySelector('.top');
  const setTop = () => document.documentElement.style.setProperty('--toph', topBar.offsetHeight + 'px');
  setTop();
  addEventListener('resize', setTop);

  // ---------- static portraits
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
  const seen = new WeakMap();
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

  function onView(el, fn) {
    const o = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { o.disconnect(); fn(); }
    }, { threshold: 0.25 });
    o.observe(el);
  }

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

  // ---------- sound: off until the speaker button is tapped. release.mp3 when a ball opens and
  // cry-<dex>.mp3 when the Pokémon lands; CRIES lists the Pokémon that have a cry file.
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
    type(heroText, 'A wild Pokémon is hiding inside!');
    if (!reduced) {
      await wait(900);
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

  // ---------- 01 the tape: a VHS player around the reel
  const vhs = $('vhs'), tape = $('tapeVideo'), vhsState = $('vhsState'), vhsTime = $('vhsTime'), vhsBtn = $('vhsBtn');
  const tc = s => { s = Math.floor(s || 0); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  vhsBtn.addEventListener('click', () => { tape.paused ? tape.play().catch(() => {}) : tape.pause(); });
  tape.addEventListener('play', () => { vhs.classList.add('playing'); vhsState.textContent = 'PLAY ▶'; vhsBtn.setAttribute('aria-label', 'Pause the tape'); });
  tape.addEventListener('pause', () => { vhs.classList.remove('playing'); vhsState.textContent = tape.ended ? 'PLAY ▶' : 'PAUSE ❚❚'; vhsBtn.setAttribute('aria-label', 'Play the tape'); });
  tape.addEventListener('ended', () => { vhsState.textContent = 'REW ◀◀'; setTimeout(() => { tape.currentTime = 0; vhsState.textContent = 'PLAY ▶'; }, 900); });
  tape.addEventListener('timeupdate', () => { vhsTime.textContent = tc(tape.currentTime); });

  // ---------- 02 bag: the items menu points at the thing in the photo
  // the card in the photo gets a real QR: it opens the no-camera demo on a phone
  function drawQr() {
    if (!window.qrcode) return;
    const q = window.qrcode(0, 'M');
    q.addData('https://nakamaprints.github.io/?try&demo');
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    $('qr').innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path d="' + d + '" fill="#111"/></svg>';
  }
  window.qrcode ? drawQr() : addEventListener('load', drawQr);

  const flatlay = $('flatlay'), items = document.querySelectorAll('.item');
  function pick(name, focus) {
    items.forEach(b => b.classList.toggle('on', b.dataset.item === name));
    flatlay.classList.toggle('focus', !!focus);
    flatlay.querySelectorAll('[data-item]').forEach(el => el.classList.toggle('lit', el.dataset.item === name));
  }
  items.forEach(b => {
    b.addEventListener('mouseenter', () => pick(b.dataset.item, true));
    b.addEventListener('focus', () => pick(b.dataset.item, true));
    b.addEventListener('click', () => pick(b.dataset.item, true));
  });
  document.querySelector('.items').addEventListener('mouseleave', () => flatlay.classList.remove('focus'));
  flatlay.querySelectorAll('[data-item]').forEach(el => el.addEventListener('mouseenter', () => pick(el.dataset.item, true)));
  flatlay.addEventListener('mouseleave', () => flatlay.classList.remove('focus'));

  // ---------- who's that Pokémon? a new silhouette every few seconds
  const sil = $('wtpSil');
  let silId = 0;
  function nextSil() {
    let id;
    do id = ALL[Math.floor(Math.random() * ALL.length)]; while (id === silId);
    silId = id;
    paint(sil, id, '#1b1b22');
  }
  nextSil();
  if (!reduced) setInterval(() => { if (!document.hidden && seen.get(sil) !== false) nextSil(); }, 2600);
  seen.set(sil, false);
  io.observe(sil);

  // ---------- 04 My Pokédex, as in the app: tap a silhouette to reveal it
  const START = [4, 7, 25, 39, 133, 6];
  const no = id => 'No.' + String(id).padStart(3, '0');
  const mdGrid = $('mdGrid'), mdHead = $('mdHead'), mdDone = $('mdDone'), phone = document.querySelector('.dexphone');
  let found = new Set(START);
  const mdSlots = {};
  function mdCount() {
    const n = found.size, r = RARES.filter(id => found.has(id)).length, all = n === ALL.length;
    $('mdCount').textContent = n + '/' + ALL.length;
    $('mdBar').style.width = (n / ALL.length) * 100 + '%';
    $('mdRare').textContent = '★ Rare found: ' + r + ' of ' + RARES.length;
    mdHead.classList.toggle('complete', all);
    phone.classList.toggle('gold', all);
    return all;
  }
  function mdSlot(id, just) {
    const b = mdSlots[id], has = found.has(id), rare = isRare(id);
    b.className = 'md-slot' + (rare ? ' rare' : '') + (has ? ' caught' : '') + (just ? ' just' : '');
    paint(b.querySelector('canvas'), id, has ? null : rare ? '#4a3c14' : '#2e2e36');
    b.querySelector('.md-name').textContent = has ? title(S[id].name) : rare ? '★ ???' : '???';
    b.setAttribute('aria-label', no(id) + (has ? ', ' + title(S[id].name) : ', not found yet. Tap to reveal') + (rare ? ', rare' : ''));
  }
  function mdFind(id) {
    if (found.has(id)) return false;
    found.add(id);
    mdSlot(id, true);
    const b = mdSlots[id];
    mdGrid.scrollTo({ top: b.offsetTop - mdGrid.clientHeight / 2 + b.offsetHeight / 2, behavior: reduced ? 'auto' : 'smooth' });
    if (mdCount()) setTimeout(() => { mdDone.hidden = false; $('mdDoneBtn').focus({ preventScroll: true }); }, reduced ? 0 : 600);
    return true;
  }
  for (const id of ALL) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="md-no">' + no(id) + '</span>';
    b.appendChild(canvas72());
    const nm = document.createElement('span');
    nm.className = 'md-name';
    b.appendChild(nm);
    b.addEventListener('click', () => mdFind(id));
    mdSlots[id] = b;
    mdGrid.appendChild(b);
    mdSlot(id);
  }
  mdCount();
  $('mdFill').addEventListener('click', async () => {
    for (const id of ALL) if (mdFind(id) && !reduced) await wait(110);
  });
  $('mdReset').addEventListener('click', () => {
    found = new Set(START);
    mdDone.hidden = true;
    ALL.forEach(id => mdSlot(id));
    mdCount();
    mdGrid.scrollTo({ top: 0 });
  });
  $('mdDoneBtn').addEventListener('click', () => { mdDone.hidden = true; mdGrid.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });

  // ---------- 06 trade mock: Squirtle for Pikachu
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

  // ---------- 08 new save file (Supabase RPC; the table itself is private)
  const form = $('wantForm'), wErr = $('wantError'), wBtn = $('wantBtn');
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, HANDLE = /^@?[a-z0-9._]{2,30}$/;
  const BAD = "That doesn't look like an email or an Instagram handle. Try you@email.com or @yourhandle.";
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
    if (!EMAIL.test(contact) && !HANDLE.test(contact)) return fail(BAD, contactEl);
    const name = $('wantName').value.trim();
    const pickFor = form.querySelector('input[name="for"]:checked');
    wBtn.disabled = true;
    wBtn.textContent = 'Saving…';
    try {
      const res = await rpc('register_interest', { p_contact: contact, p_name: name, p_for: pickFor ? pickFor.value : 'me', p_note: $('wantNote').value.trim() });
      if (res.status === 'bad_contact') return fail(BAD, contactEl);
      const hi = name ? 'Thanks, ' + name.split(/\s+/)[0] + '!' : 'Thanks!';
      $('wantDoneText').textContent = res.status === 'updated'
        ? hi + " You already had a save file, so I've updated it."
        : hi + " I'll let you know if it becomes real.";
      form.hidden = true;
      const done = $('wantDone');
      done.hidden = false;
      live(133, $('wantSprite'));
      done.focus();
    } catch (err) {
      fail("Couldn't save that just now. Check your connection and try again.");
    } finally {
      wBtn.disabled = false;
      wBtn.textContent = '▸ Count me in';
    }
  });
})();
