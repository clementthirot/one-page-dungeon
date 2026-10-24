**Statut : implémenté** (2026-10-24). Critères non satisfaits : aucun en émulation navigateur. À confirmer sur un vrai appareil tactile : 11 (ni défilement ni zoom au doigt), 18 (pas de menu contextuel natif à l'appui long, iOS compris), 19 (vibrations réelles, Android seulement), safe-area des écrans à encoche. Nuance sur 20 : un tour accéléré avec perte de ❤ dure un peu plus que ¼, à cause du minimum de 300 ms imposé par §5.

# Spécification mobile-first : One Card Dungeon

Auteur : agent `ux-designer`. Destinataire : agent développeur. Tout est **décidé** ; en cas de doute, appliquer la règle la plus simple compatible avec ce document.

**Constat à 375×812, après le lot 1** : la page fait 926 px de haut, donc on fait défiler. La carte du héros (dés) passe sous la barre d'action. L'en-tête, la piste des 12 niveaux et la carte du monstre prennent 143 px au-dessus du plateau. L'échange des dés exige deux taps précis sur des cases de 44 px.

**Objectif** : un tour complet sans défilement, sans zoom accidentel et sans texte à lire. Le pouce agit dans le tiers bas (dés et bouton). Le plateau se lit et se touche au milieu.

---

## 0. Portée et détection

| Notion | Règle |
|---|---|
| **Disposition mobile** | `@media (max-width: 600px)` (portrait) **ou** `(orientation: landscape) and (max-height: 500px)` (paysage, voir §6). Entre 601 et 920 px, on garde la disposition actuelle à une colonne, plus la barre collante. |
| **Mode tactile** | `const coarse = matchMedia('(pointer: coarse)').matches` (à réévaluer sur `change`). Ce booléen pilote la **confirmation du déplacement** (§3), pas la largeur d'écran. |
| **Plein écran du jeu** | En disposition mobile et en partie : `html, body { height: 100dvh; overflow: hidden; overscroll-behavior: none; }`. L'écran d'accueil et les fenêtres gardent leur défilement interne (`.overlay { overflow-y: auto }` existe déjà). |

Ajouter globalement :
```css
body { -webkit-tap-highlight-color: transparent; }
#app { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.tiles, .tile, .ent { touch-action: manipulation; }   /* pas de zoom au double tap */
.die-slot, .ent.hero { touch-action: none; }           /* le glisser ne fait pas défiler */
```
`#board` et `#tray` : `contextmenu` → `preventDefault()` (sinon l'appui long ouvre le menu du navigateur).

---

## 1. Disposition portrait

### 1.1 Zones (de haut en bas) : grille `#app` en `100dvh`

```css
#app {
  height: 100dvh; display: grid;
  grid-template-rows: auto 1fr auto auto auto; /* hud | plateau | statut | tiroir | barre */
  padding: env(safe-area-inset-top) 8px 0 8px;
}
```

| Zone | Hauteur | Contenu |
|---|---|---|
| **A. HUD** `.topbar` | 44 px | ❤×6 (14 px) · puce `🏹2` · puce niveau `🕷️ 3/12` · bouton `⋯` (44×44) |
| **B. Plateau** `.board-frame` | carré = `min(100vw − 16px, espace restant)`, voir 1.2 | plateau 5×5, cadre de 4 px |
| **C. Ligne de statut** `#oracle` | 28 px, hauteur réservée | Oracle, ou aperçu pendant un glisser, ou consigne (1 seule ligne, §4) |
| **D. Tiroir de dés** `#tray` (ex-`.hero-card`) | 104 px | 3 cases Vitesse / Attaque / Défense côte à côte |
| **E. Barre d'action** `.actions` | 60 px + `env(safe-area-inset-bottom)` | `[↶]` 60×48 · `[⏭ Fin du tour]` en pleine largeur restante, hauteur 48 |

Écarts : 6 px entre zones. La barre E reste dans le flux de la grille. Elle n'est plus en `position: fixed`, car la grille la cale déjà en bas. On supprime le `padding-bottom: 96px` de `.layout`.

### 1.2 Taille du plateau
```css
--chrome: calc(44px + 28px + 104px + 60px + 4 * 6px + env(safe-area-inset-top) + env(safe-area-inset-bottom));
.board-frame { width: min(100vw - 16px, 100dvh - var(--chrome), 560px); padding: 4px; justify-self: center; align-self: center; }
```

| Écran (CSS px) | Hauteur utile approx. | Plateau | Case | Bilan |
|---|---|---|---|---|
| 375×812 (iPhone X–13 mini, encoches 47/34) | 812 − 81 = 731 ; chrome 260 | **359 px** | 70 px | tient, ~110 px d'air |
| 390×844 (iPhone 12–15) | 844 − 81 = 763 | **374 px** | 73 px | tient, ~130 px d'air |
| 360×740 (Android, barre d'URL 56 px → `dvh` ≈ 684) | 684 − 260 = 424 | **344 px** | 68 px | tient, ~80 px d'air |

L'air restant est absorbé par `align-self: center` sur le plateau. Le tiroir et la barre restent collés en bas : le pouce ne cherche jamais.

### 1.3 Maquette 375×812

```
┌─────────────────────────────────────┐ ← safe-area-top
│ ❤❤❤❤❤🖤  🏹2      [🕷️ 3/12]   [ ⋯ ] │ A 44
├─────────────────────────────────────┤
│ ┌───┬───┬───┬───┬───┐               │
│ │🕷️❤3│   │▓▓▓│   │   │               │
│ ├───┼───┼───┼───┼───┤               │
│ │👢2│👢4│▓▓▓│🕷️ │   │   plateau     │ B 359
│ ├───┼───┼───┼───┼───┤   70 px/case  │
│ │🧝 │👢2│   │   │   │               │
│ ├───┼───┼───┼───┼───┤               │
│ │ ✓ │-1❤│   │   │   │               │
│ └───┴───┴───┴───┴───┘               │
├─────────────────────────────────────┤
│        🔮 Ici : ✓                    │ C 28
├─────────────────────────────────────┤
│ ┌─────────┐┌─────────┐┌─────────┐   │
│ │👢 Vitesse││🗡️ Attaque││🛡️ Défense│   │
│ │ 1 + [⚃] ││ 1 + [⚁] ││ 1 + [⚅] │   │ D 104  ← zone du pouce
│ │   = 5   ││  = 3 ·1 ││   = 7   │   │
│ │ ▓▓▓▓░░  ││ ▓▓░░░░  ││ tout tour│   │
│ └─────────┘└─────────┘└─────────┘   │
├─────────────────────────────────────┤
│ [ ↶ ] [      ⏭  Fin du tour      ]  │ E 60  ← zone du pouce
└─────────────────────────────────────┘ ← safe-area-bottom
```

### 1.4 Case du tiroir `.stat` (mobile)
Grille verticale, largeur `(100% − 2×6px) / 3` (≈ 114 px à 375), hauteur 104 px, rayon 12 px :
- ligne 1 (18 px) : icône + nom en 12 px, en gras ;
- ligne 2 (56 px) : `base` (pixel 18 px) · `+` · **dé 56×56** (le `.die-slot`) ;
- ligne 3 (24 px) : `= total` (pixel 24 px, or). Sous Attaque, ajouter `·N coups` en 11 px (N = ⌊pts/déf monstre⌋). Il s'affiche aussi pendant l'aperçu du glisser ;
- barre de 4 px en bas (existe, garder).

La ligne Portée (`.stat.fixed`) est **retirée du tiroir** sur mobile. Elle devient la puce `🏹2` du HUD.

---

## 2. Les dés : glisser-déposer (Pointer Events)

### 2.1 Modèle
- Les 3 dés **atterrissent directement** dans les 3 cases (inchangé depuis S1). Aucun geste n'est obligatoire.
- Le **tiroir est la rangée des 3 cases**. Pas de bac séparé : on garde zéro étape en plus.
- Pour changer, on **glisse un dé sur une autre case** : les deux dés s'échangent. Déposer sur sa propre case annule le geste.
- **Secours tap-tap** (existant) : un tap sélectionne, un tap sur une autre case échange, un tap sur le même dé désélectionne. On garde aussi le clavier : les `.die-slot` restent des `<button>`, et les touches `1`, `2`, `3` font la même chose que des taps (S14).

### 2.2 Machine à états (`js/game.js`, nouveau module `DiceDrag` dans le même IIFE)

```
idle ──pointerdown sur .die-slot (phase play, !busy)──▶ pressed
pressed ──move > SEUIL──▶ dragging       pressed ──pointerup──▶ tap → onSlotClick(i)
dragging ──move──▶ hitTest → setTarget(j|null)
dragging ──pointerup, target j≠i──▶ drop(i,j)    ──pointerup sinon / pointercancel / Échap──▶ cancel
```

| Paramètre | Valeur |
|---|---|
| Seuil de départ du glisser | **8 px** au toucher, **4 px** à la souris (`e.pointerType`) |
| Capture | `slot.setPointerCapture(e.pointerId)` au `pointerdown` ; écouter `pointermove/up/cancel` sur le slot |
| Défilement | `touch-action: none` sur `.die-slot` ; `e.preventDefault()` au `pointerdown` si `pointerType !== 'mouse'` |
| Zone de dépôt | **la case `.stat` entière**, agrandie de **12 px** de chaque côté (rects mis en cache au début du glisser). Hors de toutes les zones : on prend la case dont le centre est le plus proche si la distance au rect est < 40 px, sinon `null` |
| Multitouch | Ignorer tout `pointerdown` tant qu'un glisser est actif (`activePointerId`) |

### 2.3 Retours visuels pendant le glisser
1. **Fantôme** : clone du `.die` dans `#drag-layer` (`position: fixed; z-index: 70; pointer-events: none`), taille 64 px, `scale(1.15) rotate(-6deg)`, ombre `0 12px 24px #000c`. Il suit le pointeur via `transform: translate3d()` dans un `requestAnimationFrame`. **Décalage vertical : −36 px au toucher** (le dé reste visible au-dessus du doigt), 0 à la souris.
2. **Case d'origine** : le slot affiche un emplacement vide en pointillés (`.die-slot.lifted`, opacité du dé à 0).
3. **Case cible** (`.stat.drop-target`) : bordure or de 2 px, halo `0 0 0 3px #f5c45155, 0 0 18px #f5c451aa`, `translateY(-3px)`. Son dé actuel passe à 50 % d'opacité et glisse de 30 % vers la case d'origine : c'est l'annonce de l'échange.
4. **Aperçu des totaux** : dans les **deux** cases concernées, le total affiche `5 → 8` (nouvelle valeur en or, ancienne barrée en gris). Sous Attaque, `·N coups` est recalculé.
5. **Ligne de statut C** : `🎲 Vitesse 8 · Attaque 3 (1 coup)`, soit les deux compétences touchées par l'échange.
6. **Aperçu sur le plateau** : **oui**, recalculé **uniquement quand la cible change** (pas à chaque `pointermove`). On construit `pts` hypothétiques et on appelle la logique de `renderBoardState()` en lui passant ces `pts` (refactor : `renderBoardState(ptsOverride)`). Cases atteignables, badges Oracle et monstres frappables se mettent à jour. Ces éléments portent la classe `.preview` (contour en pointillés au lieu du trait plein) pour montrer que rien n'est encore joué. Sans cible, on revient à l'état réel.

### 2.4 Dépôt et annulation
- **Dépôt (i≠j)** : on échange `S.slotDice`, puis `computePts()` et `render()`. Animation FLIP : le fantôme vole vers le centre du slot j (160 ms, `cubic-bezier(.3,.7,.4,1)`), le dé de j part de sa position et vole vers i (160 ms). Ensuite, classe `swapped` (rebond existant). Son `settle` et haptique `drop`.
- **Annulation** : le fantôme revient vers i (140 ms) puis disparaît. Aucun son.
- Le menu contextuel, la sélection de texte et l'image fantôme native du navigateur sont désactivés (`draggable=false` et `user-select: none`).

### 2.5 Verrouillage (après la 1re action)
- `.die-slot.locked` : dé à 85 % d'opacité et petit cadenas 🔒 de 14 px en haut à droite de la case.
- `pointerdown` sur un dé verrouillé : pas de glisser. Le dé fait un `shake` de 250 ms, haptique `deny`, et la ligne C affiche `🔒 Annulez (↶) pour réarranger les dés`. Elle remplace le toast actuel sur mobile.
- Le bouton `↶` reçoit un halo pulsé pendant 1 s pour montrer la sortie.

---

## 3. Gestes sur le plateau

### 3.1 Déplacement : décision
| Contexte | Geste | Effet |
|---|---|---|
| **Tactile** (`coarse`) | **1er tap** sur une case atteignable | **Aperçu** : héros fantôme à 50 % sur la case, pastilles du chemin (points blancs de 8 px), case encadrée de blanc. Ligne C : `👢 −4 · Sur cette case : −1 ❤` |
| | **2e tap sur la même case** | **Déplacement** (animation existante) |
| | Tap sur une autre case atteignable | L'aperçu se déplace sur cette case |
| | Tap sur une case non atteignable, sur le héros ou hors plateau | Fin de l'aperçu. Si la case est hors de portée de Vitesse : ligne C `Il faut 6 👢 (reste 4)` + haptique `deny` |
| | **Glisser le héros** (seuil 8 px) vers une case atteignable puis lâcher | Déplacement **direct, sans confirmation** (le geste est délibéré). Pendant le glisser, même aperçu que le 1er tap, mis à jour à chaque changement de case. Lâcher ailleurs annule |
| **Souris** (`fine`) | survol | Aperçu (même rendu que le 1er tap tactile) |
| | clic | Déplacement direct (comportement actuel) |

L'aperçu est perdu dès qu'une autre action se produit (dé, attaque, Annuler, Fin du tour). Variable `pending = {r,c} | null`.

### 3.2 Attaque
- **Tap ou clic sur un monstre `.target`** : attaque **immédiate**, sans confirmation. L'intention est claire (cible marquée `🗡️N`) et `↶` la rattrape.
- Tap sur un monstre non frappable (`.target-dim`, hors de portée ou sans ligne de vue) : la ligne C donne la raison (texte actuel du toast) et haptique `deny`.
- Zone tactile d'un monstre : toute sa case (70 px). Mettre `.ent.monster { pointer-events: auto }` sur toute la largeur de `.ent` (déjà 20 %).

### 3.3 Appui long (infos) : 450 ms, annulé si le doigt bouge de plus de 8 px
| Cible | Effet | Fin |
|---|---|---|
| **Monstre** | Bulle au-dessus de lui (pas une fenêtre) : `🕷️ Araignée · ❤2/3 · 👢2 🗡️3 🛡️2 🏹3`, plus la **zone de menace** : cases d'où ce monstre pourra vous frapper, teintées de rouge à 25 % (calcul : `E.rangeDist` ≤ portée et `E.los`, depuis sa position actuelle) | au relâcher |
| **Case vide** | Bulle : `Ici : −2 ❤ (🕷️🕷️ · 6 🗡️ ÷ 3 🛡️)`, ou `✓ hors d'atteinte`. Elle s'appuie sur `predict()` et vaut aussi pour une case non atteignable | au relâcher |
| **Héros** | Rien (le glisser du héros a la priorité) | n/a |

L'appui long ne déclenche **jamais** d'action : au relâcher après un appui long, le `click` qui suit est ignoré (drapeau `suppressClick`). Haptique `tick` au déclenchement. À la souris, le survol d'un monstre affiche la même bulle (pas d'appui long nécessaire).

### 3.4 Balayages
**Aucun balayage sur le plateau** : il entrerait en conflit avec les glisser. Le seul balayage du jeu sert à fermer la feuille du bas (§4.3).

### 3.5 Retour haptique
Module `FX.haptic(kind)` dans `js/fx.js`, actif seulement si `FX.soundOn && 'vibrate' in navigator`. Il n'existe pas sur iOS Safari : on n'appelle rien dans ce cas, sans plantage. Le bouton Son devient **« Son et vibrations »**, avec un seul réglage.

| kind | motif (ms) | déclencheur |
|---|---|---|
| `tick` | 6 | prise d'un dé, début de l'appui long, 1er tap d'aperçu |
| `drop` | 12 | dépôt ou échange de dés, déplacement confirmé |
| `hit` | 18 | votre attaque touche |
| `hurt` | [30, 40, 30] | vous perdez des ❤ |
| `deny` | [10, 30, 10] | action refusée, dé verrouillé |

---

## 4. Ce qu'on retire ou déplace sur mobile

| Élément | Mobile | Où va l'info |
|---|---|---|
| Logo « One Card Dungeon » | **masqué** en partie | reste sur l'écran d'accueil |
| Puces Niveau et Tour | **fusionnées** en une puce `🕷️ 3/12` (emoji du monstre du niveau + niveau). Le n° de tour disparaît du HUD | tour visible dans le journal |
| Piste des 12 niveaux `#track` | **masquée** | feuille du bas « Progression », ouverte par un tap sur la puce `🕷️ 3/12` |
| Carte du monstre `#monster-card` | **masquée** | appui long sur un monstre (§3.3) + feuille « Progression » (stats complètes en tête) |
| Cœurs dans `.hero-card` | déplacés dans le **HUD** (14 px, 6 cœurs) | n/a |
| Ligne Portée | puce `🏹2` dans le HUD | n/a |
| Boutons 🔮 🔊 📜 | regroupés dans **`⋯`** | feuille « Menu » |
| Journal `#log` | **masqué** | feuille « Menu » → section Journal (40 dernières lignes, déplié) |
| Consigne `#hint` | **fusionnée** dans la ligne C | voir priorité ci-dessous |
| Toasts `#toast` | **remplacés** par la ligne C sur mobile (2 s puis retour à l'Oracle) | n/a |

### 4.1 Ligne de statut C : priorité d'affichage (une seule ligne, 14 px, ellipse)
1. Aperçu de glisser de dé (§2.3) ou de déplacement (§3.1) ;
2. Message temporaire (ancien toast) pendant 2 s ;
3. Consigne d'apprentissage, **seulement aux 2 premiers tours de la 1re partie** (`Store` `ocd-coach`) : tour 1 `Glissez un dé sur une autre case pour l'échanger`, tour 2 `Touchez une case verte, puis touchez-la encore pour y aller` ;
4. Oracle `🔮 Ici : ✓ / −N ❤` (si 🔮 actif) ;
5. Vide (la hauteur reste réservée).

Pendant le tour des monstres, la ligne affiche `👹 Les monstres agissent · touchez pour accélérer`.

### 4.2 Bouton principal
Libellés : `⏭ Fin du tour` (phase play), `⏩ Accélérer` (tour des monstres, §5), `🎲…` (lancer, désactivé). Le sous-libellé `#hint` disparaît sur mobile.

### 4.3 Feuille du bas `#sheet` (un seul composant, deux contenus)
- `position: fixed; bottom: 0; max-height: 70dvh;` coins supérieurs de 18 px, poignée de 36×4 px, `padding-bottom: env(safe-area-inset-bottom)`, défilement interne. Fond `#07040b99` derrière.
- Ouverture : montée de 220 ms. Fermeture : tap sur le fond, bouton ✕ de 44 px, Échap, ou **glisser la poignée vers le bas de plus de 60 px** (ou vitesse > 0,5 px/ms).
- Même gestion `inert` et focus que `showOverlay`/`hideOverlay`. Le jeu n'est pas en pause, mais l'ouverture est impossible si `busy`.
- **Menu** (`⋯`) : interrupteurs `🔮 Oracle` et `🔊 Son et vibrations` (lignes de 48 px), `📜 Règles` (ouvre la fenêtre existante), puis **Journal** en dessous.
- **Progression** (puce niveau) : la carte monstre actuelle (stats) puis la piste des 12 niveaux, en grille 7×2 de cases de 40 px.

---

## 5. Tour des monstres : accélérer
- Ajouter `let speed = 1;` et remplacer, **dans `endTurn()` et `FX.projectile/lunge`** (paramètre de durée), chaque `sleep(ms)` par `wait(ms)` avec `const wait = ms => sleep(ms * speed)`.
- Pendant les phases `mmove` et `mattack` : **un tap n'importe où** (plateau, tiroir, bouton principal `⏩ Accélérer`) met `speed = 0.25` jusqu'à la fin du tour, avec haptique `tick`. Un 2e tap ne fait rien de plus.
- `speed = 1` est remis à chaque `startTurn()`. La perte de ❤ (flottant, secousse, vibration) reste toujours visible, même accélérée : durée minimale de 300 ms pour cette séquence.
- Desktop : clic n'importe où, ou Espace, avec le même effet.

---

## 6. Tailles, typographie, safe-area, paysage, PWA

### 6.1 Cibles et texte
- Cibles **≥ 44×44 px** : `⋯`, puce niveau (hauteur 32 visible, zone tactile étendue à 44 par `padding` ou `::before`), `↶` 60×48, Fin du tour 48 de haut, dés 56×56, cases du plateau ≥ 68 px.
- Texte : **12 px minimum** (nom des compétences, `·N coups` à 11 px toléré). Chiffres de jeu en `--pixel` : totaux 24 px, base 18 px. La ligne C fait 14 px.
- Les dés restent repérables par la forme, pas seulement la couleur : verrouillé = 🔒, aperçu = pointillés.

### 6.2 Safe-area
`viewport-fit=cover` est déjà là. Haut : `#app { padding-top: env(safe-area-inset-top) }`. Bas : barre E `padding-bottom: env(safe-area-inset-bottom)`. Côtés en paysage : `padding-left/right: max(8px, env(safe-area-inset-left/right))`.

### 6.3 Paysage (`(orientation: landscape) and (max-height: 500px)`) : **disposition côte à côte**, pas d'avertissement
```
┌──────────────────────────────────────────────────────────┐
│ ┌────────────────────┐  ❤❤❤❤❤🖤 🏹2  [🕷️ 3/12]  [⋯]      │
│ │                    │  🔮 Ici : ✓                         │
│ │   plateau          │  ┌───────┐┌───────┐┌───────┐       │
│ │   100dvh − 16      │  │👢 1+⚃=5││🗡️ 1+⚁=3││🛡️ 1+⚅=7│       │
│ │                    │  └───────┘└───────┘└───────┘       │
│ │                    │  [ ↶ ] [     ⏭ Fin du tour     ]    │
│ └────────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```
`#app { grid-template-columns: auto 1fr; grid-template-rows: auto auto 1fr auto; }`. Le plateau occupe toute la colonne 1 (`width: calc(100dvh − 16px)`). Le tiroir est aligné en bas de la colonne 2, juste au-dessus de la barre (zone du pouce droit).

### 6.4 PWA légère : seulement ceci, dans `<head>`
```html
<meta name="theme-color" content="#120d18">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="One Card Dungeon">
```
Pas de manifeste ni de service worker pour l'instant : il faudrait des icônes et une stratégie de cache. Ce n'est pas utile pour jouer.

---

## 7. Desktop : ce qui doit continuer de marcher
- Mise en page à 2 colonnes inchangée (> 920 px) : piste, carte monstre, journal, cœurs dans le panneau, boutons 🔮 🔊 📜 visibles. La ligne Portée reste dans le panneau.
- **Glisser-déposer des dés à la souris** : même code Pointer Events (seuil 4 px, pas de décalage vertical du fantôme), aperçu plateau identique. Le clic-clic reste possible, ainsi que les touches 1/2/3.
- **Survol** d'une case = aperçu, **clic** = déplacement direct (pas de confirmation). Le glisser du héros fonctionne aussi à la souris.
- Survol d'un monstre = bulle d'infos et zone de menace (équivaut à l'appui long).
- Raccourcis : Espace/Entrée = Fin du tour (ou Accélérer pendant le tour des monstres), Z/Retour arrière = Annuler, Échap = annuler un glisser ou un aperçu, ou fermer une fenêtre.
- Les toasts restent sur desktop. La ligne C remplace les toasts seulement en disposition mobile.

---

## 8. Critères d'acceptation

**Disposition**
1. À 375×812, 390×844 et 360×740 (preset du navigateur, `?debug`), en phase play : `document.documentElement.scrollHeight <= innerHeight` et aucun défilement possible au doigt.
2. Le HUD, le plateau entier, la ligne C, les 3 cases du tiroir et la barre d'action sont visibles, et aucun ne se chevauche (rects disjoints).
3. Le plateau mesure ≥ 340 px de côté sur les trois tailles. Le bas de la barre E est à ≤ `innerHeight − safe-area-bottom`.
4. Sur mobile, `#track`, `#monster-card`, `#log`, `.logo`, `#hint` et la ligne Portée sont `display: none`. Les cœurs et `🏹N` sont dans le HUD.
5. Toutes les cibles interactives du jeu mesurent ≥ 44×44 px (vérifié par `getBoundingClientRect` sur `button, .die-slot, .tile.reach, .ent.target`).
6. En paysage 812×375, la disposition est côte à côte, sans défilement, avec le plateau ≥ 340 px.

**Dés**
7. Glisser un dé de Vitesse sur Attaque, puis lâcher, échange les deux valeurs. Les totaux, les cases atteignables et les monstres frappables sont à jour après le dépôt.
8. Un déplacement < 8 px (toucher) suivi d'un relâcher compte comme un tap : le tap-tap échange toujours.
9. Pendant le glisser : le fantôme suit le pointeur (36 px au-dessus du doigt au toucher), la case survolée porte `.drop-target`, les deux totaux montrent `a → b`, et le plateau affiche les cases atteignables **hypothétiques** en `.preview`.
10. Lâcher hors zone ou `pointercancel` ramène le dé, sans changer l'état (`S.slotDice` identique).
11. Glisser un dé ne fait jamais défiler ni zoomer la page.
12. Après la 1re action, un dé est verrouillé : pas de glisser, 🔒 visible, message dans la ligne C. Après `↶` jusqu'au début du tour, les dés se glissent de nouveau.
13. Le Défi du jour donne les mêmes dés qu'avant (le glisser ne consomme pas `rand`).

**Plateau**
14. Tactile : un 1er tap sur une case verte n'effectue pas de déplacement et affiche le héros fantôme, le chemin et le coût. Un 2e tap sur la même case déplace le héros. Un tap ailleurs annule l'aperçu.
15. Glisser le héros sur une case verte le déplace sans confirmation. Le lâcher ailleurs ne fait rien.
16. Souris : un clic sur une case verte déplace directement.
17. Un tap sur un monstre `.target` attaque aussitôt. Sur un monstre non frappable, la raison s'affiche dans la ligne C.
18. Un appui long de 450 ms sur un monstre affiche ses stats et sa zone de menace, sans attaquer. Un appui long sur une case affiche les dégâts prévus. Aucun menu contextuel du navigateur ne s'ouvre.
19. Si `navigator.vibrate` existe et que le son est actif, les vibrations suivent le tableau §3.5. Avec le son coupé, `vibrate` n'est jamais appelé.

**Tour des monstres et feuilles**
20. Pendant le tour des monstres, un tap réduit par 4 la durée restante de l'animation. Le tour suivant reprend à vitesse normale.
21. `⋯` ouvre une feuille avec l'Oracle, le son, les règles et le journal. La puce niveau ouvre la feuille Progression. Glisser vers le bas de plus de 60 px, ou toucher le fond, les ferme. Le focus revient au bouton d'ouverture.

**Non-régression desktop (1280×800)**
22. La disposition, les raccourcis clavier, le clic direct sur les cases et le clic-clic sur les dés sont inchangés. Le glisser-déposer à la souris fonctionne.
23. Aucune erreur dans la console sur un niveau complet, joué au toucher (preset mobile) puis à la souris.
