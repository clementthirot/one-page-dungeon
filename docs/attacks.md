# Animations d'attaque par personnage

Statut : implémenté (réserves : durées totales mesurées entre 450 et ~720 ms, l'araignée à distance dépasse un peu 700 ms à cause des 400 ms de toile collée ; `prefers-reduced-motion` vérifié dans une iframe qui simule la préférence, pas avec le réglage système ; sons et vibrations non écoutés ni ressentis ; fluidité mesurée en émulation mobile sur ordinateur, pas sur un vrai téléphone ; le rocher de la brute n'est jamais utilisé en jeu, portée 2). Débogage : `ocd.demoAttack(clé, 'ranged' | 'melee', bloqué, vitesse)` avec `?debug`. Complète `ui-v3.md`, qui garde ses règles : bouclier, parade, bandeaux.

## Principe
- Chaque avatar du héros et chaque monstre a une attaque **à distance** et une attaque **au corps à corps**. Le choix se fait comme aujourd'hui :
  - distance (`rangeDist`) > 2 : à distance ;
  - sinon : au corps à corps (orthogonal adjacent).
- Chaque attaque se déroule en 3 temps : **préparation** (~120 ms), **trajet ou geste** (~200–350 ms), **impact** (~250 ms). Durée totale ≤ 700 ms. Elle suit l'accélération du tour des monstres et `prefers-reduced-motion` (version courte : impact seul).
- Chaque attaque a un **son** propre (variante WebAudio courte dans `FX.sfx`) et une **vibration** (`FX.haptic('hit')`).
- **Aucun changement de règle.** Ce sont des effets visuels uniquement. Le bouclier et la parade de `ui-v3` restent prioritaires quand le coup est bloqué : le projectile spécifique s'écrase sur le bouclier.

## Héros (selon l'avatar choisi)

| Avatar | Nom | À distance | Corps à corps | Impact |
|---|---|---|---|---|
| 🧝‍♀️ | Archère | flèche fine en ligne droite, avec une traînée verte | coup de dague rapide en arc | flèche plantée qui vibre, puis éclats verts |
| 🧙‍♂️ | Mage | orbe ✨ violette en légère courbe, traînée d'étincelles | décharge ⚡ du bâton (éclair zigzag en SVG) | explosion arcanique en anneau |
| 🥷 | Ninja | shuriken qui tourne vite | ruée : traînée d'images rémanentes vers la cible, puis retour | trois entailles blanches en X |
| 🦸‍♀️ | Héroïne | rayon d'énergie (trait lumineux qui s'étire puis s'éteint) | coup de poing 💥 avec onde de choc | onde circulaire et secousse légère du plateau |
| 🧛 | Vampire | nuée de 3 🦇 en vol ondulant | morsure : flash rouge et gouttes qui remontent vers le héros | particules rouges aspirées vers le héros |
| 🤺 | Escrimeur | lame 🗡️ lancée en rotation | triple estoc rapide (3 petites fentes) | 3 points d'impact lumineux |
| 🧚 | Fée | poussière 🌟 en spirale | tourbillon de paillettes autour de la cible | pluie d'étoiles |
| 🐱 | Chat | empreinte 🐾 qui avance par bonds en arcs | coup de griffe | 3 griffures diagonales (traits clip-path) |

- Dans l'écran d'accueil, sous l'avatar sélectionné, afficher une petite ligne « Archère · flèches », qui sert aussi d'infobulle.

## Monstres

| Monstre | À distance | Corps à corps | Impact |
|---|---|---|---|
| 🕷️ Araignée | jet de toile 🕸️ qui s'étire | morsure : bond court et crochets | toile qui reste collée 400 ms sur le héros |
| 💀 Squelette | os 🦴 lancé en rotation, en arc | coup d'épée rouillée en arc | éclats d'os |
| 👹 Brute | rocher 🪨 lancé en cloche (portée 2 seulement : utilisé si un jour la portée change, sinon jamais) | **coup au sol** : la brute saute, retombe, une onde de choc part et le plateau tremble | fissures au sol sous le héros |
| 🐉 Dragon | **souffle de feu** : cône de 5 à 7 🔥 qui partent en éventail vers le héros | coup de griffe et de queue | brûlure orange, puis fumée |

## Implémentation
- Centraliser dans `fx.js` une table `ATTACKS` : clé = avatar ou monstre, valeur = `{ ranged(from, to, opts), melee(el, from, to, opts) }`. Chaque fonction renvoie une `Promise` et accepte `{ speed, stop }` : `stop` = point d'arrêt sur le bouclier quand le coup est bloqué.
- Réutiliser `projectile`, `lunge`, `burst` et `float` en les enrichissant :
  - trajectoire en courbe (paramètre `arc`) ;
  - rotation ;
  - traînée (petites particules semées pendant le vol) ;
  - éléments SVG (éclair, griffures, entailles) dans la couche `#fx`.
- `game.js` appelle `FX.attack(key, mode, …)` au lieu d'appeler `projectile` ou `lunge` directement.
- Garder du code lisible : une petite fonction par attaque, sans dupliquer la mécanique commune.

## Critères d'acceptation
1. Les 8 avatars ont chacun une attaque à distance et une attaque au corps à corps visuellement distinctes, avec un son distinct.
2. Les 4 monstres ont leur attaque propre. Le souffle du dragon et le coup au sol de la brute sont spectaculaires mais durent moins de 700 ms.
3. Quand le coup est bloqué, l'attaque spécifique s'arrête sur le bouclier. Quand il est paré, le geste s'interrompt.
4. Accélération du tour des monstres et `prefers-reduced-motion` : les durées sont réduites, et rien ne reste affiché après coup.
5. Aucun élément `#fx` résiduel après 20 attaques (vérifier `#fx` vide au repos). Pas de baisse de fluidité notable sur mobile.
6. L'accueil affiche le style d'attaque de l'avatar choisi.
7. Console sans erreur. Règles et Défi du jour inchangés.
