/**
 * AIMLab - rPPG explainer visuals for program.html?id=rppg
 *
 * 1) Hero stage: animated canonical face mesh with a per-region rPPG signal-strength
 *    heat map (slow head turn) beside a sweeping pulse illustration.
 * 2) "How a camera sees a heartbeat": skin-reflection diagram (redrawn after
 *    Verkruysse 2008 and Wang 2017), contact vs. remote PPG cards, references.
 *
 * Everything here is an illustration. No camera, no network, no measurement.
 * Depends on js/face-mesh-data.js (window.AIM_FACE). Markup is static (no user data).
 */
window.AIM_RPPG_VISUALS = (() => {
  const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tokens = {};
  let override = null;                      // set while a renderer with its own palette draws
  const css = n => (override && override[n]) || (tokens[n] ??= getComputedStyle(document.documentElement).getPropertyValue(n).trim());

  /** Fixed dark palette for card covers: the same whatever the site theme is. */
  const CARD_PALETTE = {
    '--card': '#081a3d', '--border': 'rgba(148,163,184,.16)', '--text-900': '#e8efff', '--text-500': '#9fb4dc',
    '--blue-700': '#ef4444'                 // the sweeping signal is red on cards
  };

  // Illustrative pulse shape (not a measured signal)
  const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  const pulse = p => gauss(p, 0.16, 0.055) + 0.38 * gauss(p, 0.42, 0.075) - 0.12;
  const HZ = 72 / 60;

  /* ------------------------------------------------------------------ markup */
  function heroStage() {
    return `
      <div class="rx-stage" aria-hidden="true">
        <canvas id="rx-hero-cv"></canvas>
        <p class="rx-readout"><span class="rx-live"></span><span class="t-en">Illustration · face mesh</span><span class="t-zh">示意圖 · 臉部網格</span><b>72<span>bpm</span></b></p>
      </div>`;
  }

  function scienceSection() {
    return `
    <section class="container rx-science" id="rl-science-section" aria-labelledby="rx-prin-h">
      <h2 class="section-title" id="rx-prin-h"><span class="t-en">How a camera sees a heartbeat</span><span class="t-zh">攝影機如何看見心跳</span></h2>
      <div class="rx-prin">
        <figure class="rx-prin-fig">
          <svg viewBox="0 0 640 400" role="img" aria-labelledby="rx-prin-cap">
            <title id="rx-prin-cap">Light reaching the skin: surface reflection carries no pulse; light that enters the skin and scatters back out is absorbed by blood in proportion to the heartbeat, so the color the camera sees rises and falls slightly.</title>
            <rect class="sub" x="20" y="330" width="600" height="56"/>
            <rect class="derm" x="20" y="268" width="600" height="62"/>
            <rect class="epi" x="20" y="236" width="600" height="32"/>
            <line class="surface" x1="20" y1="236" x2="620" y2="236"/>
            <!-- layer names stay short and left of x≈250 so they never reach the light path or the vessel (cx 340), whatever the monospace font -->
            <text class="layer-t" x="30" y="257"><tspan class="t-en">Epidermis</tspan><tspan class="t-zh">表皮</tspan></text>
            <text class="layer-t" x="30" y="292"><tspan class="t-en">Dermis</tspan><tspan class="t-zh">真皮</tspan></text>
            <text class="layer-t layer-sub" x="30" y="314"><tspan class="t-en">capillaries, arterioles</tspan><tspan class="t-zh">微血管、小動脈</tspan></text>
            <text class="layer-t" x="30" y="364"><tspan class="t-en">Subcutis</tspan><tspan class="t-zh">皮下組織</tspan></text>
            <ellipse class="art" id="rx-prin-art" cx="340" cy="304" rx="40" ry="9"/>
            <defs>
              <linearGradient id="rx-lamp-glow" gradientUnits="userSpaceOnUse" x1="0" y1="56" x2="0" y2="236">
                <stop offset="0" stop-color="#e0a63a" stop-opacity=".32"/>
                <stop offset="1" stop-color="#e0a63a" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path d="M217 56 10 236h462L265 56z" fill="url(#rx-lamp-glow)"/>
            <path class="ray-in" d="M238 62 320 236M241 62 431 236"/>
            <circle class="sun" cx="240" cy="54" r="9"/>
            <path class="lamp-cord" d="M240 0v26"/>
            <path class="lamp-shade" d="M210 54a30 30 0 0 1 60 0z"/>
            <rect class="lamp-rim" x="208" y="52" width="64" height="4" rx="2"/>
            <rect class="dev" x="552" y="92" width="56" height="112" rx="11"/>
            <rect class="dev-screen" x="555.5" y="95.5" width="49" height="105" rx="8"/>
            <path class="dev-island" d="M570 95.5h20v4a3.5 3.5 0 0 1-3.5 3.5h-13a3.5 3.5 0 0 1-3.5-3.5z"/>
            <circle class="dev-lens" cx="580" cy="99" r="2.4"/>
            <path class="dev-ui" d="M566 118v-5h5M594 118v-5h-5M566 136v5h5M594 136v5h-5"/>
            <path class="dev-pulse" d="M564 164h8l3-6 4 11 3-8 2 3h12"/>
            <rect class="dev-home" x="570" y="194" width="20" height="2.5" rx="1.25"/>
            <path class="normal" d="M431 236V202"/>
            <text class="t-theta" x="422" y="221" text-anchor="middle">θ</text><text class="t-theta" x="441" y="221" text-anchor="middle">θ</text>
            <path class="ray-spec" d="M431 236 580 99"/>
            <!-- Diffuse path (original geometry): air 25.2° -> skin 17.7° at entry (n ≈ 1.4); light crosses the vessel and is scattered back; exits at 36.7° inside -> 56.9° outside, Snell at both interfaces -->
            <path class="ray-diff" id="rx-prin-diff" d="M320 236 339 296 357 300 345 270 370 236 580 99"/>
            <rect class="wave-bg" x="420" y="46" width="130" height="48" rx="10"/>
            <path class="wave" id="rx-prin-wave" d=""/>
            <circle class="wave-dot" id="rx-prin-wdot" r="5" cx="430" cy="84"/>
            <g><circle class="num-bg" cx="292" cy="40" r="14"/><text class="t-num" x="292" y="45" text-anchor="middle">1</text></g>
            <g><circle class="num-bg" cx="488" cy="220" r="14"/><text class="t-num" x="488" y="225" text-anchor="middle">2</text></g>
            <g><circle class="num-bg" cx="398" cy="284" r="14"/><text class="t-num" x="398" y="289" text-anchor="middle">3</text></g>
            <g><circle class="num-bg" cx="626" cy="112" r="12"/><text class="t-num" x="626" y="117" text-anchor="middle">4</text></g>
            <text class="t-sm" x="420" y="34"><tspan class="t-en">Color change ≈ pulse wave</tspan><tspan class="t-zh">顏色變化 ≈ 脈搏波</tspan></text>
          </svg>
        </figure>
        <ol class="rx-notes">
          <li><span class="rx-n">1</span><span><span class="t-en"><b>Light falls on the face.</b> Ordinary room light is enough; no special source is needed.</span><span class="t-zh"><b>光線照在臉上。</b>一般室內光就夠，不需要特殊光源。</span></span></li>
          <li><span class="rx-n">2</span><span><span class="t-en"><b>Surface reflection</b> bounces off at the mirror angle. It is the color of the light source and carries <b>no pulse</b>; it shifts the moment the head moves, which makes it the main source of interference.</span><span class="t-zh"><b>表面反射</b>以鏡面角度彈開，顏色與光源相同，<b>不帶脈搏</b>；頭一動它就跟著變，是主要的干擾來源。</span></span></li>
          <li><span class="rx-n">3</span><span><span class="t-en"><b>Light that enters the skin</b> refracts at the surface, scatters through tissue, passes the small vessels of the dermis and exits elsewhere. With every heartbeat there is more blood, more absorption, and the light that comes out is a little darker.</span><span class="t-zh"><b>進入皮膚的光</b>在表面折射、在組織中散射、穿過真皮層的小血管後從別處射出。每一次心跳血液變多、吸收變多，出來的光就暗一點。</span></span></li>
          <li><span class="rx-n">4</span><span><span class="t-en"><b>The camera</b> captures about 30 frames per second. Averaging the color of each region reveals a curve that rises and falls with the heartbeat. Of the three color channels, <b>green changes the most</b>.</span><span class="t-zh"><b>攝影機</b>每秒約拍 30 張。對每個區域的顏色取平均，就能看到一條隨心跳起伏的曲線；三個色彩通道中，<b>綠色變化最大</b>。</span></span></li>
        </ol>
        <div class="rx-vs">
          <article class="card">
            <svg viewBox="0 0 72 72" aria-hidden="true"><rect x="6" y="24" width="60" height="26" rx="13" fill="#e8bf9f"/><rect x="26" y="12" width="20" height="10" rx="3" fill="#e0a63a"/><rect x="26" y="52" width="20" height="10" rx="3" fill="#26313a"/><path d="M36 22v30" stroke="#c4505a" stroke-width="3" stroke-dasharray="4 3"/></svg>
            <div><p class="rx-vs-k"><span class="t-en">Contact · transmissive</span><span class="t-zh">接觸式 · 穿透</span></p><h3><span class="t-en">Fingertip pulse oximeter</span><span class="t-zh">指尖血氧機</span></h3><p><span class="t-en">An LED on one side, a sensor on the other; light passes through the finger. Strong signal, but it has to be clipped on. Our reference device is of this kind.</span><span class="t-zh">一側 LED、一側感測器，光穿過手指。訊號強，但必須夾在身上。我們的參考儀器就是這一類。</span></p></div>
          </article>
          <article class="card">
            <svg viewBox="0 0 72 72" aria-hidden="true"><rect x="4" y="38" width="64" height="28" rx="6" fill="#e8bf9f"/><rect x="14" y="18" width="44" height="18" rx="6" fill="#26313a"/><rect x="20" y="32" width="10" height="6" rx="2" fill="#e0a63a"/><rect x="42" y="32" width="10" height="6" rx="2" fill="#0b5bd3"/><path d="M25 39c0 18 22 18 22 0" fill="none" stroke="#c4505a" stroke-width="3" stroke-dasharray="4 3"/></svg>
            <div><p class="rx-vs-k"><span class="t-en">Contact · reflective</span><span class="t-zh">接觸式 · 反射</span></p><h3><span class="t-en">Watch or wristband</span><span class="t-zh">手錶或腕帶</span></h3><p><span class="t-en">Emitter and sensor sit on the same side; light enters the skin and scatters back. It must sit tight on the skin, and any slack adds noise.</span><span class="t-zh">發射器與感測器在同一側，光進入皮膚再散射回來。必須貼緊皮膚，一鬆就有雜訊。</span></p></div>
          </article>
          <article class="card">
            <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="#e0a63a"/><circle cx="22" cy="44" r="15" fill="#e8bf9f"/><rect x="52" y="26" width="16" height="36" rx="4" fill="#26313a"/><circle cx="60" cy="36" r="4" fill="#0b5bd3"/><path d="M16 18l8 16M36 42h14" stroke="#2f9e5b" stroke-width="3" stroke-dasharray="4 3"/></svg>
            <div><p class="rx-vs-k"><span class="t-en">Non-contact · reflective</span><span class="t-zh">非接觸 · 反射</span></p><h3><span class="t-en">Remote PPG (rPPG)</span><span class="t-zh">遠距 PPG（rPPG）</span></h3><p><span class="t-en">The same physics as the reflective case, but the light is ambient and the camera sits away from the skin. The signal is tiny and easily swamped by motion and lighting, so the system has to know when not to trust it.</span><span class="t-zh">物理原理與反射式相同，但光源是環境光，攝影機離皮膚有距離。訊號極小，容易被動作與光線淹沒，所以系統必須知道何時不該相信它。</span></p></div>
          </article>
        </div>
        <div class="rx-cite">
          <p><span class="t-en">Sources (figures on this page are redrawn from the literature, not copied):</span><span class="t-zh">參考文獻（本頁圖示依文獻重繪，非直接複製）：</span></p>
          <p>Verkruysse, Svaasand &amp; Nelson (2008) measured the pulse at a distance with an ordinary camera and ambient light; the green channel carries the strongest signal. <a href="https://doi.org/10.1364/OE.16.021434" target="_blank" rel="noopener noreferrer">Optics Express</a></p>
          <p>Wang, den Brinker, Stuijk &amp; de Haan (2017): the skin-reflection model, specular reflection plus pulsatile diffuse reflection. <a href="https://doi.org/10.1109/TBME.2016.2609282" target="_blank" rel="noopener noreferrer">IEEE TBME</a></p>
          <p>Li, Elgendi, Zhu, Lam &amp; Menon (2026) compared 15 facial regions: glabella, nasal dorsum and both malar regions are stable signal sources across lighting; the lower face is weaker. The hero heat map follows their regions (CC BY 4.0; unranked regions are indicative). <a href="https://doi.org/10.1038/s44325-026-00140-7" target="_blank" rel="noopener noreferrer">npj Cardiovascular Health</a></p>
          <p>Moco, Stuijk &amp; de Haan (2018) support blood-volume change as the origin of the signal; the exact mechanism is still debated. <a href="https://doi.org/10.1038/s41598-018-26068-2" target="_blank" rel="noopener noreferrer">Scientific Reports</a></p>
        </div>
      </div>

    </section>`;
  }

  /* ------------------------------------------------------------------ face */
  function makeFace() {
    const { MESH_V, MESH_F, FACE_ROI, HEAT } = window.AIM_FACE;
    const rgb = c => `rgb(${c.join(',')})`;
    const heat = t => {
      const i = Math.max(1, HEAT.findIndex(([s]) => t <= s));
      const [s0, c0] = HEAT[i - 1], [s1, c1] = HEAT[i], u = (t - s0) / (s1 - s0);
      return rgb(c0.map((v, j) => Math.round(v + (c1[j] - v) * u)));
    };
    const pts = new Float32Array(MESH_V.length);
    const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (let i = 0; i < MESH_V.length; i += 3) {
      box.x0 = Math.min(box.x0, MESH_V[i]); box.x1 = Math.max(box.x1, MESH_V[i]);
      box.y0 = Math.min(box.y0, MESH_V[i + 1]); box.y1 = Math.max(box.y1, MESH_V[i + 1]);
    }
    const mx = (box.x0 + box.x1) / 2, my = (box.y0 + box.y1) / 2, meshH = box.y1 - box.y0;
    // Heat map is drawn at 1/8 resolution and upscaled to soften edges (ctx.filter is not universal)
    const LOW = 8, buf = document.createElement('canvas'), bctx = buf.getContext('2d');

    function project(cx, cy, scale, yaw, pitch) {
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      for (let i = 0; i < MESH_V.length; i += 3) {
        const x = MESH_V[i] - mx, y = MESH_V[i + 1] - my, z = MESH_V[i + 2];
        const xr = x * cosY + z * sinY, zr = -x * sinY + z * cosY;
        pts[i] = cx + xr * scale;
        pts[i + 1] = cy - (y * cosP - zr * sinP) * scale;
        pts[i + 2] = y * sinP + zr * cosP;
      }
    }
    const isFront = (a, b, c) =>
      (pts[b * 3] - pts[a * 3]) * (pts[c * 3 + 1] - pts[a * 3 + 1]) - (pts[b * 3 + 1] - pts[a * 3 + 1]) * (pts[c * 3] - pts[a * 3]) < 0;
    function polygon(g, ids) {
      ids.forEach((k, n) => (n ? g.lineTo : g.moveTo).call(g, pts[k * 3], pts[k * 3 + 1]));
      g.closePath();
    }
    function frontFaces(g) {
      for (let i = 0; i < MESH_F.length; i += 3) {
        const a = MESH_F[i], b = MESH_F[i + 1], c = MESH_F[i + 2];
        if (isFront(a, b, c)) polygon(g, [a, b, c]);
      }
    }
    function corners(ctx, x0, y0, x1, y1, len) {
      ctx.strokeStyle = css('--text-500'); ctx.lineWidth = 2; ctx.beginPath();
      for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) {
        ctx.moveTo(x, y + dy * len); ctx.lineTo(x, y); ctx.lineTo(x + dx * len, y);
      }
      ctx.stroke();
    }
    function heatLayer(ctx, w, h, beat) {
      const bw = Math.ceil(w / LOW), bh = Math.ceil(h / LOW);
      if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
      bctx.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bctx.globalAlpha = 0.3; bctx.fillStyle = heat(0);
      bctx.beginPath(); frontFaces(bctx); bctx.fill();
      const glow = 0.78 + 0.22 * beat;
      for (const [t, ids] of FACE_ROI) {
        bctx.globalAlpha = (0.32 + 0.5 * t) * glow; bctx.fillStyle = heat(t);
        bctx.beginPath(); polygon(bctx, ids); bctx.fill();
      }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * LOW, bh * LOW);
    }
    function legend(ctx, x0, x1, y) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      HEAT.forEach(([t, c]) => g.addColorStop(t, rgb(c)));
      ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 6);
      ctx.font = '11px "Plus Jakarta Sans", "Noto Sans TC", system-ui, sans-serif'; ctx.fillStyle = css('--text-500');
      // follows the site language switch (the canvas redraws every frame); the caption shortens when space is tight
      const zh = document.documentElement.dataset.lang === 'zh';
      const [weak, strong] = zh ? ['弱', '強'] : ['weak', 'strong'];
      const room = (x1 - x0) - ctx.measureText(weak).width - ctx.measureText(strong).width - 24;
      const long = zh ? '相對訊號強度（依 Li et al. 2026）' : 'relative signal strength (after Li et al. 2026)';
      const short = zh ? '依 Li et al. 2026' : 'after Li et al. 2026';
      const caption = ctx.measureText(long).width <= room ? long : short;
      for (const [align, x, text] of [['left', x0, weak], ['right', x1, strong], ['center', (x0 + x1) / 2, caption]]) {
        ctx.textAlign = align; ctx.fillText(text, x, y + 20);
      }
      ctx.textAlign = 'left';
    }
    return function draw(ctx, w, h, sec, beat, wide) {
      // Side-by-side: the face and its frame (about 0.88 × size wide) must fit left of the waveform,
      // which starts at 52% of the width; on a phone-width stage that, not the height, limits the size.
      const size = wide ? Math.min(h * 0.74, 300, (w * 0.52 - 18) / 0.88) : Math.min(210, h * 0.5);
      const cx = wide ? Math.max(w * 0.28, 8 + size * 0.45) : w / 2, cy = wide ? h * 0.47 : 30 + size / 2;
      // slow head turn ±16° to suggest tracking
      project(cx, cy, size / meshH, motionOK ? Math.sin(sec * 0.45) * 0.28 : 0.12, motionOK ? Math.sin(sec * 0.31) * 0.06 : 0);
      const fx0 = cx - size * 0.43, fx1 = cx + size * 0.43, fy0 = cy - size * 0.56, fy1 = cy + size * 0.56;
      corners(ctx, fx0, fy0, fx1, fy1, 18);
      heatLayer(ctx, w, h, beat);
      const ink = css('--text-900');
      ctx.globalAlpha = 0.26; ctx.strokeStyle = ink; ctx.lineWidth = 0.6;
      ctx.beginPath(); frontFaces(ctx); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.fillStyle = ink;
      for (let i = 0; i < pts.length; i += 3) if (pts[i + 2] > -1) ctx.fillRect(pts[i] - 0.7, pts[i + 1] - 0.7, 1.4, 1.4);
      ctx.globalAlpha = 1;
      if (h >= 300) legend(ctx, wide ? fx0 : 16, w - 16, fy1 + 16);   // no legend inside small card covers
    };
  }

  function gridBg(ctx, w, h, step) {
    ctx.strokeStyle = css('--border'); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0.5; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0.5; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  /* ------------------------------------------------------------------ mount */
  /**
   * Build the face-mesh + sweeping-pulse renderer for one canvas. Returns draw(sec) or null.
   * Used by the program hero (#rx-hero-cv) and by live program-card covers (mountCanvas).
   */
  function makeHeroRenderer(cv, { palette = null, camera = false } = {}) {
    if (!cv || !window.AIM_FACE) return null;
    const drawFace = makeFace();
    const ctx = cv.getContext('2d');
    let w = 0, h = 0;
    const fit = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      w = r.width; h = r.height;
      cv.width = Math.max(1, w * d); cv.height = Math.max(1, h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    new ResizeObserver(fit).observe(cv); fit();
    return sec => {
      if (!w) return;
      override = palette;
      const wide = w > 300;                       // side-by-side layout also for card covers
      ctx.clearRect(0, 0, w, h);
      if (palette) { ctx.fillStyle = css('--card'); ctx.fillRect(0, 0, w, h); }
      gridBg(ctx, w, h, 32);
      drawFace(ctx, w, h, sec, Math.max(0, pulse((sec * HZ) % 1)), wide);
      const camW = camera ? 44 : 0;                // room for the camera glyph after the signal
      const x0 = wide ? w * 0.52 : 16, span = w - 16 - camW - x0, base = wide ? h * 0.6 : h * 0.95, amp = wide ? h * 0.2 : h * 0.1;
      const SECS = 4, GAP = 26, head = ((sec % SECS) / SECS) * span;
      const yAt = s => base - pulse(((s * HZ) % 1 + 1) % 1) * amp;
      ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle = css('--blue-700');
      ctx.beginPath();
      let pen = false;
      for (let dx = 0; dx <= span; dx += 2) {
        if (dx > head && dx < head + GAP) { pen = false; continue; }
        const y = yAt(sec - ((head - dx + (dx > head ? span : 0)) / span) * SECS);
        pen ? ctx.lineTo(x0 + dx, y) : ctx.moveTo(x0 + dx, y);
        pen = true;
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + head, yAt(sec), 4, 0, 7); ctx.fill();
      if (camera) cameraGlyph(ctx, x0 + span + 10, base, css('--text-900'));
      override = null;
    };
  }

  /** Small camera: body with a lens, hood pointing left toward the signal. */
  function cameraGlyph(ctx, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.roundRect(x + 8, y - 10, 24, 20, 4); ctx.stroke();                     // body
    ctx.beginPath(); ctx.moveTo(x + 8, y - 4); ctx.lineTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.lineTo(x + 8, y + 4); ctx.closePath(); ctx.stroke();   // hood
    ctx.beginPath(); ctx.arc(x + 20, y, 5, 0, 7); ctx.stroke();                                 // lens
    ctx.beginPath(); ctx.arc(x + 20, y, 1.8, 0, 7); ctx.fill();
    ctx.restore();
  }

  /** Animate a stand-alone canvas (e.g. a program-card cover) with the hero illustration. */
  function mountCanvas(cv) {
    const draw = makeHeroRenderer(cv, { palette: CARD_PALETTE, camera: true });
    if (!draw) return;
    // The face mesh is heavy on phones, so a card cover only draws while it is on screen, at ~30 fps,
    // and holds its frame while the page is being scrolled (otherwise it takes the frames scrolling needs).
    const t0 = performance.now();
    let onScreen = true, scrolling = false, idle = 0, last = -Infinity;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(cv);
    window.addEventListener('scroll', () => {
      scrolling = true; clearTimeout(idle);
      idle = setTimeout(() => { scrolling = false; }, 160);
    }, { passive: true });
    const frame = ms => {
      if (onScreen && !document.hidden && !scrolling && ms - last >= 32) {
        last = ms;
        draw(motionOK ? (ms - t0) / 1000 : 1.2);
      }
      if (motionOK) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function mount() {
    const t0 = performance.now();
    const hero = makeHeroRenderer(document.getElementById('rx-hero-cv'));

    // principle diagram animation
    let principle = null;
    const artery = document.getElementById('rx-prin-art'), diffuse = document.getElementById('rx-prin-diff'),
      wdot = document.getElementById('rx-prin-wdot'), wave = document.getElementById('rx-prin-wave');
    if (artery && diffuse && wdot && wave) {
      const X0 = 430, X1 = 540, Y = 84, AMP = 28, CYCLES = 2;
      const at = u => [X0 + u * (X1 - X0), Y - pulse((u * CYCLES) % 1) * AMP];
      wave.setAttribute('d', Array.from({ length: 101 }, (_, i) => (i ? 'L' : 'M') + at(i / 100).map(v => v.toFixed(1)).join(' ')).join(''));
      principle = sec => {
        const beat = Math.max(0, pulse((sec * HZ) % 1));
        artery.setAttribute('ry', (8 + 5 * beat).toFixed(2));          // more blood …
        diffuse.style.strokeOpacity = (1 - 0.45 * beat).toFixed(3);     // … darker diffuse light
        const [x, y] = at(((sec * HZ) / CYCLES) % 1);
        wdot.setAttribute('cx', x.toFixed(1)); wdot.setAttribute('cy', y.toFixed(1));
      };
    }


    let visible = true;
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    function frame(ms) {
      if (visible) {
        const sec = (ms - t0) / 1000;
        if (hero) hero(motionOK ? sec : 1.2);
        if (principle) principle(motionOK ? sec : 0.2);
      }
      if (motionOK) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  return { heroStage, scienceSection, mount, mountCanvas };
})();
