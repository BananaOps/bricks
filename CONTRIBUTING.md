# Contribuer

Merci de votre intérêt pour Bricks.

## Démarrer

```bash
git clone git@github.com:BananaOps/bricks.git
cd bricks
task dev
```

Prérequis et détails : [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Avant d'ouvrir une pull request

```bash
task check      # gofmt, go vet, golangci-lint, gosec, typecheck TypeScript
task test       # 95 tests backend, 52 frontend
```

Si vous touchez au chart ou à l'image :

```bash
task helm:lint
task docker
```

La CI rejoue tout cela ; lancer les commandes en local évite l'aller-retour.

## Titres de pull request

Convention *Conventional Commits*, validée automatiquement :

```
feat: ajoute le réordonnancement des thèmes
fix: corrige le plafond des flèches sur la capacité d'équipe
docs: documente la dérivation de palette
ci: fait tourner gosec depuis le module
```

Types acceptés : `feat`, `fix`, `docs`, `test`, `ci`, `refactor`, `perf`,
`chore`, `revert`.

## Attendus

### Les tests décrivent un comportement

Un nom de test dit ce qui doit être vrai, pas quelle fonction est appelée :

```go
func TestDeleteTeamMovesItsBricksToTheChosenTeam(t *testing.T)   // oui
func TestDeleteTeam(t *testing.T)                                // non
```

Quand une assertion existe pour une raison non évidente, écrivez la raison dans
le test. Le lecteur suivant héritera de la raison, pas seulement du résultat.

### Les tests d'API touchent la vraie pile

Les tests backend montent migrations et jeu de données sur un fichier SQLite
jetable plutôt que sur un double : ils empruntent le même chemin de code que la
production. Continuez ainsi — un test qui ne valide qu'un simulacre ne dit rien
du produit.

### La logique pure va dans `lib/` ou `domain/`

Le moteur de disposition, le calcul de capacité, la dérivation de palette : tout
cela est pur et testé directement. Les composants React et les handlers HTTP
restent des passes fines au-dessus.

Si vous vous apprêtez à tester un composant pour vérifier un calcul, c'est que le
calcul devrait en sortir.

### Les invariants se tiennent à deux endroits

Le service valide **et** la base refuse. Si vous ajoutez une règle qui protège la
cohérence de la grille, ajoutez la contrainte `CHECK` correspondante — un
appelant futur qui écrirait directement en base ne doit pas pouvoir la casser.

### Les commentaires disent *pourquoi*

Le code dit déjà *quoi*. Un commentaire utile porte ce qui n'est pas dans le
code : une contrainte, un piège, une alternative écartée et la raison de
l'écarter.

```go
// Les absences descendent au fond de la pile : c'est un fait du calendrier sur
// lequel le travail doit se construire, et le montrer en dessous rend lisible
// ce qui reste au-dessus.
```

### Les messages d'erreur sont en français et affichables

L'API renvoie ses erreurs de validation dans un champ `error` que l'interface
affiche telle quelle. Écrivez-les pour la personne qui les lira, pas pour le
journal.

## Signaler un bug

Indiquez ce que vous attendiez, ce qui s'est produit, et de quoi le reproduire.
Pour un problème d'affichage, une capture vaut une page de description.

## Questions ouvertes

Plusieurs directions sont volontairement laissées de côté et seraient des
contributions bienvenues, après discussion dans une issue :

- authentification et autorisation ;
- collaboration temps réel ;
- export et partage — les écrans n'étant pas spécifiés, les boutons ont été retirés ;
- plusieurs roadmaps ou plusieurs années.

Voir [Hors périmètre](./docs/ARCHITECTURE.md#hors-périmètre) pour le
raisonnement derrière chacune.
