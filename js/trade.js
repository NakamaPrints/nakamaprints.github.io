// Trading between trainers. One page, one step at a time:
//   trade.html                     pick one of yours, then who to trade with
//   trade.html?give=ID             you're trading this Pokémon: trainer code / friends, or "in person" (QR)
//   trade.html?give=ID&with=CODE   pick one of their Pokémon and send the offer
//   trade.html?take=TOKEN          someone's in-person QR: pick one of yours and swap straight away
// The database checks every rule and does the swap (tools/db/0007_trading.sql).
(function () {
  const $ = id => document.getElementById(id);
  const show = (el, on = true) => { el.hidden = !on; };
  const params = new URLSearchParams(location.search);
  const no = dex => 'No.' + String(dex).padStart(3, '0');
  const HERE = location.href.split(/[?#]/)[0];

  let names = {}, list = [], mine = [];

  const portraits = {};
  function paint(canvas, dex) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!portraits[dex] && window.NAKAMA_SPRITES[dex]) portraits[dex] = new NakamaCreature(String(dex)).frames['000'];
    if (portraits[dex]) ctx.drawImage(portraits[dex], 0, 0, canvas.width, canvas.height);
  }
  const NAME = dex => (names[dex] || no(dex)).toUpperCase();

  function step(id) {
    for (const s of document.querySelectorAll('.trade-sec')) show(s, s.id === id);
    window.scrollTo(0, 0);
  }
  function message(title, text) {
    $('msg-title').textContent = title;
    $('msg-text').textContent = text;
    step('s-msg');
  }
  function go(q) { location.href = HERE + (q ? '?' + new URLSearchParams(q) : ''); }

  // A grid of Pokémon slots. `items`: [{ dex, label, sub, off, badge }]; `onPick(dex)` when tapped.
  function grid(el, items, onPick) {
    el.innerHTML = '';
    const buttons = {};
    for (const it of items) {
      const slot = document.createElement(it.off ? 'div' : 'button');
      slot.className = 'pdx-slot' + (it.off ? '' : ' caught') + (it.rare ? ' rare' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 72;
      cv.setAttribute('aria-hidden', 'true');
      paint(cv, it.dex);
      if (it.off) cv.className = 'pdx-dim';
      const n = document.createElement('span');
      n.className = 'pdx-no';
      n.textContent = no(it.dex);
      const label = document.createElement('span');
      label.className = 'pdx-name';
      label.textContent = it.label;
      slot.append(cv, n, label);
      if (it.badge) {
        const b = document.createElement('span');
        b.className = 'pdx-badge';
        b.textContent = it.badge;
        slot.append(b);
      }
      if (!it.off) {
        slot.setAttribute('aria-label', `${it.label}, ${no(it.dex)}`);
        slot.addEventListener('click', () => {
          for (const k in buttons) buttons[k].classList.toggle('picked', +k === it.dex);
          onPick(it.dex);
        });
        buttons[it.dex] = slot;
      }
      el.append(slot);
    }
  }

  // My Pokémon, one slot per kind (with ×N), each pointing at one of my copies (the newest, so the first stays).
  function myKinds() {
    const by = {};
    for (const c of mine) (by[c.dex] = by[c.dex] || []).push(c);
    return Object.keys(by).map(Number).sort((a, b) => a - b).map(dex => ({
      dex, items: by[dex], item: by[dex][by[dex].length - 1],
      label: names[dex] || no(dex), rare: !!(list.find(p => p.dex === dex) || {}).rare,
      badge: by[dex].length > 1 ? '×' + by[dex].length : '',
    }));
  }

  // ---------------------------------------------------------------- 1: which of mine
  function pickMine(withCode) {
    $('title').textContent = 'Trade';
    const kinds = myKinds();
    show($('mine-empty'), !kinds.length);
    grid($('mine-grid'), kinds, dex => {
      const k = kinds.find(x => x.dex === dex);
      go(withCode ? { give: k.item.id, with: withCode } : { give: k.item.id });
    });
    step('s-mine');
  }

  // ---------------------------------------------------------------- 2: with who
  let pollTimer = null;
  async function hub(give) {
    $('title').textContent = `Trade ${NAME(give.dex)}`;
    $('give-name').textContent = NAME(give.dex);
    paint($('give-portrait'), give.dex);
    step('s-hub');

    const tab = which => {
      $('tab-code').setAttribute('aria-selected', String(which === 'code'));
      $('tab-person').setAttribute('aria-selected', String(which === 'person'));
      show($('hub-code'), which === 'code');
      show($('hub-person'), which === 'person');
      if (which === 'person') inPerson(give);
      else clearInterval(pollTimer);
    };
    $('tab-code').addEventListener('click', () => tab('code'));
    $('tab-person').addEventListener('click', () => tab('person'));

    $('find-form').addEventListener('submit', async e => {
      e.preventDefault();
      const code = $('find-code').value.trim();
      show($('find-error'), false);
      const r = await NakamaDB.trainerByCode(code).catch(() => ({ status: 'error' }));
      const err = {
        not_found: 'No trainer has that code. Check the numbers on their Pokédex.',
        self: "That's your own code! Ask your friend for theirs.",
        error: "Couldn't look that up. Check your internet and try again.",
      }[r.status];
      if (err) { $('find-error').textContent = err; show($('find-error')); return; }
      go({ give: give.id, with: r.trainer.code });
    });

    const friends = await NakamaDB.myFriends().catch(() => []);
    show($('friends-h'), friends.length > 0);
    $('friend-list').innerHTML = '';
    for (const f of friends) {
      const b = document.createElement('button');
      b.className = 'trade-friend';
      b.innerHTML = `<span class="trade-avatar"></span><span class="trade-friend-text"><b></b><span class="trade-small"></span></span><span aria-hidden="true">›</span>`;
      b.querySelector('.trade-avatar').textContent = f.name === 'Trainer' ? '?' : f.name[0].toUpperCase();
      b.querySelector('b').textContent = f.name === 'Trainer' ? 'Trainer' : f.name;
      b.querySelector('.trade-small').textContent = `${f.code} · ${f.found} Pokémon`;
      b.addEventListener('click', () => go({ give: give.id, with: f.code }));
      $('friend-list').append(b);
    }
  }

  // In person: show a QR; when a friend takes it, we hear about it here.
  let opened = null;
  async function inPerson(give) {
    if (!opened) {
      const r = await NakamaDB.openTrade(give.id).catch(() => null);
      if (!r || r.status !== 'ok') { $('person-status').textContent = "Couldn't make a trade code. Try again."; return; }
      opened = r;
      const qr = qrcode(0, 'M');
      qr.addData(HERE + '?take=' + r.token);
      qr.make();
      $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      const t = await NakamaDB.myTrades().catch(() => null);
      const done = t && t.answers.find(a => a.id === opened.id);
      if (!done) return;
      clearInterval(pollTimer);
      await NakamaDB.seenTrade(done.id).catch(() => {});
      finished(done.got_dex, give.dex, done.to);
    }, 3000);
  }

  // ---------------------------------------------------------------- 3: pick one of theirs
  async function theirs(give, code) {
    const r = await NakamaDB.trainerByCode(code).catch(() => ({ status: 'error' }));
    if (r.status === 'not_found') return message('Trainer not found', 'No trainer has that code.');
    if (r.status === 'self') return message("That's you!", 'Ask your friend for their trainer code.');
    if (r.status !== 'ok') return message("Couldn't reach the Pokédex", 'Check your internet and try again.');
    const t = r.trainer, who = t.name === 'Trainer' ? 'This trainer' : t.name;
    if (!t.saved) {
      return message(`${who} can't trade yet`, `${who} needs to save their Pokédex first. Ask them to tap Save in their Pokédex, then try again.`);
    }
    $('title').textContent = `${who}'s Pokédex`;
    $('their-initial').textContent = t.name === 'Trainer' ? '?' : t.name[0].toUpperCase();
    $('their-name').textContent = `${who}'s Pokédex`;
    $('their-meta').textContent = `${t.code} · ${t.found} of ${list.length}`;
    $('their-lead').textContent = `Tap the Pokémon you'd like for your ${NAME(give.dex)}.`;
    paint($('bar-give'), give.dex);
    const have = new Set(mine.map(c => c.dex));
    const counts = Object.fromEntries(r.pokemon.map(p => [p.dex, p.count]));
    let want = null;
    grid($('their-grid'), list.map(p => ({
      dex: p.dex, rare: p.rare, off: !counts[p.dex],
      label: counts[p.dex] ? p.name : '—',
      badge: counts[p.dex] && !have.has(p.dex) ? 'NEW' : '',
    })), dex => {
      want = dex;
      paint($('bar-want'), dex);
      $('bar-text').textContent = `Your ${NAME(give.dex)} for ${t.name === 'Trainer' ? 'their' : t.name + "'s"} ${NAME(dex)}`;
      $('send-offer').disabled = false;
    });
    step('s-theirs');

    $('send-offer').addEventListener('click', async () => {
      if (!want) return;
      $('send-offer').disabled = true;
      const res = await NakamaDB.offerTrade(give.id, t.code, want).catch(() => ({ status: 'error' }));
      if (res.status === 'ok') return sent(res, give.dex, want, t);
      $('send-offer').disabled = false;
      const why = {
        already_offered: [`Your ${NAME(give.dex)} is already in an offer`, 'Cancel that offer in My Pokédex first, or pick another Pokémon.'],
        they_dont_have: ['They traded it away', `${who} doesn't have that Pokémon any more. Pick another one.`],
        not_yours: ["That Pokémon isn't yours any more", 'It may have been traded already.'],
        not_saved: [`${who} can't trade yet`, `${who} needs to save their Pokédex first.`],
      }[res.status] || ["Couldn't send the offer", 'Check your internet and try again.'];
      message(why[0], why[1]);
    });
  }

  // ---------------------------------------------------------------- 4: offer sent
  function sent(res, giveDex, wantDex, t) {
    const who = t.name === 'Trainer' ? 'your friend' : t.name;
    $('title').textContent = 'Offer sent';
    $('sent-waiting').textContent = `Waiting for ${who}`;
    paint($('sent-give'), giveDex);
    paint($('sent-want'), wantDex);
    $('sent-text').textContent = `Your ${NAME(giveDex)} for ${who === 'your friend' ? 'their' : who + "'s"} ${NAME(wantDex)}. `
      + `${who[0].toUpperCase() + who.slice(1)} will see it the next time they open their Pokédex.`;
    const msg = `I sent you a trade offer on Nakama Pokédex: my ${NAME(giveDex)} for your ${NAME(wantDex)}! `
      + `Open your Pokédex to accept: ${HERE.replace(/trade\.html$/, 'pokedex.html')}`;
    $('sent-wa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    $('sent-cancel').addEventListener('click', async () => {
      await NakamaDB.cancelTrade(res.id).catch(() => {});
      location.href = 'pokedex.html';
    });
    step('s-sent');
  }

  // ---------------------------------------------------------------- 5: take someone's in-person offer
  async function take(token) {
    const peek = await NakamaDB.peekTrade(token).catch(() => ({ status: 'error' }));
    if (peek.status === 'not_found' || peek.status === 'error') return message('Trade code not found', 'Ask your friend to show their trade code again.');
    const from = peek.from && peek.from.name !== 'Trainer' ? peek.from.name : 'Your friend';
    if (peek.mine) return message('This is your trade code', 'Show it to your friend: they scan it with their phone camera.');
    if (peek.status !== 'pending') {
      return message('This trade is over', peek.status === 'accepted' ? 'Someone already took this trade.' : `${from} closed this trade.`);
    }
    const user = await NakamaDB.user().catch(() => null);
    if (!NakamaDB.isSaved(user)) {
      try { localStorage.setItem('np-take', token); } catch (e) {}
      $('save-text').textContent = `${from} wants to trade their ${NAME(peek.give_dex)}! Save your Pokédex first (one tap), then come back to this trade.`;
      return step('s-save');
    }
    try { localStorage.removeItem('np-take'); } catch (e) {}
    $('title').textContent = `Trading with ${from}`;
    $('take-from').textContent = `${from} offers`;
    $('take-name').textContent = NAME(peek.give_dex);
    paint($('take-portrait'), peek.give_dex);
    const kinds = myKinds();
    if (!kinds.length) return message('Nothing to trade yet', 'Open a Pokeball first, then you can trade.');
    let pick = null;
    grid($('take-grid'), kinds, dex => {
      pick = dex;
      $('take-text').textContent = `Your ${NAME(dex)} for ${from === 'Your friend' ? 'their' : from + "'s"} ${NAME(peek.give_dex)}`;
      $('take-go').disabled = false;
    });
    step('s-take');
    $('take-go').addEventListener('click', async () => {
      if (!pick) return;
      $('take-go').disabled = true;
      const r = await NakamaDB.takeTrade(token, pick).catch(() => ({ status: 'error' }));
      if (r.status === 'accepted') return finished(r.got_dex, r.gave_dex, r.from);
      $('take-go').disabled = false;
      const why = {
        gone: ['Too late', `${from} doesn't have that Pokémon any more.`],
        cancelled: ['Too late', `${from} closed this trade.`],
        accepted: ['Too late', 'Someone else took this trade first.'],
      }[r.status] || ["Couldn't trade", 'Check your internet and try again.'];
      message(why[0], why[1]);
    });
  }

  // ---------------------------------------------------------------- done (either side)
  function finished(gotDex, gaveDex, other) {
    const who = other && other.name !== 'Trainer' ? other.name : 'Your friend';
    $('title').textContent = 'Trade complete';
    paint($('done-portrait'), gotDex);
    $('done-title').textContent = `${NAME(gotDex)} joined your Pokédex!`;
    $('done-text').textContent = `${who} got your ${NAME(gaveDex)}. Take good care of it.`;
    show($('done-friend'), !!other && !other.friend);
    if (other) {
      $('done-friend-text').textContent = `Add ${who} as a friend? Friends show up first next time you trade.`;
      $('done-add').onclick = async () => {
        $('done-add').disabled = true;
        const r = await NakamaDB.addFriend(other.code).catch(() => null);
        const added = !!(r && r.status === 'ok');
        $('done-add').textContent = added ? 'Friend added ✓' : 'Try again';
        $('done-add').disabled = added;
      };
    }
    step('s-done');
  }

  // ---------------------------------------------------------------- start
  (async () => {
    list = await NakamaDB.pokemonList();
    names = Object.fromEntries(list.map(p => [p.dex, p.name]));
    if (params.get('take')) {
      mine = await NakamaDB.myCollection().catch(() => []);
      return take(params.get('take'));
    }
    const user = await NakamaDB.user().catch(() => null);
    if (!NakamaDB.isSaved(user)) return step('s-save');
    mine = await NakamaDB.myCollection();
    const give = mine.find(c => c.id === params.get('give'));
    if (!give) return pickMine(params.get('with'));
    if (params.get('with')) return theirs(give, params.get('with'));
    hub(give);
  })().catch(() => message("Couldn't reach the Pokédex", 'Check your internet connection and open this page again.'));
})();
