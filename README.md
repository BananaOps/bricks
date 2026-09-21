# Bricks — roadmap capacitaire

Planification annuelle où **la forme d'un bloc est la donnée** : sa hauteur est
une charge en ETP, sa largeur la fenêtre de mois qu'il occupe. Empilées par
équipe, les briques dessinent une silhouette dont la hauteur à un mois donné
*est* la charge de ce mois — la surcharge se voit avant d'être lue.

C'est ce qui rend le glisser-déposer honnête. Déplacer une brique d'avril à juin
ne change pas qu'une date : la pile de juin monte, et si elle franchit le plafond
de l'équipe, l'écran le dit avant qu'on ait relâché le bouton.

Implémentation de la maquette Claude Design
[« LegoBrick Roadmap UI mockups »](https://claude.ai/design/p/fea1c816-f788-4e15-8d88-f42f2c775ff8).

```
backend/       API Go — net/http, SQLite/Turso, zéro framework web
frontend/      React 19 + TypeScript + Vite
helm/bricks/   chart de déploiement
docs/          documentation
Dockerfile     image unique : l'API sert l'interface compilée
Taskfile.yml   task dev, task test, task build
```

## Démarrage

```bash
task dev        # API :8080 + interface :5173, Ctrl-C arrête les deux
```

Aucune configuration : la base se crée et se remplit au premier lancement avec la
roadmap de référence — 11 équipes, 6 thèmes, 43 briques, 6 absences, 4
dépendances.

Ou en une seule commande, sans rien installer :

```bash
docker run -p 8080:8080 bananaops/bricks:latest
```

## Les trois écrans

| Écran       | Adresse      | Rôle                                                 |
| ----------- | ------------ | ---------------------------------------------------- |
| **Roadmap** | `#/`         | la grille : glisser, redimensionner, lier            |
| **Équipes** | `#/equipes`  | les lignes du plateau et leur plafond de charge      |
| **Thèmes**  | `#/themes`   | l'axe de la vue Revue et l'identité visuelle des briques |

## Documentation

| | |
| --- | --- |
| [Guide d'utilisation](./docs/USER_GUIDE.md) | les écrans, les gestes, les raccourcis |
| [Installation](./docs/INSTALLATION.md)      | Docker, Kubernetes, Turso, valeurs du chart |
| [Développement](./docs/DEVELOPMENT.md)      | prérequis, commandes, tests, configuration |
| [Architecture](./docs/ARCHITECTURE.md)      | découpage, modèle, décisions |
| [API](./docs/API.md)                        | référence REST, validation, codes de retour |
| [Contribuer](./CONTRIBUTING.md)             | flux de travail et attendus |
| [Sommaire](./docs/index.md)                 | navigation complète |

## Quelques partis pris

**Une seule image.** L'interface est compilée puis servie par le binaire Go. Lui
dédier un serveur séparé ajouterait un déploiement, une entrée d'Ingress et une
origine à autoriser dans CORS — pour rendre trois fichiers.

**Les absences consomment de la capacité.** Un congé retire des ETP livrables ;
le masquer rendrait le plan faux. Elles se calent au bas de la pile, là où le
travail doit se construire par-dessus.

**Les invariants sont tenus deux fois.** Le service valide, et le schéma refuse.
Un appelant futur qui écrirait directement en base ne peut pas casser la grille.

**Les écritures sont optimistes, l'annulation ne l'est pas.** La brique bouge au
relâchement du pointeur ; annuler rejoue une action inverse contre l'API plutôt
que de restaurer un instantané client, qui divergerait en silence au premier
appel raté.

**Le calcul de capacité vit côté serveur.** La bannière, les jauges de ligne, les
en-têtes de trimestre et tout export futur partagent une seule définition de « en
surcharge ».

## Tests

```bash
task test       # 95 backend, 52 frontend
task check      # gofmt, go vet, golangci-lint, gosec, typecheck strict
```

Les tests d'API montent la pile réelle — migrations et jeu de données compris —
sur un fichier SQLite jetable, et non sur un double.

## Hors périmètre

Authentification, collaboration temps réel, export, roadmaps multiples : ce sont
des décisions, pas des oublis. Le raisonnement derrière chacune est dans
[Architecture](./docs/ARCHITECTURE.md#hors-périmètre).
