// My Pokédex: the trainer's collection, 12 slots, a card waiting to be added, saving the Pokédex with
// Google (and signing in to it on another phone), and the "add to home screen" nudge.
(function () {
  const $ = id => document.getElementById(id);
  const show = (el, on = true) => { el.hidden = !on; };
  const TYPE_COLOR = { Grass: '#3f9e3a', Poison: '#9241b8', Fire: '#e8582a', Water: '#2f7fd8', Electric: '#d9a400', Normal: '#8a8a7a', Flying: '#7d8fe0', Bug: '#86a01e', Psychic: '#e0457a', Ghost: '#6a4c9c', Fairy: '#e07ab8' };
  const no = dex => 'No.' + String(dex).padStart(3, '0');
  const RETURN_TO = location.origin + location.pathname; // where Google sends people back to
  const params = new URLSearchParams(location.search);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  // what the page currently shows
  const now = { user: null, saved: false, trainer: null, found: 0, firstName: '', firstDex: null };

  const portraits = {};
  function portrait(dex) {
    if (!portraits[dex] && window.NAKAMA_SPRITES[dex]) portraits[dex] = new NakamaCreature(String(dex)).frames['000'];
    return portraits[dex];
  }
  function paint(canvas, dex) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = portrait(dex);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  // A card this phone scanned but didn't add: offer it here, as long as nobody else has added it since.
  async function waitingCard() {
    const p = NakamaDB.pending.get();
    if (!p || !p.code) return null;
    const card = await NakamaDB.peek(p.code).catch(() => null);
    if (!card) return null;               // offline: try again next time
    if (card.status !== 'unclaimed') { NakamaDB.pending.clear(); return null; }
    return p;
  }

  async function load() {
    const signedIn = !!(await NakamaDB.session(false));
    const [list, mine, trainer, waiting, user] = await Promise.all([
      NakamaDB.pokemonList(),
      signedIn ? NakamaDB.myCollection() : [],
      signedIn ? NakamaDB.trainer() : null,
      waitingCard(),
      signedIn ? NakamaDB.user() : null,
    ]);
    const copies = {};
    for (const c of mine) copies[c.dex] = (copies[c.dex] || 0) + 1;
    const found = list.filter(p => copies[p.dex]).length;
    const rares = list.filter(p => p.rare);
    const first = mine.length ? list.find(p => p.dex === mine[0].dex) : null;
    Object.assign(now, { user, saved: NakamaDB.isSaved(user), trainer, found,
      firstName: first ? first.name.toUpperCase() : '', firstDex: first ? first.dex : null });

    const who = !trainer ? '' : trainer.name === 'Trainer' ? 'Trainer' : `Trainer ${trainer.name}`;
    const tb = $('trainer');
    tb.textContent = trainer ? `${who} · ${trainer.code}` : 'No Pokémon yet';
    tb.disabled = !trainer;
    if (now.saved) {
      const s = document.createElement('span');
      s.className = 'pdx-saved';
      s.textContent = 'Saved';
      tb.append(s);
    }
    $('count').textContent = `${found}/${list.length}`;
    $('bar').style.width = (100 * found / list.length) + '%';
    $('rare').textContent = `★ Rare found: ${rares.filter(p => copies[p.dex]).length} of ${rares.length}`;

    show($('waiting'), !!waiting);
    if (waiting) {
      $('waiting-title').textContent = `${waiting.name.toUpperCase()} is waiting!`;
      $('waiting-text').textContent = 'You found it, but it\'s not in your Pokédex yet.';
      $('waiting-add').textContent = `Add ${waiting.name}`;
      $('waiting-add').hidden = false;
      paint($('waiting-portrait'), waiting.dex);
    }
    $('empty-text').textContent = `${list.length} Pokémon are hiding inside Nakama Pokeballs. Open one and scan the card that came with it to meet who's inside.`;
    show($('empty'), found === 0 && !waiting);
    show($('empty-signin'), !now.saved);
    $('btn-scan').textContent = found === 0 ? 'How to scan a card' : 'Scan new';
    paintSaveBanner();
    paintInstall();

    const grid = $('grid');
    grid.innerHTML = '';
    for (const p of list) {
      const have = copies[p.dex] || 0;
      const slot = document.createElement(have ? 'button' : 'div');
      slot.className = 'pdx-slot' + (have ? ' caught' : '') + (p.rare ? ' rare' : '');
      if (have) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 72;
        cv.setAttribute('aria-hidden', 'true');
        paint(cv, p.dex);
        slot.append(cv);
        slot.setAttribute('aria-label', `${p.name}, ${no(p.dex)}${have > 1 ? `, ${have} copies` : ''}`);
        slot.addEventListener('click', () => openEntry(p, have));
      } else {
        const q = document.createElement('span');
        q.className = 'pdx-q';
        q.textContent = '?';
        slot.append(q);
      }
      const n = document.createElement('span');
      n.className = 'pdx-no';
      n.textContent = no(p.dex);
      const label = document.createElement('span');
      label.className = 'pdx-name';
      label.textContent = have ? p.name : p.rare ? '★ RARE' : '???';
      slot.append(n, label);
      if (have > 1) {
        const badge = document.createElement('span');
        badge.className = 'pdx-badge';
        badge.textContent = '×' + have;
        slot.append(badge);
      }
      grid.append(slot);
    }
  }

  function openEntry(p, have) {
    const e = (window.NAKAMA_POKEDEX || {})[p.dex];
    $('sheet-no').textContent = no(p.dex);
    $('sheet-name').textContent = p.name.toUpperCase();
    $('sheet-species').textContent = e ? e.species : '';
    $('sheet-types').innerHTML = e ? e.types.map(t => `<span style="--t:${TYPE_COLOR[t] || '#777'}">${t}</span>`).join('') : '';
    $('sheet-hw').textContent = e ? `HT ${e.height} · WT ${e.weight}` : '';
    $('sheet-text').textContent = e ? e.text : '';
    $('sheet-copies').textContent = have > 1 ? `You have ${have}` : '';
    paint($('sheet-portrait'), p.dex);
    show($('sheet'));
  }
  $('sheet-close').addEventListener('click', () => show($('sheet'), false));
  $('btn-scan').addEventListener('click', () => show($('scan-help')));
  $('scan-help-close').addEventListener('click', () => show($('scan-help'), false));
  // tapping the dark area around a sheet closes it
  for (const s of document.querySelectorAll('.pdx-sheet')) s.addEventListener('click', e => { if (e.target === s) show(s, false); });

  $('waiting-add').addEventListener('click', async () => {
    const p = NakamaDB.pending.get();
    if (!p) return show($('waiting'), false);
    const btn = $('waiting-add');
    btn.disabled = true;
    const res = await NakamaDB.claim(p.code).catch(() => ({ status: 'error' }));
    btn.disabled = false;
    if (res.status === 'error') {
      $('waiting-text').textContent = 'Couldn\'t add it. Check your internet and try again.';
      return;
    }
    NakamaDB.pending.clear();
    if (res.status === 'registered' || res.status === 'mine') return load();
    $('waiting-title').textContent = 'Too late!';
    $('waiting-text').textContent = `Someone else added this ${p.name} to their Pokédex first.`;
    btn.hidden = true;
  });

  // ---- saving the Pokédex
  // A guest with Pokémon sees a banner until they save. "Later" hides it until they add another one.
  const laterKey = 'np-save-later';
  const laterAt = () => { try { return +sessionStorage.getItem(laterKey) || 0; } catch (e) { return 0; } };
  function later() {
    try { sessionStorage.setItem(laterKey, String(now.found)); } catch (e) {}
    paintSaveBanner();
  }
  function paintSaveBanner() {
    const on = !!now.trainer && !now.saved && now.found > 0 && now.found > laterAt();
    show($('save-banner'), on);
    if (on) {
      $('save-banner-text').textContent = now.found === 1 ? `${now.firstName} is only on this phone` : `${now.found} Pokémon are only on this phone`;
    }
  }
  function openSave() {
    $('save-title').textContent = now.found === 1 ? `Keep ${now.firstName} safe` : 'Keep your Pokémon safe';
    show($('save-portrait'), !!now.firstDex);
    if (now.firstDex) paint($('save-portrait'), now.firstDex);
    show($('save-sheet'));
  }
  $('save-banner-btn').addEventListener('click', openSave);
  $('save-banner-close').addEventListener('click', later);
  $('save-later').addEventListener('click', () => { show($('save-sheet'), false); later(); });

  async function goGoogle(btn, fn) {
    btn.disabled = true;
    try {
      await fn(RETURN_TO); // leaves the page for Google
    } catch (e) {
      btn.disabled = false;
      for (const s of document.querySelectorAll('.pdx-sheet')) show(s, false);
      message('Couldn\'t reach Google', 'Check your internet connection and try again.');
    }
  }
  $('save-google').addEventListener('click', () => goGoogle($('save-google'), r => NakamaDB.saveWithGoogle(r)));
  $('signin-google').addEventListener('click', () => goGoogle($('signin-google'), r => NakamaDB.signInWithGoogle(r)));
  $('empty-signin').addEventListener('click', () => show($('signin-sheet')));
  $('signin-close').addEventListener('click', () => show($('signin-sheet'), false));

  function message(title, text) {
    $('msg-title').textContent = title;
    $('msg-text').textContent = text;
    show($('msg-sheet'));
  }
  $('msg-ok').addEventListener('click', () => show($('msg-sheet'), false));

  // ---- trainer name: asked right after saving, or tap your name to change it
  function openName(mode, suggestion) {
    const fresh = mode === 'saved';
    show($('name-eyebrow'), fresh);
    $('name-title').textContent = fresh ? 'Welcome, trainer!' : 'Change trainer name';
    $('name-text').textContent = fresh ? 'Your Pokédex is safe now. What\'s your name?' : '';
    show($('name-text'), fresh);
    const current = now.trainer && now.trainer.name !== 'Trainer' ? now.trainer.name : '';
    $('name-input').value = suggestion || current;
    $('name-code').textContent = now.trainer ? now.trainer.code : '';
    show($('name-sheet'));
  }
  $('trainer').addEventListener('click', () => openName('rename'));
  $('name-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('name-input').value.trim().slice(0, 12);
    if (!name) return $('name-input').focus();
    $('name-save').disabled = true;
    try {
      await NakamaDB.setName(name);
      show($('name-sheet'), false);
      await load();
    } catch (err) {
      $('name-text').textContent = 'Couldn\'t save that name. Try again.';
      show($('name-text'));
    }
    $('name-save').disabled = false;
  });

  // Back from Google: say what happened.
  function afterAuth(auth) {
    if (auth.kind === 'saved') return openName('saved', NakamaDB.googleName(auth.user));
    if (auth.kind === 'signedin') {
      // a brand-new account (first time with this Google account): treat it like saving
      if (now.trainer && now.trainer.name === 'Trainer') return openName('saved', NakamaDB.googleName(auth.user));
      const hi = `Welcome back, ${now.trainer ? now.trainer.name : 'trainer'}!`;
      return message(hi, auth.moved > 0
        ? `We added the ${auth.moved === 1 ? 'Pokémon' : auth.moved + ' Pokémon'} from this phone to your Pokédex, so nothing is lost.`
        : 'Your Pokédex is back.');
    }
    if (auth.kind === 'error' && !/access_denied/i.test(auth.code)) {
      message('Couldn\'t save your Pokédex', 'Something went wrong with Google. Please try again.');
    }
  }

  // ---- add to home screen
  // On iPhone a home-screen app doesn't share storage with Safari, so it's only offered once the
  // Pokédex is saved (then the app can sign in to it). Android shares storage, so it can be offered any time.
  let dismissed = false;
  try { dismissed = localStorage.getItem('np-install-dismissed') === '1'; } catch (e) {}
  let deferred = null;
  if (!standalone && !dismissed) {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show($('install')); });
  }
  function paintInstall() {
    if (!isIOS || standalone || dismissed || !now.saved) return;
    $('install-hint').textContent = 'In Safari, tap Share, then "Add to Home Screen". Sign in there once with Google.';
    show($('install-btn'), false);
    show($('install'));
  }
  $('install-btn').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    show($('install'), false);
  });
  $('install-close').addEventListener('click', () => {
    dismissed = true;
    show($('install'), false);
    try { localStorage.setItem('np-install-dismissed', '1'); } catch (e) {}
  });

  // ---- start
  (async () => {
    const auth = await NakamaDB.finishAuth(RETURN_TO).catch(() => ({ kind: 'error', code: 'failed' }));
    if (auth && auth.kind === 'redirecting') return; // off to Google again
    history.replaceState(null, '', location.pathname + location.hash);
    await load();
    if (auth) afterAuth(auth);
    else if (params.has('save') && !now.saved && now.found > 0) openSave();
  })().catch(() => {
    $('trainer').textContent = 'Can\'t reach the Pokédex';
    $('empty').querySelector('h2').textContent = 'Can\'t load your Pokédex';
    $('empty-text').textContent = 'Check your internet connection and open this page again.';
    show($('empty'));
  });
})();
