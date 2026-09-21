# Étape 1 : interface
FROM --platform=$BUILDPLATFORM node:25-alpine AS frontend-builder

WORKDIR /app/frontend

# Les manifestes d'abord : tant qu'ils ne bougent pas, la couche d'installation
# est réutilisée telle quelle.
COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build

# Étape 2 : API
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend-builder

# Arguments fournis par buildx pour la compilation croisée.
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY backend/go.mod backend/go.sum ./

RUN go env -w GOPROXY=https://proxy.golang.org,direct && \
    go mod download -x

COPY backend/ ./

# CGO désactivé : les deux pilotes de base sont en Go pur, donc le binaire est
# statique et tourne sur une image quasi vide.
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -ldflags="-w -s" -o bricks ./cmd/server

# Étape 3 : image d'exécution
FROM alpine:3.22

# Utilisateur dédié non privilégié (UID/GID 65532, convention « nonroot » de
# distroless).
RUN apk --no-cache add ca-certificates \
    && addgroup -S -g 65532 bricks \
    && adduser -S -D -H -u 65532 -G bricks -s /sbin/nologin bricks

# Seul emplacement inscriptible de l'image. Le reste appartient à root et reste
# en lecture seule, ce qui permet à Kubernetes d'imposer readOnlyRootFilesystem.
RUN mkdir -p /data && chown 65532:65532 /data
VOLUME ["/data"]

WORKDIR /app

# Les fichiers restent la propriété de root et lisibles par tous : l'utilisateur
# d'exécution peut les lire et les exécuter sans pouvoir les altérer, ce qui
# fonctionne avec readOnlyRootFilesystem.
COPY --from=backend-builder --chmod=0755 /app/bricks ./bricks
COPY --from=frontend-builder --chmod=0755 /app/frontend/dist ./web/dist

# Base locale par défaut, dans le seul dossier inscriptible : l'image démarre
# donc sans configuration. En cluster, `DATABASE_URL` désigne plutôt une base
# Turso — un fichier local ne se partage pas entre répliques.
ENV DATABASE_URL=file:/data/bricks.db

EXPOSE 8080

# UID:GID numériques pour que Kubernetes applique runAsNonRoot sans avoir à
# résoudre un nom d'utilisateur.
USER 65532:65532

CMD ["./bricks"]
