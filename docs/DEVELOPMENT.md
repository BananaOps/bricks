# Développement

## Prérequis

| Outil                         | Version | Pourquoi                                |
| ----------------------------- | ------- | --------------------------------------- |
| [Go](https://go.dev)          | 1.26+   | l'API                                   |
| [Node](https://nodejs.org)    | 24+     | l'interface                             |
| [Task](https://taskfile.dev)  | 3+      | les commandes du projet *(facultatif)*  |
| Docker                        | —       | construire l'image *(facultatif)*       |
| [Helm](https://helm.sh)       | 3+      | valider le chart *(facultatif)*         |

Pas de chaîne C : les deux pilotes de base sont en Go pur.

## Démarrer

```bash
task dev        # API :8080 + interface :5173, Ctrl-C arrête les deux
```

Aucune configuration : le backend crée et remplit sa base au premier lancement
avec la roadmap 2026 de la maquette — 11 équipes, 6 thèmes, 43 briques, 6
absences, 4 dépendances.

Sans Task, deux terminaux :

```bash
cd backend  && go run ./cmd/server
cd frontend && npm install && npm run dev
```

Vite relaie `/api` vers `localhost:8080`, donc le navigateur ne voit qu'une seule
origine et CORS n'entre pas en jeu.

## Commandes

| Commande            | Rôle                                                  |
| ------------------- | ----------------------------------------------------- |
| `task dev`          | API et interface en parallèle                         |
| `task dev:api`      | API seule                                             |
| `task dev:web`      | interface seule                                       |
| `task test`         | toute la suite de tests                               |
| `task check`        | formatage, `go vet`, typecheck, lint, sécurité        |
| `task lint`         | golangci-lint, tel que la CI l'exécute                |
| `task security`     | gosec, tel que la CI l'exécute                        |
| `task build`        | binaire de l'API et bundle de production              |
| `task docker`       | construit l'image                                     |
| `task docker:run`   | lance l'image sur `localhost:8080`                    |
| `task helm:lint`    | valide le chart, options facultatives comprises       |
| `task helm:template`| rend les manifestes sur la sortie standard            |
| `task db:reset`     | efface la base locale — elle sera reconstruite        |
| `task --list`       | liste complète                                        |

## Arborescence

```
backend/
  cmd/server/           point d'entrée, arrêt propre
  internal/
    api/                routage, validation d'entrée, statuts HTTP
    config/             lecture de l'environnement
    db/                 ouverture, choix du pilote, migrations
      migrations/       0001_init.sql, 0002_seed.sql
    domain/             modèle, règles, capacité, palette — sans dépendance
    store/              SQL
    web/                sert l'interface compilée

frontend/
  public/favicon.svg
  src/
    api/client.ts       client typé
    components/         Board, BrickBlock, Inspector, Logo, PageShell…
    hooks/              useBoard, useInteraction, useHotkeys, useRoute…
    lib/                layout, format, themeIcons — logique pure
    pages/              RoadmapPage, TeamsPage, ThemesPage
    types.ts            les formes renvoyées par l'API

helm/bricks/            chart de déploiement
docs/                   cette documentation
Dockerfile              image unique
```

## Tests

```bash
task test
```

**Backend — 95 tests.** Les tests d'API montent la pile réelle — migrations et
jeu de données compris — sur un fichier SQLite jetable, et non sur un double :
ils empruntent le même chemin de code que la production.

**Frontend — 52 tests.** Ils portent sur la logique pure : le moteur de
disposition, le formatage, les proportions de la marque. Les composants ne sont
pas testés unitairement ; ce sont des passes de rendu au-dessus de fonctions qui,
elles, le sont.

### Conventions de test

Un nom de test décrit un **comportement**, pas une méthode :
`TestDeleteTeamMovesItsBricksToTheChosenTeam`, pas `TestDeleteTeam`.

Quand une assertion existe pour une raison non évidente, la raison est dans le
test :

```go
// Une charge exactement égale au plafond est une équipe pleine, pas une
// équipe en surcharge — et l'arithmétique flottante sur des pas de 0,5 ne
// doit pas en décider autrement.
func TestLoadExactlyAtCapacityIsNotAnOverload(t *testing.T) { … }
```

## Style

**Go** — `gofmt`, `go vet`, `golangci-lint` et `gosec` doivent passer.
`task check` les enchaîne. La configuration du linter est à la racine
(`.golangci.yml`) et golangci-lint la trouve depuis `backend/`.

**TypeScript** — mode strict, plus `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` et `noUnusedLocals`. `npm run typecheck` ne doit
rien signaler.

**Commentaires** — ils expliquent *pourquoi*, pas *quoi*. Le code dit déjà ce
qu'il fait ; un commentaire utile dit ce qui n'est pas dans le code — une
contrainte, un piège, une alternative écartée.

**Titres de PR** — convention *Conventional Commits* (`feat:`, `fix:`, `docs:`,
`ci:`…), validée par la CI.

## Configuration

### API

| Variable              | Défaut                    | Rôle                                   |
| --------------------- | ------------------------- | -------------------------------------- |
| `DATABASE_URL`        | `file:./bricks.db`        | fichier local ou URL Turso             |
| `DATABASE_AUTH_TOKEN` | —                         | requis pour une base Turso distante    |
| `ADDR`                | `:8080`                   | adresse d'écoute                       |
| `PORT`                | —                         | port seul ; l'emporte sur `ADDR`       |
| `ALLOWED_ORIGIN`      | `http://localhost:5173`   | origine autorisée par CORS ; `*` désactive le contrôle |
| `WEB_DIR`             | `./web/dist`              | interface compilée ; ignorée si absente |

Un `.env` à la racine surcharge ces valeurs pour `task dev`.

### Interface

| Variable             | Défaut     | Rôle                                            |
| -------------------- | ---------- | ----------------------------------------------- |
| `VITE_API_BASE_URL`  | vide       | vide = même origine, via le relais Vite          |
| `VITE_ROADMAP_ID`    | `rm-2026`  | roadmap chargée au démarrage                     |

## Base de données

Les migrations sont embarquées dans le binaire et s'appliquent au démarrage,
chacune dans sa propre transaction et une seule fois — une table
`schema_migrations` tient le registre.

Ajouter une migration : déposer un fichier dans
`backend/internal/db/migrations/` en respectant l'ordre des noms
(`0003_…sql`). Il sera embarqué à la compilation.

Le découpeur d'instructions gère les littéraux et les commentaires mais **pas**
les blocs `BEGIN…END` : les migrations évitent donc triggers et procédures.

Repartir de zéro :

```bash
task db:reset
```

## Travailler sur Turso

```bash
turso db create bricks
turso db show bricks --url          # libsql://bricks-<org>.turso.io
turso db tokens create bricks
```

```bash
# .env à la racine
DATABASE_URL=libsql://bricks-<org>.turso.io
DATABASE_AUTH_TOKEN=<jeton>
```

`task dev` pointera dessus sans autre changement.

## Le design

L'interface implémente une maquette Claude Design,
[« LegoBrick Roadmap UI mockups »](https://claude.ai/design/p/fea1c816-f788-4e15-8d88-f42f2c775ff8).
Deux fichiers font référence : `Bricks v4.dc.html` pour l'application et
`Logo.dc.html` pour la marque.

Leur `support.js` est le runtime générique du canvas — compilateur de gabarits,
évaluateur d'expressions — et ne contient aucune logique métier : il n'y a rien à
en porter.
