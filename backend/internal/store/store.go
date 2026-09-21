// Package store is the persistence layer for roadmap boards.
//
// It owns SQL and nothing else: validation lives in domain, HTTP concerns live
// in api. Every method takes a context so a cancelled request stops work at the
// database rather than after it.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/BananaOps/bricks/backend/internal/domain"
)

// Store reads and writes roadmap data.
type Store struct {
	db *sql.DB
}

// New returns a Store backed by conn.
func New(conn *sql.DB) *Store { return &Store{db: conn} }

// DB exposes the underlying handle for health checks.
func (s *Store) DB() *sql.DB { return s.db }

// Roadmap returns a board's metadata.
func (s *Store) Roadmap(ctx context.Context, id string) (domain.Roadmap, error) {
	var r domain.Roadmap
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, year FROM roadmaps WHERE id = ?`, id).
		Scan(&r.ID, &r.Name, &r.Year)
	if errors.Is(err, sql.ErrNoRows) {
		return r, domain.ErrNotFound
	}
	if err != nil {
		return r, fmt.Errorf("lecture de la roadmap : %w", err)
	}
	return r, nil
}

// Teams returns a roadmap's teams in display order.
func (s *Store) Teams(ctx context.Context, roadmapID string) ([]domain.Team, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, capacity_etp, position
		   FROM teams WHERE roadmap_id = ? ORDER BY position, name`, roadmapID)
	if err != nil {
		return nil, fmt.Errorf("lecture des équipes : %w", err)
	}
	defer rows.Close()

	teams := []domain.Team{}
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.Capacity, &t.Position); err != nil {
			return nil, fmt.Errorf("lecture d'une équipe : %w", err)
		}
		teams = append(teams, t)
	}
	return teams, rows.Err()
}

// Themes returns a roadmap's themes in display order.
func (s *Store) Themes(ctx context.Context, roadmapID string) ([]domain.Theme, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, base_color, tint_color, ink_color, line_color, icon_path, position
		   FROM themes WHERE roadmap_id = ? ORDER BY position, name`, roadmapID)
	if err != nil {
		return nil, fmt.Errorf("lecture des thèmes : %w", err)
	}
	defer rows.Close()

	themes := []domain.Theme{}
	for rows.Next() {
		var t domain.Theme
		if err := rows.Scan(&t.ID, &t.Name, &t.Base, &t.Tint, &t.Ink, &t.Line, &t.IconPath, &t.Position); err != nil {
			return nil, fmt.Errorf("lecture d'un thème : %w", err)
		}
		themes = append(themes, t)
	}
	return themes, rows.Err()
}

// Bricks returns every brick on a roadmap.
func (s *Store) Bricks(ctx context.Context, roadmapID string) ([]domain.Brick, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, roadmap_id, team_id, theme_id, kind, title, etp, start_month, duration, link
		   FROM bricks WHERE roadmap_id = ? ORDER BY start_month, id`, roadmapID)
	if err != nil {
		return nil, fmt.Errorf("lecture des briques : %w", err)
	}
	defer rows.Close()

	bricks := []domain.Brick{}
	for rows.Next() {
		b, err := scanBrick(rows)
		if err != nil {
			return nil, err
		}
		bricks = append(bricks, b)
	}
	return bricks, rows.Err()
}

// Brick returns a single brick.
func (s *Store) Brick(ctx context.Context, id string) (domain.Brick, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, roadmap_id, team_id, theme_id, kind, title, etp, start_month, duration, link
		   FROM bricks WHERE id = ?`, id)
	b, err := scanBrick(row)
	if errors.Is(err, sql.ErrNoRows) {
		return b, domain.ErrNotFound
	}
	return b, err
}

// scanner abstracts *sql.Row and *sql.Rows so one scan body serves both.
type scanner interface{ Scan(dest ...any) error }

func scanBrick(sc scanner) (domain.Brick, error) {
	var b domain.Brick
	var theme sql.NullString
	if err := sc.Scan(&b.ID, &b.RoadmapID, &b.TeamID, &theme, &b.Kind,
		&b.Title, &b.ETP, &b.StartMonth, &b.Duration, &b.Link); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return b, err
		}
		return b, fmt.Errorf("lecture d'une brique : %w", err)
	}
	if theme.Valid {
		v := theme.String
		b.ThemeID = &v
	}
	return b, nil
}

// Dependencies returns every link on a roadmap.
func (s *Store) Dependencies(ctx context.Context, roadmapID string) ([]domain.Dependency, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, from_brick_id, to_brick_id
		   FROM dependencies WHERE roadmap_id = ? ORDER BY created_at, id`, roadmapID)
	if err != nil {
		return nil, fmt.Errorf("lecture des dépendances : %w", err)
	}
	defer rows.Close()

	deps := []domain.Dependency{}
	for rows.Next() {
		var d domain.Dependency
		if err := rows.Scan(&d.ID, &d.FromID, &d.ToID); err != nil {
			return nil, fmt.Errorf("lecture d'une dépendance : %w", err)
		}
		deps = append(deps, d)
	}
	return deps, rows.Err()
}

// Board loads a whole roadmap in one call. The frontend boots from this single
// response rather than fanning out four requests it would have to join anyway.
func (s *Store) Board(ctx context.Context, roadmapID string) (domain.Board, error) {
	var board domain.Board
	var err error
	if board.Roadmap, err = s.Roadmap(ctx, roadmapID); err != nil {
		return board, err
	}
	if board.Teams, err = s.Teams(ctx, roadmapID); err != nil {
		return board, err
	}
	if board.Themes, err = s.Themes(ctx, roadmapID); err != nil {
		return board, err
	}
	if board.Bricks, err = s.Bricks(ctx, roadmapID); err != nil {
		return board, err
	}
	if board.Dependencies, err = s.Dependencies(ctx, roadmapID); err != nil {
		return board, err
	}
	return board, nil
}

// CreateBrick inserts a brick. The caller has already validated it.
func (s *Store) CreateBrick(ctx context.Context, b domain.Brick) (domain.Brick, error) {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO bricks (id, roadmap_id, team_id, theme_id, kind, title, etp, start_month, duration, link)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		b.ID, b.RoadmapID, b.TeamID, nullable(b.ThemeID), string(b.Kind),
		b.Title, b.ETP, b.StartMonth, b.Duration, b.Link)
	if err != nil {
		return b, fmt.Errorf("création de la brique : %w", err)
	}
	return b, nil
}

// UpdateBrick overwrites every mutable field of an existing brick. Callers
// build the target state by patching the row they just read, so a full
// overwrite here keeps the SQL fixed instead of assembling it per request.
func (s *Store) UpdateBrick(ctx context.Context, b domain.Brick) (domain.Brick, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE bricks
		    SET team_id = ?, theme_id = ?, kind = ?, title = ?, etp = ?,
		        start_month = ?, duration = ?, link = ?, updated_at = datetime('now')
		  WHERE id = ?`,
		b.TeamID, nullable(b.ThemeID), string(b.Kind), b.Title, b.ETP,
		b.StartMonth, b.Duration, b.Link, b.ID)
	if err != nil {
		return b, fmt.Errorf("mise à jour de la brique : %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return b, domain.ErrNotFound
	}
	return b, nil
}

// DeleteBrick removes a brick. Its dependencies go with it via ON DELETE CASCADE.
func (s *Store) DeleteBrick(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM bricks WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("suppression de la brique : %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// CreateDependency inserts a link. A violation of the (from, to) unique index
// surfaces as domain.ErrDuplicateDep so the handler can answer 409 rather than
// leaking a driver error.
func (s *Store) CreateDependency(ctx context.Context, d domain.Dependency, roadmapID string) (domain.Dependency, error) {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO dependencies (id, roadmap_id, from_brick_id, to_brick_id) VALUES (?, ?, ?, ?)`,
		d.ID, roadmapID, d.FromID, d.ToID)
	if err != nil {
		if isUniqueViolation(err) {
			return d, domain.ErrDuplicateDep
		}
		return d, fmt.Errorf("création du lien : %w", err)
	}
	return d, nil
}

// DeleteDependency removes a link.
func (s *Store) DeleteDependency(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM dependencies WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("suppression du lien : %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func nullable(s *string) any {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}

// isUniqueViolation recognises a duplicate-key error from either driver.
//
// modernc.org/sqlite and the libSQL client report it with different error types
// but both carry SQLite's wording, so matching on the message is the one check
// that holds for both.
func isUniqueViolation(err error) bool {
	msg := strings.ToUpper(err.Error())
	return strings.Contains(msg, "UNIQUE CONSTRAINT FAILED") || strings.Contains(msg, "SQLITE_CONSTRAINT_UNIQUE")
}
