# Installation

## Docker

L'image contient tout : l'interface compilée et l'API qui la sert.

```bash
docker run -p 8080:8080 bananaops/bricks:latest
```

L'application répond sur <http://localhost:8080>. Sans configuration, elle écrit
un fichier SQLite dans `/data` et se remplit avec le jeu de données de départ —
de quoi essayer, pas de quoi produire.

Pour garder les données entre deux démarrages :

```bash
docker run -p 8080:8080 -v bricks-data:/data bananaops/bricks:latest
```

### Construire l'image

```bash
task docker              # ou : docker build -t bananaops/bricks:dev .
```

Trois étapes — interface, API, exécution — pour **20 Mo** au final : le binaire
est statique, les deux pilotes de base étant en Go pur.

### Ce que l'image garantit

- utilisateur dédié non privilégié, UID/GID **65532** ;
- aucune capacité Linux, pas d'élévation de privilèges ;
- compatible **`readOnlyRootFilesystem`** — `/data` est le seul emplacement
  inscriptible ;
- multi-architecture `linux/amd64` et `linux/arm64` sur les images publiées.

```bash
# Tel que le chart la fait tourner
docker run --read-only -v bricks-data:/data --user 65532:65532 \
  -p 8080:8080 bananaops/bricks:latest
```

---

## Kubernetes

```bash
helm install bricks ./helm/bricks \
  --set database.url=libsql://<base>-<org>.turso.io \
  --set database.existingSecret=bricks-turso
```

Avec le Secret créé au préalable :

```bash
kubectl create secret generic bricks-turso \
  --from-literal=authToken="$(turso db tokens create bricks)"
```

### Pourquoi Turso par défaut

Le conteneur tourne avec `readOnlyRootFilesystem`, et plusieurs répliques
partageant un fichier ne partageraient rien du tout. Sans `database.url`, le
chart monte un `emptyDir` sur `/data` : l'application démarre, mais les données
disparaissent à chaque redémarrage du pod et deux répliques ne verraient pas la
même roadmap. Les notes d'installation le signalent.

### Le jeton

`existingSecret` est préférable : le jeton ne transite alors ni par les valeurs
du chart ni par l'historique de votre dépôt. Quand le chart crée lui-même le
Secret à partir de `database.authToken`, une annotation de somme de contrôle sur
le Deployment fait rouler les pods à chaque changement — sans elle, une variable
d'environnement resterait celle du démarrage.

### Exposer l'application

Trois mécanismes, mutuellement indépendants.

```yaml
# Ingress
ingress:
  enabled: true
  className: traefik
  hosts:
    - host: bricks.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: bricks-tls
      hosts: [bricks.example.com]
```

```yaml
# Gateway API
gateway:
  enabled: true
  name: gateway-bricks
  namespace: infra
  hosts:
    - host: bricks.example.com
      paths: [{ path: / }]
```

```yaml
# OpenShift
openshift:
  enabled: true
  route:
    enabled: true
    host: bricks.example.com
```

### Valeurs

| Clé                          | Défaut                | Rôle                                        |
| ---------------------------- | --------------------- | ------------------------------------------- |
| `replicaCount`               | `1`                   | nombre de répliques                          |
| `database.url`               | `""`                  | URL Turso ; vide = fichier local éphémère    |
| `database.authToken`         | `""`                  | jeton en clair — préférez `existingSecret`   |
| `database.existingSecret`    | `""`                  | Secret portant la clé `authToken`            |
| `env.allowedOrigin`          | `""`                  | origine CORS ; inutile ici, l'API sert l'interface |
| `image.repository`           | `bananaops/bricks`    |                                              |
| `image.tag`                  | `appVersion` du chart |                                              |
| `service.type`               | `ClusterIP`           |                                              |
| `service.http.port`          | `8080`                |                                              |
| `livenessProbe.enabled`      | `true`                | interroge `/healthz`                         |
| `readinessProbe.enabled`     | `true`                | interroge `/healthz`                         |
| `resources`                  | 250m / 128Mi          | requêtes et limites                          |
| `autoscaling.enabled`        | `false`               | HPA sur CPU et mémoire                       |
| `podSecurityContext`         | profil *restricted*   | `runAsNonRoot`, UID 65532, seccomp           |
| `securityContext`            | profil *restricted*   | pas d'élévation, racine en lecture seule, capacités retirées |

S'y ajoutent les clés habituelles d'un chart Helm, au comportement standard :
`nameOverride`, `fullnameOverride`, `imagePullSecrets`, `podAnnotations`,
`nodeSelector`, `tolerations` et `affinity`.

Liste complète : [`helm/bricks/values.yaml`](../helm/bricks/values.yaml).

### Sondes

`/healthz` interroge la base. Une sonde rouge signale donc aussi bien un
processus mort qu'une base injoignable — ce qui est bien le comportement voulu :
une application qui ne peut pas lire sa roadmap n'a rien à servir.

### Vérifier avant d'appliquer

```bash
task helm:lint                          # défauts, puis toutes options activées
task helm:template                      # rend les manifestes
helm template bricks ./helm/bricks | kubeconform -strict -summary
```

---

## Publication

Un tag `v*.*.*` déclenche `release.yml`, qui :

1. aligne `version` et `appVersion` du chart sur le tag et les commite ;
2. construit et pousse l'image multi-architecture vers Docker Hub ;
3. publie le chart via `chart-releaser`.

Secrets attendus par le dépôt : `DOCKER_USERNAME` et `DOCKER_AUTH_TOKEN`.
