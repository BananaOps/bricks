// Package web sert l'interface compilée depuis le même binaire que l'API.
//
// Une seule image, un seul port : le frontend est un paquet de fichiers
// statiques, et lui dédier un serveur séparé ajouterait un déploiement, une
// entrée d'Ingress et une origine à autoriser dans CORS — pour rendre trois
// fichiers.
package web

import (
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Handler sert le contenu de dir, avec repli sur index.html.
//
// Quand dir n'existe pas — le cas en développement, où Vite sert l'interface —
// le handler renvoie 404 sans empêcher l'API de démarrer.
func Handler(dir string, log *slog.Logger) http.Handler {
	index := filepath.Join(dir, "index.html")
	if _, err := os.Stat(index); err != nil {
		log.Info("interface non servie par l'API", "dir", dir, "raison", "index.html introuvable")
		return http.NotFoundHandler()
	}

	log.Info("interface servie par l'API", "dir", dir)
	files := http.Dir(dir)
	fileServer := http.FileServer(files)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}

		clean := path.Clean("/" + r.URL.Path)

		// Un chemin sans fichier correspondant est une route de l'application :
		// on rend index.html et le routeur du navigateur fait le reste. Sans ce
		// repli, ouvrir une URL profonde renverrait un 404.
		if !exists(files, clean) {
			serveIndex(w, r, index)
			return
		}

		// Les noms des bundles portent une empreinte de contenu, donc un fichier
		// donné ne change jamais : il peut être gardé indéfiniment. index.html,
		// lui, désigne les bundles du moment et doit être revalidé à chaque
		// visite, sinon un déploiement resterait invisible.
		if strings.HasPrefix(clean, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fileServer.ServeHTTP(w, r)
	})
}

// exists indique si le chemin désigne un fichier régulier servable.
func exists(files http.FileSystem, name string) bool {
	if name == "/" {
		return false
	}
	f, err := files.Open(name)
	if err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			// Chemin refusé par http.Dir — une tentative de remontée, par
			// exemple. Traité comme absent.
			return false
		}
		return false
	}
	defer f.Close()

	info, err := f.Stat()
	return err == nil && !info.IsDir()
}

func serveIndex(w http.ResponseWriter, r *http.Request, index string) {
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	http.ServeFile(w, r, index)
}
