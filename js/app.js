// Nakama Pokeball AR: picks the creature from the link (?c=4), then either starts the camera and
// waits for the NP sticker (marker), or with ?demo shows a no-camera preview.
(function () {
  // ---- tuning (sizes are in marker widths: 1 = the sticker's width) ----
  const SPRITE_SIZE = 1.25;   // how big the creature appears
  const HOVER = 0.08;         // gap between the sticker and the creature's feet
  const REAPPEAR_AFTER = 2500; // ms out of view before the release plays again

  const AFRAME_SRC = 'https://aframe.io/releases/1.5.0/aframe.min.js';
  const MINDAR_SRC = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';

  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const id = String(parseInt(params.get('c'), 10));
  const data = window.NAKAMA_SPRITES[id];
  const show = (el, on = true) => { el.hidden = !on; };

  let creature = null;
  let arStarted = false;

  if (!data) { show($('screen-nocard')); return; }
  show($('screen-start'));

  // ---------------------------------------------------------------- shared bits
  function makeCreature() {
    if (creature) return creature;
    creature = new NakamaCreature(id);
    window.nakamaCreature = creature; // handy for poking at from the browser console
    creature.onEvent = (ev, kind) => {
      if (ev === 'release') NakamaSfx.release();
      if (ev === 'cry') NakamaSfx.cry(id);
      if (ev === 'move') NakamaSfx.move(data.type, kind);
    };
    return creature;
  }

  const muteBtn = $('btn-mute');
  const paintMute = () => muteBtn.classList.toggle('off', NakamaSfx.muted);
  paintMute();
  muteBtn.addEventListener('click', () => { NakamaSfx.toggle(); paintMute(); });

  // Typewriter dialog box, one message at a time; tap to skip or advance.
  const dialog = {
    queue: [], timer: null, typing: false, full: '',
    say(lines) { this.queue = lines.slice(); show($('dialog')); this.next(); },
    next() {
      clearTimeout(this.timer);
      if (this.typing) { this.typing = false; $('dialog-text').textContent = this.full; this.wait(); return; }
      const line = this.queue.shift();
      if (line === undefined) { show($('dialog'), false); return; }
      this.full = line; this.typing = true;
      $('dialog-more').hidden = true;
      let i = 0;
      const step = () => {
        if (!this.typing) return;
        $('dialog-text').textContent = line.slice(0, ++i);
        if (i % 2) NakamaSfx.blip();
        if (i < line.length) this.timer = setTimeout(step, 32);
        else { this.typing = false; this.wait(); }
      };
      step();
    },
    wait() {
      $('dialog-more').hidden = this.queue.length === 0;
      this.timer = setTimeout(() => this.next(), this.queue.length ? 2600 : 4200);
    },
  };
  $('dialog').addEventListener('click', () => dialog.next());

  const dex = 'No.' + id.padStart(3, '0');
  const TYPE_WORD = { fire: 'FIRE', water: 'WATER', grass: 'GRASS' };
  function introLines() {
    return [`${data.name} came out of the Pokeball!`, `${dex} ${data.name}, ${TYPE_WORD[data.type]} type. Your new partner!`];
  }

  // ---------------------------------------------------------------- start
  $('btn-start').addEventListener('click', () => {
    NakamaSfx.unlock();
    NakamaSfx.preload(['release', 'cry-' + id]);
    show($('screen-start'), false);
    if (params.has('demo')) startPreview(); else startAR();
  });
  $('btn-retry').addEventListener('click', () => location.reload());
  $('btn-preview').addEventListener('click', () => {
    NakamaSfx.unlock();
    NakamaSfx.preload(['release', 'cry-' + id]);
    show($('screen-error'), false);
    startPreview();
  });

  function fail(msg) {
    show($('hud'), false);
    if (msg) $('error-text').textContent = msg;
    show($('screen-error'));
  }

  // ---------------------------------------------------------------- no-camera preview
  function startPreview() {
    const c = makeCreature();
    show($('hud')); show($('status'), false); show($('scan'), false);
    show($('stage'));
    $('stage-sprite').appendChild(c.canvas);
    let last = performance.now();
    (function loop(now) {
      c.update(now - last); last = now; c.draw();
      requestAnimationFrame(loop);
    })(last);
    setTimeout(() => { c.appear(); setTimeout(() => dialog.say(introLines()), 700); }, 500);
    $('stage').addEventListener('click', () => c.appear());
  }

  // ---------------------------------------------------------------- AR
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function startAR() {
    if (arStarted) return;
    arStarted = true;
    show($('hud')); show($('status'));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail(location.protocol !== 'https:' && location.hostname !== 'localhost'
        ? 'The camera only works on a secure (https) link. Open the link from your QR card on your phone.'
        : 'This browser can\'t use the camera. Try Safari on iPhone or Chrome on Android.');
      return;
    }
    try {
      await loadScript(AFRAME_SRC);
      await loadScript(MINDAR_SRC);
    } catch (e) {
      fail('Couldn\'t load the AR engine. Check your internet connection and try again.');
      return;
    }
    registerComponents();
    buildScene();
  }

  function registerComponents() {
    const THREE = window.AFRAME.THREE;

    // Paints the creature canvas onto a plane as a crisp pixel texture.
    AFRAME.registerComponent('nakama-sprite', {
      init() {
        this.c = makeCreature();
        this.tex = new THREE.CanvasTexture(this.c.canvas);
        this.tex.magFilter = THREE.NearestFilter;
        this.tex.minFilter = THREE.NearestFilter;
        this.tex.generateMipmaps = false;
        if ('colorSpace' in this.tex) this.tex.colorSpace = THREE.SRGBColorSpace;
        this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
      },
      tick(t, dt) {
        const mesh = this.el.getObject3D('mesh');
        if (mesh && mesh.material !== this.mat) mesh.material = this.mat;
        this.c.update(dt || 16);
        this.c.draw();
        this.tex.needsUpdate = true;
      },
    });

    AFRAME.registerComponent('nakama-shadow', {
      init() {
        const tex = new THREE.CanvasTexture(NakamaShadow());
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
        this.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      },
      tick() {
        const mesh = this.el.getObject3D('mesh');
        if (mesh && mesh.material !== this.mat) mesh.material = this.mat;
        const c = creature;
        const on = c && c.phase !== 'hidden';
        this.el.object3D.visible = !!on;
        if (on) {
          const s = c.phase === 'release' ? Math.min(c.phaseT / 350, 1) : 1 - c.bob() * 0.04;
          this.el.object3D.scale.set(s, s, 1);
        }
      },
    });

    // Turns the creature around the sticker's centre so it always faces the phone,
    // like a paper cut-out that follows you as you walk around the ball.
    AFRAME.registerComponent('nakama-face-camera', {
      init() { this.v = new THREE.Vector3(); this.angle = null; },
      tick() {
        const cam = this.el.sceneEl.camera;
        if (!cam) return;
        cam.getWorldPosition(this.v);
        this.el.parentNode.object3D.worldToLocal(this.v);
        if (Math.abs(this.v.x) + Math.abs(this.v.y) < 1e-4) return;
        const target = Math.atan2(this.v.x, -this.v.y);
        if (this.angle === null) this.angle = target;
        let d = target - this.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.angle += d * 0.2;
        this.el.object3D.rotation.z = this.angle;
      },
    });
  }

  function buildScene() {
    const half = SPRITE_SIZE / 2;
    $('ar-root').innerHTML = `
      <a-scene id="scene"
        mindar-image="imageTargetSrc: ./targets/marker.mind; autoStart: false; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001"
        color-space="sRGB" renderer="colorManagement: true" vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false" loading-screen="enabled: false">
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        <a-entity id="target" mindar-image-target="targetIndex: 0">
          <a-entity nakama-face-camera>
            <a-plane nakama-shadow width="0.62" height="0.31" position="0 0 0.002"></a-plane>
            <a-entity rotation="90 0 0">
              <a-plane nakama-sprite width="${SPRITE_SIZE}" height="${SPRITE_SIZE}" position="0 ${half + HOVER - SPRITE_SIZE * 2 / NAKAMA_TEX} 0"></a-plane>
            </a-entity>
          </a-entity>
        </a-entity>
      </a-scene>`;

    const scene = $('scene');
    const target = $('target');
    let seen = false, lostAt = 0, lostTimer = null;

    scene.addEventListener('arReady', () => { show($('status'), false); show($('scan')); });
    scene.addEventListener('arError', () => fail());

    target.addEventListener('targetFound', () => {
      clearTimeout(lostTimer);
      show($('scan'), false);
      if (!seen || performance.now() - lostAt > REAPPEAR_AFTER) {
        creature.appear();
        if (!seen) setTimeout(() => dialog.say(introLines()), 700);
        else setTimeout(() => dialog.say([`Go! ${data.name}!`]), 500);
      }
      seen = true;
    });
    target.addEventListener('targetLost', () => {
      lostAt = performance.now();
      lostTimer = setTimeout(() => show($('scan')), 600);
    });

    const go = () => {
      const sys = scene.systems['mindar-image-system'];
      makeCreature();
      sys.start();
    };
    if (scene.hasLoaded) go(); else scene.addEventListener('loaded', go);
  }
})();
