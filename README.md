# One Card Dungeon — version web

Adaptation en HTML/CSS/JS vanilla du jeu solo *One Card Dungeon* de Barny Skinner : 12 niveaux, 3 dés d'énergie, 4 types de monstres.

## Jouer

Ouvrez `index.html` dans un navigateur (aucune installation). Pour le partager avec vos amis, hébergez le dossier sur n'importe quel hébergeur statique (GitHub Pages, Netlify…).

- **Espace / Entrée** : action principale (lancer, valider, fin du tour)
- **Z** : annuler la dernière action du tour
- **🔮 Oracle** : affiche les dégâts prévus sur chaque case (désactivable pour jouer avec les règles d'origine)
- **📅 Défi du jour** : tout le monde a la même suite de dés ce jour-là, pour comparer vos scores

## Structure

- `js/data.js` : monstres, cartes des 4 orientations, niveaux d'apparition
- `js/engine.js` : règles pures (portée, ligne de vue, déplacements, IA des monstres)
- `js/fx.js` : sons synthétisés et effets visuels
- `js/game.js` : interface et déroulement de la partie
