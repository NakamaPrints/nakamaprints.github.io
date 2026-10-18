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

  async function load() {
    const signedIn = !!(await NakamaDB.session(false));
    const [list, mine, trainer] = await Promise.all([
      NakamaDB.pokemonList(),
      signedIn ? NakamaDB.myCollection() : [],
      signedIn ? NakamaDB.trainer() : null,
    ]);
    const copies = {};
    for (const c of mine) copies[c.dex] = (copies[c.dex] || 0) + 1;
    const found = list.filter(p => copies[p.dex]).length;
    const rares = list.filter(p => p.rare);

    const who = !trainer ? '' : trainer.name === 'Trainer' ? 'Trainer' : `Trainer ${trainer.name}`;
    $('trainer').textContent = trainer ? `${who} · ${trainer.code}` : 'No trainer yet';
    $('count').textContent = `${found}/${list.length}`;
    $('bar').style.width = (100 * found / list.length) + '%';
    $('rare').textContent = `★ Rare found: ${rares.filter(p => copies[p.dex]).length} of ${rares.length}`;
    show($('empty'), found === 0);

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
  $('scan-help-close').addEventListener('click', () => show($('scan-help'), false));

  // ---- add to home screen
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let dismissed = false;
  try { dismissed = localStorage.getItem('np-install-dismissed') === '1'; } catch (e) {}
  let deferred = null;
  if (!standalone && !dismissed) {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show($('install')); });
    if (isIOS) {
      $('install-hint').textContent = 'In Safari, tap Share, then "Add to Home Screen".';
      show($('install-btn'), false);
      show($('install'));
    }
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
    $('empty').textContent = 'Check your internet connection and open this page again.';
    show($('empty'));
  });
})();
