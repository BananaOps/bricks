# Guide d'utilisation

## L'idée

Une roadmap classique dit *quand*. Bricks dit *quand, et à quel prix*.

Chaque bloc a deux dimensions qui sont des données, pas de la décoration :

- sa **hauteur** est une charge, en ETP (équivalent temps plein) ;
- sa **largeur** est la fenêtre de mois qu'il occupe.

Empilés par équipe, les blocs dessinent une silhouette dont la hauteur à un mois
donné **est** la charge de ce mois. Une équipe surchargée ne se lit pas dans un
tableau annexe : sa pile dépasse la ligne pointillée de sa capacité, et le mois
fautif passe au rouge.

C'est ce qui rend le glisser-déposer honnête. Déplacer une brique d'avril à juin
ne fait pas que changer une date : la pile de juin monte, et si elle franchit le
plafond, l'écran le dit avant qu'on ait fini de relâcher le bouton.

## Les trois écrans

Le rail de gauche donne accès à trois destinations.

| Écran       | Adresse      | Ce qu'on y fait                                      |
| ----------- | ------------ | ---------------------------------------------------- |
| **Roadmap** | `#/`         | planifier : glisser, redimensionner, lier            |
| **Équipes** | `#/equipes`  | régler les lignes du plateau et leurs plafonds       |
| **Thèmes**  | `#/themes`   | régler l'identité des briques et l'axe de la Revue   |

---

## Roadmap

### Les deux vues

**Capacité** — une ligne par équipe. C'est la vue de travail : elle montre ce que
chaque squad peut absorber et ce qu'on lui a déjà confié.

**Revue** — une ligne par thème, les mêmes briques regroupées par intention.
C'est la vue de présentation : elle répond à « qu'est-ce qu'on fait pour la
conformité cette année », sans le bruit des équipes. Les absences y disparaissent
— elles ne portent aucune intention — et les briques y affichent leur équipe en
sous-titre.

La vue Revue est en lecture seule : on n'y déplace rien. Réorganiser un plan se
fait en regardant la capacité, sinon on déplace à l'aveugle.

### Deux types de blocs

**Projet** — du travail. Porte un thème, donc une couleur, et apparaît en Revue.

**Absence** — congés, astreinte, parental. Ne porte pas de thème, se cale au bas
de la pile, et n'apparaît pas en Revue.

Une absence consomme de la capacité exactement comme du travail. C'est le point
important : un congé d'été retire des ETP livrables, et le masquer rendrait le
plan faux. En la posant au bas de la pile, l'écran montre ce qui reste
réellement disponible au-dessus.

### Gestes

| Geste                              | Effet                                  |
| ---------------------------------- | -------------------------------------- |
| Glisser une brique                 | change de mois **et** d'équipe         |
| Poignée du haut, vers le haut/bas  | charge en ETP, par pas de 0,5          |
| Poignée de droite, vers la gauche/droite | durée en mois                    |
| Point bleu à gauche → autre brique | crée une dépendance                    |
| Clic sur une cellule vide          | saisie en place, `⏎` pour créer        |
| Clic sur l'icône calendrier d'une cellule | ajoute une absence              |
| Clic sur une brique                | ouvre le panneau de détail             |

Pendant un glisser, la brique d'origine reste visible en transparence et un
contour pointillé montre où elle atterrirait — l'équipe visée est celle sous le
**centre** du bloc, pas sous le curseur, qui se trouve souvent près d'un bord.

**Glisser jusqu'au bord fait avancer la grille.** Amener le bloc contre un bord
du tableau l'entraîne dans cette direction, d'autant plus vite qu'on s'en
approche. Sans cela, un bloc ne pourrait rejoindre que les mois et les équipes
déjà visibles : sur une fenêtre étroite, décembre resterait hors d'atteinte.

Déposer sous la dernière équipe la vise : inutile de survoler la ligne au pixel
près.

### Raccourcis

| Touches            | Effet                                  |
| ------------------ | -------------------------------------- |
| `⌘K` / `Ctrl+K`    | palette : chercher une brique, une équipe, lancer une action |
| `⌘Z` / `Ctrl+Z`    | annuler la dernière modification       |
| `←` `→`            | décaler la brique sélectionnée d'un mois |
| `⇧←` `⇧→`          | raccourcir / allonger la fenêtre       |
| `↑` `↓`            | charge, par pas de 0,5 ETP             |
| `⌫` / `Suppr`      | supprimer la brique sélectionnée       |
| `Échap`            | ferme la palette, le panneau, la saisie |

Les flèches n'agissent que hors d'un champ de saisie : un titre en cours
d'édition garde le comportement normal des flèches.

### La palette

`⌘K` ouvre une recherche qui cherche **et** agit. Elle trouve les briques par
titre, les équipes par nom, et exécute les commandes de vue :

- isoler les équipes en surcharge, ou tout réafficher ;
- aller à aujourd'hui ;
- basculer Capacité / Revue ;
- afficher ou masquer les liens ;
- **densité aérée ou compacte** ;
- **briques teintées ou pleines** ;
- **afficher ou masquer le repère du jour** ;
- annuler la dernière action.

Les trois réglages d'affichage ne vivent que là : ils ne méritaient pas leur
propre bouton dans une barre déjà chargée.

Quand la recherche ne trouve rien, `⏎` crée une brique portant le texte saisi.

### Dépendances

Tirer le point bleu d'une brique vers une autre crée un lien orienté. Les liens
expriment un séquencement — « migrer l'entrepôt avant la facturation
électronique » — donc **un cycle est refusé** : un plan qui se mord la queue
n'est pas réalisable.

Survoler une brique met ses liens en avant et efface les autres. Le bouton
**Liens** de la barre les masque tous.

### Surcharge

Quand une équipe dépasse son plafond, un bandeau rouge apparaît au-dessus de la
grille avec le nombre d'équipes concernées et la plage de mois. Le bouton
**Isoler** ne garde à l'écran que les lignes en dépassement — utile quand onze
squads tiennent à l'écran et que trois posent problème.

Une charge exactement égale au plafond n'est **pas** une surcharge : c'est une
équipe pleine.

### Annuler

Chaque modification affiche une confirmation en bas de l'écran, avec un bouton
**Annuler** — ou `⌘Z`. L'annulation rejoue l'action inverse contre le serveur,
donc ce que vous voyez et ce qui est enregistré ne peuvent pas diverger.

L'historique remonte à 25 actions et ne couvre que la grille. Les pages Équipes
et Thèmes n'en font pas partie : ce sont des gestes de formulaire, délibérés et
relisibles, là où un glisser se joue en une fraction de seconde.

### Panneau de détail

Cliquer une brique ouvre un panneau à droite. Tout ce qu'il contient est aussi
atteignable sur la grille ; il existe pour ce que la manipulation directe rend
pénible — renommer, coller un lien, fixer une fenêtre exacte — et pour montrer
la **conséquence** d'un changement : la pointe de charge de l'équipe après coup,
en rouge si elle dépasse.

C'est aussi là qu'on bascule une brique entre Projet et Absence, qu'on change son
thème, et qu'on supprime ses dépendances une à une.

---

## Équipes

Une équipe est une ligne de la grille et un plafond de charge.

En face de chaque plafond, la page affiche la **pointe réellement atteinte** —
la charge du mois le plus chargé de l'année, absences comprises. Régler l'un sans
voir l'autre reviendrait à planifier à l'aveugle.

On peut y renommer, changer la capacité, réordonner les lignes, en ajouter et en
supprimer.

### Supprimer une équipe

Une équipe qui porte des briques ne part pas sans qu'on dise **où va son
travail**. La boîte de confirmation demande l'équipe de destination, et les
briques y sont transférées — rien n'est perdu.

La dernière équipe ne peut pas être supprimée : une brique appartient toujours à
une équipe.

---

## Thèmes

Un thème range une brique par intention plutôt que par équipe. C'est l'axe de la
vue Revue, et la couleur que porte le bloc sur la grille.

**Seule la couleur de base se choisit.** Le serveur en dérive le fond, l'encre et
le trait en conservant la teinte et en ne déplaçant que la clarté. Laisser saisir
les quatre couleurs indépendamment, c'est produire tôt ou tard un bloc dont le
titre ne se lit plus sur son propre remplissage.

Un aperçu de brique, à droite de chaque ligne, montre le résultat : la lisibilité
d'un titre sur son fond ne se juge pas en pastilles.

L'icône se choisit dans une bibliothèque — laisser taper un tracé SVG à la main
serait une invitation à l'erreur.

### Supprimer un thème

Comme pour les équipes, un thème encore porté par des briques demande une
destination. Une brique de projet doit porter un thème : les briques concernées
adoptent celui choisi.

Le dernier thème ne peut pas être supprimé.

---

## Ce que l'application ne fait pas

- **Pas d'authentification.** Ni session, ni compte : la maquette montrait des
  avatars de collaborateurs, ils ont été retirés plutôt que laissés décoratifs.
- **Pas de collaboration temps réel.** Deux personnes qui éditent en même temps
  ne se voient pas ; la dernière écriture gagne.
- **Une seule année.** Le plateau fait douze mois, pas plus.
