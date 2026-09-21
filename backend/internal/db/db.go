// Package db opens the roadmap database and applies migrations.
//
// Two drivers are wired in because the same code serves two environments:
// Turso (remote libSQL, over the network) in deployment, and a plain local
// SQLite file for development and tests. The DSN scheme picks the driver, so
// nothing above this package knows which one is in play.
package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"sort"
	"strings"

	_ "github.com/tursodatabase/libsql-client-go/libsql" // driver "libsql"
	_ "modernc.org/sqlite"                               // driver "sqlite", cgo-free
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open connects to the database named by dsn and applies every migration.
//
// dsn is either a Turso URL (libsql://db-org.turso.io?authToken=…) or a local
// file path (file:./bricks.db). authToken is appended to remote URLs when it is
// not already carried in the DSN itself.
func Open(ctx context.Context, dsn, authToken string) (*sql.DB, error) {
	driver, target, err := resolve(dsn, authToken)
	if err != nil {
		return nil, err
	}

	conn, err := sql.Open(driver, target)
	if err != nil {
		return nil, fmt.Errorf("ouverture de la base (%s) : %w", driver, err)
	}
	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("connexion à la base (%s) : %w", driver, err)
	}

	// Local SQLite defaults are conservative; a single-writer web service wants
	// WAL and enforced foreign keys. Turso applies neither pragma remotely.
	if driver == "sqlite" {
		for _, pragma := range []string{"PRAGMA journal_mode = WAL", "PRAGMA foreign_keys = ON", "PRAGMA busy_timeout = 5000"} {
			if _, err := conn.ExecContext(ctx, pragma); err != nil {
				_ = conn.Close()
				return nil, fmt.Errorf("%s : %w", pragma, err)
			}
		}
	}

	if err := Migrate(ctx, conn); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return conn, nil
}

// resolve maps a DSN to (driver, connection string).
func resolve(dsn, authToken string) (driver, target string, err error) {
	switch {
	case dsn == "":
		return "", "", fmt.Errorf("DATABASE_URL est vide")

	case strings.HasPrefix(dsn, "libsql://"), strings.HasPrefix(dsn, "wss://"),
		strings.HasPrefix(dsn, "ws://"), strings.HasPrefix(dsn, "https://"), strings.HasPrefix(dsn, "http://"):
		if authToken != "" && !strings.Contains(dsn, "authToken=") {
			sep := "?"
			if strings.Contains(dsn, "?") {
				sep = "&"
			}
			dsn += sep + "authToken=" + authToken
		}
		return "libsql", dsn, nil

	case strings.HasPrefix(dsn, "file:"):
		return "sqlite", dsn, nil

	default:
		// A bare path such as ./bricks.db.
		return "sqlite", "file:" + dsn, nil
	}
}

// Migrate applies every embedded migration that has not run yet, in filename
// order, recording each one so reruns are no-ops.
//
// Each migration runs inside its own transaction: a half-applied schema change
// is worse than a failed startup.
func Migrate(ctx context.Context, conn *sql.DB) error {
	if _, err := conn.ExecContext(ctx,
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			name       TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`); err != nil {
		return fmt.Errorf("création de schema_migrations : %w", err)
	}

	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("lecture des migrations : %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var applied int
		if err := conn.QueryRowContext(ctx,
			`SELECT count(*) FROM schema_migrations WHERE name = ?`, name).Scan(&applied); err != nil {
			return fmt.Errorf("lecture de l'état de %s : %w", name, err)
		}
		if applied > 0 {
			continue
		}

		body, err := migrations.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("lecture de %s : %w", name, err)
		}

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("transaction pour %s : %w", name, err)
		}
		// libSQL's HTTP driver executes one statement per call, so split the
		// file rather than handing it over whole.
		for _, stmt := range splitStatements(string(body)) {
			if _, err := tx.ExecContext(ctx, stmt); err != nil {
				_ = tx.Rollback()
				return fmt.Errorf("migration %s : %w", name, err)
			}
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (name) VALUES (?)`, name); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("enregistrement de %s : %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("validation de %s : %w", name, err)
		}
	}
	return nil
}

// splitStatements breaks a migration file on semicolons that end a statement.
//
// It tracks single-quoted string literals and `--` comments so a semicolon
// inside either — the seed data is full of both — does not split a statement in
// half. The migrations deliberately avoid triggers and BEGIN…END blocks, which
// this simple scanner could not handle.
func splitStatements(sqlText string) []string {
	var out []string
	var cur strings.Builder
	inString, inComment := false, false

	runes := []rune(sqlText)
	for i := 0; i < len(runes); i++ {
		c := runes[i]
		switch {
		case inComment:
			if c == '\n' {
				inComment = false
				cur.WriteRune(c)
			}
			continue
		case inString:
			cur.WriteRune(c)
			if c == '\'' {
				// '' is an escaped quote, not the end of the literal.
				if i+1 < len(runes) && runes[i+1] == '\'' {
					i++
					cur.WriteRune('\'')
				} else {
					inString = false
				}
			}
			continue
		case c == '-' && i+1 < len(runes) && runes[i+1] == '-':
			inComment = true
			i++
			continue
		case c == '\'':
			inString = true
			cur.WriteRune(c)
			continue
		case c == ';':
			if s := strings.TrimSpace(cur.String()); s != "" {
				out = append(out, s)
			}
			cur.Reset()
			continue
		}
		cur.WriteRune(c)
	}
	if s := strings.TrimSpace(cur.String()); s != "" {
		out = append(out, s)
	}
	return out
}
