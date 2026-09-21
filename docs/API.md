# API

REST sur JSON, servie par le binaire Go. Aucune authentification : voir
[Hors périmètre](./ARCHITECTURE.md#hors-périmètre).

Base : `http://localhost:8080` en développement.

## Conventions

**Un appel pour charger.** `GET /board` renvoie la roadmap entière — équipes,
thèmes, briques, liens. Le frontend démarre là-dessus plutôt que de lancer quatre
requêtes qu'il devrait joindre lui-même.

**Un `PATCH` ne touche que ce qu'il porte.** Faire glisser une brique envoie une
équipe et un mois ; le titre et le lien ne doivent pas être effacés au passage.

**Les champs inconnus sont refusés** en 400, plutôt qu'ignorés : une faute de
frappe côté client échoue bruyamment au lieu de ne rien faire en silence.

**Les erreurs sont lisibles.** Elles reviennent en français dans un champ
`error`, directement affichable :

```json
{ "error": "la charge doit être un multiple de 0,5 ETP" }
```

### Codes de retour

| Code | Quand                                                              |
| ---- | ------------------------------------------------------------------ |
| 200  | lecture ou modification réussie                                     |
| 201  | création réussie                                                    |
| 204  | suppression réussie                                                 |
| 400  | corps invalide, champ inconnu, ou règle de validation non respectée |
| 404  | ressource introuvable                                               |
| 409  | conflit : doublon, cycle, ou suppression refusée                    |
| 500  | erreur interne                                                      |
| 503  | `/healthz` seulement : base injoignable                             |

---

## Santé

### `GET /healthz`

Interroge la base. Une réponse rouge signale aussi bien un processus mort qu'une
base injoignable — c'est ce qui en fait une sonde utile en cluster.

```bash
curl localhost:8080/healthz
```

```json
{ "status": "ok" }
```

---

## Plateau

### `GET /api/v1/roadmaps/{roadmapID}/board`

La roadmap entière.

```bash
curl localhost:8080/api/v1/roadmaps/rm-2026/board
```

```json
{
  "roadmap": { "id": "rm-2026", "name": "Roadmap 2026", "year": 2026 },
  "teams": [
    { "id": "payment", "name": "Payment", "capacity": 4, "position": 0 }
  ],
  "themes": [
    {
      "id": "t1",
      "name": "Encaisser plus, mieux",
      "base": "#7C3AED",
      "tint": "#F5F3FF",
      "ink": "#5B21B6",
      "line": "#DDD6FE",
      "iconPath": "M1.6 4h10.8v6.4H1.6z…",
      "position": 0
    }
  ],
  "bricks": [
    {
      "id": "b1",
      "roadmapId": "rm-2026",
      "teamId": "payment",
      "themeId": "t1",
      "kind": "work",
      "title": "Refonte du tunnel de paiement",
      "etp": 2.5,
      "startMonth": 0,
      "duration": 5,
      "link": "notion.so/tunnel-paiement"
    }
  ],
  "dependencies": [{ "id": "dep-1", "fromId": "b18", "toId": "b11" }]
}
```

`startMonth` va de 0 (janvier) à 11 (décembre). `themeId` vaut `null` exactement
quand `kind` vaut `absence`.

### `GET /api/v1/roadmaps/{roadmapID}/capacity`

Charges, pointes et surcharges, calculées côté serveur.

Ce calcul vit ici pour que la bannière, les jauges de ligne, les en-têtes de
trimestre et tout export futur partagent **une seule** définition de « en
surcharge » au lieu de la redériver chacun de son côté.

```bash
curl localhost:8080/api/v1/roadmaps/rm-2026/capacity
```

```json
{
  "teams": [
    {
      "teamId": "checkout",
      "capacity": 3.5,
      "load": [1, 1, 0, 2, 2, 2, 5, 5, 2, 2, 2, 2],
      "peak": 5,
      "overloaded": true,
      "overloadedMonths": [6, 7],
      "overflow": 1.5
    }
  ],
  "totalCapacity": 37.5,
  "totalLoad": [19.5, 22.5, 22, 26, 24, 18.5, 28, 32.5, 25.5, 25.5, 21, 21],
  "overloadedTeams": 4,
  "overloadedMonths": [6, 7, 8, 9]
}
```

`load` et `totalLoad` comptent douze mois, janvier en premier. Une charge
exactement égale au plafond n'est pas une surcharge.

---

## Briques

### `POST /api/v1/roadmaps/{roadmapID}/bricks`

| Champ        | Type              | Défaut                        |
| ------------ | ----------------- | ----------------------------- |
| `teamId`     | string            | **requis**                    |
| `title`      | string            | **requis** (sauf absence)     |
| `startMonth` | int 0–11          | **requis**                    |
| `kind`       | `work`/`absence`  | `work`                        |
| `themeId`    | string ou null    | premier thème de la roadmap   |
| `etp`        | number            | `1`                           |
| `duration`   | int ≥ 1           | `2`                           |
| `link`       | string            | `""`                          |

```bash
curl -X POST localhost:8080/api/v1/roadmaps/rm-2026/bricks \
  -H 'Content-Type: application/json' \
  -d '{"teamId":"payment","title":"Nouveau sujet","startMonth":3}'
```

Une brique posée près de décembre reçoit **les mois qui restent** plutôt qu'un
refus : `startMonth: 11, duration: 4` donne `duration: 1`.

### `PATCH /api/v1/bricks/{brickID}`

Tous les champs sont facultatifs ; seuls ceux présents sont modifiés.

```bash
# Déplacement : le titre et le lien restent intacts
curl -X PATCH localhost:8080/api/v1/bricks/b1 \
  -H 'Content-Type: application/json' \
  -d '{"startMonth":4,"teamId":"checkout"}'
```

Changer `kind` réécrit ce que l'autre type ne peut pas porter, de sorte que la
bascule Projet/Absence ne produise jamais une brique invalide :

- vers `absence` : le thème et le lien sont vidés ;
- vers `work` : un thème est réattribué s'il n'y en a pas.

### `DELETE /api/v1/bricks/{brickID}`

204. Les dépendances de la brique partent avec elle.

---

## Dépendances

### `POST /api/v1/roadmaps/{roadmapID}/dependencies`

```bash
curl -X POST localhost:8080/api/v1/roadmaps/rm-2026/dependencies \
  -H 'Content-Type: application/json' \
  -d '{"fromId":"b18","toId":"b11"}'
```

Refusé en 409 si le lien existe déjà, ou s'il **fermerait un cycle** : les liens
expriment un séquencement, donc une boucle décrit un plan insatisfiable. Les
deux briques doivent appartenir à la même roadmap.

### `DELETE /api/v1/dependencies/{depID}`

204.

---

## Équipes

### `POST /api/v1/roadmaps/{roadmapID}/teams`

```bash
curl -X POST localhost:8080/api/v1/roadmaps/rm-2026/teams \
  -H 'Content-Type: application/json' \
  -d '{"name":"Plateforme","capacity":2.5}'
```

L'équipe est ajoutée en fin de liste. `capacity` va de 0,5 à 100 ETP.

### `PATCH /api/v1/teams/{teamID}`

`name`, `capacity`, ou les deux. L'ordre se change par la route dédiée.

### `DELETE /api/v1/teams/{teamID}?reassignTo={autreTeamID}`

Sans `reassignTo`, une équipe qui porte des briques est refusée en 409. Perdre un
pan du plan d'un seul clic n'est pas une erreur rattrapable : l'appelant dit où
va le travail.

La dernière équipe est refusée en 409 — une brique appartient toujours à une
équipe.

### `PUT /api/v1/roadmaps/{roadmapID}/teams/order`

```bash
curl -X PUT localhost:8080/api/v1/roadmaps/rm-2026/teams/order \
  -H 'Content-Type: application/json' \
  -d '{"ids":["checkout","payment","data"]}'
```

La liste doit contenir **exactement** les identifiants existants, sans doublon :
un ordre partiel laisserait des lignes avec une position périmée, donc un
affichage arbitraire. Renvoie le plateau réordonné.

---

## Thèmes

### `POST /api/v1/roadmaps/{roadmapID}/themes`

| Champ      | Type   | Défaut                  |
| ---------- | ------ | ----------------------- |
| `base`     | string | **requis**, `#RRGGBB`   |
| `name`     | string | **requis**              |
| `iconPath` | string | `""`                    |

```bash
curl -X POST localhost:8080/api/v1/roadmaps/rm-2026/themes \
  -H 'Content-Type: application/json' \
  -d '{"name":"Plateforme","base":"#2563eb"}'
```

`tint`, `ink` et `line` sont **dérivés** de `base` : la teinte est conservée,
seule la clarté bouge. C'est ce qui garantit qu'un titre reste lisible sur son
propre remplissage. Les couleurs sont normalisées (`#2563eb` → `#2563EB`).

Une teinte fournie explicitement l'emporte sur la dérivation : une palette
dessinée à la main reste modifiable au détail près.

### `PATCH /api/v1/themes/{themeID}`

Changer `base` **redérive toute la palette**. `iconPath` n'accepte que la
grammaire des tracés SVG — commandes, nombres, séparateurs — et 512 caractères
au plus : le contenu finit dans un attribut `d`, il est borné plutôt que recopié.

### `DELETE /api/v1/themes/{themeID}?reassignTo={autreThemeID}`

Même règle que pour les équipes. Une brique de projet doit porter un thème, donc
les briques concernées adoptent celui indiqué. Le dernier thème est refusé.

### `PUT /api/v1/roadmaps/{roadmapID}/themes/order`

Identique aux équipes.

---

## Règles de validation

Appliquées par le serveur **et** par la base, dont les contraintes `CHECK`
refusent les mêmes valeurs si un appelant futur contournait la couche service.

| Règle                                        | Message                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| titre non vide                                | `le titre est obligatoire`                            |
| charge dans [0,5 ; 6]                         | `la charge doit être comprise entre 0,5 et 6 ETP`     |
| charge multiple de 0,5                        | `la charge doit être un multiple de 0,5 ETP`          |
| mois dans [0 ; 11]                            | `le mois de départ doit être compris entre 0 et 11`   |
| durée ≥ 1                                     | `la durée doit être d'au moins 1 mois`                |
| `startMonth + duration` ≤ 12                  | `la brique dépasse la fin de l'année`                 |
| une absence ne porte pas de thème             | `une absence ne porte pas de thème`                   |
| un projet porte un thème                      | `une brique de projet doit porter un thème`           |
| pas de lien sur soi-même                      | `une brique ne peut pas dépendre d'elle-même`         |
| pas de lien en double                         | `ce lien existe déjà`                                 |
| pas de cycle                                  | `ce lien créerait un cycle de dépendances`            |
| capacité dans [0,5 ; 100]                     | `la capacité doit être comprise entre 0,5 et 100 ETP` |
| couleur hexadécimale                          | `couleur invalide, un code hexadécimal est attendu`   |
| tracé d'icône borné                           | `le tracé de l'icône contient des caractères interdits` |
| suppression avec briques                      | `cette équipe porte encore des briques`               |
| dernière équipe / dernier thème               | `la dernière équipe ne peut pas être supprimée`       |
| liste d'ordre complète                        | `la liste ordonnée doit contenir exactement les éléments existants` |
