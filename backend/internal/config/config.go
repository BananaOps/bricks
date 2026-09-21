// Package config reads runtime settings from the environment.
package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds everything the server needs to start.
type Config struct {
	// Addr is the listen address, e.g. ":8080".
	Addr string
	// DatabaseURL is a Turso URL (libsql://…) or a local file path.
	DatabaseURL string
	// DatabaseAuthToken authenticates against Turso. Unused for local files.
	DatabaseAuthToken string
	// AllowedOrigin is the frontend origin accepted by CORS; "*" allows any.
	AllowedOrigin string
	// WebDir contient l'interface compilée. Servie par l'API quand le dossier
	// existe, ce qui est le cas dans l'image mais pas en développement.
	WebDir string
}

// Load reads the environment, applying development-friendly defaults so the
// server runs with no configuration at all.
func Load() (Config, error) {
	cfg := Config{
		Addr:              env("PORT_ADDR", env("ADDR", ":8080")),
		DatabaseURL:       env("DATABASE_URL", "file:./bricks.db"),
		DatabaseAuthToken: os.Getenv("DATABASE_AUTH_TOKEN"),
		AllowedOrigin:     env("ALLOWED_ORIGIN", "http://localhost:5173"),
		WebDir:            env("WEB_DIR", "./web/dist"),
	}

	// Platforms that inject a bare PORT win over the defaults above.
	if port := os.Getenv("PORT"); port != "" && !strings.Contains(port, ":") {
		cfg.Addr = ":" + port
	}

	if strings.HasPrefix(cfg.DatabaseURL, "libsql://") && cfg.DatabaseAuthToken == "" &&
		!strings.Contains(cfg.DatabaseURL, "authToken=") {
		return cfg, fmt.Errorf("DATABASE_AUTH_TOKEN est requis pour une base Turso distante")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
