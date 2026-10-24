// Données du jeu, transcrites de la carte « One Card Dungeon » (Barny Skinner).
// Grille 5x5, coordonnées [ligne, colonne], ligne 0 = haut de la carte.
// Chaque orientation de la carte = un type de monstre, utilisé sur 3 niveaux.
const GameData = {
  MONSTERS: {
    spider: {
      key: 'spider', name: 'Araignée', plural: 'Araignées', emoji: '🕷️', proj: '🕸️',
      hp: 2, spd: 5, atk: 4, def: 4, rng: 3, theme: 'sand',
      walls: [[1, 3], [3, 1], [3, 3]], stairs: [[4, 0], [0, 4]], start: [4, 0],
      spawns: { 1: [[0, 3], [2, 4]], 5: [[0, 1], [1, 4], [4, 4]], 9: [[0, 0], [2, 2], [3, 4], [4, 2]] },
    },
    skeleton: {
      key: 'skeleton', name: 'Squelette', plural: 'Squelettes', emoji: '💀', proj: '🦴',
      hp: 3, spd: 4, atk: 5, def: 4, rng: 4, theme: 'crypt',
      walls: [[2, 0], [2, 3], [3, 3]], stairs: [[0, 0], [4, 4]], start: [4, 4],
      spawns: { 2: [[0, 2], [1, 0]], 6: [[0, 1], [1, 1], [4, 0]], 10: [[0, 4], [1, 2], [2, 1], [3, 0]] },
    },
    brute: {
      key: 'brute', name: 'Brute', plural: 'Brutes', emoji: '👹', proj: null,
      hp: 5, spd: 3, atk: 7, def: 7, rng: 2, theme: 'sand',
      walls: [[1, 1], [1, 3], [3, 1]], stairs: [[4, 0], [0, 4]], start: [4, 0],
      spawns: { 3: [[1, 4]], 7: [[1, 2], [3, 4]], 11: [[0, 1], [0, 3], [2, 4]] },
    },
    dragon: {
      key: 'dragon', name: 'Dragon', plural: 'Dragons', emoji: '🐉', proj: '🔥',
      hp: 5, spd: 5, atk: 5, def: 5, rng: 5, theme: 'crypt',
      walls: [[1, 1], [2, 1], [2, 4]], stairs: [[0, 0], [4, 4]], start: [4, 4],
      spawns: { 4: [[0, 1]], 8: [[0, 3], [4, 1]], 12: [[1, 0], [1, 2], [3, 0]] },
    },
  },
  ORDER: ['spider', 'skeleton', 'brute', 'dragon'],
  AVATARS: ['🧝‍♀️', '🧙‍♂️', '🥷', '🦸‍♀️', '🧛', '🤺', '🧚', '🐱'],
  // Nom et style d'attaque de chaque avatar (accueil) ; les animations sont dans FX.ATTACKS.
  HEROES: {
    '🧝‍♀️': { name: 'Archère', style: 'flèches' },
    '🧙‍♂️': { name: 'Mage', style: 'arcanes' },
    '🥷': { name: 'Ninja', style: 'shurikens' },
    '🦸‍♀️': { name: 'Héroïne', style: 'rayon et poings' },
    '🧛': { name: 'Vampire', style: 'chauves-souris' },
    '🤺': { name: 'Escrimeur', style: 'lames' },
    '🧚': { name: 'Fée', style: 'poussière d’étoiles' },
    '🐱': { name: 'Chat', style: 'griffes' },
  },
  levelKey(l) { return this.ORDER[(l - 1) % 4]; },
};

// Stockage local tolérant aux navigateurs qui le bloquent.
const Store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignoré */ } },
};

// RNG à graine, pour que le « Défi du jour » donne les mêmes dés à tout le monde.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
