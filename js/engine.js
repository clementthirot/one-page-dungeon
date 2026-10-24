// Règles pures : distances, ligne de vue, déplacements et IA des monstres.
// Un « monde » w = { walls:Set<idx>, hero:{r,c}, monsters:[{id,r,c,hp}], skills, pts, def }.
const Engine = (() => {
  'use strict';
  const N = 5;
  const DIRS = [[-1, 0, 2], [1, 0, 2], [0, -1, 2], [0, 1, 2], [-1, -1, 3], [-1, 1, 3], [1, -1, 3], [1, 1, 3]];
  const CORNERS = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const EPS = 1e-9;
  const idx = (r, c) => r * N + c;
  const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const same = (a, b) => a.r === b.r && a.c === b.c;
  const ALL = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) ALL.push({ r, c });

  // Portée = coût de déplacement le plus court sans obstacle (2 orthogonal, 3 diagonal).
  function rangeDist(a, b) {
    const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
    return 2 * Math.max(dr, dc) + Math.min(dr, dc);
  }

  function dijkstra(src, blocked) {
    const dist = Array(N * N).fill(Infinity), prev = Array(N * N).fill(-1), done = Array(N * N).fill(false);
    dist[idx(src.r, src.c)] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < N * N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = true;
      const ur = Math.floor(u / N), uc = u % N;
      for (const [dr, dc, w] of DIRS) {
        const r = ur + dr, c = uc + dc;
        if (!inB(r, c) || blocked(r, c)) continue;
        const v = idx(r, c);
        if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
      }
    }
    return { dist, prev };
  }

  function pathTo(prev, src, dst) {
    const path = [], s = idx(src.r, src.c);
    let v = idx(dst.r, dst.c);
    while (v !== s && v >= 0) { path.unshift({ r: Math.floor(v / N), c: v % N }); v = prev[v]; }
    return path;
  }

  // Le segment traverse-t-il l'intérieur (ouvert) de la case (bx, by) ? Liang-Barsky.
  function segHitsBox(x1, y1, x2, y2, bx, by) {
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - bx, bx + 1 - x1, y1 - by, by + 1 - y1];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < EPS) { if (q[i] <= EPS) return false; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
      }
    }
    return t1 - t0 > EPS;
  }

  // Ligne de vue : un segment d'un coin de a vers un coin de b sans traverser mur ni autre monstre.
  function los(walls, a, b, monsters) {
    const blockers = [];
    walls.forEach(v => blockers.push({ r: Math.floor(v / N), c: v % N }));
    for (const m of monsters) if (!same(m, a) && !same(m, b)) blockers.push(m);
    for (const [ai, aj] of CORNERS) for (const [bi, bj] of CORNERS) {
      const x1 = a.c + ai, y1 = a.r + aj, x2 = b.c + bi, y2 = b.r + bj;
      if (!blockers.some(o => segHitsBox(x1, y1, x2, y2, o.c, o.r))) return true;
    }
    return false;
  }

  function heroReach(w) {
    return dijkstra(w.hero, (r, c) => w.walls.has(idx(r, c)) || w.monsters.some(m => m.r === r && m.c === c));
  }

  function attackable(w) {
    return w.monsters.filter(m => rangeDist(w.hero, m) <= w.skills.rng && los(w.walls, w.hero, m, w.monsters));
  }

  function lexLess(a, b) {
    for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return true; if (a[i] > b[i]) return false; }
    return false;
  }
  function best(arr, keyFn) {
    let b = null, bk = null;
    for (const x of arr) { const k = keyFn(x); if (!b || lexLess(k, bk)) { b = x; bk = k; } }
    return b;
  }

  // Phase de mouvement + attaque des monstres, sans modifier w.
  function planMonsters(w) {
    const d = w.def, hero = w.hero;
    const ms = w.monsters.map(m => ({ ...m }));
    const order = [...ms].sort((a, b) => rangeDist(a, hero) - rangeDist(b, hero) || (a.id < b.id ? -1 : 1));
    const moves = [];
    for (const m of order) {
      const others = ms.filter(o => o !== m);
      const blocked = (r, c) => w.walls.has(idx(r, c)) || (r === hero.r && c === hero.c);
      const free = t => !blocked(t.r, t.c) && !others.some(o => same(o, t));
      const good = t => rangeDist(t, hero) <= d.rng && los(w.walls, t, hero, others);
      const D = dijkstra(m, blocked);
      const dist = t => D.dist[idx(t.r, t.c)];
      const tiles = ALL.filter(t => free(t) && dist(t) < Infinity);
      const reach = tiles.filter(t => dist(t) <= d.spd);

      let pick;
      const reachGood = reach.filter(good);
      if (reachGood.length) {
        // Priorité : être à portée et en vue, idéalement à portée maximale.
        pick = best(reachGood, t => [-rangeDist(t, hero), dist(t)]);
      } else {
        const allGood = tiles.filter(good);
        let toward;
        if (allGood.length) {
          const atMax = allGood.filter(t => rangeDist(t, hero) === d.rng);
          const target = atMax.length ? best(atMax, t => [dist(t)]) : best(allGood, t => [-rangeDist(t, hero), dist(t)]);
          toward = dijkstra(target, blocked);
        } else {
          toward = dijkstra(hero, (r, c) => w.walls.has(idx(r, c)));
        }
        pick = best(reach, t => [toward.dist[idx(t.r, t.c)], dist(t)]);
      }
      moves.push({ id: m.id, path: pathTo(D.prev, m, pick) });
      m.r = pick.r; m.c = pick.c;
    }
    const attackers = ms.filter(m => rangeDist(m, hero) <= d.rng && los(w.walls, m, hero, ms));
    const total = attackers.length * d.atk;
    const dmg = Math.floor(total / Math.max(1, w.pts.def));
    return { moves, final: ms, attackers: attackers.map(a => a.id), total, dmg };
  }

  return { N, idx, rangeDist, dijkstra, pathTo, los, heroReach, attackable, planMonsters };
})();
