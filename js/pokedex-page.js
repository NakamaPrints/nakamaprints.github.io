// My Pokédex: the trainer's collection (one slot per Pokémon in the database), a card waiting to be added, saving the Pokédex with
// Google (and signing in to it on another phone), and the "add to home screen" nudge.
(function () {
  const $ = id => document.getElementById(id);
  const show = (el, on = true) => { el.hidden = !on; };
  const TYPE_COLOR = { Grass: '#3f9e3a', Poison: '#9241b8', Fire: '#e8582a', Water: '#2f7fd8', Electric: '#d9a400', Normal: '#8a8a7a', Flying: '#7d8fe0', Bug: '#86a01e', Psychic: '#e0457a', Ghost: '#6a4c9c', Fairy: '#e07ab8', Ice: '#4fb8c9' };
  const no = dex => 'No.' + String(dex).padStart(3, '0');
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
  // Draws the Pokémon; with `shadow` (a colour) it's drawn as a flat "Who's that Pokémon?" silhouette.
  function paint(canvas, dex, shadow) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = portrait(dex);
    if (!img) return false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (shadow) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    return true;
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
    Object.assign(now, { user, saved: NakamaDB.isSaved(user), trainer, found, mine, list,
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
    const complete = list.length > 0 && found === list.length;
    document.querySelector('.pdx-head').classList.toggle('complete', complete); // gold trainer card
    if (complete) celebrate(list, rares.length);
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
      } else if (window.NAKAMA_SPRITES[p.dex]) {
        // not found yet: its silhouette, like "Who's that Pokémon?"
        const cv = document.createElement('canvas');
        cv.width = cv.height = 72;
        cv.className = 'pdx-shadow';
        cv.setAttribute('aria-hidden', 'true');
        paint(cv, p.dex, p.rare ? '#6e5a26' : '#3a3a42');
        slot.append(cv);
      } else {
        // no sprite on the site yet
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

  // Every Pokémon found: a one-time celebration (shown again if more Pokémon are added to the set later).
  function celebrate(list, rareCount) {
    let seen = null;
    try { seen = localStorage.getItem('np-complete-seen'); } catch (e) {}
    if (seen === String(list.length)) return;
    $('complete-text').textContent = `You found all ${list.length}, including all ${rareCount} rares. Your trainer card now has a gold border.`;
    const grid = $('complete-grid');
    grid.innerHTML = '';
    for (const p of list) {
      const cell = document.createElement('span');
      if (p.rare) cell.className = 'rare';
      if (window.NAKAMA_SPRITES[p.dex]) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 48;
        cv.setAttribute('aria-hidden', 'true');
        paint(cv, p.dex);
        cell.append(cv);
      } else {
        cell.textContent = String(p.dex).padStart(3, '0');
      }
      grid.append(cell);
    }
    show($('complete-sheet'));
    try { localStorage.setItem('np-complete-seen', String(list.length)); } catch (e) {}
  }
  $('complete-ok').addEventListener('click', () => show($('complete-sheet'), false));

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
    // where it came from, and what you can do with it
    const items = (now.mine || []).filter(c => c.dex === p.dex);
    const first = items[0], last = items[items.length - 1];
    const day = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    $('sheet-meta').textContent = !first ? ''
      : first.obtained_via === 'trade' ? `Got in a trade on ${day(first.obtained_at)}`
      : `Added ${day(first.obtained_at)}` + (first.card_code ? ` · from card ${first.card_code.slice(0, 4)}-${first.card_code.slice(4)}` : '');
    const card = items.find(c => c.card_code);
    show($('sheet-ar'), !!card);
    if (card) $('sheet-ar').href = './?k=' + card.card_code;
    // trade the newest copy, so the first one you found stays
    $('sheet-trade').textContent = `Trade ${p.name.toUpperCase()}`;
    $('sheet-trade').href = last ? 'trade.html?give=' + last.id : 'trade.html';
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
  // A guest with Pokémon sees a banner every time they open My Pokédex, until they save.
  // ✕ only hides it for this visit; "Later" in the sheet just closes the sheet.
  let bannerClosed = false;
  function paintSaveBanner() {
    const on = !!now.trainer && !now.saved && now.found > 0 && !bannerClosed;
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
    googleButton($('save-google'));
  }
  $('save-banner-btn').addEventListener('click', openSave);
  $('save-banner-close').addEventListener('click', () => { bannerClosed = true; paintSaveBanner(); });
  $('save-later').addEventListener('click', () => show($('save-sheet'), false));
  $('empty-signin').addEventListener('click', () => { show($('signin-sheet')); googleButton($('signin-google')); });
  $('signin-close').addEventListener('click', () => show($('signin-sheet'), false));

  // ---- Google's own "Continue with Google" button. It signs in in a pop-up on this site, so Google
  // shows nakamaprints.github.io (or, once Google has verified the app, "Nakama Pokédex").
  let gsi = null, nonce = null;
  function loadGsi() {
    if (!gsi) {
      gsi = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = res;
        s.onerror = () => { gsi = null; rej(new Error('Google didn\'t load')); };
        document.head.append(s);
      });
    }
    return gsi;
  }
  async function newNonce() {
    const raw = crypto.randomUUID() + crypto.randomUUID();
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return { raw, hashed: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('') };
  }
  async function googleButton(box) {
    try {
      await loadGsi();
      nonce = await newNonce(); // a fresh one for every try
      google.accounts.id.initialize({
        client_id: window.NAKAMA_CONFIG.googleClientId,
        nonce: nonce.hashed,
        callback: onGoogle,
        ux_mode: 'popup',
        context: 'signin',
        auto_select: false,
      });
      box.innerHTML = '';
      google.accounts.id.renderButton(box, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular',
        logo_alignment: 'center', width: Math.max(200, Math.min(400, box.clientWidth || 300)),
      });
    } catch (e) {
      box.innerHTML = '<span class="pdx-fine">Couldn\'t load Google. Check your internet and try again.</span>';
    }
  }
  async function onGoogle(resp) {
    const n = nonce;
    for (const s of document.querySelectorAll('.pdx-sheet')) show(s, false);
    try {
      const result = await NakamaDB.google(resp.credential, n.raw);
      await load();
      afterAuth(result);
      refreshTrades(); // e.g. "Finish your trade" if they saved to take a friend's trade
    } catch (e) {
      await load().catch(() => {});
      message('Couldn\'t save your Pokédex', 'Something went wrong with Google. Please try again.');
    }
  }

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
  $('trainer').addEventListener('click', openProfile);

  // ---- trainer profile: name, code, account, friends, sign out
  async function openProfile() {
    const t = now.trainer;
    if (!t) return;
    const named = t.name !== 'Trainer';
    $('prof-initial').textContent = named ? t.name[0].toUpperCase() : '?';
    $('prof-name').textContent = named ? t.name.toUpperCase() : 'TRAINER';
    const rares = (now.list || []).filter(p => p.rare);
    const have = new Set((now.mine || []).map(c => c.dex));
    $('prof-count').textContent = `${now.found} of ${(now.list || []).length} · Rare ${rares.filter(p => have.has(p.dex)).length} of ${rares.length}`;
    $('prof-name2').textContent = named ? t.name : 'Not set';
    $('prof-code').textContent = t.code;
    $('prof-copy').textContent = 'Copy';
    const email = now.user && now.user.email;
    $('prof-account').textContent = now.saved ? (email ? `Google · ${email}` : 'Saved') : 'Only on this phone';
    show($('prof-save'), !now.saved);
    show($('prof-signout'), now.saved);
    show($('prof-friends-box'), now.saved);
    show($('profile-sheet'));
    if (now.saved) paintFriends();
  }
  async function paintFriends() {
    const box = $('prof-friends');
    const friends = await NakamaDB.myFriends().catch(() => []);
    box.innerHTML = friends.length ? '' : '<span class="pdx-fine">No friends yet. Add one with their trainer code.</span>';
    for (const f of friends) {
      const row = document.createElement('div');
      row.className = 'trade-friend';
      const named = f.name !== 'Trainer';
      row.innerHTML = '<span class="trade-avatar"></span><span class="trade-friend-text"><b></b><span class="trade-small"></span></span>'
        + '<a class="pdx-mini">Trade</a><button class="pdx-x" aria-label="Remove friend">✕</button>';
      row.querySelector('.trade-avatar').textContent = named ? f.name[0].toUpperCase() : '?';
      row.querySelector('b').textContent = named ? f.name : 'Trainer';
      row.querySelector('.trade-small').textContent = `${f.code} · ${f.found} Pokémon`;
      row.querySelector('a').href = 'trade.html?with=' + encodeURIComponent(f.code);
      row.querySelector('button').addEventListener('click', async () => {
        await NakamaDB.removeFriend(f.code).catch(() => {});
        paintFriends();
      });
      box.append(row);
    }
  }
  $('prof-close').addEventListener('click', () => show($('profile-sheet'), false));
  $('prof-rename').addEventListener('click', () => { show($('profile-sheet'), false); openName('rename'); });
  $('prof-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(now.trainer.code); $('prof-copy').textContent = 'Copied ✓'; }
    catch (e) { $('prof-copy').textContent = now.trainer.code; }
  });
  $('prof-save').addEventListener('click', () => { show($('profile-sheet'), false); openSave(); });
  $('prof-add-form').addEventListener('submit', async e => {
    e.preventDefault();
    show($('prof-add-error'), false);
    const r = await NakamaDB.addFriend($('prof-add-code').value).catch(() => ({ status: 'error' }));
    const err = { not_found: 'No trainer has that code.', self: "That's your own code!", error: "Couldn't add them. Try again." }[r.status];
    if (err) { $('prof-add-error').textContent = err; show($('prof-add-error')); return; }
    $('prof-add-code').value = '';
    paintFriends();
  });
  $('prof-signout').addEventListener('click', async () => {
    await NakamaDB.signOut().catch(() => {});
    location.reload();
  });

  // ---- trades: offers for me (accept / decline), my offers still waiting, and answers to mine
  const NAME = dex => ((now.list || []).find(p => p.dex === dex) || { name: 'No.' + dex }).name.toUpperCase();
  const whoName = t => (t && t.name && t.name !== 'Trainer' ? t.name : 'A trainer');
  let answersShown = new Set();
  async function refreshTrades() {
    const box = $('trades');
    const t = await NakamaDB.myTrades().catch(() => null);
    let pendingTake = null;
    try { pendingTake = localStorage.getItem('np-take'); } catch (e) {}
    box.innerHTML = '';
    if (pendingTake && now.saved) {
      const a = document.createElement('a');
      a.className = 'pdx-trade-card';
      a.href = 'trade.html?take=' + encodeURIComponent(pendingTake);
      a.innerHTML = '<b>Finish your trade</b><span>Your Pokédex is saved. Tap to go back to the trade ›</span>';
      box.append(a);
    }
    if (t) {
      for (const o of t.incoming) {
        const b = document.createElement('button');
        b.className = 'pdx-trade-card hot';
        b.innerHTML = '<b></b><span></span>';
        b.querySelector('b').textContent = `${whoName(o.from)} wants your ${NAME(o.want_dex)}`;
        b.querySelector('span').textContent = `For their ${NAME(o.give_dex)} · See offer ›`;
        b.addEventListener('click', () => openOffer(o));
        box.append(b);
      }
      for (const o of t.outgoing) {
        const d = document.createElement('div');
        d.className = 'pdx-trade-card';
        d.innerHTML = '<b></b><span></span><button class="pdx-mini">Cancel</button>';
        d.querySelector('b').textContent = o.kind === 'inperson' ? `Trade code open for your ${NAME(o.give_dex)}`
          : `Waiting for ${whoName(o.to)}`;
        d.querySelector('span').textContent = o.kind === 'inperson' ? 'Anyone who scans it can swap with you'
          : `Your ${NAME(o.give_dex)} for their ${NAME(o.want_dex)}`;
        d.querySelector('button').addEventListener('click', async () => {
          await NakamaDB.cancelTrade(o.id).catch(() => {});
          refreshTrades();
        });
        box.append(d);
      }
      const answer = t.answers.find(a => !answersShown.has(a.id));
      if (answer && $('result-sheet').hidden && $('offer-sheet').hidden) showAnswer(answer);
    }
    show(box, box.children.length > 0);
  }

  function openOffer(o) {
    const who = whoName(o.from);
    $('offer-title').textContent = `${who} wants your ${NAME(o.want_dex)}`;
    $('offer-who').textContent = `Trainer ${o.from.code}` + (o.from.friend ? ' · your friend' : ' · not in your friends yet');
    paint($('offer-give'), o.want_dex); $('offer-give-name').textContent = NAME(o.want_dex);
    paint($('offer-get'), o.give_dex); $('offer-get-name').textContent = NAME(o.give_dex);
    $('offer-text').textContent = `${who} has already said yes. If you accept, the swap happens straight away.`;
    $('offer-accept').disabled = false;
    $('offer-accept').onclick = async () => {
      $('offer-accept').disabled = true;
      const r = await NakamaDB.answerTrade(o.id, true).catch(() => ({ status: 'error' }));
      show($('offer-sheet'), false);
      await load();
      if (r.status === 'accepted') {
        return result({ pic: r.got_dex, eyebrow: 'Trade complete', title: `${NAME(r.got_dex)} joined your Pokédex!`,
          text: `${who} got your ${NAME(r.gave_dex)}.`, friend: r.from });
      }
      const why = { gone: `${who} doesn't have their ${NAME(o.give_dex)} any more, so this offer is closed.`,
        you_dont_have: `You don't have a ${NAME(o.want_dex)} any more.`,
        cancelled: `${who} cancelled this offer.` }[r.status] || "Couldn't finish the trade. Check your internet and try again.";
      result({ pic: o.give_dex, eyebrow: 'Trade', title: 'No trade this time', text: why });
    };
    $('offer-decline').onclick = async () => {
      await NakamaDB.answerTrade(o.id, false).catch(() => {});
      show($('offer-sheet'), false);
      refreshTrades();
    };
    show($('offer-sheet'));
  }

  // The answer to an offer I sent.
  function showAnswer(a) {
    answersShown.add(a.id);
    NakamaDB.seenTrade(a.id).catch(() => {});
    const who = whoName(a.to);
    if (a.status === 'accepted') {
      load();
      return result({ pic: a.got_dex, eyebrow: `${who} accepted!`, title: `${NAME(a.got_dex)} joined your Pokédex!`,
        text: `Take good care of it. ${who} got your ${NAME(a.give_dex)}.`, friend: a.to });
    }
    const still = (now.mine || []).filter(c => c.dex === a.give_dex).pop();
    result({ pic: a.give_dex, eyebrow: 'Trade', title: `${who} said no this time`,
      text: `They'd like to keep their ${NAME(a.want_dex)} for now. Your ${NAME(a.give_dex)} is still safe in your Pokédex.`,
      again: still && a.to ? `trade.html?give=${still.id}&with=${encodeURIComponent(a.to.code)}` : null });
  }

  function result({ pic, eyebrow, title, text, friend, again }) {
    paint($('result-pic'), pic);
    $('result-eyebrow').textContent = eyebrow;
    $('result-title').textContent = title;
    $('result-text').textContent = text;
    const ask = !!friend && !friend.friend;
    show($('result-friend'), ask);
    if (ask) {
      const who = whoName(friend);
      $('result-friend-text').textContent = `Add ${who} as a friend? Friends show up first next time you trade.`;
      $('result-add').disabled = false;
      $('result-add').textContent = 'Add friend';
      $('result-add').onclick = async () => {
        $('result-add').disabled = true;
        const r = await NakamaDB.addFriend(friend.code).catch(() => null);
        $('result-add').textContent = r && r.status === 'ok' ? 'Friend added ✓' : 'Try again';
        $('result-add').disabled = !!(r && r.status === 'ok');
      };
    }
    show($('result-again'), !!again);
    if (again) $('result-again').href = again;
    show($('result-sheet'));
  }
  $('result-ok').addEventListener('click', () => { show($('result-sheet'), false); refreshTrades(); });

  // keep an eye out for new offers while the page is open
  setInterval(() => { if (document.visibilityState === 'visible' && now.saved) refreshTrades(); }, 20000);
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

  // After Google: say what happened.
  function afterAuth(auth) {
    if (auth.kind === 'saved') return openName('saved', NakamaDB.googleName(auth.user));
    // a brand-new account (first time with this Google account): treat it like saving
    if (now.trainer && now.trainer.name === 'Trainer') return openName('saved', NakamaDB.googleName(auth.user));
    message(`Welcome back, ${now.trainer ? now.trainer.name : 'trainer'}!`, auth.moved > 0
      ? `We added the ${auth.moved === 1 ? 'Pokémon' : auth.moved + ' Pokémon'} from this phone to your Pokédex, so nothing is lost.`
      : 'Your Pokédex is back.');
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
    if (params.has('save')) history.replaceState(null, '', location.pathname);
    await load();
    if (params.has('save') && !now.saved && now.found > 0) openSave();
    refreshTrades();
  })().catch(() => {
    $('trainer').textContent = 'Can\'t reach the Pokédex';
    $('empty').querySelector('h2').textContent = 'Can\'t load your Pokédex';
    $('empty-text').textContent = 'Check your internet connection and open this page again.';
    show($('empty'));
  });
})();
