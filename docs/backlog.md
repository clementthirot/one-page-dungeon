# Backlog : simplification de l'interface

Produit par les agents `ux-designer`, `game-designer` et `product-owner` (`.claude/agents/`).

**Objectif de l'itération** : un tour ne demande plus que les vraies décisions (répartir les dés, bouger, frapper) et un seul clic fixe. L'écran se réduit au plateau, aux dés, aux PV et à un bouton.

## Lot 1 : à livrer en une session (✅ livré)

| ID | Story | Critères d'acceptation |
|---|---|---|
| S1 ✅ | Dés lancés automatiquement en début de tour | Lancer automatique après le bandeau, animation ≤ 500 ms ; le Défi du jour donne la même suite de dés ; plus de bouton « Lancer » |
| S2 ✅ | Plus de « Valider » : répartir puis agir | Dés échangeables tant qu'aucune action n'est faite, points mis à jour en direct ; la 1re action verrouille les dés ; Annuler jusqu'au début du tour les déverrouille ; le bouton principal = « Fin du tour » |
| S3 ✅ | Le plateau réagit à la répartition | Cases atteignables et monstres frappables mis à jour à chaque échange de dés |
| S4 ✅ | Oracle sur une ligne fixe | Encadré supprimé ; ligne « Ici : −N ❤ / ✓ » de hauteur réservée sous le plateau ; badges par case conservés ; rien quand 🔮 est désactivé |
| S5 ✅ | Panneau épuré | Barre des 4 phases supprimée (le bouton sert d'indicateur et porte la consigne) ; journal replié sur sa dernière ligne ; avatar et nom retirés du panneau |
| S6 ✅ | Barre d'action collante sur mobile | À 375×812, [↶][Fin du tour] toujours visibles ; cibles ≥ 44 px ; affichage ordinateur inchangé |
| S7 ✅ | « Rejouer » immédiat | Relance avec les mêmes réglages ; lien « Changer d'aventurier·e » |
| S8 ✅ | Socle clavier et accessibilité | Fenêtres fermées en `inert` + `visibility:hidden` ; `:focus-visible` ; pas de `blur()` global ni de double action sur Espace |

## Lot 2
- **S9 (moteur)** : égalités de l'IA départagées en faveur du joueur. On choisit la case qui minimise ses dégâts, puis celle qui laisse le monstre frappable.
- **S10** : Attaque affichée en nombre de coups, badge « manque N 🗡️ » sur le monstre, Portée en puce à côté des PV.
- **S11** : tour des monstres plus rapide (pas de 110 à 120 ms, attaques simultanées), avec une ligne de formule ; on peut l'accélérer ou le passer.
- **S12** : modale Règles complète : repli de l'IA, égalités, « plus proche » mesuré sans les murs, coins.

## Lot 3
- **S13** : scores obtenus avec l'Oracle marqués 🔮 au Panthéon.
- **S14** : échange des dés au clavier (touches 1/2/3) et par glisser-déposer.
- **S15** : accueil allégé, « Jouer » en premier.
- **S16** : « Fin du tour » mis en avant quand plus aucune action n'est possible.

## Arbitrages
- **Plus de bouton « Valider »** (avis game design) : Annuler et l'aperçu en direct couvrent le risque d'erreur.
- **Oracle** (avis UX) : on garde les badges par case et on supprime l'encadré. Le mode « au survol » est écarté : il ne marche pas sur mobile et coûte trop.
- **Égalités de l'IA** : arbitrées en faveur du joueur, sans fenêtre de choix.
