# UI v3 : une seule barre de stats, blocage au bouclier, bandeaux de phase

Statut : implémenté (réserves : rendu en `prefers-reduced-motion` non vérifié en navigateur ; parade au corps à corps vérifiée par la séquence d'événements, pas en capture ; sous 340 px de large, la réserve passe au-dessus de la vie, cas non testé). Ce document prime sur `ui-v2.md` en cas de conflit.

## Retours du joueur
- Le changement d'interface au moment de la validation des stats est perturbant, comme l'attribution automatique de la 3e stat. Il faut une interface commune pour ne pas perturber le joueur.
- Ajouter des animations de blocage, avec le projectile arrêté par le bouclier.
- Résumer les phases de jeu au joueur avec des bandeaux très visuels.

## 1. Une seule barre, du début à la fin du tour

On supprime la barre d'attribution séparée (`#assign`) et son repli. **La barre des stats unifiée est la seule interface** : on y attribue les jetons et on y lit ses points. Sa structure reste la même pendant tout le tour, rien ne se replie ni ne change de place.

```
┌──────────────────────────────────────────────────────┐
│ ❤ ▰▰▰▰▱▱ 4/6            réserve : [3] [6] [2]        │  ← la réserve vit DANS la barre
│ [👢  ?  ]  [🗡️  ?  ]  [🛡️  ?  ]  [🏹 2 ]              │  ← les tuiles sont les emplacements
└──────────────────────────────────────────────────────┘
```

- **Ligne 1** : barre de vie à gauche, **réserve** des jetons à droite, à la place qui reste.
  - Les jetons non attribués sont dorés et font au moins 48 px.
  - La réserve se vide au fil des attributions. Une fois vide, elle laisse 3 emplacements fantômes très discrets (pointillés) pour que la mise en page ne bouge pas.
  - Sur mobile, si la place manque, la réserve passe au-dessus de la barre de vie, mais toujours dans le même bloc et à hauteur fixe.
- **Ligne 2** : les 4 tuiles colorées (Vitesse, Attaque, Défense, Portée), avec le même gabarit que dans ui-v2.
  - Une tuile vide affiche son icône, « 1 + ? » et un emplacement de jeton en pointillés aux couleurs de la stat.
  - Une tuile remplie affiche le jeton incrusté dans la forme de la stat, avec le total en gros et l'aide en dessous.
  - **Seul le contenu de la tuile change, jamais sa taille ni sa position.**
- **Guide** : la tuile en cours d'attribution pulse doucement (bordure lumineuse). Une seule ligne de consigne s'affiche dans la ligne de statut, par exemple « Placez un jeton sur 👢 Vitesse ».

**Attribution (tout explicite, aucun automatisme)**
- Taper un jeton de la réserve le pose dans la tuile guidée : la première vide, dans l'ordre Vitesse, Attaque, Défense.
- **Le 3e jeton n'est plus posé automatiquement** : le joueur le pose lui-même, en 3 taps au total.
- Glisser un jeton sur une tuile l'y pose. Sur une tuile déjà remplie, les deux jetons s'échangent.
- Taper une tuile remplie renvoie son jeton dans la réserve, tant qu'aucune action n'a été faite.
- La tuile Portée n'accepte jamais de jeton : un dépôt dessus déclenche une secousse et le message « La Portée est fixe ».
- Il n'y a pas de bouton Valider. Dès que les 3 jetons sont posés, le jeu est possible ; l'interface ne change pas, seule la consigne devient « Déplacez-vous ou attaquez ».
- Après la 1re action, les jetons sont verrouillés (🔒 sur les tuiles, secousse au tap, halo sur ↶), comme aujourd'hui.

## 2. Animations de défense

Pendant la riposte des monstres, chaque attaque est animée selon son résultat :
- **Bloqué** (dégâts du tour = 0) : un **bouclier bleu translucide** apparaît devant le héros, du côté de l'attaquant, avant l'impact.
  - Le projectile (🕸️, 🦴, 🔥) **s'écrase dessus** : il s'arrête net, rebondit ou se brise en éclats bleus, avec un « tink ».
  - Pour une attaque au corps à corps (brute), le coup est **paré** : choc métallique, étincelles et léger recul du monstre.
  - Puis « 🛡️ Bloqué ! ».
- **Dégâts partiels** : les projectiles traversent, mais le bouclier apparaît fissuré et absorbe une partie du coup.
  - Afficher la formule « 12 🗡️ ÷ 🛡️ 4 = −3 ❤ ».
  - Les crans de vie se vident un par un.
- **Dégâts sans défense utile** : pas de bouclier, impact direct, secousse et flash rouge, comme aujourd'hui.
- La tuile 🛡️ de la barre des stats pulse en même temps que le bouclier, pour faire le lien visuel.
- Réutiliser `FX.projectile` / `FX.lunge` en ajoutant un point d'arrêt. Respecter `prefers-reduced-motion`.

## 3. Bandeaux de phase très visuels

Un bandeau plein écran, court, résume chaque moment clé. Il remplace le bandeau de niveau actuel par un système unique.

| Moment | Bandeau | Couleur dominante |
|---|---|---|
| Début de niveau | « NIVEAU 3 » + 👹 ×1 Brute + mini-stats du monstre | or |
| Début de votre tour | « ⚔️ VOTRE TOUR » + « Tour 4 » + les 3 jetons tirés qui tombent dans le bandeau | vert-or |
| Tour des monstres | « 👹 TOUR DES MONSTRES » | rouge sombre |
| Résultat de la riposte | « 🛡️ BLOQUÉ ! » (bleu) / « −2 ❤ » avec la formule (rouge) / « HORS D'ATTEINTE » (vert) | selon le résultat |
| Monstre tué (dernier du niveau) | « NIVEAU NETTOYÉ ! » + confettis | or |
| Mort / victoire | inchangé (écran de fin) | — |

- **Design** :
  - bande horizontale qui traverse l'écran : glisse d'un côté, s'arrête, puis repart de l'autre côté ;
  - grosse typographie pixel avec contour, icône animée, fond en dégradé de la couleur de la phase.
- **Rythme** :
  - environ 900 ms pour le début de tour et le tour des monstres, environ 1,2 s pour le résultat ;
  - **un tap ou Espace le passe** ;
  - le bandeau ne bloque jamais plus que nécessaire et suit l'accélération du tour des monstres.
- **Lisibilité** : il reste lisible à 360 px de large, avec du texte d'au moins 28 px pour le titre.
- **Réglage** « Bandeaux de phase » dans la feuille Menu, activé par défaut. Une fois désactivé, il ne reste que les bandeaux de niveau et de résultat.

## 4. Ce qui ne change pas
- Les règles (`engine.js`) et le Défi du jour, avec la même suite de dés.
- Annuler et le verrou, l'aperçu puis la confirmation au toucher, l'appui long, la feuille Menu/Progression, les barres de vie en crans, le code couleur des stats.

## 5. Critères d'acceptation
1. De l'arrivée des jetons à la fin du tour, la barre des stats garde exactement la même taille et la même position. Pas de repli, pas de deuxième barre. On le vérifie avec `getBoundingClientRect` avant et après l'attribution.
2. Les jetons sont posés uniquement par le joueur : 3 taps, ou des glisser. Aucun jeton ne se pose tout seul.
3. Glisser sur une tuile remplie échange les deux jetons, et taper une tuile remplie renvoie son jeton dans la réserve. La Portée refuse tout jeton.
4. Le jeu (déplacement, attaque, Fin du tour) se débloque quand les 3 jetons sont posés, sans clic de validation.
5. Riposte bloquée : un bouclier apparaît et le projectile s'y arrête (ou le coup est paré). Riposte avec dégâts : la formule s'affiche et les crans se vident.
6. Des bandeaux s'affichent au début de niveau, au début de tour, au tour des monstres, au résultat de la riposte et au niveau nettoyé. Un tap ou Espace les passe, et on peut les désactiver dans le menu.
7. À 375×812, 390×844, 360×740 et 800×800 : aucun défilement, cibles ≥ 44 px. Sur ordinateur à 1280×800, même logique.
8. Console sans erreur. Le Défi du jour donne la même suite de dés.
