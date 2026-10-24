# UI v2 : énergie, stats unifiées, barres de vie

Statut : implémenté (2026-10-24). Critères 1 à 11 vérifiés en émulation navigateur (375×812, 390×844, 360×740, 1280×800). Réserves : gestes et vibrations à confirmer sur un vrai appareil tactile ; sur mobile, la barre de vie du héros est masquée pendant l'attribution (elle reste visible sur le plateau), puisque la barre d'attribution prend la place de la barre des stats. Ce document complète `mobile-ux.md`. En cas de conflit, c'est lui qui prime.

## Retours du joueur (à l'origine de ce document)
- Sur mobile, les dés doivent avoir une barre dédiée en début de tour pour les attribuer à une stat, par glisser ou en tapant stat après stat.
- Les zones de stats sont trop complexes. Il faut un code couleur et lier chaque dé à une icône (par exemple le dé dans un bouclier pour la Défense).
- Sur le plateau, les monstres ont des dés de vie comme le joueur, ce qui n'est pas clair. Une barre de vie en crans serait plus simple.
- On peut s'éloigner du principe du dé si l'UX y gagne.
- Toutes les stats doivent être au même endroit.

## 1. Code couleur et jetons (partout : panneau, plateau, règles, récompenses)

| Stat | Couleur | Forme du jeton | Icône |
|---|---|---|---|
| Vitesse | vert `#4ade80` | botte / chevron (clip-path) | 👢 |
| Attaque | rouge-orange `#ff6b4a` | épée / losange | 🗡️ |
| Défense | bleu `#4fa8ff` | bouclier (clip-path écu) | 🛡️ |
| Portée | violet `#b38cff` | cible / cercle | 🏹 |
| Vie | rose-rouge `#ff4d6d` (héros : vert-cyan) | barre en crans | ❤ |

- Définir ces couleurs en variables CSS : `--c-spd`, `--c-atk`, `--c-def`, `--c-rng`, `--c-hp`.
- **Jeton d'énergie** : le résultat du dé n'a plus de points. C'est un **chiffre** (1 à 6, gros, en police pixel) dans un jeton :
  - neutre tant qu'il n'est pas attribué : doré, en forme de dé arrondi ;
  - une fois attribué, il prend **la forme et la couleur de la stat** : chiffre dans un bouclier bleu pour la Défense, dans un losange rouge pour l'Attaque, dans un chevron vert pour la Vitesse.
- Les badges du plateau reprennent ces couleurs :
  - coût de déplacement sur une case : pastille verte « 👢3 » ;
  - coût d'attaque sur un monstre : pastille rouge « 🗡️4 » ;
  - dégâts prévus : pastille rose « −2❤ » ;
  - case sûre : ✓ discret.

## 2. Barre d'énergie dédiée en début de tour

Au début de chaque tour, après le lancer automatique, une **barre d'attribution** s'affiche (sur mobile, à la place de la barre des stats ; sur ordinateur, dans le panneau). Elle contient :
- **la réserve** : les 3 jetons neutres tirés, côte à côte, gros (≥ 56 px) ;
- **les 3 emplacements** Vitesse / Attaque / Défense, chacun avec sa couleur, son icône, sa base (« 1 + ? ») et le total.

Deux façons d'attribuer, toujours disponibles :
- **Glisser** un jeton de la réserve sur un emplacement, ou d'un emplacement à un autre (les deux s'échangent). On garde le moteur Pointer Events existant (seuils, fantôme, aperçu sur le plateau pendant le survol).
- **Taper stat après stat** :
  - un guide « Choisissez votre dé de 👢 Vitesse » met l'emplacement Vitesse en surbrillance ;
  - le joueur tape un jeton de la réserve, qui vole dans l'emplacement (animation d'environ 200 ms) ;
  - le guide passe à 🗡️ Attaque ; le **dernier jeton est posé automatiquement en 🛡️ Défense** ;
  - au total : 2 taps.
- Taper un emplacement déjà rempli renvoie son jeton dans la réserve, et le guide revient sur cette stat.

Pendant l'attribution :
- le plateau montre en direct les cases atteignables et les monstres frappables, calculés avec les jetons déjà posés (base seule pour un emplacement vide) ;
- la ligne de statut indique la menace.

Quand les 3 jetons sont posés :
- la barre se replie, en animation, dans la **barre des stats unifiée** (§3) ;
- les jetons restent visibles dans leurs couleurs ;
- tant qu'aucune action n'est faite, taper une stat de la barre unifiée rouvre la barre d'attribution ;
- après la première action, les jetons sont verrouillés, avec le même comportement qu'aujourd'hui (🔒, ↶ pour déverrouiller).

On peut agir (bouger, frapper) seulement une fois les 3 jetons posés. Avant cela :
- un tap sur le plateau rappelle « Attribuez d'abord vos dés » ;
- le bouton principal reste « ⏭ Fin du tour » mais il est désactivé ;
- son sous-libellé indique la consigne.

## 3. Une seule barre des stats (toutes les stats au même endroit)

Un bloc unique, lisible d'un coup d'œil, qui remplace les cœurs et la puce Portée de l'en-tête, la carte héros et les lignes « base + dé = total » :

```
┌──────────────────────────────────────────────────────┐
│ ❤ ▰▰▰▰▱▱ 4/6                                          │
│ [👢 6]      [🗡️ 3]        [🛡️ 5]       [🏹 2]        │
│  restants   0 coup ⚠      contre-coup   portée        │
└──────────────────────────────────────────────────────┘
```

- **Ligne 1, vie du héros** : barre en 6 crans, colorée, avec « 4/6 ». Perte de vie : les crans se vident en animation (secousse, flash). Soin : ils se remplissent.
- **Ligne 2** : 4 tuiles de même taille, couleur et icône de leur stat :
  - le chiffre principal est le total utilisable **maintenant** (Vitesse restante, Attaque restante, Défense du tour, Portée) ;
  - en petit dessous : l'aide utile (« restants », « N coups » contre le monstre du niveau, « fixe ») ;
  - le jeton attribué est incrusté dans le coin de la tuile (chiffre dans la forme de la stat), et la base apparaît en petit (« base 1 + 5 ») ;
  - quand un total baisse, une mini-barre ou un compteur l'anime.
- Sur mobile, ce bloc occupe la place du tiroir de dés actuel, sous la ligne de statut. La barre du haut ne garde que la puce niveau et le menu `⋯`.
- Sur ordinateur, ce bloc remplace le contenu de `.hero-card` dans le panneau.

## 4. Barres de vie en crans sur le plateau

- Supprimer les dés de PV (`.hp .die`) sur les monstres **et** sur le héros.
- Sous chaque sprite : une **barre segmentée**, un cran par PV max :
  - araignée : 2, squelette : 3, brute et dragon : 5, héros : 6 ;
  - crans pleins colorés : rouge pour les monstres, vert-cyan pour le héros ; crans vides sombres.
- Coup reçu : le cran perdu clignote blanc puis se vide (environ 300 ms), avec un « −1 » flottant.
- Lisible à 344 px de plateau, donc avec des crans d'au moins 3 px de haut.

## 5. Ce qui ne change pas
- Les règles (`engine.js`), le Défi du jour et sa suite de dés à graine.
- Annuler et le verrou à la première action, Rejouer, les fenêtres inertes, l'aperçu puis la confirmation au toucher, l'appui long, l'accélération du tour des monstres, la feuille Menu/Progression.
- La règle Portée : jamais de jeton d'énergie.

## 6. Critères d'acceptation
1. Au début d'un tour, la barre d'attribution affiche 3 jetons neutres à chiffres, sans points. Rien n'est attribué tant que le joueur n'a pas agi.
2. Taper 2 jetons attribue Vitesse puis Attaque, et le 3e va automatiquement en Défense. Le guide suit la stat courante.
3. Glisser un jeton sur un emplacement l'y place ; sur un emplacement occupé, les deux s'échangent. Taper un emplacement rempli renvoie le jeton dans la réserve.
4. Un jeton attribué prend la forme et la couleur de sa stat (Défense : chiffre dans un bouclier bleu, etc.).
5. Tant que l'attribution est incomplète, aucune action plateau n'est possible et « Fin du tour » est désactivé. Une fois complète, la barre se replie dans la barre des stats unifiée.
6. Toutes les stats (vie, Vitesse, Attaque, Défense, Portée) sont dans un seul bloc, avec les couleurs du §1. L'Attaque indique le nombre de coups possibles contre le monstre du niveau.
7. Sur le plateau, héros et monstres ont une barre de vie en crans, et plus aucun dé de PV.
8. Les badges du plateau (coût, cible, dégâts) utilisent les couleurs des stats.
9. À 375×812, 390×844 et 360×740 : aucun défilement, cibles ≥ 44 px, jetons de la réserve ≥ 56 px.
10. Ordinateur 1280×800 : même logique (barre d'attribution puis barre des stats dans le panneau), glisser à la souris et clic-clic.
11. La console reste sans erreur, et le Défi du jour donne la même suite de dés.
