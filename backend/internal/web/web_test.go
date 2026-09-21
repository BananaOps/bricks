package web_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/BananaOps/bricks/backend/internal/web"
)

// buildDir reconstitue la forme d'un `vite build` : un index et un bundle
// portant une empreinte de contenu.
func buildDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	write := func(name, body string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("index.html", "<!doctype html><title>Bricks</title>")
	write("favicon.svg", "<svg/>")
	write(filepath.Join("assets", "index-abc123.js"), "console.log(1)")
	return dir
}

func get(t *testing.T, h http.Handler, path string) *http.Response {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Result()
}

func TestServesTheBuiltIndex(t *testing.T) {
	h := web.Handler(buildDir(t), slog.New(slog.DiscardHandler))

	res := get(t, h, "/")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d, attendu 200", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	if string(body) == "" {
		t.Error("corps vide")
	}
}

func TestServesStaticAssets(t *testing.T) {
	h := web.Handler(buildDir(t), slog.New(slog.DiscardHandler))

	res := get(t, h, "/assets/index-abc123.js")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d, attendu 200", res.StatusCode)
	}
}

// Les bundles portent une empreinte de contenu et ne changent jamais ; index.html
// désigne les bundles du moment et doit être revalidé, sinon un déploiement
// resterait invisible derrière un cache.
func TestCachingDistinguishesFingerprintedAssetsFromTheIndex(t *testing.T) {
	h := web.Handler(buildDir(t), slog.New(slog.DiscardHandler))

	asset := get(t, h, "/assets/index-abc123.js")
	defer asset.Body.Close()
	if got := asset.Header.Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Errorf("Cache-Control d'un bundle : %q", got)
	}

	index := get(t, h, "/")
	defer index.Body.Close()
	if got := index.Header.Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control de l'index : %q", got)
	}
}

// Une URL profonde est une route de l'application, pas un fichier manquant.
func TestUnknownPathFallsBackToTheIndex(t *testing.T) {
	h := web.Handler(buildDir(t), slog.New(slog.DiscardHandler))

	res := get(t, h, "/equipes")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d, attendu 200", res.StatusCode)
	}
	if ct := res.Header.Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("Content-Type %q, attendu du HTML", ct)
	}
}

func TestTraversalCannotEscapeTheBuildDirectory(t *testing.T) {
	dir := buildDir(t)
	secret := filepath.Join(filepath.Dir(dir), "secret.txt")
	if err := os.WriteFile(secret, []byte("token"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := web.Handler(dir, slog.New(slog.DiscardHandler))

	for _, attempt := range []string{"/../secret.txt", "/assets/../../secret.txt", "//../secret.txt"} {
		res := get(t, h, attempt)
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if string(body) == "token" {
			t.Errorf("%s a servi un fichier hors du dossier de build", attempt)
		}
	}
}

// L'API doit démarrer seule en développement, où Vite sert l'interface.
func TestMissingBuildDirectoryDoesNotBreakTheServer(t *testing.T) {
	h := web.Handler(filepath.Join(t.TempDir(), "absent"), slog.New(slog.DiscardHandler))

	res := get(t, h, "/")
	defer res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("statut %d, attendu 404", res.StatusCode)
	}
}

func TestRejectsWrites(t *testing.T) {
	h := web.Handler(buildDir(t), slog.New(slog.DiscardHandler))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("statut %d, attendu 405", rec.Code)
	}
}
