// Effets : sons synthétisés (WebAudio) et animations visuelles.
const FX = (() => {
  'use strict';
  let ctx = null;
  let soundOn = Store.get('ocd-sound', true);

  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone({ f = 440, f2 = null, d = 0.12, type = 'square', v = 0.06, delay = 0 }) {
    if (!soundOn) return;
    const c = audio(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + d + 0.02);
  }
  // Bruit blanc décroissant ; filt = [type, fréquence] d'un filtre (grave : lowpass, aigu : highpass).
  function noise(d = 0.12, v = 0.08, delay = 0, filt = null) {
    if (!soundOn) return;
    const c = audio(); if (!c) return;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = v;
    let out = s;
    if (filt) { const f = c.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; out = s.connect(f); }
    out.connect(g).connect(c.destination);
    s.start(c.currentTime + delay);
  }
  const notes = (fs, step = 0.08, type = 'square', v = 0.05) => fs.forEach((f, i) => tone({ f, d: step * 1.6, v, type, delay: i * step }));
  const repeat = (n, step, fn) => { for (let i = 0; i < n; i++) fn(i * step, i); };

  const sfx = {
    click: () => tone({ f: 660, d: 0.05, v: 0.04 }),
    select: () => tone({ f: 990, d: 0.06, v: 0.04, type: 'triangle' }),
    roll: () => noise(0.04, 0.05),
    settle: () => tone({ f: 880, f2: 1320, d: 0.09, v: 0.05, type: 'triangle' }),
    step: () => tone({ f: 240, d: 0.05, v: 0.04, type: 'triangle' }),
    mstep: () => tone({ f: 130, d: 0.06, v: 0.05, type: 'square' }),
    hit: () => { noise(0.1, 0.1); tone({ f: 320, f2: 90, d: 0.15, v: 0.07, type: 'sawtooth' }); },
    kill: () => notes([523, 659, 784, 1046], 0.06),
    thud: () => tone({ f: 110, f2: 60, d: 0.12, v: 0.08, type: 'square' }),
    hurt: () => { tone({ f: 220, f2: 55, d: 0.4, v: 0.1, type: 'sawtooth' }); noise(0.25, 0.09); },
    // Défense : apparition du bouclier, « tink » du projectile qui s'y brise, choc métallique de la parade,
    // bouclier fissuré, cran de vie perdu, puis carillon du blocage réussi.
    shield: () => tone({ f: 520, f2: 1250, d: 0.14, v: 0.03, type: 'sine' }),
    block: () => {
      tone({ f: 2350, f2: 1900, d: 0.16, v: 0.05, type: 'triangle' });
      tone({ f: 3520, d: 0.1, v: 0.025, type: 'sine', delay: 0.012 });
      noise(0.03, 0.05);
    },
    clang: () => {
      tone({ f: 1180, f2: 860, d: 0.26, v: 0.045, type: 'square' });
      tone({ f: 1770, f2: 1500, d: 0.22, v: 0.03, type: 'triangle' });
      noise(0.06, 0.09);
    },
    crack: () => { noise(0.1, 0.08); tone({ f: 1500, f2: 240, d: 0.14, v: 0.04, type: 'sawtooth' }); },
    drain: () => tone({ f: 300, f2: 180, d: 0.07, v: 0.05, type: 'square' }),
    guard: () => notes([1200, 1600], 0.05, 'triangle'),
    deny: () => tone({ f: 140, d: 0.14, v: 0.06 }),
    level: () => notes([392, 523, 659, 784, 1046, 1318], 0.09, 'square', 0.05),
    win: () => notes([523, 659, 784, 1046, 784, 1046, 1318, 1568], 0.12, 'triangle', 0.07),
    lose: () => notes([392, 330, 262, 196, 131], 0.18, 'sawtooth', 0.06),
    // Attaques : un son court par personnage et par mode (à distance, puis corps à corps), joué au départ.
    arrow: () => { tone({ f: 380, f2: 900, d: 0.07, v: 0.05, type: 'triangle' }); noise(0.14, 0.05, 0.03, ['highpass', 2500]); },
    dagger: () => { noise(0.07, 0.07, 0, ['highpass', 3000]); tone({ f: 2600, f2: 1300, d: 0.08, v: 0.03, type: 'triangle' }); },
    orb: () => { notes([880, 1175, 1568], 0.04, 'sine', 0.04); tone({ f: 220, f2: 440, d: 0.25, v: 0.03, type: 'sine' }); },
    bolt: () => { noise(0.2, 0.1, 0, ['highpass', 1200]); tone({ f: 70, f2: 50, d: 0.25, v: 0.06, type: 'sawtooth' }); tone({ f: 1800, f2: 300, d: 0.12, v: 0.03, type: 'square', delay: 0.04 }); },
    shuriken: () => repeat(4, 0.045, d => tone({ f: 3100, f2: 2500, d: 0.035, v: 0.025, type: 'triangle', delay: d })),
    dash: () => { noise(0.16, 0.07, 0, ['bandpass', 1400]); tone({ f: 200, f2: 1100, d: 0.12, v: 0.03, type: 'sine' }); },
    beam: () => { tone({ f: 300, f2: 1600, d: 0.24, v: 0.035, type: 'sawtooth' }); tone({ f: 600, f2: 3200, d: 0.24, v: 0.02, type: 'sine' }); },
    punch: () => { tone({ f: 170, f2: 40, d: 0.2, v: 0.1, type: 'square', delay: 0.1 }); noise(0.12, 0.12, 0.1, ['lowpass', 900]); },
    bats: () => repeat(3, 0.06, d => { noise(0.03, 0.05, d, ['bandpass', 2000]); tone({ f: 4200, f2: 3000, d: 0.03, v: 0.02, type: 'sine', delay: d }); }),
    bite: () => { noise(0.08, 0.1, 0.12, ['lowpass', 1500]); tone({ f: 260, f2: 110, d: 0.14, v: 0.06, type: 'sawtooth', delay: 0.12 }); },
    blade: () => { tone({ f: 900, f2: 1500, d: 0.2, v: 0.03, type: 'triangle' }); repeat(3, 0.07, d => noise(0.04, 0.04, d, ['highpass', 4000])); },
    thrust: () => repeat(3, 0.1, (d, i) => tone({ f: 1900 + i * 320, f2: 1500 + i * 320, d: 0.05, v: 0.035, type: 'square', delay: 0.13 + d })),
    dust: () => notes([1320, 1760, 2093, 2637, 3136], 0.035, 'sine', 0.03),
    twirl: () => { tone({ f: 600, f2: 2400, d: 0.3, v: 0.03, type: 'sine' }); tone({ f: 900, f2: 3600, d: 0.3, v: 0.015, type: 'triangle', delay: 0.04 }); },
    paw: () => repeat(3, 0.1, d => tone({ f: 190, f2: 120, d: 0.05, v: 0.07, type: 'triangle', delay: 0.12 + d })),
    claw: () => { noise(0.1, 0.08, 0.12, ['highpass', 2500]); tone({ f: 2600, f2: 700, d: 0.1, v: 0.03, type: 'sawtooth', delay: 0.12 }); },
    web: () => { tone({ f: 1500, f2: 400, d: 0.2, v: 0.03, type: 'sine' }); noise(0.15, 0.04, 0.02, ['bandpass', 3000]); },
    fang: () => { noise(0.06, 0.1, 0.12, ['highpass', 1800]); tone({ f: 900, f2: 300, d: 0.08, v: 0.04, type: 'square', delay: 0.12 }); },
    bone: () => repeat(3, 0.08, d => tone({ f: 620, f2: 480, d: 0.05, v: 0.04, type: 'square', delay: d })),
    rusty: () => { noise(0.12, 0.07, 0.1, ['bandpass', 900]); tone({ f: 520, f2: 280, d: 0.16, v: 0.04, type: 'sawtooth', delay: 0.1 }); },
    rock: () => { tone({ f: 120, f2: 260, d: 0.25, v: 0.05, type: 'triangle' }); noise(0.1, 0.06, 0, ['lowpass', 500]); },
    slam: () => tone({ f: 180, f2: 420, d: 0.18, v: 0.04, type: 'triangle', delay: 0.08 }),
    boom: () => { tone({ f: 90, f2: 30, d: 0.4, v: 0.13, type: 'square' }); noise(0.35, 0.14, 0, ['lowpass', 400]); },
    fire: () => { noise(0.42, 0.09, 0.05, ['lowpass', 1100]); tone({ f: 140, f2: 70, d: 0.4, v: 0.05, type: 'sawtooth', delay: 0.05 }); },
    rake: () => { noise(0.08, 0.08, 0.1, ['highpass', 2000]); noise(0.14, 0.09, 0.22, ['lowpass', 700]); tone({ f: 380, f2: 140, d: 0.2, v: 0.05, type: 'sawtooth', delay: 0.22 }); },
  };

  const layer = () => document.getElementById('fx');
  const center = p => ({ x: (p.c + 0.5) * 20, y: (p.r + 0.5) * 20 });

  function float(text, p, cls = '') {
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    const q = center(p);
    el.style.left = q.x + '%'; el.style.top = q.y + '%';
    layer().append(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // Mouvement réduit : les trajectoires sont quasi instantanées (les effets restent lisibles).
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dur = ms => reduced.matches ? Math.min(ms, 60) : ms;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- Géométrie de la couche #fx, en px (clientWidth : insensible aux secousses du plateau) ----------
  const size = () => { const l = layer(); return { w: l.clientWidth, h: l.clientHeight }; };
  const cellPx = () => size().w / 5;
  const P = p => { const s = size(); return { x: (p.c + 0.5) * s.w / 5, y: (p.r + 0.5) * s.h / 5 }; };
  const T = (x, y, r = 0, s = 1) => `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${r}deg) scale(${s})`;
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Direction de a vers b : vecteur unitaire, longueur, angle (degrés) et normale.
  function dirOf(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len, nx: -dy / len, ny: dx / len, len, ang: Math.atan2(dy, dx) * 180 / Math.PI };
  }

  // Élément d'effet placé par transform ; invisible (CSS) tant que son animation n'a pas commencé.
  function spawn(html = '', cls = '') {
    const el = document.createElement('div');
    el.className = `fxe ${cls}`;
    el.innerHTML = html;
    layer().append(el);
    return el;
  }
  // Joue les keyframes (opacité 1 par défaut) puis retire l'élément, même si l'animation est annulée.
  function play(el, frames, ms, o = {}) {
    const a = el.animate(frames.map(f => ({ opacity: 1, ...f })), { duration: Math.max(1, ms), fill: 'forwards', ...o });
    return a.finished.catch(() => {}).then(() => el.remove());
  }
  const sprite = (el, frames, ms, easing = 'linear') => el?.querySelector('.sprite')?.animate(frames, { duration: Math.max(1, ms), easing });

  // Particule : carré coloré (w×h en cqw) ou caractère (html, taille w), de (x, y) vers (x+dx, y+dy).
  function dot(x, y, { html = '', color = '#fff', w = 1.6, h = w, dx = 0, dy = 0, r0 = 0, r1 = r0, s0 = 1, s1 = 0, o0 = 1,
    ms = 400, delay = 0, cls = '', ease = 'cubic-bezier(.2,.8,.3,1)' } = {}) {
    const el = spawn(html, `dot ${html ? '' : 'bit'} ${cls}`);
    if (html) el.style.fontSize = w + 'cqw';
    else { el.style.width = w + 'cqw'; el.style.height = h + 'cqw'; el.style.background = color; }
    el.style.color = color;
    return play(el, [
      { transform: T(x, y, r0, s0), opacity: o0 },
      { transform: T(x + dx, y + dy, r1, s1), opacity: 0 },
    ], ms, { delay, easing: ease });
  }
  // Gerbe de particules autour de (x, y) ; spread en px pour un plateau de 300 px.
  function burstAt(x, y, colors, n = 12, spread = 50, { ms = 560, ...o } = {}) {
    const k = size().w / 300;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, d = rnd(0.4, 1) * spread * k, deg = ang * 180 / Math.PI;
      dot(x, y, { color: colors[i % colors.length], dx: Math.cos(ang) * d, dy: Math.sin(ang) * d, r0: deg, r1: deg + rnd(-90, 90), ms: ms * rnd(0.75, 1), ...o });
    }
  }
  function burst(p, colors, n = 16, spread = 60) { const q = P(p); burstAt(q.x, q.y, colors, n, spread, { ms: 700 }); }

  // Halo lumineux (charge, flash d'impact) et onde circulaire ; diamètre d en cases.
  function glow(x, y, { color = '#fff', d = 1, ms = 250, delay = 0, s0 = 0.3, s1 = 1 } = {}) {
    const el = spawn('', 'glow');
    el.style.width = el.style.height = d * cellPx() + 'px'; el.style.color = color;
    return play(el, [
      { transform: T(x, y, 0, s0), opacity: 0 },
      { transform: T(x, y, 0, (s0 + s1) / 2), offset: 0.35 },
      { transform: T(x, y, 0, s1), opacity: 0 },
    ], ms, { delay, easing: 'ease-out' });
  }
  function ring(x, y, { color = '#fff', d = 1, w = 1, ms = 300, delay = 0, flat = 1, cls = '' } = {}) {
    const el = spawn('', `ring ${cls}`);
    el.style.width = d * cellPx() + 'px'; el.style.height = d * cellPx() * flat + 'px';
    el.style.color = color; el.style.borderWidth = w + 'cqw';
    return play(el, [{ transform: T(x, y, 0, 0.15) }, { transform: T(x, y, 0, 1), opacity: 0 }], ms, { delay, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  // Secousse du plateau : légère (quake) ou forte (shake, celle des dégâts).
  function quake(cls = 'quake') { const f = layer().closest('.board-frame'); if (f) retrigger(f, cls); }

  // Entaille en croissant (SVG), révélée puis effacée d'un bord à l'autre par clip-path.
  // len en cases, bend = courbure, t = épaisseur ; linger : reste affichée avant de s'estomper (griffures, entailles).
  const crescent = (b, t, x0 = 0, x1 = 100) => `M${x0} 16Q50 ${16 - 28 * b - 6 * t} ${x1} 16Q50 ${16 - 28 * b + 6 * t} ${x0} 16Z`;
  function slash(x, y, { ang = 0, len = 0.9, bend = 0.5, t = 1, color = '#fff', core = '#fff', ms = 260, delay = 0, linger = false } = {}) {
    const el = spawn(`<svg viewBox="0 0 100 24" preserveAspectRatio="none"><path fill="${color}" d="${crescent(bend, t)}"/><path fill="${core}" d="${crescent(bend, t * 0.4, 9, 91)}"/></svg>`, 'slash');
    const L = len * cellPx();
    el.style.width = L + 'px'; el.style.height = L * 0.24 + 'px'; el.style.color = color;
    const at = s => T(x, y, ang, s);
    return play(el, linger ? [
      { transform: at(1), clipPath: 'inset(0 100% 0 0)' },
      { transform: at(1.06), clipPath: 'inset(0 0% 0 0)', offset: 0.3 },
      { transform: at(1), clipPath: 'inset(0 0% 0 0)', offset: 0.7 },
      { transform: at(1), clipPath: 'inset(0 0% 0 0)', opacity: 0 },
    ] : [
      { transform: at(0.9), clipPath: 'inset(0 100% 0 0)' },
      { transform: at(1.05), clipPath: 'inset(0 0% 0 0)', offset: 0.45 },
      { transform: at(1.1), clipPath: 'inset(0 0% 0 100%)', opacity: 0.4 },
    ], ms, { delay, easing: 'ease-out' });
  }
  // Couche SVG plein plateau (coordonnées en px), pour l'éclair, le fil de toile et les fissures.
  function svgFx(inner, cls = '') {
    const el = spawn('', `fxs ${cls}`), { w, h } = size();
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
    return el;
  }
  function zigzag(a, b, n, amp) {
    const d = dirOf(a, b);
    let s = `M${a.x} ${a.y}`;
    for (let i = 1; i < n; i++) {
      const q = mix(a, b, i / n), j = rnd(-amp, amp);
      s += `L${q.x + d.nx * j} ${q.y + d.ny * j}`;
    }
    return s + `L${b.x} ${b.y}`;
  }
  // Tracé progressif d'un chemin SVG (pathLength = 1).
  const draw = (el, ms, easing = 'ease-out') => el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: Math.max(1, ms), fill: 'both', easing });

  // Trajectoire de a vers b : droite, en courbe (arc, vers le haut de l'écran), ondulante (wave) ou en spirale (orbit).
  function curve(a, b, { arc = 0, wave = 0, freq = 2, phase = 0, orbit = 0, turns = 1.5 } = {}) {
    const d = dirOf(a, b);
    let nx = d.nx, ny = d.ny;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
    return t => {
      const bell = Math.sin(Math.PI * t), th = 2 * Math.PI * turns * t + phase;
      const h = arc * d.len * 4 * t * (1 - t) + wave * Math.sin(2 * Math.PI * freq * t + phase) * bell;
      return { x: a.x + (b.x - a.x) * t + nx * h + orbit * bell * Math.cos(th), y: a.y + (b.y - a.y) * t + ny * h + orbit * bell * Math.sin(th) };
    };
  }
  const tangent = (f, t) => { const p = f(Math.max(0, t - 0.02)), q = f(Math.min(1, t + 0.02)); return Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI; };

  // Projectile de a vers b (px) le long d'une trajectoire (voir curve) : tournoyant (spin, en tours),
  // orienté selon la trajectoire (face) ou balancé (rock), rot = angle fixe, lob = grossit à mi-course (cloche).
  // trail(x, y, delay, angle, i) sème la traînée. stop < 1 : point d'arrêt sur le bouclier, où il s'écrase
  // (crash 'bounce' : rebondit en tournoyant ; 'puff' : s'étale et s'éteint, en crashMs). Résout à l'arrivée.
  async function projectile(html, a, b, o = {}) {
    const { ms = 300, delay = 0, size: fs = 6, cls = '', spin = 0, face = false, rock = 0, rot = 0, s0 = 0.6, s1 = 1.1, lob = 0,
      stop = 1, trail = null, n = 8, crash = 'bounce', crashMs = 300 } = o;
    const f = curve(a, b, o), el = spawn(html, `proj ${cls}`), K = 16, D = ms * Math.max(stop, 0.5);
    el.style.fontSize = fs + 'cqw';
    const at = t => ({
      q: f(t), r: rot + (face ? tangent(f, t) : 0) + spin * 360 * t + rock * Math.sin(t * 14),
      s: (s0 + (s1 - s0) * t) * (1 + lob * Math.sin(Math.PI * t)),
    });
    const frames = [];
    for (let i = 0; i <= K; i++) { const p = at(i / K * stop); frames.push({ transform: T(p.q.x, p.q.y, p.r, p.s) }); }
    if (trail) for (let i = 1; i < n; i++) { const t = i / n * stop, q = f(t); trail(q.x, q.y, delay + D * i / n, tangent(f, t), i); }
    await el.animate(frames.map(fr => ({ opacity: 1, ...fr })), { duration: Math.max(1, D), delay, fill: 'forwards' }).finished.catch(() => {});
    if (stop >= 1) { el.remove(); return; }
    const e = at(stop), d = dirOf(a, b), cs = cellPx();
    if (crash === 'puff') {
      play(el, [{ transform: T(e.q.x, e.q.y, e.r, e.s) }, { transform: T(e.q.x - d.x * cs * 0.12, e.q.y - d.y * cs * 0.12, e.r, e.s * 1.9), opacity: 0 }], dur(crashMs * 0.8), { easing: 'ease-out' });
    } else {
      play(el, [
        { transform: T(e.q.x, e.q.y, e.r, e.s) },
        { transform: T(e.q.x - d.x * cs * 0.35, e.q.y - d.y * cs * 0.35 - cs * 0.12, e.r + 200, e.s * 0.4), opacity: 0 },
      ], dur(crashMs), { easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  }

  // Attaque au corps à corps. parry(fn) : le coup est paré, arrêté net à mi-course (fn appelée au choc),
  // puis le monstre recule légèrement. reach : allonge du coup (en % du sprite).
  async function lunge(el, from, to, ms = 320, parry = null, reach = 45) {
    const sp = el?.querySelector('.sprite');
    if (!sp) { await sleep(ms * 0.5); parry?.(); return; }
    const dx = to.c - from.c, dy = to.r - from.r, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len * reach, uy = dy / len * reach;
    const frames = parry ? [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${-ux * 0.25}%, ${-uy * 0.25}%) scale(.95)`, offset: 0.25 },
      { transform: `translate(${ux * 0.7}%, ${uy * 0.7}%) scale(1.12)`, offset: 0.5, easing: 'ease-out' },
      { transform: `translate(${-ux * 0.4}%, ${-uy * 0.4}%) scale(.94) rotate(${dx >= 0 ? -8 : 8}deg)`, offset: 0.72 },
      { transform: 'translate(0,0) scale(1)' },
    ] : [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${-ux * 0.25}%, ${-uy * 0.25}%) scale(.95)`, offset: 0.3 },
      { transform: `translate(${ux}%, ${uy}%) scale(1.15)`, offset: 0.6 },
      { transform: 'translate(0,0) scale(1)' },
    ];
    const anim = sp.animate(frames, { duration: dur(ms), easing: parry ? 'linear' : 'ease-out' });
    if (parry) { await sleep(dur(ms) * 0.5); parry(); }
    await anim.finished.catch(() => {});
  }

  // Bouclier bleu translucide devant le héros, tourné vers l'attaquant (fissuré si le coup passe en partie).
  // point : centre du bouclier (en cases, pour burst/float) ; stop : fraction de la trajectoire où le projectile s'arrête.
  function shield(hero, from, cracked = false) {
    const dx = from.c - hero.c, dy = from.r - hero.r, len = Math.hypot(dx, dy) || 1, off = 0.4;
    const point = { r: hero.r + dy / len * off, c: hero.c + dx / len * off };
    const el = document.createElement('div');
    el.className = `shield${cracked ? ' cracked' : ''}`;
    const q = center(point);
    el.style.left = q.x + '%'; el.style.top = q.y + '%';
    el.style.setProperty('--rot', `${Math.atan2(dy, dx) * 180 / Math.PI}deg`);
    layer().append(el);
    return {
      point, stop: Math.max(0.2, 1 - off / len),
      hit() { retrigger(el, 'hit'); },
      remove() { el.classList.add('out'); setTimeout(() => el.remove(), 320); },
    };
  }

  // ---------- Attaques propres à chaque personnage ----------
  // Déroulé : préparation (~120 ms), trajet ou geste (~200–350 ms), impact (~250 ms), 700 ms au plus.
  // Chaque fonction reçoit k = { el, a, b, d, stop, parry, ms(), impact() } : a/b = centres (px) de l'attaquant
  // et de la cible, d = direction, ms() applique l'accélération ; elle résout au moment de l'impact.

  // Préparation : l'attaquant recule et se gonfle face à sa cible.
  function windup(el, d, ms) {
    const a = sprite(el, [
      { transform: 'none' },
      { transform: `translate(${-d.x * 12}%, ${-d.y * 12}%) scale(1.14, .9)`, offset: 0.75 },
      { transform: `translate(${-d.x * 8}%, ${-d.y * 8}%) scale(1.06)` },
    ], ms, 'ease-out');
    return a ? a.finished.catch(() => {}) : sleep(ms);
  }
  // Geste commun au corps à corps (élan, coup, retour) : résout au contact (true), ou false s'il est paré.
  async function strike(el, from, to, k, ms = 320, reach = 45) {
    if (k.parry) { await lunge(el, from, to, k.ms(ms + 60), k.parry, reach); return false; }
    lunge(el, from, to, k.ms(ms), null, reach);
    await sleep(k.ms(ms) * 0.6);
    return true;
  }
  // Point à une fraction de case de p, vers d (s = décalage latéral).
  const off = (p, d, f, s = 0) => { const cs = cellPx(); return { x: p.x + d.x * cs * f + d.nx * cs * s, y: p.y + d.y * cs * f + d.ny * cs * s }; };

  const ARROW = `<svg class="arrow" viewBox="0 0 48 12"><path d="M5 6H38" stroke="#eadcbf" stroke-width="2.4"/>
    <path d="M35 1.2 47.5 6 35 10.8 38 6Z" fill="#e8f0f6"/><path d="M1 1.5 9 6 1 10.5M6 1.5 14 6 6 10.5" stroke="#7cf08a" stroke-width="2.2" fill="none"/></svg>`;
  const STAR = `<svg class="shuriken" viewBox="-10 -10 20 20"><path d="M0-10 2.4-2.4 10 0 2.4 2.4 0 10-2.4 2.4-10 0-2.4-2.4Z" fill="#e3ebf3" stroke="#3c4552" stroke-width=".9"/>
    <circle r="2.1" fill="#232831"/></svg>`;

  const ATTACKS = {
    // Archère : flèche à traînée verte / coup de dague en arc ; flèche plantée qui vibre, éclats verts.
    '🧝‍♀️': {
      sfx: ['arrow', 'dagger'],
      async ranged(from, to, k) {
        glow(k.a.x, k.a.y, { color: '#7cf08a', d: 0.8, ms: k.ms(180) });
        await windup(k.el, k.d, k.ms(120));
        await projectile(ARROW, k.a, k.b, { ms: k.ms(200), face: true, size: 7.5, s0: 1, s1: 1, stop: k.stop, crashMs: k.ms(300), n: 8,
          trail: (x, y, delay, r) => dot(x, y, { color: '#7cf08a', w: 5, h: 0.9, r0: r, s0: 1, s1: 0.2, ms: k.ms(240), delay, cls: 'streak' }) });
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 260, 40)) return;
        slash(k.b.x, k.b.y, { ang: k.d.ang + 65, len: 1, bend: 0.7, color: '#7cf08a', ms: k.ms(240) });
        k.impact();
      },
      impact(k, mode) {
        const { b, d } = k;
        if (mode === 'ranged') {
          const q = off(b, d, -0.3), el = spawn(ARROW, 'proj');
          el.style.fontSize = '7.5cqw';
          play(el, [0, 1, 2, 3, 4, 5].map(i => ({ transform: T(q.x, q.y, d.ang + (i % 2 ? 9 : -9) * (1 - i / 6)) }))
            .concat({ transform: T(q.x, q.y, d.ang), opacity: 0 }), k.ms(300));
        }
        glow(b.x, b.y, { color: '#7cf08a', d: 0.9, ms: k.ms(220) });
        burstAt(b.x, b.y, ['#7cf08a', '#d4ffc4', '#2fae5a'], 12, 50, { w: 2.8, h: 1.1, ms: k.ms(280) });
      },
    },
    // Mage : orbe ✨ en courbe, traînée d'étincelles / éclair ⚡ du bâton ; explosion arcanique en anneau.
    '🧙‍♂️': {
      sfx: ['orb', 'bolt'],
      async ranged(from, to, k) {
        const { a, d } = k, cs = cellPx();
        glow(a.x, a.y, { color: '#b38cff', d: 0.9, ms: k.ms(200) });
        for (let i = 0; i < 4; i++) {
          const t = i * Math.PI / 2 + 0.6, r = cs * 0.45;
          dot(a.x + Math.cos(t) * r, a.y + Math.sin(t) * r, { color: '#e6d4ff', w: 1.2, dx: -Math.cos(t) * r, dy: -Math.sin(t) * r, s0: 0.6, s1: 1.1, ms: k.ms(130), ease: 'ease-in' });
        }
        await windup(k.el, d, k.ms(120));
        await projectile('<span class="orb">✨</span>', a, k.b, { ms: k.ms(215), arc: 0.2, spin: 0.5, size: 7, s0: 0.8, s1: 1.2, stop: k.stop, crashMs: k.ms(300), n: 10,
          trail: (x, y, delay, r, i) => dot(x + rnd(-5, 5), y + rnd(-5, 5), i % 3
            ? { color: i % 2 ? '#a66bff' : '#ff7ae6', w: 1.9, dy: rnd(4, 12), ms: k.ms(320), delay }
            : { html: '✦', color: '#e9d6ff', w: 4, r1: 90, dy: rnd(2, 8), ms: k.ms(320), delay, cls: 'twinkle' }) });
        k.impact();
      },
      async melee(el, from, to, k) {
        const { a, b, d } = k, cs = cellPx();
        glow(a.x, a.y, { color: '#9fd8ff', d: 0.8, ms: k.ms(150) });
        await windup(el, d, k.ms(120));
        sprite(el, [{ transform: `translate(${-d.x * 14}%, ${-d.y * 14}%)` }, { transform: 'none' }], k.ms(220), 'ease-out');   // recul du tir
        const s = off(a, d, 0.28), e = off(b, d, -0.05), ms = k.ms(260);
        // Éclair : halo violet sombre (contraste sur sable), corps violet, cœur blanc, plus une ramification.
        const g = () => {
          const p = zigzag(s, e, 7, cs * 0.17);
          return `<path d="${p}" stroke="#3b1580" stroke-width="${cs * 0.2}" opacity=".35"/><path d="${p}" stroke="#9a5cff" stroke-width="${cs * 0.12}"/><path d="${p}" stroke="#fff" stroke-width="${cs * 0.05}"/>`;
        };
        const branch = () => { const q = mix(s, e, rnd(0.35, 0.6)); return `<path d="${zigzag(q, off(q, d, 0.3, rnd(-0.4, 0.4)), 3, cs * 0.06)}" stroke="#e2d0ff" stroke-width="${cs * 0.035}"/>`; };
        const bolt = svgFx(`<g>${g()}${branch()}</g><g>${g()}${branch()}</g>`, 'bolt');
        const [g1, g2] = bolt.querySelectorAll('g');
        g1.animate([{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0, offset: 0.41 }, { opacity: 0 }], { duration: ms, fill: 'both' });
        g2.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1, offset: 0.41 }, { opacity: 1 }], { duration: ms, fill: 'both' });
        play(bolt, [{ opacity: 1 }, { opacity: 0.5, offset: 0.2 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], ms);
        glow(e.x, e.y, { color: '#e6d4ff', d: 0.7, ms: k.ms(200) });
        await sleep(k.ms(60));
        k.impact();
      },
      impact({ b, ms }) {
        ring(b.x, b.y, { color: '#b38cff', d: 1.5, w: 1.3, ms: ms(280) });
        ring(b.x, b.y, { color: '#ff9ff3', d: 0.95, w: 0.8, ms: ms(260), delay: ms(50) });
        glow(b.x, b.y, { color: '#c48bff', d: 1.1, ms: ms(260) });
        burstAt(b.x, b.y, ['#e6d4ff', '#9a5cff', '#fff'], 12, 50, { w: 2, ms: ms(280) });
      },
    },
    // Ninja : shuriken qui tourne vite / ruée avec images rémanentes, puis retour ; trois entailles en X.
    '🥷': {
      sfx: ['shuriken', 'dash'],
      async ranged(from, to, k) {
        await windup(k.el, k.d, k.ms(120));
        await projectile(STAR, k.a, k.b, { ms: k.ms(210), spin: 4, s0: 0.9, s1: 1.05, size: 6.5, stop: k.stop, crashMs: k.ms(300), n: 7,
          trail: (x, y, delay) => dot(x, y, { color: '#e6eef8', w: 3.4, s0: 0.9, s1: 0.1, o0: 0.6, ms: k.ms(180), delay, cls: 'soft' }) });
        k.impact();
      },
      async melee(el, from, to, k) {
        const { a, b, d } = k, ms = k.ms(420), r = n => `translate(${d.x * n}%, ${d.y * n}%)`;
        sprite(el, [
          { transform: 'none' },
          { transform: `${r(-14)} scale(.9)`, offset: 0.28 },
          { transform: `${r(88)} scale(1.1)`, offset: 0.48 },
          { transform: r(80), offset: 0.62 },
          { transform: 'none' },
        ], ms, 'ease-in-out');
        const emo = el?.querySelector('.emo')?.textContent || '🥷';
        for (let i = 0; i < 3; i++) {
          const q = mix(a, b, 0.12 + i * 0.2);
          dot(q.x, q.y, { html: emo, w: 11, s0: 1, s1: 0.92, o0: 0.55, ms: k.ms(230), delay: ms * (0.32 + i * 0.05), cls: 'ghost' });
        }
        await sleep(ms * 0.48);
        k.impact();
      },
      impact({ b, ms }) {
        [45, -45, 8].forEach((ang, i) => slash(b.x, b.y, { ang, len: 1.1, bend: 0.06, t: 1.5, color: '#9fd0ff', ms: ms(260), delay: ms(i * 35), linger: true }));
      },
    },
    // Héroïne : rayon d'énergie qui s'étire puis s'éteint / coup de poing 💥 ; onde circulaire, secousse légère.
    '🦸‍♀️': {
      sfx: ['beam', 'punch'],
      async ranged(from, to, k) {
        const { a, d } = k, cs = cellPx();
        glow(a.x, a.y, { color: '#ffd25a', d: 1, ms: k.ms(200) });
        await windup(k.el, d, k.ms(120));
        const s = off(a, d, 0.25), el = spawn('', 'beam');
        el.style.width = (d.len - cs * 0.25) * k.stop + 'px';
        const B = (sx, sy) => `translate(${s.x}px,${s.y}px) rotate(${d.ang}deg) scale(${sx},${sy}) translateY(-50%)`;
        play(el, [{ transform: B(0, 1.5) }, { transform: B(1, 1), offset: 0.35 }, { transform: B(1, 0.8), offset: 0.6 }, { transform: B(1, 0), opacity: 0.3 }], k.ms(420));
        glow(s.x, s.y, { color: '#fff3b0', d: 0.6, ms: k.ms(300) });
        await sleep(k.ms(150));
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 300, 55)) return;
        const q = mix(k.a, k.b, 0.72);
        dot(q.x, q.y, { html: '💥', w: 10, s0: 0.7, s1: 1.6, r0: rnd(-20, 20), ms: k.ms(300), ease: 'cubic-bezier(.2,1.4,.4,1)' });
        k.impact();
      },
      impact({ b, ms }) {
        ring(b.x, b.y, { color: '#ffd25a', d: 1.8, w: 1.2, ms: ms(320) });
        ring(b.x, b.y, { color: '#fff', d: 1.1, w: 0.7, ms: ms(260), delay: ms(40) });
        quake();
      },
    },
    // Vampire : nuée de 3 🦇 ondulantes / morsure, flash rouge ; particules rouges aspirées vers le héros.
    '🧛': {
      sfx: ['bats', 'bite'],
      async ranged(from, to, k) {
        glow(k.a.x, k.a.y, { color: '#ff2a47', d: 0.9, ms: k.ms(200) });
        await windup(k.el, k.d, k.ms(120));
        const cs = cellPx();
        await Promise.all([0, 1, 2].map(i => projectile('🦇', k.a, k.b, { ms: k.ms(200), delay: k.ms(i * 25), wave: cs * (0.26 + i * 0.07), freq: 1.2, phase: i * 2.1, rock: 18, s0: 0.8, s1: 1.1, size: 7, stop: k.stop, crashMs: k.ms(300), cls: 'bat' })));
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 280, 50)) return;
        const { b, d } = k;
        glow(b.x, b.y, { color: '#ff2a47', d: 1.2, ms: k.ms(240) });
        [-1, 1].forEach(s => { const q = off(b, d, -0.08, s * 0.1); slash(q.x, q.y, { ang: d.ang + 90 + s * 12, len: 0.3, bend: 0.4, t: 1.4, color: '#ffe0e4', ms: k.ms(200) }); });
        k.impact();
      },
      impact({ a, b, ms }) {
        const cs = cellPx();
        for (let i = 0; i < 9; i++) {
          const t = rnd(0, Math.PI * 2), r = cs * rnd(0.12, 0.4), x = b.x + Math.cos(t) * r, y = b.y + Math.sin(t) * r;
          dot(x, y, { color: i % 3 ? '#ff2a47' : '#ffc2cb', w: i % 2 ? 2.2 : 1.6, dx: a.x - x, dy: a.y - y, s0: 1, s1: 0.35,
            ms: ms(rnd(200, 250)), delay: ms(rnd(0, 40)), ease: 'cubic-bezier(.55,0,.85,.45)', cls: i % 2 ? 'drop' : '' });
        }
      },
    },
    // Escrimeur : lame 🗡️ lancée en rotation / triple estoc ; 3 points d'impact lumineux.
    '🤺': {
      sfx: ['blade', 'thrust'],
      async ranged(from, to, k) {
        await windup(k.el, k.d, k.ms(120));
        await projectile('🗡️', k.a, k.b, { ms: k.ms(240), spin: 3, arc: 0.12, size: 6, s0: 0.8, s1: 1.1, stop: k.stop, crashMs: k.ms(300), n: 7,
          trail: (x, y, delay) => dot(x, y, { color: '#e3eefb', w: 1.8, s0: 1, s1: 0.2, ms: k.ms(200), delay }) });
        k.impact();
      },
      async melee(el, from, to, k) {
        const { b, d } = k, ms = k.ms(440), J = [0.3, 0.55, 0.8], r = n => `translate(${d.x * n}%, ${d.y * n}%)`;
        sprite(el, [
          { transform: 'none' },
          { transform: `${r(-12)} scale(.95)`, offset: 0.15 },
          ...J.flatMap((o, i) => [{ transform: `${r(36 + i * 7)} scale(1.08)`, offset: o }, { transform: r(6), offset: o + 0.12 }]),
          { transform: 'none' },
        ], ms, 'ease-out');
        J.forEach((o, i) => { const q = off(b, d, -0.1, (i - 1) * 0.16); slash(q.x, q.y, { ang: d.ang + rnd(-12, 12), len: 0.5, bend: 0.04, t: 1.2, color: '#8fcaff', ms: k.ms(200), delay: ms * o }); });
        await sleep(ms * 0.8);
        k.impact();
      },
      impact({ b, d, ms }) {
        [-1, 0, 1].forEach((s, i) => {
          const q = off(b, d, -0.05 + Math.abs(s) * 0.1, s * 0.22);
          glow(q.x, q.y, { color: '#ffd25a', d: 0.6, ms: ms(220), delay: ms(i * 35) });
          dot(q.x, q.y, { html: '✦', color: '#fff6c8', w: 6, s0: 0.3, s1: 1.3, r1: 45, ms: ms(220), delay: ms(i * 35), ease: 'ease-out', cls: 'twinkle' });
        });
      },
    },
    // Fée : poussière 🌟 en spirale / tourbillon de paillettes autour de la cible ; pluie d'étoiles.
    '🧚': {
      sfx: ['dust', 'twirl'],
      async ranged(from, to, k) {
        glow(k.a.x, k.a.y, { color: '#ff9ff3', d: 0.9, ms: k.ms(200) });
        await windup(k.el, k.d, k.ms(120));
        const cs = cellPx(), colors = ['#fff3a8', '#ff9ff3', '#bff4ff'];
        await Promise.all([0, 1, 2, 3, 4].map(i => projectile('🌟', k.a, k.b, { ms: k.ms(235), orbit: cs * 0.3, turns: 1.25, phase: i * Math.PI * 2 / 5, size: 4.8, spin: 1, s0: 0.8, s1: 1.1, stop: k.stop, crashMs: k.ms(300), n: 4, cls: 'sparkly',
          trail: (x, y, delay) => dot(x, y, { color: colors[i % 3], w: 1.5, dy: rnd(3, 9), s0: 1, s1: 0.2, ms: k.ms(280), delay, cls: 'twinkle' }) })));
        k.impact();
      },
      async melee(el, from, to, k) {
        lunge(el, from, to, k.ms(330), null, 22);
        const { b } = k, cs = cellPx(), ms = k.ms(330), colors = ['#fff3a8', '#ff9ff3', '#bff4ff', '#fff'];
        await Promise.all(Array.from({ length: 12 }, (_, i) => {
          const el2 = spawn(i % 3 ? '' : '✦', 'dot twinkle'), t0 = i * Math.PI * 2 / 12, frames = [];
          if (i % 3) { el2.style.width = el2.style.height = '2.2cqw'; el2.style.background = colors[i % 4]; } else el2.style.fontSize = '4.6cqw';
          el2.style.color = colors[i % 4];
          for (let j = 0; j <= 10; j++) {
            const th = t0 + j / 10 * Math.PI * 3.2, r = cs * (0.6 - 0.4 * j / 10);
            frames.push({ transform: T(b.x + Math.cos(th) * r, b.y + Math.sin(th) * r * 0.75, j * 30, 0.6 + j / 20), opacity: j === 10 ? 0 : 1 });
          }
          return play(el2, frames, ms, { easing: 'ease-in' });
        }));
        k.impact();
      },
      impact({ b, ms }) {
        const cs = cellPx();
        for (let i = 0; i < 6; i++) {
          dot(b.x + rnd(-0.38, 0.38) * cs, b.y - cs * rnd(0.45, 0.65), { html: i % 2 ? '⭐' : '✦', color: '#fff6c0', w: rnd(3.4, 4.8), dy: cs * rnd(0.55, 0.75), r1: rnd(-140, 140), s0: 1, s1: 0.5,
            ms: ms(210), delay: ms(i * 16), ease: 'ease-in', cls: 'twinkle' });
        }
      },
    },
    // Chat : empreinte 🐾 qui avance par bonds / coup de griffe ; 3 griffures diagonales.
    '🐱': {
      sfx: ['paw', 'claw'],
      async ranged(from, to, k) {
        await windup(k.el, k.d, k.ms(100));
        const { a, d } = k, end = mix(a, k.b, k.stop), hops = 3;
        for (let i = 0; i < hops; i++) {
          const p = mix(a, end, i / hops), q = mix(a, end, (i + 1) / hops);
          await projectile('🐾', p, q, { ms: k.ms(72), arc: 0.55, rot: d.ang + 90, size: 6, s0: 0.9, s1: 1, cls: 'paw' });
          if (i < hops - 1) dot(q.x, q.y, { html: '🐾', w: 5.2, r0: d.ang + 90, s0: 0.9, s1: 0.8, o0: 0.6, ms: k.ms(280), ease: 'ease-in', cls: 'paw' });
        }
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 260, 45)) return;
        const { b, d } = k, p = off(b, d, -0.25, -0.25), q = off(b, d, 0.1, 0.25);
        dot(p.x, p.y, { html: '🐾', w: 5, dx: q.x - p.x, dy: q.y - p.y, r0: d.ang + 60, r1: d.ang + 120, s0: 1.1, s1: 0.8, ms: k.ms(160), ease: 'ease-in' });
        k.impact();
      },
      impact({ b, ms }) {
        const cs = cellPx();
        [-1, 0, 1].forEach((s, i) => slash(b.x + s * cs * 0.17, b.y - s * cs * 0.1, { ang: 62, len: 0.95, bend: 0.22, t: 0.9, color: '#ff3d6e', core: '#ffe3ea', ms: ms(260), delay: ms(i * 25), linger: true }));
      },
    },

    // Araignée : jet de toile 🕸️ qui s'étire / morsure (bond court et crochets) ; toile collée 400 ms sur le héros.
    spider: {
      sfx: ['web', 'fang'],
      async ranged(from, to, k) {
        const { a, b, d } = k, ms = k.ms(180), e = mix(a, b, k.stop);
        await windup(k.el, d, k.ms(90));
        const silk = svgFx(`<path d="M${a.x} ${a.y}L${e.x} ${e.y}" pathLength="1" stroke="#f4f1ff" stroke-width="${cellPx() * 0.04}"/>`, 'silk');
        draw(silk.querySelector('path'), ms, 'linear');
        play(silk, [{ opacity: 1 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }], ms + k.ms(160));
        await projectile('🕸️', a, b, { ms, s0: 0.35, s1: 1.25, spin: 0.25, size: 7.5, stop: k.stop, crashMs: k.ms(300), crash: 'puff', cls: 'webby' });
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 260, 55)) return;
        const { b, d } = k;
        [-1, 1].forEach(s => { const q = off(b, d, -0.12, s * 0.14); slash(q.x, q.y, { ang: d.ang + s * 55, len: 0.38, bend: 0.8, t: 1.1, color: '#b6ff8a', core: '#fff', ms: k.ms(220) }); });
        k.impact();
      },
      impact({ b, ms }, mode) {
        const el = spawn('🕸️', 'webby stuck'), s = mode === 'ranged' ? 1 : 0.8;
        el.style.fontSize = 13 * s + 'cqw';
        play(el, [
          { transform: T(b.x, b.y, -8, 1.4), opacity: 0 },
          { transform: T(b.x, b.y, 0, 0.95), opacity: 0.9, offset: 0.12 },
          { transform: T(b.x, b.y, 0, 1), opacity: 0.85, offset: 0.8 },
          { transform: T(b.x, b.y, 4, 1.05), opacity: 0 },
        ], ms(400));
        burstAt(b.x, b.y, ['#f4f1ff', '#b6ff8a'], 6, 30, { w: 1.1, ms: ms(300) });
      },
    },
    // Squelette : os 🦴 lancé en rotation, en arc / épée rouillée en arc ; éclats d'os.
    skeleton: {
      sfx: ['bone', 'rusty'],
      async ranged(from, to, k) {
        await windup(k.el, k.d, k.ms(120));
        await projectile('🦴', k.a, k.b, { ms: k.ms(245), arc: 0.3, spin: 2.5, s0: 0.9, s1: 1.1, size: 7, stop: k.stop, crashMs: k.ms(300), n: 6,
          trail: (x, y, delay) => dot(x, y, { color: '#f3ead2', w: 1.6, s0: 1, s1: 0.2, o0: 0.8, ms: k.ms(200), delay }) });
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 300, 42)) return;
        slash(k.b.x, k.b.y, { ang: k.d.ang + 75, len: 1.05, bend: 0.75, t: 1, color: '#c8743a', core: '#f3d9b0', ms: k.ms(260) });
        k.impact();
      },
      impact({ b, ms }) {
        const cs = cellPx();
        burstAt(b.x, b.y, ['#f1ead8', '#d8ccb0', '#fff'], 10, 48, { w: 2.8, h: 1.1, ms: ms(280) });
        [-1, 1].forEach(s => dot(b.x, b.y, { html: '🦴', w: 3.6, dx: s * cs * 0.42, dy: -cs * 0.3, r1: s * 220, s0: 0.9, s1: 0.6, ms: ms(280) }));
      },
    },
    // Brute : rocher 🪨 en cloche / coup au sol (saut, onde de choc, plateau qui tremble) ; fissures sous le héros.
    brute: {
      sfx: ['rock', 'slam'], ownParry: true,
      async ranged(from, to, k) {
        await windup(k.el, k.d, k.ms(100));
        await projectile('🪨', k.a, k.b, { ms: k.ms(265), arc: 0.45, lob: 0.5, spin: 0.8, s0: 0.8, s1: 1, size: 7, stop: k.stop, crashMs: k.ms(300) });
        k.impact();
      },
      async melee(el, from, to, k) {
        const { a, b, d } = k, ms = k.ms(480), r = (n, up = 0) => `translate(${d.x * n}%, ${d.y * n - up}%)`;
        if (k.parry) {
          // Bond vers le héros, arrêté net par le bouclier, puis recul.
          sprite(el, [
            { transform: 'none' },
            { transform: 'translateY(6%) scale(1.15, .85)', offset: 0.2 },
            { transform: `${r(30, 50)} scale(1.1)`, offset: 0.45 },
            { transform: `${r(55, 8)} scale(1.15, .9)`, offset: 0.58 },
            { transform: `${r(-15)} rotate(${d.x >= 0 ? -10 : 10}deg)`, offset: 0.8 },
            { transform: 'none' },
          ], ms);
          await sleep(ms * 0.58); k.parry(); await sleep(ms * 0.42);
          return;
        }
        sprite(el, [
          { transform: 'none' },
          { transform: 'translateY(8%) scale(1.18, .82)', offset: 0.22 },
          { transform: `${r(15, 62)} scale(1.08, 1.12)`, offset: 0.52, easing: 'ease-in' },
          { transform: `${r(25)} scale(1.32, .74)`, offset: 0.7 },
          { transform: 'none' },
        ], ms, 'ease-out');
        await sleep(ms * 0.7);
        const g = off(mix(a, b, 0.25), { x: 0, y: 1, nx: 0, ny: 0 }, 0.25);
        sfx.boom();
        ring(g.x, g.y, { color: '#ffd27a', d: 3, w: 2.4, ms: k.ms(300), flat: 0.55, cls: 'quakering' });
        ring(g.x, g.y, { color: '#fff3d0', d: 1.7, w: 1.2, ms: k.ms(260), delay: k.ms(40), flat: 0.55, cls: 'quakering' });
        for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1; dot(g.x, g.y, { color: '#7a5a3c', w: 6, cls: 'smoke', dx: s * cellPx() * rnd(0.4, 0.8), dy: -cellPx() * rnd(0, 0.2), s0: 0.5, s1: 1.3, o0: 0.85, ms: k.ms(300) }); }
        quake('shake');
        k.impact();
      },
      impact({ b, ms }) {
        const cs = cellPx(), f = { x: b.x, y: b.y + cs * 0.28 };
        let paths = '';
        for (let i = 0; i < 6; i++) {
          let th = (i / 5 * 1.3 - 0.15) * Math.PI + rnd(-0.15, 0.15), x = f.x + Math.cos(th) * cs * 0.12, y = f.y + Math.sin(th) * cs * 0.06, p = `M${x} ${y}`;
          for (let j = 0; j < 3; j++) { th += rnd(-0.5, 0.5); const l = cs * rnd(0.16, 0.26); x += Math.cos(th) * l; y += Math.sin(th) * l * 0.5; p += `L${x} ${y}`; }
          paths += `<path d="${p}" pathLength="1"/>`;
        }
        const el = svgFx(`<g stroke="#ffc978" stroke-width="${cs * 0.075}" opacity=".55">${paths}</g><g stroke="#1b0f07" stroke-width="${cs * 0.045}">${paths}</g>`, 'cracks');
        el.querySelectorAll('path').forEach(p => draw(p, ms(110)));
        play(el, [{ opacity: 1 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }], ms(280));
      },
    },
    // Dragon : souffle de feu (cône de 🔥 en éventail) / griffe puis queue ; brûlure orange, puis fumée.
    dragon: {
      sfx: ['fire', 'rake'],
      async ranged(from, to, k) {
        const { a, b, d } = k, cs = cellPx(), m = off(a, d, 0.3);
        glow(m.x, m.y, { color: '#ff8a3d', d: 1, ms: k.ms(220) });
        await windup(k.el, d, k.ms(100));
        // Cône de chaleur qui s'ouvre de la gueule vers le héros (ou jusqu'au bouclier), sous les flammes.
        const cone = spawn('', 'cone'), len = (d.len - cs * 0.3) * k.stop, C = sx => `translate(${m.x}px,${m.y}px) rotate(${d.ang}deg) scale(${sx},1) translateY(-50%)`;
        cone.style.width = len + 'px'; cone.style.height = cs * 1.1 + 'px';
        play(cone, [{ transform: C(0), opacity: 0.9 }, { transform: C(1), opacity: 0.85, offset: 0.5 }, { transform: C(1.05), opacity: 0 }], k.ms(360), { easing: 'ease-out' });
        const order = [2, 0, 4, 1, 3, 5];
        await Promise.all(order.map((o, i) => {
          const s = (i / 5 - 0.5) * 2, t = { x: b.x + d.nx * s * cs * 0.45, y: b.y + d.ny * s * cs * 0.45 };
          return projectile('🔥', m, t, { ms: k.ms(185), delay: k.ms(o * 16), s0: 0.4, s1: 1.4, size: 7, rot: d.ang + 270, rock: 8, stop: k.stop, crashMs: k.ms(300), crash: 'puff', n: 3, cls: 'flame',
            trail: (x, y, delay) => dot(x, y, { color: i % 2 ? '#ffb347' : '#ff5a1f', w: 1.6, dx: rnd(-6, 6), dy: rnd(-10, -3), s0: 1, s1: 0.2, ms: k.ms(240), delay }) });
        }));
        k.impact();
      },
      async melee(el, from, to, k) {
        if (!await strike(el, from, to, k, 280, 50)) return;
        const { b, d } = k, cs = cellPx();
        [-1, 0, 1].forEach((s, i) => slash(b.x + d.nx * s * cs * 0.16, b.y + d.ny * s * cs * 0.16, { ang: d.ang + 60, len: 0.75, bend: 0.25, t: 0.7, color: '#ff8a3d', core: '#fff1c2', ms: k.ms(220), delay: k.ms(i * 25) }));
        slash(b.x, b.y + cs * 0.1, { ang: d.ang - 70, len: 1.3, bend: 0.85, t: 1.2, color: '#3fbf6a', core: '#d7ffd9', ms: k.ms(240), delay: k.ms(110) });   // coup de queue
        k.impact();
      },
      impact({ b, ms }) {
        const cs = cellPx();
        glow(b.x, b.y, { color: '#ff7a1f', d: 1.25, ms: ms(240) });
        burstAt(b.x, b.y, ['#ffb347', '#ff5a1f', '#ffe08a'], 10, 40, { w: 2, ms: ms(260) });
        for (let i = 0; i < 3; i++) dot(b.x + (i - 1) * cs * 0.2, b.y, { color: '#4d4550', w: 6.5, cls: 'smoke', dy: -cs * rnd(0.45, 0.65), dx: rnd(-6, 6), s0: 0.5, s1: 1.4, o0: 0.7, ms: ms(200), delay: ms(50 + i * 20), ease: 'ease-out' });
      },
    },
  };

  // Attaque de key (avatar ou clé de monstre) en mode 'ranged' ou 'melee', de la case from vers la case to.
  // o = { el (entité de l'attaquant), speed, stop (arrêt sur le bouclier), parry (coup paré : fn au choc) }.
  // Résout au moment de l'impact (l'effet d'impact se poursuit seul). Mouvement réduit : impact seul.
  async function attack(key, mode, from, to, o = {}) {
    const atk = ATTACKS[key] || ATTACKS[GameData.AVATARS[0]];
    const sp = o.speed ?? 1, stop = o.stop ?? 1, a = P(from), b = P(to);
    const k = { el: o.el, stop, parry: o.parry || null, a, b, d: dirOf(a, b), ms: x => reduced.matches ? Math.min(x * sp, 250) : x * sp };
    const blocked = stop < 1 || !!k.parry;
    k.impact = () => { if (!blocked) { haptic('hit'); atk.impact(k, mode); } };
    sfx[atk.sfx[mode === 'ranged' ? 0 : 1]]();
    if (reduced.matches) { if (k.parry) k.parry(); else k.impact(); return; }
    if (mode === 'ranged') await atk.ranged(from, to, k);
    else if (k.parry && !atk.ownParry) await strike(o.el, from, to, k);   // paré : le geste s'interrompt
    else await atk.melee(o.el, from, to, k);
  }

  function hop(el, ms = 190) {
    el.querySelector('.sprite').animate([
      { transform: 'translateY(0) scale(1,1)' },
      { transform: 'translateY(-22%) scale(.92,1.08)', offset: 0.45 },
      { transform: 'translateY(0) scale(1.08,.92)', offset: 0.85 },
      { transform: 'translateY(0) scale(1,1)' },
    ], { duration: ms, easing: 'ease-out' });
  }

  function confetti(n = 120) {
    const colors = ['#f5c451', '#ff5d73', '#4fd6ff', '#7cf08a', '#c48bff', '#fff'];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[i % colors.length];
      el.style.width = 6 + Math.random() * 6 + 'px';
      document.body.append(el);
      const drift = (Math.random() - 0.5) * 300;
      el.animate([
        { transform: `translate(0,-20px) rotate(0)`, opacity: 1 },
        { transform: `translate(${drift}px, 105vh) rotate(${720 * Math.random() + 360}deg)`, opacity: 0.8 },
      ], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.25,.4,.6,1)' })
        .finished.then(() => el.remove());
    }
  }

  // Vibrations : même réglage que le son ; absentes sur iOS Safari, où rien n'est appelé.
  const HAPTIC = { tick: 6, drop: 12, hit: 18, hurt: [30, 40, 30], deny: [10, 30, 10] };
  function haptic(kind) {
    if (!soundOn || !('vibrate' in navigator) || !HAPTIC[kind]) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // Chrome refuse avant le 1er geste
    try { navigator.vibrate(HAPTIC[kind]); } catch { /* ignoré */ }
  }

  function retrigger(el, cls) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  return {
    sfx, float, projectile, lunge, shield, attack, ATTACKS, hop, burst, confetti, retrigger, haptic,
    get soundOn() { return soundOn; },
    toggleSound() { soundOn = !soundOn; Store.set('ocd-sound', soundOn); return soundOn; },
  };
})();
