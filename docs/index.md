# Documentation Bricks

Bricks est une roadmap capacitaire : la **forme d'un bloc est la donnée**. Sa
hauteur est une charge en ETP, sa largeur la fenêtre de mois qu'il occupe.
Empilées par équipe, les briques dessinent une silhouette dont la hauteur à un
mois donné *est* la charge de ce mois — la surcharge se voit avant d'être lue.

## Navigation

### 📖 Utiliser

- [Guide d'utilisation](./USER_GUIDE.md) — les trois écrans, les gestes, les
  raccourcis, et le modèle tel qu'on le rencontre à l'usage

### 🚀 Déployer

- [Installation](./INSTALLATION.md) — Docker, Kubernetes, Turso, valeurs du chart

### 🔧 Développer

- [Développement](./DEVELOPMENT.md) — prérequis, commandes, arborescence, tests,
  configuration
- [Architecture](./ARCHITECTURE.md) — le découpage, le modèle, le moteur de
  disposition, et les décisions derrière
- [API](./API.md) — référence REST complète, règles de validation, codes de retour
- [Contribuer](../CONTRIBUTING.md) — flux de travail et attendus

## Accès rapide

| | |
| --- | --- |
| Interface (dev) | <http://localhost:5173> |
| API (dev)       | <http://localhost:8080> |
| Tout-en-un (image) | <http://localhost:8080> |
| Santé           | `GET /healthz` |
| Plateau complet | `GET /api/v1/roadmaps/rm-2026/board` |

## Démarrage rapide

```bash
task dev
```

Aucune configuration : la base se crée et se remplit au premier lancement avec la
roadmap de référence — 11 équipes, 6 thèmes, 43 briques, 6 absences, 4
dépendances.

## Repères

| | |
| --- | --- |
| Backend  | Go 1.26, `net/http`, zéro framework web |
| Frontend | React 19, TypeScript strict, Vite |
| Données  | SQLite en local, Turso en distant — pilote choisi sur l'URL |
| Image    | 20 Mo, utilisateur non privilégié, racine en lecture seule |
| Tests    | 95 backend, 52 frontend |
