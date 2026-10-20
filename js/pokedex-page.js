// My Pokédex: the trainer's collection, 12 slots, plus the "add to home screen" nudge.
(function () {
  const $ = id => document.getElementById(id);
  const show = (el, on = true) => { el.hidden = !on; };
  const TYPE_COLOR = { Grass: '#3f9e3a', Poison: '#9241b8', Fire: '#e8582a', Water: '#2f7fd8', Electric: '#d9a400', Normal: '#8a8a7a', Flying: '#7d8fe0', Bug: '#86a01e', Psychic: '#e0457a', Ghost: '#6a4c9c', Fairy: '#e07ab8' };
  const no = dex => 'No.' + String(dex).padStart(3, '0');

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
    const [list, mine, trainer, waiting] = await Promise.all([
      NakamaDB.pokemonList(),
      signedIn ? NakamaDB.myCollection() : [],
      signedIn ? NakamaDB.trainer() : null,
      waitingCard(),
    ]);
    const copies = {};
    for (const c of mine) copies[c.dex] = (copies[c.dex] || 0) + 1;
    const found = list.filter(p => copies[p.dex]).length;
    const rares = list.filter(p => p.rare);

    const who = !trainer ? '' : trainer.name === 'Trainer' ? 'Trainer' : `Trainer ${trainer.name}`;
    $('trainer').textContent = trainer ? `${who} · ${trainer.code}` : 'No Pokémon yet';
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
    $('btn-scan').textContent = found === 0 ? 'How to scan a card' : 'Scan new';

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
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) show($('sheet'), false); });
  $('btn-scan').addEventListener('click', () => show($('scan-help')));

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
  $('scan-help-close').addEventListener('click', () => show($('scan-help'), false));

  // ---- add to home screen
  // Android only for now. On iPhone a home-screen app doesn't share storage with Safari, so a guest
  // Pokédex would open empty there. Offer it on iPhone once trainers can save and sign in (Phase 3).
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let dismissed = false;
  try { dismissed = localStorage.getItem('np-install-dismissed') === '1'; } catch (e) {}
  let deferred = null;
  if (!standalone && !dismissed) {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show($('install')); });
  }
  $('install-btn').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    show($('install'), false);
  });
  $('install-close').addEventListener('click', () => {
    show($('install'), false);
    try { localStorage.setItem('np-install-dismissed', '1'); } catch (e) {}
  });

  load().catch(() => {
    $('trainer').textContent = 'Can\'t reach the Pokédex';
    $('empty').querySelector('h2').textContent = 'Can\'t load your Pokédex';
    $('empty-text').textContent = 'Check your internet connection and open this page again.';
    show($('empty'));
  });
})();
