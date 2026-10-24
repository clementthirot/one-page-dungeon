// Interface et déroulement d'une partie.
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const { MONSTERS, AVATARS } = GameData;
  const E = Engine;
  const SLOT_KEYS = ['spd', 'atk', 'def'];
  const SKILLS = {
    spd: { icon: '👢', name: 'Vitesse' },
    atk: { icon: '🗡️', name: 'Attaque' },
    def: { icon: '🛡️', name: 'Défense' },
    rng: { icon: '🏹', name: 'Portée' },
  };
  const EASE = 'cubic-bezier(.3,.7,.4,1)';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Disposition mobile (portrait étroit ou paysage bas) et pointeur grossier (doigt).
  const mobileMQ = matchMedia('(max-width: 920px), (orientation: landscape) and (max-height: 500px)');
  const coarseMQ = matchMedia('(pointer: coarse)');
  const isMobile = () => mobileMQ.matches;
  let coarse = coarseMQ.matches;

  let S = null;            // état de la partie
  let busy = false;        // animation en cours : entrées bloquées
  let guide = null;        // tuile choisie pour le prochain jeton tapé (sinon la 1re vide)
  let undo = [];           // instantanés du tour (pour Annuler)
  let pending = null;      // aperçu de déplacement {r,c} : 1er tap, survol ou glisser du héros
  let dicePreview = '';    // ligne de statut pendant le glisser d'un dé
  let statusMsg = '';      // message temporaire (remplace les toasts sur mobile)
  let coach = false;       // consignes d'apprentissage (2 premiers tours de la 1re partie)
  let speed = 1;           // 0.25 quand le tour des monstres est accéléré
  let rand = Math.random;
  let oracleOn = Store.get('ocd-oracle', true);
  let bannersOn = Store.get('ocd-banners', true);   // bandeaux de début de tour et de tour des monstres
  let avatar = Store.get('ocd-avatar', AVATARS[0]);
  let mode = 'free';
  const wait = ms => sleep(ms * speed);

  // ---------- Utilitaires d'affichage ----------
  // Jeton d'énergie : un chiffre dans une forme (neutre doré, ou forme et couleur de la stat k).
  const tokHTML = (v, k = '') => `<span class="tok${k ? ` tok-${k}` : ''}"><b>${v}</b></span>`;
  // Barre de vie en crans : le cran perdu clignote blanc puis se vide, le cran regagné s'allume.
  function setHpBar(el, hp, max) {
    let old = +el.dataset.hp;
    if (el.children.length !== max) { el.innerHTML = '<i></i>'.repeat(max); old = hp; }
    [...el.children].forEach((s, i) => {
      s.classList.toggle('on', i < hp);
      if (i < old && i >= hp) FX.retrigger(s, 'lost');
      else if (i >= old && i < hp) FX.retrigger(s, 'gain');
    });
    el.dataset.hp = hp;
  }
  const ready = () => !!S && S.slotDice.every(v => v !== null);   // les 3 jetons sont posés
  const ptsOf = d => ({ spd: S.skills.spd + (d[0] ?? 0), atk: S.skills.atk + (d[1] ?? 0), def: S.skills.def + (d[2] ?? 0) });
  // Emplacement guidé : celui choisi s'il est vide, sinon le 1er vide (Vitesse, Attaque, Défense) ; -1 si tout est posé.
  function curGuide() {
    if (guide !== null && S.slotDice[guide] === null) return guide;
    return S.slotDice.indexOf(null);
  }
  // Déplace un jeton dans a = {pool, slotDice}. src/dst : {kind:'pool', i} ou {kind:'slot', i} ; dst {kind:'pool'} = renvoi.
  // Sur un emplacement occupé, le jeton qui y était prend la place de celui qu'on pose (échange).
  function applyMove(a, src, dst) {
    const P = a.pool, D = a.slotDice;
    if (dst.kind === 'pool') { P[P.indexOf(null)] = D[src.i]; D[src.i] = null; return; }
    if (src.kind === 'pool') [P[src.i], D[dst.i]] = [D[dst.i], P[src.i]];
    else [D[src.i], D[dst.i]] = [D[dst.i], D[src.i]];
  }
  const entEl = id => document.querySelector(`.ent[data-id="${id}"]`);
  const tileEl = k => document.querySelector(`#statbar .st-tile[data-k="${k}"]`);
  function place(el, p) { el.style.setProperty('--r', p.r); el.style.setProperty('--c', p.c); }
  const monsterLabel = n => `${n} ${n > 1 ? S.def.plural : S.def.name}`;
  const hitsOf = pts => Math.floor(Math.max(0, pts) / S.def.def);
  const hitsLabel = n => `${n} coup${n > 1 ? 's' : ''}`;
  const reachCost = (r, c) => E.heroReach(S).dist[E.idx(r, c)];
  const canReach = d => d > 0 && d <= S.pts.spd;
  const inMonsterTurn = () => !!S && (S.phase === 'mmove' || S.phase === 'mattack');

  function addLog(text, cls = '') {
    const li = document.createElement('div');
    li.className = `log-line ${cls}`;
    li.textContent = text;
    const log = $('#log');
    log.prepend(li);
    while (log.children.length > 40) log.lastChild.remove();
  }

  // Message court : toast sur ordinateur, ligne de statut (2 s) en disposition mobile.
  let toastTimer;
  function toast(text) {
    clearTimeout(toastTimer);
    if (isMobile()) {
      statusMsg = text;
      renderStatus();
      toastTimer = setTimeout(() => { statusMsg = ''; renderStatus(); }, 2000);
      return;
    }
    const t = $('#toast');
    t.textContent = text;
    FX.retrigger(t, 'show');
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  // Action refusée : son, vibration et raison.
  function deny(text) {
    FX.sfx.deny();
    FX.haptic('deny');
    if (text) toast(text);
  }

  // Bandeau de phase : une bande traverse l'écran (entre à gauche, s'arrête, repart à droite).
  // kind : couleur de la phase (level, turn, monsters, block, hurt, safe, clear). Un tap ou Espace le passe ;
  // la durée suit l'accélération du tour des monstres, même en cours de route.
  let bannerSkip = null;
  async function banner(kind, { ico = '', title, sub = '', extra = '', ms = 900 }) {
    const b = $('#banner');
    b.className = `banner bn-${kind}`;
    b.querySelector('.bn-ico').textContent = ico;
    b.querySelector('h2').textContent = title;
    b.querySelector('p').innerHTML = sub;   // texte du jeu uniquement (formule avec opérateur mis en forme)
    b.querySelector('.bn-extra').innerHTML = extra;
    void b.offsetWidth;
    b.classList.add('show');
    let skipped = false;
    bannerSkip = () => { skipped = true; };
    for (let t = 0; t < ms && !skipped; t += 40 / speed) await sleep(40);
    bannerSkip = null;
    b.classList.replace('show', 'out');
    await sleep(Math.max(80, 220 * speed));
    b.classList.remove('out');
  }
  // Mini-stats d'un monstre (bandeau de niveau)
  const miniStats = d => [['hp', '❤️', d.hp], ['spd', '👢', d.spd], ['atk', '🗡️', d.atk], ['def', '🛡️', d.def], ['rng', '🏹', d.rng]]
    .map(([k, i, v]) => `<span data-k="${k}">${i}<b>${v}</b></span>`).join('');

  // Fenêtres : une fenêtre fermée est inerte (ni focus, ni clic, ni lecteur d'écran).
  let opener = null;       // élément qui avait le focus avant l'ouverture
  function showOverlay(id) {
    const ov = $(id);
    opener = document.activeElement;
    ov.inert = false;
    ov.classList.add('show');
    requestAnimationFrame(() => ov.querySelector('input, button:not(:disabled)')?.focus());
  }
  function hideOverlay(id) {
    const ov = $(id);
    const hadFocus = ov.contains(document.activeElement);
    ov.classList.remove('show');
    ov.inert = true;
    if (hadFocus && opener?.isConnected && !opener.closest('[inert]')) opener.focus();
  }

  // ---------- Construction ----------
  function buildBoard() {
    const tiles = $('#tiles');
    tiles.innerHTML = '';
    const stairs = new Set(S.def.stairs.map(([r, c]) => E.idx(r, c)));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const i = E.idx(r, c);
      const t = document.createElement('div');
      t.className = 'tile' + (S.walls.has(i) ? ' wall' : '') + (stairs.has(i) ? ' stairs' : '');
      t.dataset.r = r; t.dataset.c = c;
      t.style.setProperty('--v', (r * 7 + c * 13) % 5);
      tiles.append(t);
    }
    $('#board').className = `board theme-${S.def.theme}`;
    buildEntities(true);
  }

  function buildEntities(spawn = false) {
    const ents = $('#entities');
    ents.innerHTML = '';
    const make = (id, emoji, cls, p) => {
      const el = document.createElement('div');
      el.className = `ent ${cls}${spawn ? ' spawn' : ''}`;
      el.dataset.id = id;
      el.innerHTML = `<div class="sprite"><span class="emo">${emoji}</span></div><div class="hp hpbar"></div><div class="tag"></div>`;
      place(el, p);
      ents.append(el);
      return el;
    };
    make('hero', S.avatar, 'hero', S.hero);
    S.monsters.forEach((m, i) => {
      const el = make(m.id, S.def.emoji, `monster m-${S.def.key}`, m);
      el.style.animationDelay = `${0.25 + i * 0.12}s`;
      // Souris : le survol d'un monstre montre ses infos et sa zone de menace (= appui long au doigt).
      el.addEventListener('pointerenter', e => {
        const mm = S.monsters.find(x => x.id === m.id);
        if (e.pointerType === 'mouse' && mm && S.phase === 'play' && !busy) showInfo(mm);
      });
      el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideInfo(); });
    });
  }

  // Barre des stats unifiée, seule interface du tour : vie + réserve des jetons (ligne 1),
  // puis 4 tuiles qui sont aussi les emplacements des jetons (ligne 2). Sa structure ne change jamais.
  function buildTray() {
    const tile = k => `<button class="st-tile" data-k="${k}" aria-label="${SKILLS[k].name}" draggable="false">
        <span class="ts-ico">${SKILLS[k].icon}</span><span class="ts-tok"></span>
        <b class="ts-val" data-f="val">–</b><small class="ts-help" data-f="help"></small>
        <small class="ts-base" data-f="base"></small><i class="ts-bar"><i data-f="bar"></i></i></button>`;
    $('#statbar').innerHTML = `<div class="sb-top">
        <div class="hprow"><span class="hp-ico">❤</span><div class="hpbar" id="hero-hp"></div><b id="hp-num"></b></div>
        <div class="pool" id="pool" aria-label="Réserve">${[0, 1, 2].map(p => `<button class="pool-tok" data-pool="${p}" aria-label="Jeton d’énergie ${p + 1}" draggable="false"></button>`).join('')}</div>
      </div>
      <div class="st-tiles">${[...SLOT_KEYS, 'rng'].map(tile).join('')}</div>`;
    SLOT_KEYS.forEach((k, i) => DiceDrag.bind(tileEl(k), { kind: 'slot', i }));
    $$('#pool .pool-tok').forEach(el => DiceDrag.bind(el, { kind: 'pool', i: +el.dataset.pool }));
    tileEl('rng').addEventListener('click', () => { if (S?.phase === 'play' && !busy) rangeDeny(); });
  }

  // ---------- Rendu ----------
  function render() {
    if (!S) return;
    renderHud();
    renderTray();
    renderBoardState();
    renderStatus();
    renderControls();
  }

  function renderHud() {
    $('#hud-level').textContent = S.level;
    $('#hud-turn').textContent = S.turn;
    $('#hud-lvl').textContent = `${S.def.emoji} ${S.level}/12`;
    $('#btn-progress').setAttribute('aria-label', `Progression : niveau ${S.level} sur 12`);

    // Piste des 12 niveaux
    let t = '';
    for (let l = 1; l <= 12; l++) {
      const m = MONSTERS[GameData.levelKey(l)];
      const st = l < S.level ? 'done' : l === S.level ? 'cur' : '';
      t += `<div class="lv ${st}" title="Niveau ${l} : ${m.plural}"><span>${l < S.level ? '✓' : m.emoji}</span><small>${l}</small></div>`;
    }
    t += `<div class="lv goal ${S.won ? 'done' : ''}" title="Le Sceptre de M'Guf-yn"><span>🔱</span></div>`;
    $('#track').innerHTML = t;

    const d = S.def;
    const alive = S.monsters.length, total = d.spawns[S.level].length;
    let icons = '';
    for (let i = 0; i < total; i++) icons += `<span class="${i < alive ? '' : 'dead'}">${d.emoji}</span>`;
    $('#monster-card').innerHTML = `
      <div class="mc-left"><div class="mc-emoji">${d.emoji}</div>
        <div><div class="mc-name">${d.plural}</div><div class="mc-count">${icons}</div></div></div>
      <div class="mc-stats">
        <span title="Points de vie" data-k="hp">❤️<b>${d.hp}</b></span>
        <span title="Vitesse" data-k="spd">👢<b>${d.spd}</b></span>
        <span title="Attaque" data-k="atk">🗡️<b>${d.atk}</b></span>
        <span title="Défense : coût en Attaque pour 1 dégât" data-k="def">🛡️<b>${d.def}</b></span>
        <span title="Portée" data-k="rng">🏹<b>${d.rng}</b></span>
      </div>`;
  }

  function setText(el, v) {
    if (el.textContent !== String(v)) { el.textContent = v; FX.retrigger(el, 'pop'); }
  }

  // Barre des stats : seul le contenu des tuiles et de la réserve change, jamais leur taille ni leur place.
  function renderTray() {
    renderStatbar();
    renderPool();

    // Consigne affichée sous le bouton principal (ordinateur)
    const hint = $('#hint');
    if (S.phase === 'roll') hint.textContent = 'Lancer des dés…';
    else if (S.phase === 'play' && !ready()) hint.textContent = 'Touchez les 3 jetons, ou glissez-les sur les stats.';
    else if (S.phase === 'play' && !S.locked) hint.textContent = 'Bougez ou frappez · touchez une stat pour reprendre son jeton.';
    else if (S.phase === 'play') hint.textContent = 'Case lumineuse : bouger · monstre ciblé : frapper.';
    else hint.textContent = '';
  }

  // Vie du héros + 4 tuiles. Tuile vide : icône, « 1+? » et emplacement en pointillés.
  // Tuile remplie : jeton incrusté, total utilisable en gros, aide, base et mini-barre.
  function renderStatbar() {
    setHpBar($('#hero-hp'), S.hero.hp, 6);
    $('#hp-num').textContent = `${S.hero.hp}/6`;
    const inTurn = ['play', 'mmove', 'mattack'].includes(S.phase);
    const locked = S.phase === 'play' && S.locked;
    const g = S.phase === 'play' && !S.locked ? curGuide() : -1;
    [...SLOT_KEYS, 'rng'].forEach((k, i) => {
      const t = tileEl(k), base = S.skills[k];
      const dv = k === 'rng' ? null : S.slotDice[i], empty = k !== 'rng' && dv === null;
      const total = base + (dv ?? 0), now = k === 'rng' || !inTurn ? total : S.pts[k];
      // Valeur : « 1+? » si vide, sinon le total (qui saute quand il change, sauf au retour d'un aperçu)
      const val = t.querySelector('[data-f="val"]'), was = val.dataset.v, want = empty ? `${base}+?` : String(now);
      if (was !== want) {
        val.innerHTML = empty ? `${base}<i>+?</i>` : want;
        val.dataset.v = want;
        if (!empty && was !== undefined && was !== '~') FX.retrigger(val, 'pop');
      }
      t.querySelector('[data-f="help"]').textContent =
        empty ? (i === g ? 'posez ici' : 'à remplir')
        : k === 'spd' ? `restant${now > 1 ? 's' : ''}`
        : k === 'atk' ? `${hitsLabel(hitsOf(now))}${hitsOf(now) ? '' : ' ⚠'}`
        : k === 'def' ? 'ce tour' : 'fixe';
      t.querySelector('[data-f="base"]').textContent = k === 'rng' ? 'sans dé' : dv !== null ? `base ${base} + ${dv}` : `base ${base}`;
      t.querySelector('[data-f="bar"]').style.width = empty ? '0%' : `${Math.max(0, now) / total * 100}%`;
      const tok = t.querySelector('.ts-tok'), wantTok = dv === null ? '' : String(dv);
      if (k !== 'rng' && tok.dataset.v !== wantTok) {
        tok.innerHTML = dv === null ? '<span class="tok-well"></span>' : tokHTML(dv, k);
        tok.dataset.v = wantTok;
      }
      t.classList.toggle('empty', empty);
      t.classList.toggle('cur', i === g);
      t.classList.toggle('locked', locked && k !== 'rng');
    });
  }

  // Réserve : jetons dorés ; une place vidée reste en fantôme pointillé, la mise en page ne bouge pas.
  function renderPool() {
    if (S.phase === 'roll') return;   // pendant le lancer, la réserve affiche l'animation des jetons (startTurn)
    $$('#pool .pool-tok').forEach((b, p) => {
      const v = S.pool[p], want = v === null ? '' : String(v);
      if (b.dataset.v !== want) { b.innerHTML = v === null ? '' : tokHTML(v); b.dataset.v = want; }
      b.classList.toggle('empty', v === null);
      b.tabIndex = v === null ? -1 : 0;
    });
  }

  // Dégâts prévus si le tour se termine sur la case p (Oracle).
  function predict(p, defPts) {
    const w = { ...S, hero: { ...S.hero, r: p.r, c: p.c }, pts: { ...S.pts, def: defPts } };
    return E.planMonsters(w);
  }

  // Cases atteignables, badges Oracle et monstres frappables.
  // ptsOverride : points hypothétiques (aperçu pendant le glisser d'un dé), rendus en pointillés (.preview).
  function renderBoardState(ptsOverride = null) {
    const pts = ptsOverride || S.pts, pv = !!ptsOverride;
    place(entEl('hero'), S.hero);
    setHpBar(entEl('hero').querySelector('.hp'), S.hero.hp, 6);
    const atk = S.phase === 'play' && !busy ? E.attackable(S) : [];
    S.monsters.forEach(m => {
      const el = entEl(m.id);
      if (!el) return;
      place(el, m);
      setHpBar(el.querySelector('.hp'), m.hp, S.def.hp);
      const inR = atk.some(a => a.id === m.id);
      const afford = pts.atk >= S.def.def;
      el.classList.toggle('target', inR && afford);
      el.classList.toggle('target-dim', inR && !afford);
      el.classList.toggle('preview', pv && inR);
      el.querySelector('.tag').textContent = inR ? `🗡️${S.def.def}` : '';
    });

    const tiles = $$('#tiles .tile');
    tiles.forEach(t => { t.classList.remove('reach', 'danger', 'safe', 'preview'); delete t.dataset.cost; delete t.dataset.dmg; });
    if (S.phase !== 'play' || busy) return;
    const { dist } = E.heroReach(S);
    tiles.forEach(t => {
      const r = +t.dataset.r, c = +t.dataset.c, d = dist[E.idx(r, c)];
      if (!(d > 0 && d <= pts.spd)) return;
      t.classList.add('reach');
      if (pv) t.classList.add('preview');
      t.dataset.cost = d;
      if (oracleOn) {
        const dmg = predict({ r, c }, pts.def).dmg;
        t.classList.add(dmg ? 'danger' : 'safe');
        t.dataset.dmg = dmg || '✓';
      }
    });
  }

  const verdictHTML = dmg => dmg ? `<b class="bad">−${dmg} ❤</b>` : '<b class="good">✓</b>';
  // L'attribution a son propre guide : la consigne d'apprentissage ne parle que du plateau.
  function coachText() {
    if (!coach || !isMobile() || S.phase !== 'play' || S.level !== 1 || !ready() || S.turn > 2) return '';
    return '👆 Touchez une case verte, puis touchez-la encore pour y aller';
  }

  // Ligne de statut sous le plateau (une seule ligne, hauteur réservée). Priorité :
  // tour des monstres > aperçu (dé ou déplacement) > message temporaire > attribution > consigne > Oracle > vide.
  function renderStatus() {
    const box = $('#oracle');
    if (!S) { box.innerHTML = ''; return; }
    let h = '';
    if (inMonsterTurn()) {
      h = speed < 1 ? '⏩ Les monstres agissent…'
        : `👹 Les monstres agissent · ${isMobile() ? 'touchez' : 'cliquez ou Espace'} pour accélérer`;
    } else if (S.phase === 'play' && dicePreview) h = dicePreview;
    else if (S.phase === 'play' && pending) {
      h = `👢 −${reachCost(pending.r, pending.c)}`;
      if (oracleOn) h += ` · Sur cette case : ${verdictHTML(predict(pending, S.pts.def).dmg)}`;
    } else if (isMobile() && statusMsg) h = escapeHTML(statusMsg);
    else if (S.phase === 'roll') h = '<span class="cue">🎲 Lancer des dés…</span>';
    else if (S.phase === 'play' && !ready()) {
      const k = SLOT_KEYS[curGuide()];
      h = `<span class="cue">Placez un jeton sur <b class="kc-${k}">${SKILLS[k].icon} ${SKILLS[k].name}</b></span>`;
    } else if (coachText()) h = coachText();
    else if (S.phase === 'play' && !S.locked) {
      h = `<span class="cue">👉 Déplacez-vous ou attaquez</span>${oracleOn ? ` · 🔮 ${verdictHTML(predict(S.hero, S.pts.def).dmg)}` : ''}`;
    }
    else if (oracleOn && S.phase === 'play') {
      const p = predict(S.hero, S.pts.def);
      const detail = p.attackers.length ? `<small>${p.total} 🗡️ ÷ ${S.pts.def} 🛡️</small>` : '';
      h = `🔮 Ici : ${verdictHTML(p.dmg)} ${detail}`;
    }
    box.innerHTML = h;
  }

  function renderControls() {
    const main = $('#btn-main');
    const monsters = inMonsterTurn();
    const enabled = S.phase === 'play' && !busy && ready();
    // Sous-libellé : consigne tant que les jetons ne sont pas tous posés
    main.innerHTML = monsters ? '⏩ Accélérer' : S.phase === 'roll' ? '🎲…'
      : `⏭ Fin du tour${S.phase === 'play' && !ready() ? '<small>Placez d’abord vos 3 jetons</small>' : ''}`;
    main.title = monsters ? 'Accélérer (Espace)' : 'Fin du tour (Espace)';
    main.disabled = monsters ? speed < 1 : !enabled;
    main.classList.toggle('pulse', enabled);
    $('#btn-undo').disabled = busy || S.phase !== 'play' || !undo.length;
    $('#btn-oracle').classList.toggle('off', !oracleOn);
    $('#btn-banners').classList.toggle('off', !bannersOn);
    $('#btn-sound').textContent = FX.soundOn ? '🔊' : '🔇';
  }

  // ---------- Aperçu de déplacement et bulle d'infos sur le plateau ----------
  function setPending(p) {
    pending = p;
    drawPending();
    renderStatus();
  }
  // Héros fantôme à 50 %, pastilles du chemin et case encadrée.
  function drawPending() {
    $$('#entities .ghost, #entities .path-dot').forEach(x => x.remove());
    $$('#tiles .tile.pending').forEach(t => t.classList.remove('pending'));
    if (!pending || !S) return;
    const ents = $('#entities');
    const path = E.pathTo(E.heroReach(S).prev, S.hero, pending);
    path.slice(0, -1).forEach(q => {
      const dot = document.createElement('div');
      dot.className = 'path-dot';
      dot.style.left = `${(q.c + 0.5) * 20}%`;
      dot.style.top = `${(q.r + 0.5) * 20}%`;
      ents.append(dot);
    });
    const g = document.createElement('div');
    g.className = 'ent hero ghost';
    g.innerHTML = `<div class="sprite"><span class="emo">${S.avatar}</span></div>`;
    place(g, pending);
    ents.append(g);
    $(`#tiles .tile[data-r="${pending.r}"][data-c="${pending.c}"]`)?.classList.add('pending');
  }

  // Bulle au-dessus d'un monstre (stats + zone de menace) ou d'une case (dégâts prévus).
  function showInfo(m, p = null) {
    hideInfo();
    const d = S.def, at = m || p;
    if (!m && S.walls.has(E.idx(p.r, p.c))) return;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.id = 'bubble';
    if (m) {
      b.textContent = `${d.emoji} ${d.name} · ❤${m.hp}/${d.hp} · 👢${d.spd} 🗡️${d.atk} 🛡️${d.def} 🏹${d.rng}`;
      // Cases d'où ce monstre pourra vous frapper, depuis sa position actuelle
      $$('#tiles .tile').forEach(t => {
        const q = { r: +t.dataset.r, c: +t.dataset.c };
        if (S.walls.has(E.idx(q.r, q.c)) || S.monsters.some(o => o.r === q.r && o.c === q.c)) return;
        if (E.rangeDist(m, q) <= d.rng && E.los(S.walls, m, q, S.monsters)) t.classList.add('threat');
      });
    } else {
      const pr = predict(p, S.pts.def);
      b.textContent = !pr.attackers.length ? '✓ hors d’atteinte'
        : `Ici : ${pr.dmg ? `−${pr.dmg} ❤` : '✓'} (${d.emoji.repeat(pr.attackers.length)} · ${pr.total} 🗡️ ÷ ${Math.max(1, S.pts.def)} 🛡️)`;
    }
    const board = $('#board');
    board.append(b);
    const W = board.clientWidth, w = b.offsetWidth;
    const cx = (at.c + 0.5) * W / 5;
    b.style.left = `${Math.min(Math.max(cx, w / 2 + 2), W - w / 2 - 2)}px`;
    b.classList.toggle('below', at.r === 0);
    b.style.top = `${(at.r + (at.r === 0 ? 1 : 0)) * 20}%`;
  }
  function hideInfo() {
    $('#bubble')?.remove();
    $$('#tiles .threat').forEach(t => t.classList.remove('threat'));
  }

  // ---------- Jetons d'énergie : glisser-déposer et taps (Pointer Events) ----------
  // Sources : un jeton de la réserve ou d'une tuile de la barre des stats. Cibles : les tuiles Vitesse, Attaque,
  // Défense, ou la réserve (renvoi) ; la tuile Portée refuse le dépôt.
  // idle → pressed (pointerdown) → dragging (seuil 8 px doigt / 4 px souris) → dépôt ou annulation.
  // Un relâcher sans dépasser le seuil est un tap : jeton de réserve → tuile guidée ; tuile remplie → réserve.
  const DiceDrag = (() => {
    let st = null;            // geste en cours
    let animating = false;    // vol d'un jeton : glisser ignoré, tap mis en attente
    let queuedTap = [];       // file des taps reçus pendant un vol, rejoués dans l'ordre
    let skipClickAt = -1e9;   // le click natif qui suit aussitôt un tap ou un glisser est ignoré (une seule fois)
    const slotEl = i => tileEl(SLOT_KEYS[i]);
    const poolEl = p => $(`#pool .pool-tok[data-pool="${p}"]`);
    const srcEl = s => s.kind === 'pool' ? poolEl(s.i) : slotEl(s.i);
    const tokOf = s => srcEl(s).querySelector('.tok');
    const valOf = s => s.kind === 'pool' ? S.pool[s.i] : S.slotDice[s.i];
    const keyOf = s => s.kind === 'slot' ? SLOT_KEYS[s.i] : '';
    const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const at = (c, s, rot = 0) => `translate3d(${c.x - 32}px, ${c.y - 32}px, 0) scale(${s}) rotate(${rot}deg)`;
    const settle = (...anims) => Promise.race([Promise.all(anims.map(a => a?.finished)), sleep(400)]).catch(() => {});
    const canAssign = () => !!S && !busy && S.phase === 'play' && !S.locked;

    function bind(el, src) {
      el.addEventListener('pointerdown', e => down(e, src, el));
      // Clavier (Entrée/Espace) ou navigateur sans Pointer Events : le click natif sert de tap.
      el.addEventListener('click', () => {
        const skip = performance.now() - skipClickAt < 400;
        skipClickAt = -1e9;
        if (!skip) tap(src);
      });
      el.addEventListener('dragstart', e => e.preventDefault());
    }

    function down(e, src, el) {
      if (st || !e.isPrimary || e.button > 0 || !canAssign()) return;   // multitouch : un seul geste à la fois
      if (e.pointerType !== 'mouse') e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
      st = { id: e.pointerId, src, touch: e.pointerType !== 'mouse', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dragging: false, target: null };
    }

    function move(e) {
      if (!st || e.pointerId !== st.id) return;
      st.x = e.clientX; st.y = e.clientY;
      if (!st.dragging) {
        // Pendant un vol, pas de glisser : le geste reste un tap (mis en attente).
        if (animating || valOf(st.src) === null || Math.hypot(st.x - st.x0, st.y - st.y0) < (st.touch ? 8 : 4)) return;
        start();
      }
      if (e.cancelable) e.preventDefault();
      if (!st.raf) st.raf = requestAnimationFrame(placeGhost);
      const z = hitTest(st.x, st.y);
      if (z !== st.target) setTarget(z);
    }

    function ghostOf(v, k) {
      const g = document.createElement('div');
      g.className = 'drag-ghost';
      g.innerHTML = tokHTML(v, k);
      $('#drag-layer').append(g);
      return g;
    }

    function start() {
      st.dragging = true;
      hideInfo();
      setPending(null);
      // Zones de dépôt (rects mis en cache) : les 3 tuiles à jeton, la tuile Portée (refus), puis la réserve
      st.zones = [...SLOT_KEYS.map((k, i) => ({ kind: 'slot', i, el: slotEl(i) })), { kind: 'rng', el: tileEl('rng') }, { kind: 'pool', el: $('#pool') }];
      st.zones.forEach(z => { z.rect = z.el.getBoundingClientRect(); });
      st.ghost = ghostOf(valOf(st.src), keyOf(st.src));
      srcEl(st.src).classList.add('lifted');
      FX.sfx.select();
      FX.haptic('tick');
      placeGhost();
    }

    // Le fantôme suit le pointeur, 36 px au-dessus du doigt pour rester visible.
    function placeGhost() {
      if (!st?.ghost) return;
      st.raf = 0;
      st.ghost.style.transform = at({ x: st.x, y: st.y - (st.touch ? 36 : 0) }, 1.15, -6);
    }

    // Zone de dépôt agrandie de 12 px ; sinon la plus proche à moins de 40 px. Sa propre zone annule.
    function hitTest(x, y) {
      const inside = (r, m) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
      let z = st.zones.find(q => inside(q.rect, 0)) || st.zones.find(q => inside(q.rect, 12));
      if (!z) {
        let bd = Infinity;
        st.zones.forEach(q => {
          const r = q.rect, gap = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
          const c = center(r), cd = Math.hypot(x - c.x, y - c.y);
          if (gap < 40 && cd < bd) { bd = cd; z = q; }
        });
      }
      if (!z || z.kind === st.src.kind && (z.kind === 'pool' || z.i === st.src.i)) return null;
      return z;
    }

    function setTarget(z) {
      if (st.target) st.target.el.classList.remove('drop-target');
      st.target = z;
      // Le fantôme prend la forme de la stat survolée (neutre au-dessus de la réserve)
      st.ghost.innerHTML = tokHTML(valOf(st.src), z && z.kind !== 'rng' ? (z.kind === 'slot' ? SLOT_KEYS[z.i] : '') : keyOf(st.src));
      if (!z) { clearPreview(); return; }
      z.el.classList.add('drop-target');
      if (z.kind === 'rng') { clearPreview(); dicePreview = '🏹 La Portée est fixe'; renderStatus(); return; }
      showPreview(z);
    }

    // Aperçu : totaux « ancien → nouveau », ligne de statut et plateau hypothétique (en pointillés).
    function showPreview(z) {
      const a = { pool: [...S.pool], slotDice: [...S.slotDice] };
      applyMove(a, st.src, z.kind === 'slot' ? { kind: 'slot', i: z.i } : { kind: 'pool' });
      const pts = ptsOf(a.slotDice), parts = [];
      SLOT_KEYS.forEach((k, i) => {
        if (a.slotDice[i] === S.slotDice[i]) return;
        const old = S.slotDice[i] === null ? '?' : S.skills[k] + S.slotDice[i], now = a.slotDice[i] === null ? `${S.skills[k]}+?` : pts[k];
        const val = slotEl(i).querySelector('[data-f="val"]');
        val.innerHTML = `<s>${old}</s>${now}`;
        val.dataset.v = '~';   // aperçu : le rendu suivant restaure la valeur sans la faire sauter
        parts.push(`${SKILLS[k].icon} ${SKILLS[k].name} <b>${pts[k]}</b>${k === 'atk' ? ` (${hitsLabel(hitsOf(pts[k]))})` : ''}`);
      });
      dicePreview = parts.length ? `🎲 ${parts.join(' · ')}` : '';
      renderBoardState(pts);
      renderStatus();
    }
    function clearPreview() {
      dicePreview = '';
      renderTray();
      renderBoardState();
      renderStatus();
    }

    function up(e) {
      if (!st || e.pointerId !== st.id) return;
      skipClickAt = performance.now();
      if (!st.dragging) { const src = st.src; st = null; tap(src); return; }
      if (st.target?.kind === 'rng') { cancel(); rangeDeny(); }   // la Portée refuse : le jeton revient
      else if (st.target) drop(); else cancel();
    }
    function cancelEvent(e) {
      if (!st || e.pointerId !== st.id) return;
      skipClickAt = performance.now();
      if (st.dragging) cancel(); else st = null;
    }

    // Tap : jeton de réserve → tuile guidée ; tuile remplie → réserve ; tuile vide → devient le guide.
    function tap(src) {
      if (animating) { queuedTap.push(src); return; }   // tap rapide pendant un vol : rejoué à l'atterrissage
      if (!canAssign()) {
        if (S?.phase === 'play' && !busy && S.locked && src.kind === 'slot') lockedDeny(SLOT_KEYS[src.i]);
        return;
      }
      const v = valOf(src);
      if (src.kind === 'pool') {
        const j = curGuide();
        if (v !== null && j >= 0) moveTok(src, { kind: 'slot', i: j });
      } else if (v === null) {
        guide = src.i;
        FX.sfx.select();
        FX.haptic('tick');
        render();
      } else moveTok(src, { kind: 'pool' });
    }

    // Changement réel de l'état, puis rendu.
    function commit(src, dst) {
      applyMove(S, src, dst);
      guide = dst.kind === 'pool' ? src.i : null;   // jeton renvoyé : le guide revient sur cette stat
      dicePreview = '';
      computePts();
      render();
      FX.sfx.settle();
      FX.haptic('drop');
    }

    // Vol d'un jeton (~200 ms) vers sa destination ; le jeton déplacé par un échange repart vers la source.
    async function moveTok(src, dst, ghost = null) {
      animating = true;
      const v = valOf(src), p = S.pool.indexOf(null);
      const from = tokOf(src)?.getBoundingClientRect();
      const displaced = dst.kind === 'slot' && S.slotDice[dst.i] !== null ? tokOf(dst).getBoundingClientRect() : null;
      commit(src, dst);
      const toEl = dst.kind === 'slot' ? slotEl(dst.i) : poolEl(p), toTok = toEl.querySelector('.tok');
      if (!ghost) {
        ghost = ghostOf(v, keyOf(src));
        ghost.style.transform = at(center(from), from.width / 64);
      }
      ghost.innerHTML = tokHTML(v, dst.kind === 'slot' ? SLOT_KEYS[dst.i] : '');
      toTok.style.opacity = '0';
      const r = toTok.getBoundingClientRect();
      const fly = ghost.animate([{ transform: ghost.style.transform }, { transform: at(center(r), r.width / 64) }],
        { duration: 200, easing: EASE, fill: 'forwards' });
      let back = null;
      if (displaced) {
        const d = tokOf(src), b = d.getBoundingClientRect(), ca = center(displaced), cb = center(b);
        back = d.animate([
          { transform: `translate(${ca.x - cb.x}px, ${ca.y - cb.y}px) scale(${displaced.width / b.width})` },
          { transform: 'none' },
        ], { duration: 200, easing: EASE });
      }
      await settle(fly, back);
      ghost.remove();
      toTok.style.opacity = '';
      FX.retrigger(toTok, 'swapped');
      animating = false;
      flushTaps();
    }

    // Rejoue le tap suivant de la file (le vol qu'il déclenche rejouera les autres).
    function flushTaps() {
      while (queuedTap.length && !animating) tap(queuedTap.shift());
    }

    async function drop() {
      const { src, target, ghost } = st;
      cancelAnimationFrame(st.raf);
      st = null;
      srcEl(src).classList.remove('lifted');
      target.el.classList.remove('drop-target');
      await moveTok(src, target.kind === 'slot' ? { kind: 'slot', i: target.i } : { kind: 'pool' }, ghost);
    }

    // Annulation : le fantôme revient à sa place, sans son, et l'état ne change pas.
    async function cancel() {
      if (!st) return;
      const { ghost, src, target } = st;
      cancelAnimationFrame(st.raf);
      st = null;
      if (!ghost) return;
      animating = true;
      if (target) target.el.classList.remove('drop-target');
      ghost.innerHTML = tokHTML(valOf(src), keyOf(src));
      clearPreview();
      const r = tokOf(src).getBoundingClientRect();
      const fly = ghost.animate([{ transform: ghost.style.transform }, { transform: at(center(r), r.width / 64) }],
        { duration: 140, easing: EASE, fill: 'forwards' });
      await settle(fly);
      ghost.remove();
      srcEl(src).classList.remove('lifted');
      animating = false;
      flushTaps();
    }

    // Écoute sur window : reçoit les événements capturés par le jeton comme les autres.
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelEvent);

    return {
      bind, tap,
      cancel() { if (st?.dragging) cancel(); },
      get active() { return !!st?.dragging || animating; },
    };
  })();

  // ---------- Déroulement ----------
  function newGame(name) {
    S = {
      name, avatar, daily: mode === 'daily', level: 1, won: false,
      hero: { r: 0, c: 0, hp: 6 }, skills: { spd: 1, atk: 1, def: 1, rng: 2 },
      monsters: [], walls: new Set(), def: null,
      pool: [null, null, null], slotDice: [null, null, null], locked: false, pts: { spd: 0, atk: 0, def: 0 },
      phase: 'intro', turn: 1, totalTurns: 0, dmgTaken: 0, kills: 0,
    };
    rand = mulberry32(S.daily ? hashStr(`ocd-${todayStr()}`) : (Math.random() * 2 ** 32) >>> 0);
    coach = !Store.get('ocd-coach', false);
    pending = null; dicePreview = ''; statusMsg = ''; speed = 1;
    $('#log').innerHTML = '';
    buildTray();
    closeSheet();
    hideOverlay('#ov-start');
    hideOverlay('#ov-end');
    addLog(S.daily ? `📅 Défi du jour ${todayStr()} — bonne chance, ${name} !` : `Bonne chance, ${name} !`, 'lvl');
    setupLevel(1);
  }

  async function setupLevel(l) {
    const def = MONSTERS[GameData.levelKey(l)];
    Object.assign(S, { level: l, def, walls: new Set(def.walls.map(([r, c]) => E.idx(r, c))), turn: 1, phase: 'intro' });
    S.hero.r = def.start[0]; S.hero.c = def.start[1];
    S.monsters = def.spawns[l].map(([r, c], i) => ({ id: `m${i}`, r, c, hp: def.hp }));
    S.pool = [null, null, null]; S.slotDice = [null, null, null]; S.locked = false; S.pts = { spd: 0, atk: 0, def: 0 };
    busy = true;
    pending = null;
    buildBoard();
    render();
    addLog(`— Niveau ${l} : ${monsterLabel(S.monsters.length)} —`, 'lvl');
    const n = S.monsters.length;
    await banner('level', { ico: def.emoji, title: `NIVEAU ${l}`, sub: `×${n} ${n > 1 ? def.plural : def.name}`, extra: miniStats(def), ms: 1500 });
    busy = false;
    startTurn();
  }

  // Début du tour : les 3 jetons sont tirés dans la réserve, puis le joueur les attribue et agit.
  async function startTurn() {
    S.phase = 'roll';
    S.locked = false;
    S.pool = [null, null, null];
    S.slotDice = [null, null, null];
    computePts();
    guide = null; undo = []; pending = null; dicePreview = '';
    speed = 1;
    $('#board').classList.remove('fast');
    if (coach && (S.level > 1 || S.turn > 2)) { coach = false; Store.set('ocd-coach', true); }
    hideInfo();
    drawPending();
    busy = true;
    render();
    // Valeurs finales tirées une seule fois (graine du Défi du jour), l'animation n'est que visuelle.
    const vals = [0, 0, 0].map(() => 1 + Math.floor(rand() * 6));
    const btns = $$('#pool .pool-tok');
    if (bannersOn) {
      // Bandeau « Votre tour » : les 3 jetons tirés y tombent, puis atterrissent dans la réserve.
      FX.sfx.roll();
      await banner('turn', {
        ico: '⚔️', title: 'VOTRE TOUR', sub: `Tour ${S.turn}`, ms: 900,
        extra: vals.map((v, i) => `<span class="bn-die" style="--i:${i}">${tokHTML(v)}</span>`).join(''),
      });
    } else {
      btns.forEach(b => { b.innerHTML = tokHTML(1); b.firstElementChild.classList.add('rolling'); b.classList.remove('empty'); b.dataset.v = ''; });
      for (let i = 0; i < 6; i++) {
        btns.forEach(b => { b.querySelector('b').textContent = 1 + Math.floor(Math.random() * 6); });
        if (i % 2 === 0) FX.sfx.roll();
        await sleep(45);
      }
    }
    for (let i = 0; i < 3; i++) {
      btns[i].innerHTML = tokHTML(vals[i]);
      btns[i].classList.remove('empty');
      btns[i].firstElementChild.classList.add('landed');
      btns[i].dataset.v = String(vals[i]);
      FX.sfx.settle();
      await sleep(55);
    }
    S.pool = vals;
    S.phase = 'play';
    busy = false;
    addLog(`🎲 Énergie : ${vals.join(' · ')}`);
    render();
  }

  // Points du tour = compétence + jeton posé dessous (base seule pour un emplacement vide).
  function computePts() {
    S.pts = ptsOf(S.slotDice);
  }

  // La tuile Portée ne reçoit jamais de jeton (tap ou dépôt).
  function rangeDeny() {
    deny('🏹 La Portée est fixe');
    FX.retrigger(tileEl('rng'), 'nope');
  }
  // Action sur le plateau avant d'avoir posé les 3 jetons : la réserve et la tuile guidée se signalent.
  function remindAssign() {
    deny('Placez d’abord vos 3 jetons');
    FX.retrigger($('#pool'), 'nudge');
    const g = curGuide();
    if (g >= 0) FX.retrigger(tileEl(SLOT_KEYS[g]), 'nope');
  }

  // Jetons verrouillés : secousse, vibration, message, et halo sur Annuler pour montrer la sortie.
  function lockedDeny(k) {
    deny('🔒 Annulez (↶) pour réattribuer les jetons');
    const t = $(`#statbar .st-tile[data-k="${k}"]`);
    if (t) FX.retrigger(t, 'nope');
    FX.retrigger($('#btn-undo'), 'halo');
  }

  // Avant chaque action : instantané pour Annuler, puis la 1re action verrouille les jetons.
  function beginAction() {
    undo.push(JSON.stringify({ hero: S.hero, monsters: S.monsters, pts: S.pts, kills: S.kills, pool: S.pool, slotDice: S.slotDice, locked: S.locked }));
    pending = null;
    drawPending();
    hideInfo();
    if (S.locked) return;
    S.locked = true;
    addLog(`Points du tour : 👢${S.pts.spd} 🗡️${S.pts.atk} 🛡️${S.pts.def}`);
  }
  function doUndo() {
    if (busy || S.phase !== 'play' || !undo.length) return;
    const snap = JSON.parse(undo.pop());
    Object.assign(S, snap);
    pending = null;
    buildEntities();
    FX.sfx.click();
    addLog(S.locked ? '↶ Action annulée' : '↶ Action annulée : dés à nouveau modifiables');
    render();
  }

  // Tap ou clic sur une case. Au doigt : 1er tap = aperçu, 2e tap sur la même case = déplacement.
  // À la souris : déplacement direct (l'aperçu vient du survol).
  function onTileTap(r, c, touch) {
    if (busy || !S || S.phase !== 'play' || !ready()) return;
    const d = reachCost(r, c);
    if (canReach(d)) {
      if (!touch || (pending && pending.r === r && pending.c === c)) { moveHero(r, c); return; }
      FX.sfx.select();
      FX.haptic('tick');
      setPending({ r, c });
      return;
    }
    if (pending) setPending(null);
    if (d > S.pts.spd && d < Infinity) {
      deny(isMobile() ? `Il faut ${d} 👢 (reste ${S.pts.spd})` : `Il faut ${d} points de Vitesse (il vous en reste ${S.pts.spd}).`);
    }
  }

  async function moveHero(r, c) {
    if (busy || !S || S.phase !== 'play' || !ready()) return;
    const { dist, prev } = E.heroReach(S);
    const d = dist[E.idx(r, c)];
    if (!canReach(d)) return;
    beginAction();
    S.pts.spd -= d;
    busy = true;
    FX.haptic('drop');
    render();
    const el = entEl('hero');
    for (const p of E.pathTo(prev, S.hero, { r, c })) {
      S.hero.r = p.r; S.hero.c = p.c;
      place(el, p);
      FX.hop(el);
      FX.sfx.step();
      await sleep(190);
    }
    busy = false;
    render();
  }

  async function onMonsterClick(id) {
    if (busy || !S || S.phase !== 'play' || !ready()) return;
    const m = S.monsters.find(x => x.id === id);
    if (!m) return;
    if (pending) setPending(null);
    if (!E.attackable(S).some(x => x.id === id)) {
      deny(E.rangeDist(S.hero, m) > S.skills.rng ? `Hors de portée (distance ${E.rangeDist(S.hero, m)}, portée ${S.skills.rng}).` : 'Pas de ligne de vue !');
      return;
    }
    if (S.pts.atk < S.def.def) { deny(`Il faut ${S.def.def} points d'Attaque (il vous en reste ${S.pts.atk}).`); return; }

    beginAction();
    S.pts.atk -= S.def.def;
    busy = true;
    render();
    const mEl = entEl(id);
    // Attaque propre à l'avatar (son, vibration et impact compris) : à distance au-delà de 2, sinon au corps à corps.
    await FX.attack(S.avatar, attackMode(S.hero, m), S.hero, m, { el: entEl('hero') });
    m.hp--;
    setHpBar(mEl.querySelector('.hp'), m.hp, S.def.hp);   // le cran perdu clignote dès l'impact
    FX.sfx.hit();
    FX.float('-1', m, 'dmg');
    FX.retrigger(mEl, 'hurt');
    if (m.hp <= 0) {
      S.monsters = S.monsters.filter(x => x !== m);
      S.kills++;
      FX.sfx.kill();
      FX.burst(m, ['#b38cff', '#ff5d73', '#ffd25a', '#fff'], 26, 90);
      mEl.classList.add('dying');
      addLog(`☠️ ${S.def.name} terrassé${S.def.key === 'spider' ? 'e' : ''} !`, 'good');
      await sleep(480);
      mEl.remove();
    } else {
      addLog(`🗡️ Touché ! ${S.def.name} : ${m.hp} PV`);
      await sleep(200);
    }
    busy = false;
    render();
    if (!S.monsters.length) levelComplete();
  }

  // Mode d'attaque : à distance au-delà d'une portée de 2, sinon au corps à corps (orthogonal adjacent).
  const attackMode = (a, b) => E.rangeDist(a, b) > 2 ? 'ranged' : 'melee';

  // Attaque d'un monstre (def) animée selon son issue, connue d'avance : bloquée (le projectile s'écrase
  // sur le bouclier, ou le coup est paré), dégâts partiels (bouclier fissuré) ou impact direct. Renvoie le bouclier.
  async function monsterAttack(def, m, el, guard) {
    const mode = attackMode(m, S.hero), shot = mode === 'ranged';
    // Le bouclier apparaît du côté de l'attaquant avant l'impact ; la tuile 🛡️ pulse avec lui.
    const sh = guard ? FX.shield(S.hero, m, guard === 'crack') : null;
    if (sh) { FX.sfx.shield(); FX.retrigger(tileEl('def'), 'guard'); await wait(140); }
    if (guard === 'block') {
      const clash = () => {
        sh.hit();
        FX.burst(sh.point, shot ? ['#bfe6ff', '#4fa8ff', '#fff'] : ['#fff', '#ffe08a', '#9fd8ff'], 14, 36);
        if (shot) FX.sfx.block(); else FX.sfx.clang();
        FX.haptic('tick');
      };
      await FX.attack(def.key, mode, m, S.hero, { el, speed, stop: shot ? sh.stop : 1, parry: shot ? null : clash });
      if (shot) clash();
      FX.float(`🗡️${def.atk}`, sh.point, 'atk');
    } else {
      await FX.attack(def.key, mode, m, S.hero, { el, speed });
      if (sh) { sh.hit(); FX.sfx.crack(); FX.burst(sh.point, ['#4fa8ff', '#fff'], 6, 26); }
      FX.sfx.thud();
      FX.float(`🗡️${def.atk}`, S.hero, 'atk');
    }
    return sh;
  }

  // Tour des monstres accéléré (×4) par un tap n'importe où, Espace ou le bouton principal.
  function accelerate() {
    if (!inMonsterTurn() || speed < 1) return;
    speed = 0.25;
    FX.haptic('tick');
    $('#board').classList.add('fast');
    renderControls();
    renderStatus();
  }

  async function endTurn() {
    if (busy || S.phase !== 'play') return;
    if (!ready()) { remindAssign(); return; }
    busy = true;
    undo = [];
    pending = null; dicePreview = '';
    drawPending();
    hideInfo();
    S.phase = 'mmove';
    render();
    const plan = E.planMonsters(S);
    if (bannersOn) await banner('monsters', { ico: S.def.emoji, title: 'TOUR DES MONSTRES', ms: 900 });
    await wait(250);
    for (const mv of plan.moves) {
      const m = S.monsters.find(x => x.id === mv.id), el = entEl(mv.id);
      if (!mv.path.length) continue;
      el.classList.add('active');
      for (const p of mv.path) {
        m.r = p.r; m.c = p.c;
        place(el, p);
        FX.hop(el, 190 * speed);
        FX.sfx.mstep();
        await wait(180);
      }
      el.classList.remove('active');
      await wait(90);
    }

    S.phase = 'mattack';
    render();
    await wait(250);
    const heroEl = entEl('hero');
    // Issue connue d'avance : bloquée (bouclier intact), dégâts partiels (bouclier fissuré),
    // ou défense inutile (Défense 1 : pas de bouclier, impact direct).
    const guard = !plan.attackers.length ? '' : plan.dmg === 0 ? 'block' : S.pts.def > 1 ? 'crack' : '';
    for (const id of plan.attackers) {
      const m = S.monsters.find(x => x.id === id), el = entEl(id);
      el.classList.add('active');
      const sh = await monsterAttack(S.def, m, el, guard);
      el.classList.remove('active');
      await wait(140);
      sh?.remove();
    }

    // Résultat : bandeau (toujours affiché), crans de vie vidés un par un en cas de dégâts.
    const formula = `${plan.total} 🗡️ <i class="op">÷</i> 🛡️ ${S.pts.def}`;
    if (!plan.attackers.length) {
      FX.float('Hors d’atteinte', S.hero, 'safe');
      addLog('😌 Aucun monstre ne vous atteint.');
      await banner('safe', { ico: '😌', title: 'HORS D’ATTEINTE', sub: 'Aucun monstre ne vous atteint', ms: 1200 });
    } else if (plan.dmg === 0) {
      FX.sfx.guard();
      FX.float('🛡️ Bloqué !', S.hero, 'block');
      FX.burst(S.hero, ['#4fd6ff', '#fff'], 14, 50);
      addLog(`🛡️ ${plan.total} d'attaque contre ${S.pts.def} de défense : aucun dégât !`, 'good');
      await banner('block', { ico: '🛡️', title: 'BLOQUÉ !', sub: `${formula} = 0 ❤️`, ms: 1200 });
    } else {
      S.dmgTaken += plan.dmg;
      FX.sfx.hurt();
      FX.haptic('hurt');
      FX.float(`-${plan.dmg} ❤`, S.hero, 'hurt');
      FX.retrigger($('#board-frame'), 'shake');
      FX.retrigger($('#vignette'), 'flash');
      FX.retrigger(heroEl, 'hurt');
      FX.retrigger($('#statbar .hprow'), 'hit');
      addLog(`💥 ${plan.total} d'attaque ÷ ${S.pts.def} de défense : −${plan.dmg} ❤`, 'bad');
      const drain = drainHp(plan.dmg);
      await banner('hurt', { ico: '💥', title: `−${plan.dmg} ❤️`, sub: `${formula} = −${plan.dmg} ❤️`, ms: 1200 });
      await drain;
    }
    render();
    await wait(200);
    S.totalTurns++;
    busy = false;
    if (S.hero.hp <= 0) return gameOver();
    S.turn++;
    startTurn();
  }

  // Crans de vie du héros vidés un par un (barre des stats et sprite), au rythme du tour des monstres.
  async function drainHp(n) {
    for (let i = 0; i < n && S.hero.hp > 0; i++) {
      S.hero.hp--;
      setHpBar($('#hero-hp'), S.hero.hp, 6);
      setHpBar(entEl('hero').querySelector('.hp'), S.hero.hp, 6);
      $('#hp-num').textContent = `${S.hero.hp}/6`;
      FX.sfx.drain();
      await sleep(Math.max(110, 260 * speed));
    }
  }

  async function levelComplete() {
    busy = true;
    S.phase = 'clear';
    S.totalTurns++;
    render();
    FX.sfx.level();
    FX.confetti(90);
    await banner('clear', {
      ico: '🏆', title: 'NIVEAU NETTOYÉ !', ms: 1700,
      sub: S.level === 12 ? 'Le Sceptre brille au fond de la salle…' : `Niveau ${S.level} · un instant de répit…`,
    });
    if (S.level === 12) return victory();
    showLevelUp();
  }

  function showLevelUp() {
    const opts = [
      { k: 'spd', title: '+1 Vitesse', desc: 'Plus de déplacements chaque tour.' },
      { k: 'atk', title: '+1 Attaque', desc: 'Plus de coups portés.' },
      { k: 'def', title: '+1 Défense', desc: 'Réduit les dégâts reçus.' },
      { k: 'rng', title: '+1 Portée', desc: 'Frappez de plus loin (3 = diagonale).' },
      { k: 'heal', title: 'Soin complet', desc: `Retour à 6 ❤ (actuellement ${S.hero.hp}).` },
    ];
    $('#rewards').innerHTML = opts.map((o, i) => {
      const icon = o.k === 'heal' ? '❤️‍🩹' : SKILLS[o.k].icon;
      const now = o.k === 'heal' ? '' : `<div class="cur">${S.skills[o.k]} → <b>${S.skills[o.k] + 1}</b></div>`;
      const dis = o.k === 'heal' && S.hero.hp === 6 ? 'disabled' : '';
      return `<button class="reward ${o.k}" data-k="${o.k}" style="animation-delay:${i * 0.07}s" ${dis}>
        <div class="r-ico">${icon}</div><div class="r-title">${o.title}</div>${now}<div class="r-desc">${o.desc}</div></button>`;
    }).join('');
    const nl = S.level + 1, nd = MONSTERS[GameData.levelKey(nl)], n = nd.spawns[nl].length;
    $('#next-preview').innerHTML = `Prochain niveau ${nl} : <b>${nd.emoji} ${n} ${n > 1 ? nd.plural : nd.name}</b>
      <span class="mini">❤️${nd.hp} 👢${nd.spd} 🗡️${nd.atk} 🛡️${nd.def} 🏹${nd.rng}</span>`;
    $$('#rewards .reward').forEach(b => b.addEventListener('click', () => chooseReward(b.dataset.k)));
    showOverlay('#ov-level');
  }

  function chooseReward(k) {
    if (k === 'heal') { S.hero.hp = 6; addLog('❤️‍🩹 Soins complets : 6 ❤', 'good'); }
    else { S.skills[k]++; addLog(`⬆️ ${SKILLS[k].name} passe à ${S.skills[k]}`, 'good'); }
    FX.sfx.settle();
    hideOverlay('#ov-level');
    busy = false;
    setupLevel(S.level + 1);
  }

  function recordScore(won) {
    const list = Store.get('ocd-hof', []);
    list.push({
      name: S.name, avatar: S.avatar, level: S.level, won, turns: S.totalTurns,
      daily: S.daily ? todayStr() : null, date: Date.now(),
    });
    list.sort((a, b) => (b.won - a.won) || (b.level - a.level) || (a.turns - b.turns));
    Store.set('ocd-hof', list.slice(0, 30));
  }

  function endScreen(won) {
    const stats = `<div class="end-stats">
      <div><b>${won ? 12 : S.level - 1}</b><small>niveaux finis</small></div>
      <div><b>${S.totalTurns}</b><small>tours</small></div>
      <div><b>${S.kills}</b><small>monstres tués</small></div>
      <div><b>${S.dmgTaken}</b><small>❤ perdus</small></div></div>`;
    $('#end-content').innerHTML = won
      ? `<div class="end-icon win">🔱</div><h2 class="modal-title">Victoire !</h2>
         <p class="sub">${S.avatar} ${S.name} brandit le Sceptre de M'Guf-yn. Le village est sauvé (ou votre frère maléfique vaincu, au choix).</p>${stats}
         <button class="btn primary big" id="btn-again">Rejouer</button>`
      : `<div class="end-icon lose">🪦</div><h2 class="modal-title">Vous êtes tombé·e…</h2>
         <p class="sub">${S.avatar} ${S.name} périt au niveau ${S.level}, face aux ${S.def.plural.toLowerCase()}.</p>${stats}
         <button class="btn primary big" id="btn-again">Rejouer</button>`;
    $('#end-content').insertAdjacentHTML('beforeend', '<button class="btn ghost" id="btn-change">Changer d’aventurier·e</button>');
    // Rejouer relance tout de suite avec le même nom, avatar et mode.
    $('#btn-again').addEventListener('click', () => { FX.sfx.level(); newGame(S.name); });
    $('#btn-change').addEventListener('click', () => { hideOverlay('#ov-end'); openStart(); });
    showOverlay('#ov-end');
  }

  async function gameOver() {
    busy = true;
    S.phase = 'over';
    render();
    FX.sfx.lose();
    entEl('hero').classList.add('dying');
    addLog('🪦 Votre aventure s’arrête ici.', 'bad');
    recordScore(false);
    await sleep(1100);
    busy = false;
    endScreen(false);
  }

  async function victory() {
    S.won = true;
    S.phase = 'over';
    render();
    FX.sfx.win();
    FX.confetti(220);
    recordScore(true);
    await sleep(600);
    busy = false;
    endScreen(true);
  }

  // ---------- Feuille du bas (mobile) : Menu ou Progression ----------
  let sheetOpener = null;
  const sheetOpen = () => $('#sheet').classList.contains('show');
  function openSheet(kind, btn) {
    if (!S || busy || sheetOpen()) return;
    sheetOpener = btn;
    fillSheet(kind);
    const sh = $('#sheet');
    sh.querySelector('.sheet').setAttribute('aria-label', kind === 'menu' ? 'Menu' : 'Progression');
    sh.inert = false;
    sh.classList.add('show');
    requestAnimationFrame(() => $('#btn-close-sheet').focus());
  }
  function closeSheet() {
    const sh = $('#sheet');
    if (!sheetOpen()) return;
    sh.classList.remove('show');
    sh.inert = true;
    if (sheetOpener?.isConnected) sheetOpener.focus();
  }
  function fillSheet(kind) {
    const body = $('#sheet-body');
    body.dataset.kind = kind;
    if (kind === 'menu') {
      body.innerHTML = `<h2 class="sheet-title">Menu</h2>
        <button class="sheet-row" role="switch" aria-checked="${oracleOn}" data-act="oracle"><span>🔮 Oracle</span><i class="sw"></i></button>
        <button class="sheet-row" role="switch" aria-checked="${FX.soundOn}" data-act="sound"><span>🔊 Son et vibrations</span><i class="sw"></i></button>
        <button class="sheet-row" role="switch" aria-checked="${bannersOn}" data-act="banners"><span>🎬 Bandeaux de phase</span><i class="sw"></i></button>
        <button class="sheet-row" data-act="rules"><span>📜 Règles</span><i>›</i></button>
        <h3 class="sheet-sub">Journal</h3>
        <div class="sheet-log">${$('#log').innerHTML}</div>`;
    } else {
      body.innerHTML = `<h2 class="sheet-title">Progression</h2>
        <div class="monster-card">${$('#monster-card').innerHTML}</div>
        <div class="track sheet-track">${$('#track').innerHTML}</div>`;
    }
  }

  function toggleOracle() {
    oracleOn = !oracleOn; Store.set('ocd-oracle', oracleOn);
    toast(oracleOn ? '🔮 Oracle activé' : 'Oracle désactivé : règles d’origine');
    if (S) render(); else $('#btn-oracle').classList.toggle('off', !oracleOn);
  }
  // Bandeaux de début de tour et de tour des monstres (ceux de niveau et de résultat restent).
  function toggleBanners() {
    bannersOn = !bannersOn; Store.set('ocd-banners', bannersOn);
    toast(bannersOn ? '🎬 Bandeaux de phase activés' : 'Bandeaux de phase désactivés');
    $('#btn-banners').classList.toggle('off', !bannersOn);
  }
  function toggleSound() {
    const on = FX.toggleSound();
    $('#btn-sound').textContent = on ? '🔊' : '🔇';
    if (on) FX.sfx.select();
  }

  // ---------- Accueil ----------
  // Style d'attaque de l'avatar : « Archère · flèches » (ligne sous les avatars et infobulle).
  const heroStyle = a => { const h = GameData.HEROES[a]; return h ? `${h.name} · ${h.style}` : ''; };
  function openStart() {
    const name = Store.get('ocd-name', '');
    $('#in-name').value = name;
    $('#avatars').innerHTML = AVATARS.map(a => `<button class="av ${a === avatar ? 'sel' : ''}" data-a="${a}" title="${heroStyle(a)}" aria-label="${heroStyle(a)}">${a}</button>`).join('');
    $('#av-style').textContent = heroStyle(avatar);
    $$('#avatars .av').forEach(b => b.addEventListener('click', () => {
      avatar = b.dataset.a; Store.set('ocd-avatar', avatar);
      $$('#avatars .av').forEach(x => x.classList.toggle('sel', x === b));
      $('#av-style').textContent = heroStyle(avatar);
      FX.sfx.select();
    }));
    const list = Store.get('ocd-hof', []).slice(0, 10);
    $('#hof').innerHTML = list.length
      ? list.map(e => `<li><span class="who">${e.avatar} ${escapeHTML(e.name)}</span>
          <span class="res">${e.won ? '🔱 Victoire' : `Niv. ${e.level}`}</span>
          <span class="turns">${e.turns} tours${e.daily ? ` · 📅${e.daily.slice(5)}` : ''}</span></li>`).join('')
      : '<li class="empty">Aucun exploit pour l’instant. Soyez le premier nom gravé ici !</li>';
    showOverlay('#ov-start');
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ---------- Événements ----------
  $('#btn-main').addEventListener('click', () => { if (!S) return; if (inMonsterTurn()) accelerate(); else endTurn(); });
  $('#btn-undo').addEventListener('click', doUndo);
  // Journal replié sur sa dernière ligne : clic (ou Entrée) pour déplier/replier.
  const toggleLog = () => {
    const open = $('#log').classList.toggle('open');
    $('#log').setAttribute('aria-expanded', open);
    $('#log').title = open ? 'Replier le journal' : 'Déplier le journal';
  };
  $('#log').addEventListener('click', toggleLog);
  $('#log').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLog(); } });

  // Plateau : un seul appui suivi à la fois. Appui long (450 ms, doigt) = infos ; glisser le héros = déplacement direct.
  let press = null;
  let suppressClickAt = -1e9;     // le click qui suit un appui long ou un glisser du héros est ignoré
  function tileAt(x, y) {
    const b = $('#tiles').getBoundingClientRect();
    const r = Math.floor((y - b.top) / b.height * 5), c = Math.floor((x - b.left) / b.width * 5);
    return r >= 0 && r < 5 && c >= 0 && c < 5 ? { r, c } : null;
  }
  $('#board').addEventListener('pointerdown', e => {
    if (press || !e.isPrimary || e.button > 0 || !S || S.phase !== 'play' || busy) return;
    const hero = e.target.closest('.ent.hero:not(.ghost)'), mon = e.target.closest('.ent.monster'), tile = e.target.closest('.tile');
    const p = { id: e.pointerId, touch: e.pointerType !== 'mouse', x0: e.clientX, y0: e.clientY };
    if (hero) {
      if (!ready()) return;          // le click qui suit rappelle d'attribuer les dés
      p.kind = 'hero';
      if (p.touch) e.preventDefault();
      try { hero.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
    } else if (mon || tile) {
      p.kind = 'info';
      if (p.touch) p.timer = setTimeout(() => {
        if (press !== p || busy || S.phase !== 'play') return;
        p.long = true;
        FX.haptic('tick');
        const m = mon && S.monsters.find(x => x.id === mon.dataset.id);
        if (m) showInfo(m);
        else if (tile) showInfo(null, { r: +tile.dataset.r, c: +tile.dataset.c });
      }, 450);
    } else return;
    press = p;
  });
  window.addEventListener('pointermove', e => {
    if (!press || e.pointerId !== press.id) return;
    const moved = Math.hypot(e.clientX - press.x0, e.clientY - press.y0);
    if (press.kind === 'info') {
      if (moved > 8 && !press.long) { clearTimeout(press.timer); press = null; }
      return;
    }
    if (!press.drag && moved < (press.touch ? 8 : 4)) return;
    if (busy || S.phase !== 'play') return;
    press.drag = true;
    const t = tileAt(e.clientX, e.clientY);
    if (!t || !canReach(reachCost(t.r, t.c))) { if (pending) setPending(null); }
    else if (!pending || pending.r !== t.r || pending.c !== t.c) setPending(t);
  });
  const endPress = cancelled => e => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    clearTimeout(p.timer);
    if (p.long) { hideInfo(); suppressClickAt = performance.now(); }
    if (p.kind === 'hero' && p.drag) {
      suppressClickAt = performance.now();
      const t = pending;
      if (!cancelled && t && canReach(reachCost(t.r, t.c))) moveHero(t.r, t.c);
      else setPending(null);
    }
  };
  window.addEventListener('pointerup', endPress(false));
  window.addEventListener('pointercancel', endPress(true));
  $('#board').addEventListener('click', e => {
    const skip = performance.now() - suppressClickAt < 400;
    suppressClickAt = -1e9;
    if (skip) return;
    if (S?.phase === 'play' && !busy && !ready()) { remindAssign(); return; }
    const touch = e.pointerType ? e.pointerType !== 'mouse' : coarse;
    const mon = e.target.closest('.ent.monster');
    if (mon) { onMonsterClick(mon.dataset.id); return; }
    if (e.target.closest('.ent.hero')) { if (pending) setPending(null); return; }
    const t = e.target.closest('.tile');
    if (t) onTileTap(+t.dataset.r, +t.dataset.c, touch);
  });
  // Souris : survol d'une case atteignable = aperçu (le clic déplace directement).
  $('#tiles').addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || press?.drag || !S || S.phase !== 'play' || busy || DiceDrag.active || !ready()) return;
    const t = e.target.closest('.tile');
    if (!t) return;
    const r = +t.dataset.r, c = +t.dataset.c;
    if (canReach(reachCost(r, c))) { if (!pending || pending.r !== r || pending.c !== c) setPending({ r, c }); }
    else if (pending) setPending(null);
  });
  $('#tiles').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !press?.drag && pending) setPending(null); });
  // Pas de menu contextuel du navigateur sur l'appui long
  ['#board', '#tray'].forEach(s => $(s).addEventListener('contextmenu', e => e.preventDefault()));
  // Tap n'importe où : accélère le tour des monstres, ou abandonne l'aperçu hors du plateau.
  document.addEventListener('pointerdown', e => {
    if (!S) return;
    if (inMonsterTurn()) accelerate();
    else if (pending && !e.target.closest('#board')) setPending(null);
  }, true);

  $('#btn-oracle').addEventListener('click', toggleOracle);
  $('#btn-sound').addEventListener('click', toggleSound);
  $('#btn-banners').addEventListener('click', toggleBanners);
  // Un tap sur le bandeau le passe (le tap accélère aussi le tour des monstres, voir plus haut).
  $('#banner').addEventListener('pointerdown', () => bannerSkip?.());
  $('#btn-help').addEventListener('click', () => showOverlay('#ov-help'));
  $('#btn-rules').addEventListener('click', () => showOverlay('#ov-help'));
  $('#btn-close-help').addEventListener('click', () => hideOverlay('#ov-help'));
  $('#ov-help').addEventListener('click', e => { if (e.target.id === 'ov-help') hideOverlay('#ov-help'); });

  // Feuille du bas : ⋯ (Menu), puce niveau (Progression) ; fermeture par le fond, ✕, Échap ou glisser vers le bas.
  $('#btn-menu').addEventListener('click', e => openSheet('menu', e.currentTarget));
  $('#btn-progress').addEventListener('click', e => openSheet('progress', e.currentTarget));
  $('#btn-close-sheet').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
  $('#sheet-body').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'oracle') { toggleOracle(); b.setAttribute('aria-checked', oracleOn); }
    else if (b.dataset.act === 'sound') { toggleSound(); b.setAttribute('aria-checked', FX.soundOn); }
    else if (b.dataset.act === 'banners') { toggleBanners(); b.setAttribute('aria-checked', bannersOn); }
    else if (b.dataset.act === 'rules') { closeSheet(); showOverlay('#ov-help'); }
  });
  (() => {
    const grip = $('#sheet-grip'), panel = $('#sheet .sheet');
    let g = null;
    grip.addEventListener('pointerdown', e => {
      if (g || !e.isPrimary) return;
      e.preventDefault();
      try { grip.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
      g = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0 };
      panel.style.transition = 'none';
    });
    grip.addEventListener('pointermove', e => {
      if (!g || e.pointerId !== g.id) return;
      g.dy = Math.max(0, e.clientY - g.y0);
      panel.style.transform = `translateY(${g.dy}px)`;
    });
    const end = e => {
      if (!g || e.pointerId !== g.id) return;
      const v = g.dy / Math.max(1, performance.now() - g.t0);
      const close = e.type === 'pointerup' && (g.dy > 60 || (g.dy > 20 && v > 0.5));
      g = null;
      panel.style.transition = '';
      panel.style.transform = '';
      if (close) closeSheet();
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  })();

  $$('.mode').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    $$('.mode').forEach(x => x.classList.toggle('sel', x === b));
    FX.sfx.select();
  }));
  const start = () => {
    const name = $('#in-name').value.trim() || 'Aventurière';
    Store.set('ocd-name', name);
    FX.sfx.level();
    newGame(name);
  };
  $('#btn-start').addEventListener('click', start);
  $('#in-name').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

  // Raccourcis : Espace/Entrée = Fin du tour (ou Accélérer), Z = Annuler, 1/2/3 = taps sur les dés,
  // Échap = annuler un glisser ou un aperçu, ou fermer une fenêtre. Sur un bouton ou un champ, on laisse l'action native.
  document.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea')) return;
    // Bandeau affiché : Espace, Entrée ou Échap le passe (et accélère le tour des monstres)
    if (bannerSkip && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      bannerSkip();
      accelerate();
      return;
    }
    if (e.key === 'Escape') {
      if (sheetOpen()) { closeSheet(); return; }
      if ($('#ov-help').classList.contains('show')) { hideOverlay('#ov-help'); return; }
      if (DiceDrag.active) { DiceDrag.cancel(); return; }
      if (pending) { setPending(null); return; }
    }
    if (!S || $('.overlay.show') || sheetOpen()) return;
    if (e.key === ' ' || e.key === 'Enter') {
      // Jeton ou tuile de la barre des stats (focus après un tap) : Espace finit le tour, Entrée reste le tap natif.
      const barBtn = e.target.closest?.('.pool-tok, .st-tile');
      if (barBtn ? e.key === 'Enter' : e.target.closest?.('button, [role="button"]')) return;
      e.preventDefault();
      if (inMonsterTurn()) accelerate(); else endTurn();
    } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') doUndo();
    else if (e.key === '1' || e.key === '2' || e.key === '3') {
      // Tap sur le jeton n de la réserve s'il y est encore, sinon sur la tuile n
      const n = +e.key - 1;
      DiceDrag.tap(S.pool[n] !== null ? { kind: 'pool', i: n } : { kind: 'slot', i: n });
    }
  });

  mobileMQ.addEventListener('change', () => { if (S) render(); });
  coarseMQ.addEventListener('change', () => { coarse = coarseMQ.matches; });

  // Accès de débogage : index.html?debug
  if (location.search.includes('debug')) {
    window.ocd = {
      get S() { return S; }, get speed() { return speed; }, set speed(v) { speed = v; }, get pending() { return pending; }, get busy() { return busy; },
      get bannerShown() { return !!bannerSkip; }, get dragActive() { return DiceDrag.active; },
      render, levelComplete, setupLevel, startTurn, endTurn, accelerate, banner, computePts,
      // Rejoue une attaque sans toucher à l'état : key = avatar ou clé de monstre, mode 'ranged' | 'melee',
      // blocked (monstres) : bouclier, projectile arrêté ou coup paré ; sp = vitesse (> 1 pour ralentir).
      async demoAttack(key, mode = 'ranged', blocked = false, sp = 1) {
        if (!S || busy) return 'occupé';
        const hero = S.hero, def = MONSTERS[key];
        const offs = mode === 'melee' ? [[0, 1], [0, -1], [1, 0], [-1, 0]] : [[0, 2], [0, -2], [2, 0], [-2, 0], [2, 2], [-2, -2], [2, -2], [-2, 2]];
        const [dr, dc] = offs.find(([r, c]) => hero.r + r >= 0 && hero.r + r < 5 && hero.c + c >= 0 && hero.c + c < 5);
        const foe = { r: hero.r + dr, c: hero.c + dc }, m0 = S.monsters[0], mEl = m0 && entEl(m0.id), hEl = entEl('hero');
        const emo = el => el?.querySelector('.emo'), old = [emo(hEl)?.textContent, emo(mEl)?.textContent];
        busy = true;
        if (mEl) { place(mEl, foe); emo(mEl).textContent = def ? def.emoji : S.def.emoji; }
        if (!def) emo(hEl).textContent = key;
        await sleep(250);
        if (def) {
          const was = speed;
          speed = sp;
          const sh = await monsterAttack(def, foe, mEl, blocked ? 'block' : '');
          await wait(140);
          sh?.remove();
          speed = was;
        } else {
          await FX.attack(key, mode, hero, foe, { el: hEl, speed: sp });
          FX.float('-1', foe, 'dmg');
          if (mEl) FX.retrigger(mEl, 'hurt');
        }
        await sleep(900);
        if (mEl) { place(mEl, m0); emo(mEl).textContent = old[1]; }
        emo(hEl).textContent = old[0];
        busy = false;
        return 'ok';
      },
    };
  }

  $('#btn-oracle').classList.toggle('off', !oracleOn);
  $('#btn-banners').classList.toggle('off', !bannersOn);
  $('#btn-sound').textContent = FX.soundOn ? '🔊' : '🔇';
  openStart();
})();
