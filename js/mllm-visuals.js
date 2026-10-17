/**
 * AIMLab - MLLM live cover for program cards ("live": "mllm" in programs.json).
 *
 * The whole cover is drawn on a canvas: three inputs on the left (an image read patch by patch,
 * breathing audio bars, a scrolling physiological trace), a small network in the middle whose
 * activations travel node by node, and on the right what the model produces: the emotion placed
 * on a valence-arousal plane and an empathic reply typed into a speech bubble. One forward pass
 * per CYCLE seconds; each pass picks the next scenario from SCENARIOS.
 *
 * Everything here is an illustration. No model, no data. Coordinates are in a fixed 788 x 444
 * grid and scaled to whatever size the canvas is displayed at.
 */
window.AIM_MLLM_VISUALS = (() => {
  const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ART_W = 788, ART_H = 444;
  const PAPER = '#e9edf5';
  const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  const C = { blue: '#2a5fbf', ink: '#1d4d96', indigo: '#3b33ad', teal: '#27b1a7', violet: '#6a40b9', white: '#fff' };

  /* ------------------------------------------------------------------ layout (artwork pixels) */
  const IMG = { x: 53, y: 64, w: 138, h: 76, cols: 4, rows: 3 };
  const AUDIO = { x: 38, y: 216, w: 176, bars: 27 };
  const PHYSIO = { x: 34, y: 340, w: 180, amp: 30 };
  const ANCHORS = [[197, 104], [218, 216], [214, 340]];     // where each input's edges leave: image, audio, physio
  const L1 = [122, 160, 200, 237, 275, 313].map(y => [352, y]);
  const L2 = [110, 160, 215, 270, 322].map(y => [400, y]);
  const OUT = [470, 216];                                    // fused representation
  const NODE_R = 8;
  const PLANE = { x: 640, y: 118, r: 66 };                   // valence (x) - arousal (y) plane
  const BUBBLE = { x: 520, y: 262, w: 250, h: 118, pad: 16, line: 27 };
  const HEADS = [[PLANE.x - PLANE.r * 0.7, PLANE.y + PLANE.r * 0.7], [BUBBLE.x, BUBBLE.y + 34]];   // where the two output lines land

  // What a pass "finds": emotion, its place on the plane (valence, arousal in -1..1) and the reply.
  const SCENARIOS = [
    { label: 'sad', v: -0.62, a: -0.32, text: 'That sounds really hard. I\'m here with you.' },
    { label: 'anxious', v: -0.4, a: 0.62, text: 'Let\'s take one slow breath together.' },
    { label: 'joy', v: 0.7, a: 0.5, text: 'That\'s wonderful. Tell me more about it!' },
    { label: 'calm', v: 0.5, a: -0.55, text: 'It sounds like you\'ve found some peace today.' },
    { label: 'angry', v: -0.7, a: 0.55, text: 'It makes sense that you feel upset about this.' },
    { label: 'tired', v: -0.2, a: -0.72, text: 'You\'ve carried a lot today. Resting is okay.' }
  ];
  const scenario = cycle => SCENARIOS[((cycle % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length];

  // stage 0: inputs -> L1, 1: L1 -> L2, 2: L2 -> fused node, 3: fused node -> the two outputs.
  // Then the emotion point moves (MOVE) and the reply is typed (TYPE). One forward pass per CYCLE seconds.
  const CYCLE = 4.6;
  const STAGES = [[0.02, 0.22], [0.25, 0.40], [0.42, 0.52], [0.54, 0.62]];
  const MOVE = [0.60, 0.76], TYPE = [0.62, 0.92];
  const EDGES = [];
  ANCHORS.forEach((a, i) => L1.forEach((b, j) => EDGES.push({ a, b, stage: 0, shape: i, seed: hash(i * 7 + j) })));
  L1.forEach((a, i) => L2.forEach((b, j) => EDGES.push({ a, b, stage: 1, shape: 3, seed: hash(100 + i * 5 + j) })));
  L2.forEach((a, i) => EDGES.push({ a, b: OUT, stage: 2, shape: 3, seed: hash(200 + i) }));
  HEADS.forEach((b, i) => EDGES.push({ a: OUT, b, stage: 3, shape: 3, seed: 0.2 * i }));

  /* ------------------------------------------------------------------ helpers */
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  /** Progress 0..1 of a stage inside the cycle phase p, or -1 when the stage is not running. */
  const stageU = (p, k) => (p < STAGES[k][0] || p > STAGES[k][1] ? -1 : (p - STAGES[k][0]) / (STAGES[k][1] - STAGES[k][0]));
  /** A node lights up when its stage's travellers arrive, then fades. */
  const arrival = (p, k) => Math.max(0, 1 - Math.abs(p - STAGES[k][1]) / 0.14);
  /** 0..1 progress through a [start, end] window of the cycle. */
  const window01 = (p, [s0, s1]) => clamp01((p - s0) / (s1 - s0));
  const ease = u => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  /** Illustrative ECG-like beat (P, QRS, T) on a 0..1 phase. */
  const ecg = f => 0.14 * gauss(f, 0.2, 0.035) - 0.1 * gauss(f, 0.37, 0.012) + gauss(f, 0.4, 0.013) - 0.22 * gauss(f, 0.435, 0.012) + 0.3 * gauss(f, 0.62, 0.05);

  function rgba(hex, a) {
    const n = parseInt(hex.length === 4 ? hex.slice(1).replace(/./g, c => c + c) : hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ------------------------------------------------------------------ inputs */
  /** Image input: a small landscape, read patch by patch while stage 0 runs. */
  function drawImageInput(ctx, p) {
    const { x, y, w, h, cols, rows } = IMG;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6);
    ctx.fillStyle = '#d7e4f8'; ctx.fill();
    ctx.clip();
    ctx.fillStyle = rgba(C.blue, 0.55);                                  // sun
    ctx.beginPath(); ctx.arc(x + 24, y + 20, 7, 0, 7); ctx.fill();
    ctx.fillStyle = rgba(C.blue, 0.6);                                   // hills
    ctx.beginPath(); ctx.moveTo(x, y + h);
    [[0, 56], [22, 34], [48, 48], [78, 24], [104, 44], [126, 30], [138, 40]].forEach(([dx, dy]) => ctx.lineTo(x + dx, y + dy));
    ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(C.ink, 0.5);
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + 30, y + 46); ctx.lineTo(x + 64, y + 60); ctx.lineTo(x + 96, y + 40); ctx.lineTo(x + w, y + 58); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();

    // patch grid + the patches read so far this pass
    const cw = w / cols, ch = h / rows, n = cols * rows;
    const u = stageU(p, 0);
    const read = u < 0 ? (p > STAGES[0][1] ? n : 0) : Math.floor(u * n * 1.15);
    const fadeAll = p > STAGES[0][1] ? 1 - clamp01((p - STAGES[0][1]) / 0.3) : 1;
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < cols; i++) { ctx.moveTo(x + i * cw, y); ctx.lineTo(x + i * cw, y + h); }
    for (let j = 1; j < rows; j++) { ctx.moveTo(x, y + j * ch); ctx.lineTo(x + w, y + j * ch); }
    ctx.stroke();
    for (let k = 0; k < Math.min(read, n); k++) {
      const age = u < 0 ? 1 : clamp01((u * n * 1.15 - k) / 2);          // newest patch is brightest
      const fresh = (1 - age) * fadeAll, keep = 0.3 * fadeAll;
      const px = x + (k % cols) * cw, py = y + Math.floor(k / cols) * ch;
      ctx.fillStyle = `rgba(255,255,255,${keep + 0.6 * fresh})`; ctx.fillRect(px, py, cw, ch);
      ctx.strokeStyle = rgba(C.ink, keep + 0.7 * fresh); ctx.lineWidth = 1 + 1.5 * fresh; ctx.strokeRect(px + 1, py + 1, cw - 2, ch - 2);
    }
    ctx.restore();
    ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke();
  }

  /** Audio input: a symmetric bar waveform whose bars breathe. */
  function drawAudio(ctx, sec, p) {
    const { x, y, w, bars } = AUDIO;
    const step = w / (bars - 1);
    const hot = Math.max(0, stageU(p, 0));
    ctx.lineCap = 'round'; ctx.lineWidth = 3.2; ctx.strokeStyle = C.blue;
    for (let i = 0; i < bars; i++) {
      const env = 0.18 + 0.82 * Math.max(gauss(i, 13, 5.5), 0.7 * gauss(i, 5, 2.2), 0.6 * gauss(i, 21, 2.4));
      const wob = 0.55 + 0.45 * Math.abs(Math.sin(sec * 5.1 + i * 1.7) * Math.sin(sec * 2.3 + i * 0.6));
      const hh = Math.max(2, 32 * env * (0.6 + 0.4 * wob) * (1 + 0.2 * hot));
      const bx = x + i * step;
      ctx.beginPath(); ctx.moveTo(bx, y - hh); ctx.lineTo(bx, y + hh); ctx.stroke();
    }
  }

  /** Physiological input: an ECG-like trace scrolling left to right (toward the network), bright where it leaves. */
  function drawPhysio(ctx, sec) {
    const { x, y, w, amp } = PHYSIO;
    const BEATS = 2.2, PERIOD = 1.05;                                   // beats visible / seconds per beat
    const yAt = dx => y - ecg((((sec - (dx / w) * BEATS * PERIOD) / PERIOD) % 1 + 1) % 1) * amp;   // newest sample at the left edge
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.indigo;
    ctx.beginPath();
    for (let dx = 0; dx <= w; dx += 1.5) (dx ? ctx.lineTo : ctx.moveTo).call(ctx, x + dx, yAt(dx));
    ctx.stroke();
    ctx.fillStyle = C.indigo; ctx.beginPath(); ctx.arc(x + w, yAt(w), 3.2, 0, 7); ctx.fill();
  }

  /* ------------------------------------------------------------------ network */
  function drawEdges(ctx) {
    ctx.strokeStyle = rgba(C.blue, 0.42); ctx.lineWidth = 1.1; ctx.beginPath();
    EDGES.forEach(({ a, b }) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
    ctx.stroke();
  }

  /** The signal travelling along each edge of the running stage: a short bright trail and a token. */
  function drawTravellers(ctx, p) {
    EDGES.forEach(({ a, b, stage, shape, seed }) => {
      const u0 = stageU(p, stage);
      if (u0 < 0) return;
      const u = clamp01(u0 * 1.1 - seed * 0.1);                           // edges start slightly out of step
      if (u <= 0.05 || u >= 0.97) return;                                 // not piled up on the anchor or the node
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
      const tx = a[0] + (b[0] - a[0]) * Math.max(0, u - 0.14), ty = a[1] + (b[1] - a[1]) * Math.max(0, u - 0.14);
      const trail = ctx.createLinearGradient(tx, ty, x, y);
      trail.addColorStop(0, rgba(C.teal, 0)); trail.addColorStop(1, rgba(C.teal, 0.9));
      ctx.strokeStyle = trail; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = C.ink;
      if (shape === 0) ctx.fillRect(x - 2.4, y - 2.4, 4.8, 4.8);         // image patch token
      else if (shape === 1) ctx.fillRect(x - 1.2, y - 3.6, 2.4, 7.2);    // audio bar token
      else { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); }   // physio / hidden activations
    });
  }

  /** Nodes fill and glow when their stage's travellers arrive; each lights up by a different amount each pass. */
  function drawNodes(ctx, p, cycle) {
    [[L1, 0], [L2, 1]].forEach(([layer, stage]) => {
      const t = arrival(p, stage);
      layer.forEach(([x, y], i) => {
        const a = t * (0.45 + 0.55 * hash(cycle * 31 + stage * 11 + i));
        if (a > 0.02) {
          const halo = ctx.createRadialGradient(x, y, NODE_R, x, y, NODE_R + 16 * a);
          halo.addColorStop(0, rgba(C.teal, 0.45 * a)); halo.addColorStop(1, rgba(C.teal, 0));
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, NODE_R + 16 * a, 0, 7); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, NODE_R, 0, 7);
        ctx.fillStyle = C.white; ctx.fill();
        ctx.fillStyle = rgba(C.blue, a); ctx.fill();
        ctx.strokeStyle = C.blue; ctx.lineWidth = 1.6; ctx.stroke();
      });
    });
  }

  /** The fused-representation node: a teal-violet orb that flares when the pass arrives. */
  function drawFused(ctx, p) {
    const [x, y] = OUT;
    const a = arrival(p, 2);
    const r = 10 + 4 * a;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r + 16);
    glow.addColorStop(0, rgba(C.teal, 0.5 + 0.4 * a)); glow.addColorStop(0.5, rgba(C.violet, 0.3 + 0.3 * a)); glow.addColorStop(1, rgba(C.violet, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r + 16, 0, 7); ctx.fill();
    const core = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, r);
    core.addColorStop(0, '#d9fffb'); core.addColorStop(0.5, C.teal); core.addColorStop(1, C.violet);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  /* ------------------------------------------------------------------ outputs */
  const planePoint = sc => [PLANE.x + sc.v * PLANE.r * 0.82, PLANE.y - sc.a * PLANE.r * 0.82];

  /** Valence-arousal plane: the recognized emotion glides from last pass's place to this one's. */
  function drawPlane(ctx, p, cycle) {
    const { x, y, r } = PLANE;
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = rgba(C.blue, 0.55); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = rgba(C.blue, 0.3); ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    ctx.fillStyle = rgba(C.ink, 0.6); ctx.font = `600 17px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    [['angry', x - r * 0.55, y - r * 0.6], ['joy', x + r * 0.55, y - r * 0.6], ['sad', x - r * 0.55, y + r * 0.6], ['calm', x + r * 0.55, y + r * 0.6]]
      .forEach(([t, tx, ty]) => ctx.fillText(t, tx, ty));
    ctx.font = `700 13px ${FONT}`; ctx.fillStyle = rgba(C.ink, 0.45);
    ctx.fillText('AROUSAL', x, y - r - 12); ctx.textAlign = 'left'; ctx.fillText('VALENCE', x + r + 8, y);

    const prev = scenario(cycle - 1), cur = scenario(cycle);
    const u = ease(window01(p, MOVE));
    const [x0, y0] = planePoint(prev), [x1, y1] = planePoint(cur);
    const px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u;
    if (u > 0 && u < 1) {                                               // trail while moving
      const trail = ctx.createLinearGradient(x0, y0, px, py);
      trail.addColorStop(0, rgba(C.teal, 0)); trail.addColorStop(1, rgba(C.teal, 0.8));
      ctx.strokeStyle = trail; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(px, py); ctx.stroke();
    }
    const halo = ctx.createRadialGradient(px, py, 2, px, py, 16);
    halo.addColorStop(0, rgba(C.teal, 0.55)); halo.addColorStop(1, rgba(C.teal, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, 16, 0, 7); ctx.fill();
    const core = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 7);
    core.addColorStop(0, '#d9fffb'); core.addColorStop(0.6, C.teal); core.addColorStop(1, C.violet);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();

    // the reading, under the plane: last pass's until the new point has settled
    const settled = u >= 1 ? cur : prev, conf = Math.round(62 + 34 * hash((u >= 1 ? cycle : cycle - 1) * 17 + 5));
    ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
    ctx.fillText(`${settled.label}  ${conf}%`, x, y + r + 18);
  }

  const wrapped = new Map();
  function wrap(ctx, text, width) {
    if (wrapped.has(text)) return wrapped.get(text);
    const lines = [];
    let line = '';
    text.split(' ').forEach(word => {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width > width && line) { lines.push(line); line = word; } else line = probe;
    });
    lines.push(line);
    wrapped.set(text, lines);
    return lines;
  }

  /** Speech bubble: the empathic reply of this pass typed over last pass's. */
  function drawBubble(ctx, sec, p, cycle) {
    const { x, y, w, h, pad, line } = BUBBLE;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = rgba(C.blue, 0.6); ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1, y + 24); ctx.lineTo(x - 12, y + 34); ctx.lineTo(x + 1, y + 44); ctx.closePath();   // tail toward the network
    ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 1, y + 24); ctx.lineTo(x - 12, y + 34); ctx.lineTo(x + 1, y + 44); ctx.stroke();
    ctx.font = `700 13px ${FONT}`; ctx.fillStyle = rgba(C.ink, 0.45); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('EMPATHIC REPLY', x + pad, y - 8);

    const u = window01(p, TYPE);
    const sc = u > 0 ? scenario(cycle) : scenario(cycle - 1);
    const shown = u > 0 ? Math.floor(u * sc.text.length) : sc.text.length;
    ctx.font = `500 21px ${FONT}`; ctx.fillStyle = C.ink;
    const lines = wrap(ctx, sc.text, w - 2 * pad);
    let left = shown, cx = x + pad, cy = y + pad + 20;
    lines.forEach((ln, i) => {
      const part = ln.slice(0, Math.max(0, left));
      ctx.fillText(part, x + pad, y + pad + 20 + i * line);
      if (left > 0 && left <= ln.length) { cx = x + pad + ctx.measureText(part).width; cy = y + pad + 20 + i * line; }
      left -= ln.length + 1;
    });
    if (u > 0 && u < 1 && Math.floor(sec * 3) % 2 === 0) { ctx.fillStyle = C.teal; ctx.fillRect(cx + 2, cy - 17, 2.5, 22); }   // caret
  }

  /* ------------------------------------------------------------------ mount */
  /** Animate one card cover. */
  function mountCanvas(cv) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let scale = 0;
    const fit = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      const bw = Math.max(1, Math.round(r.width * d)), bh = Math.max(1, Math.round(r.height * d));
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      scale = bw / ART_W;
    };
    new ResizeObserver(fit).observe(cv); fit();

    const draw = sec => {
      if (!scale) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(scale, 0, 0, scale, 0, (cv.height - ART_H * scale) / 2);
      const p = (sec % CYCLE) / CYCLE, cycle = Math.floor(sec / CYCLE);
      drawEdges(ctx);
      drawImageInput(ctx, p); drawAudio(ctx, sec, p); drawPhysio(ctx, sec);
      drawTravellers(ctx, p);
      drawNodes(ctx, p, cycle);
      drawFused(ctx, p);
      drawPlane(ctx, p, cycle);
      drawBubble(ctx, sec, p, cycle);
    };

    let onScreen = true;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(cv);
    const t0 = performance.now();
    const frame = ms => {
      if (onScreen && !document.hidden) draw(motionOK ? (ms - t0) / 1000 : 1.0);
      if (motionOK) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    if (!motionOK && document.fonts) document.fonts.ready.then(() => draw(1.0));
  }

  return { mountCanvas };
})();
