# Architecture

## Vue d'ensemble

```
┌───────────────────────────────────────────────────────────┐
│  Navigateur                                                │
│                                                            │
│   React 19 + TypeScript                                    │
│   ├─ pages/          Roadmap · Équipes · Thèmes            │
│   ├─ hooks/          état, gestes, raccourcis, routage     │
│   └─ lib/layout.ts   moteur de disposition — pur           │
└──────────────────────────┬─────────────────────────────────┘
                           │  REST/JSON, même origine
┌──────────────────────────┴─────────────────────────────────┐
│  Binaire Go  (net/http, zéro framework)                    │
│                                                            │
│   internal/api      routage, validation d'entrée, statuts  │
│   internal/domain   modèle et règles — aucune dépendance   │
│   internal/store    SQL, et rien d'autre                   │
│   internal/web      sert l'interface compilée              │
│   internal/db       ouverture, migrations, choix du pilote │
└──────────────────────────┬─────────────────────────────────┘
                           │  database/sql
              ┌────────────┴────────────┐
       modernc.org/sqlite        libsql-client-go
       fichier local             Turso, distant
```

## Un seul déploiement

L'interface est compilée puis servie par le binaire Go. Lui dédier un serveur
séparé ajouterait un déploiement, une entrée d'Ingress et une origine à
autoriser dans CORS — pour rendre trois fichiers.

En développement, Vite sert l'interface et relaie `/api` vers l'API : le
navigateur ne voit qu'une seule origine là aussi, donc CORS n'entre jamais en
jeu. Quand le dossier de build est absent, `internal/web` renvoie 404 sans
empêcher l'API de démarrer.

## Découpage du backend

Chaque paquet a une seule raison de changer.

**`domain`** — le modèle et ses règles, sans aucune dépendance. `Brick.Validate`
tient les invariants dont dépend la grille ; `ComputeCapacity` dérive charges,
pointes et surcharges ; `WouldCycle` refuse les plans insatisfiables ;
`DerivePalette` tient les couleurs d'un thème dans un rapport lisible. Tout y est
pur, donc testable sans base ni serveur.

**`store`** — du SQL, et rien d'autre. Pas de validation, pas de HTTP. Chaque
méthode prend un `context` pour qu'une requête annulée arrête le travail à la
base plutôt qu'après elle.

**`api`** — routage, décodage, et la traduction des erreurs du domaine en codes
HTTP. Le routeur est celui de la bibliothèque standard, avec les motifs
méthode + joker de Go 1.22 : le service ne porte aucune dépendance web.

**`db`** — ouverture et migrations. Le pilote se choisit sur le schéma de
`DATABASE_URL`, si bien que rien au-dessus ne sait lequel est en jeu.

## Le modèle

**Roadmap** — un plateau, une année.

**Équipe** — une ligne de la vue Capacité, et un plafond en ETP.

**Thème** — une ligne de la vue Revue, et l'identité visuelle d'une brique.

**Brique** — un bloc. `etp` × `duration` mois à partir de `startMonth`.

Deux types, et la différence est structurelle :

- `work` porte un **thème** et apparaît en Revue ;
- `absence` n'en porte pas, se cale au bas de la pile, et disparaît de la Revue.

Une absence consomme de la capacité exactement comme du travail : un congé
retire des ETP livrables, et le masquer rendrait le plan faux.

**Dépendance** — un lien orienté. Les liens expriment un séquencement, donc un
cycle décrit un plan insatisfiable et le serveur le refuse avant l'écriture.

### Les invariants sont tenus à deux endroits

Le service valide, **et** la base refuse. Un `CHECK` impose qu'une absence n'ait
pas de thème et qu'un projet en ait un ; un autre qu'une brique ne déborde pas de
décembre ; un index unique rend impossible un lien en double, même entre deux
glissers concurrents.

La duplication est voulue : la couche service est la première ligne, et le
schéma la dernière. Un appelant futur qui écrirait directement en base ne peut
pas casser la grille.

## Le moteur de disposition

`frontend/src/lib/layout.ts` est **pur** : des lignes en entrée, des boîtes en
pixels en sortie. Aucun React, donc l'empilement et les règles de capacité se
testent directement, et les composants restent une passe de rendu au-dessus du
résultat.

### Empilement

`packRow` pose chaque brique sur ce qui occupe déjà les mois qu'elle couvre. Une
ligne se lit donc comme une silhouette : sa hauteur à un mois donné **est** la
charge de ce mois.

Les absences descendent au fond de la pile — c'est un fait du calendrier sur
lequel le travail doit se construire, et le montrer en dessous rend lisible ce
qui reste au-dessus.

L'ordre départage par début, puis par durée, puis par charge, ce qui garde le
résultat stable d'un rendu à l'autre plutôt que de tout remélanger à chaque
modification sans rapport.

### Largeur élastique

Une année tient toujours en douze colonnes. À largeur fixe, un grand écran
laisserait un tiers de la page vide ; `metricsFor` partage donc la place
restante entre les mois, sans jamais descendre sous un plancher en deçà duquel
les titres deviendraient illisibles — auquel cas la grille défile.

La largeur reste fractionnaire : les douze colonnes totalisent alors exactement
l'espace offert, là où un arrondi laisserait un liseré blanc à droite.

## État et écritures

### Optimiste par nécessité

La brique bouge au relâchement du pointeur, et un appel en échec la remet en
place en expliquant pourquoi. Attendre un aller-retour réseau avant de déplacer
un bloc rend le glisser inutilisable sur une connexion réelle.

Les **créations** font exception : elles partent d'un geste délibéré — taper un
titre, cliquer Ajouter — où un aller-retour est imperceptible, et attendre évite
d'inventer un identifiant temporaire à réconcilier ensuite.

### Un geste en cours ne touche pas l'état

Pendant un glisser ou un redimensionnement, l'état du plateau reste celui du
serveur. Le geste vit dans `useInteraction` et rien n'est écrit avant le
relâchement, donc un glisser abandonné ne laisse aucune trace.

Le redimensionnement passe malgré tout par le moteur de disposition — agrandir
un bloc repousse ses voisins, et il faut le voir. Le glisser non : il se rend
comme une copie translatée plus un contour d'atterrissage, laissant la ligne
d'origine intacte jusqu'au dépôt.

### Annuler rejoue l'inverse

L'annulation exécute une **action inverse** contre l'API plutôt que de restaurer
un instantané client. Un instantané divergerait silencieusement du serveur au
premier appel raté ; une action inverse, elle, échoue visiblement.

Seuls les champs que le patch a touchés sont capturés, donc annuler un
déplacement ne revient pas aussi sur un renommage fait entre-temps.

Restaurer une brique supprimée lui donne un nouvel identifiant : ses liens sont
donc reconstruits contre celui-ci, pas contre celui qui vient de disparaître.

## Données

Deux pilotes, choisis sur le schéma de `DATABASE_URL` :

| URL                              | Pilote                | Usage                |
| -------------------------------- | --------------------- | -------------------- |
| `file:./bricks.db` *(défaut)*    | `modernc.org/sqlite`  | développement, tests |
| `libsql://<base>-<org>.turso.io` | `libsql-client-go`    | Turso                |

`modernc.org/sqlite` est une implémentation **pure Go** : pas de cgo, donc pas de
chaîne de compilation C à installer, et un binaire statique qui tient dans une
image de 20 Mo.

Les migrations sont embarquées dans le binaire et s'appliquent au démarrage,
chacune dans sa propre transaction et une seule fois — un schéma à moitié appliqué
est pire qu'un démarrage raté. Un découpeur de requêtes maison sépare les
instructions en tenant compte des littéraux et des commentaires, parce que le
client libSQL exécute une instruction par appel.

## Hors périmètre

Ces absences sont des décisions, pas des oublis.

**Authentification et autorisation.** Rien dans la maquette ne les spécifie, et
les deviner aurait figé des choix qui reviennent au produit. L'API est ouverte :
elle est faite pour vivre derrière une passerelle qui s'en charge.

La maquette dessinait une grappe d'avatars de collaborateurs et un avatar de
compte dans le rail. Ils ont été **retirés** : une interface qui affiche une
session inexistante apprend au lecteur à ne plus croire ce qu'elle montre.

**Collaboration temps réel.** Deux éditeurs simultanés ne se voient pas et la
dernière écriture gagne.

**Exporter et Partager.** Dessinés dans la maquette sans écran derrière, ils ont
été **retirés**. Un bouton qui ne fait rien n'est pas une promesse d'évolution :
c'est une manière d'apprendre au lecteur à ne plus croire ce que l'interface
montre. Ils reviendront quand il y aura quelque chose derrière.

**Plusieurs années.** Le plateau fait douze mois. `MonthsPerYear` est une
constante partagée par le domaine, le schéma et le moteur de disposition ; en
faire un paramètre toucherait les trois.
