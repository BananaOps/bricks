package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/BananaOps/bricks/backend/internal/domain"
)

// ---- équipes

// CreateTeam insère une équipe en fin de liste.
func (s *Store) CreateTeam(ctx context.Context, t domain.Team, roadmapID string) (domain.Team, error) {
	position, err := s.nextPosition(ctx, teamsTable, roadmapID)
	if err != nil {
		return t, err
	}
	t.Position = position

	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO teams (id, roadmap_id, name, capacity_etp, position) VALUES (?, ?, ?, ?, ?)`,
		t.ID, roadmapID, t.Name, t.Capacity, t.Position); err != nil {
		return t, fmt.Errorf("création de l'équipe : %w", err)
	}
	return t, nil
}

// UpdateTeam réécrit le nom et la capacité d'une équipe. L'ordre se change par
// ReorderTeams, qui renumérote la liste entière d'un coup.
func (s *Store) UpdateTeam(ctx context.Context, t domain.Team) (domain.Team, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE teams SET name = ?, capacity_etp = ? WHERE id = ?`, t.Name, t.Capacity, t.ID)
	if err != nil {
		return t, fmt.Errorf("mise à jour de l'équipe : %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return t, domain.ErrNotFound
	}
	return s.Team(ctx, t.ID)
}

// Team lit une équipe.
func (s *Store) Team(ctx context.Context, id string) (domain.Team, error) {
	var t domain.Team
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, capacity_etp, position FROM teams WHERE id = ?`, id).
		Scan(&t.ID, &t.Name, &t.Capacity, &t.Position)
	if errors.Is(err, sql.ErrNoRows) {
		return t, domain.ErrNotFound
	}
	if err != nil {
		return t, fmt.Errorf("lecture de l'équipe : %w", err)
	}
	return t, nil
}

// RoadmapOfTeam indique à quelle roadmap appartient une équipe.
func (s *Store) RoadmapOfTeam(ctx context.Context, id string) (string, error) {
	var roadmapID string
	err := s.db.QueryRowContext(ctx, `SELECT roadmap_id FROM teams WHERE id = ?`, id).Scan(&roadmapID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("lecture de l'équipe : %w", err)
	}
	return roadmapID, nil
}

// DeleteTeam supprime une équipe, en déplaçant d'abord ses briques vers
// reassignTo lorsque cet identifiant est fourni.
//
// Le déplacement et la suppression partagent une transaction : sans elle, un
// échec à mi-chemin laisserait des briques orphelines que la cascade aurait
// effacées en silence.
func (s *Store) DeleteTeam(ctx context.Context, id, reassignTo string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		if reassignTo != "" {
			if _, err := tx.ExecContext(ctx,
				`UPDATE bricks SET team_id = ?, updated_at = datetime('now') WHERE team_id = ?`,
				reassignTo, id); err != nil {
				return fmt.Errorf("réaffectation des briques : %w", err)
			}
		}
		res, err := tx.ExecContext(ctx, `DELETE FROM teams WHERE id = ?`, id)
		if err != nil {
			return fmt.Errorf("suppression de l'équipe : %w", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return domain.ErrNotFound
		}
		return nil
	})
}

// ReorderTeams renumérote les positions selon l'ordre fourni.
func (s *Store) ReorderTeams(ctx context.Context, roadmapID string, ids []string) error {
	return s.reorder(ctx, teamsTable, roadmapID, ids)
}

// ---- thèmes

// CreateTheme insère un thème en fin de liste.
func (s *Store) CreateTheme(ctx context.Context, t domain.Theme, roadmapID string) (domain.Theme, error) {
	position, err := s.nextPosition(ctx, themesTable, roadmapID)
	if err != nil {
		return t, err
	}
	t.Position = position

	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO themes (id, roadmap_id, name, base_color, tint_color, ink_color, line_color, icon_path, position)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, roadmapID, t.Name, t.Base, t.Tint, t.Ink, t.Line, t.IconPath, t.Position); err != nil {
		return t, fmt.Errorf("création du thème : %w", err)
	}
	return t, nil
}

// UpdateTheme réécrit le nom, la palette et l'icône d'un thème.
func (s *Store) UpdateTheme(ctx context.Context, t domain.Theme) (domain.Theme, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE themes SET name = ?, base_color = ?, tint_color = ?, ink_color = ?, line_color = ?, icon_path = ?
		  WHERE id = ?`,
		t.Name, t.Base, t.Tint, t.Ink, t.Line, t.IconPath, t.ID)
	if err != nil {
		return t, fmt.Errorf("mise à jour du thème : %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return t, domain.ErrNotFound
	}
	return s.Theme(ctx, t.ID)
}

// Theme lit un thème.
func (s *Store) Theme(ctx context.Context, id string) (domain.Theme, error) {
	var t domain.Theme
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, base_color, tint_color, ink_color, line_color, icon_path, position
		   FROM themes WHERE id = ?`, id).
		Scan(&t.ID, &t.Name, &t.Base, &t.Tint, &t.Ink, &t.Line, &t.IconPath, &t.Position)
	if errors.Is(err, sql.ErrNoRows) {
		return t, domain.ErrNotFound
	}
	if err != nil {
		return t, fmt.Errorf("lecture du thème : %w", err)
	}
	return t, nil
}

// RoadmapOfTheme indique à quelle roadmap appartient un thème.
func (s *Store) RoadmapOfTheme(ctx context.Context, id string) (string, error) {
	var roadmapID string
	err := s.db.QueryRowContext(ctx, `SELECT roadmap_id FROM themes WHERE id = ?`, id).Scan(&roadmapID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("lecture du thème : %w", err)
	}
	return roadmapID, nil
}

// DeleteTheme supprime un thème, en reportant d'abord ses briques sur
// reassignTo lorsque cet identifiant est fourni.
//
// Sans report, la clé étrangère passerait `theme_id` à NULL et laisserait des
// briques de projet sans thème — un état que le CHECK de la table refuse.
func (s *Store) DeleteTheme(ctx context.Context, id, reassignTo string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		if reassignTo != "" {
			if _, err := tx.ExecContext(ctx,
				`UPDATE bricks SET theme_id = ?, updated_at = datetime('now') WHERE theme_id = ?`,
				reassignTo, id); err != nil {
				return fmt.Errorf("réaffectation des briques : %w", err)
			}
		}
		res, err := tx.ExecContext(ctx, `DELETE FROM themes WHERE id = ?`, id)
		if err != nil {
			return fmt.Errorf("suppression du thème : %w", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return domain.ErrNotFound
		}
		return nil
	})
}

// ReorderThemes renumérote les positions selon l'ordre fourni.
func (s *Store) ReorderThemes(ctx context.Context, roadmapID string, ids []string) error {
	return s.reorder(ctx, themesTable, roadmapID, ids)
}

// ---- décomptes

// BrickCountsByTeam donne le nombre de briques portées par chaque équipe.
// Les pages de configuration s'en servent pour dire ce qu'une suppression
// emporterait avant qu'elle soit confirmée.
func (s *Store) BrickCountsByTeam(ctx context.Context, roadmapID string) (map[string]int, error) {
	return s.counts(ctx, `SELECT team_id, count(*) FROM bricks WHERE roadmap_id = ? GROUP BY team_id`, roadmapID)
}

// BrickCountsByTheme donne le nombre de briques portant chaque thème.
func (s *Store) BrickCountsByTheme(ctx context.Context, roadmapID string) (map[string]int, error) {
	return s.counts(ctx,
		`SELECT theme_id, count(*) FROM bricks WHERE roadmap_id = ? AND theme_id IS NOT NULL GROUP BY theme_id`,
		roadmapID)
}

func (s *Store) counts(ctx context.Context, query, roadmapID string) (map[string]int, error) {
	rows, err := s.db.QueryContext(ctx, query, roadmapID)
	if err != nil {
		return nil, fmt.Errorf("décompte des briques : %w", err)
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var key string
		var n int
		if err := rows.Scan(&key, &n); err != nil {
			return nil, fmt.Errorf("décompte des briques : %w", err)
		}
		out[key] = n
	}
	return out, rows.Err()
}

// ---- utilitaires partagés

// orderedTable regroupe les requêtes d'une table à position.
//
// Les requêtes sont des littéraux plutôt qu'un nom de table concaténé à
// l'exécution : le SQL reste greppable, et aucune chaîne n'est assemblée —
// ce qu'aucun relecteur, humain ou analyseur, n'a alors à vérifier.
type orderedTable struct {
	nextPosition string
	listIDs      string
	setPosition  string
}

var (
	teamsTable = orderedTable{
		nextPosition: `SELECT max(position) FROM teams WHERE roadmap_id = ?`,
		listIDs:      `SELECT id FROM teams WHERE roadmap_id = ?`,
		setPosition:  `UPDATE teams SET position = ? WHERE id = ?`,
	}
	themesTable = orderedTable{
		nextPosition: `SELECT max(position) FROM themes WHERE roadmap_id = ?`,
		listIDs:      `SELECT id FROM themes WHERE roadmap_id = ?`,
		setPosition:  `UPDATE themes SET position = ? WHERE id = ?`,
	}
)

// nextPosition renvoie la position suivante pour une nouvelle ligne.
func (s *Store) nextPosition(ctx context.Context, table orderedTable, roadmapID string) (int, error) {
	var position sql.NullInt64
	err := s.db.QueryRowContext(ctx, table.nextPosition, roadmapID).Scan(&position)
	if err != nil {
		return 0, fmt.Errorf("lecture de la position : %w", err)
	}
	if !position.Valid {
		return 0, nil
	}
	return int(position.Int64) + 1, nil
}

// reorder renumérote les positions d'une table selon l'ordre fourni.
//
// La liste doit contenir exactement les identifiants existants : accepter un
// sous-ensemble laisserait des lignes avec une position périmée, donc un ordre
// d'affichage arbitraire.
func (s *Store) reorder(ctx context.Context, table orderedTable, roadmapID string, ids []string) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, table.listIDs, roadmapID)
		if err != nil {
			return fmt.Errorf("lecture de l'ordre : %w", err)
		}
		existing := map[string]bool{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return fmt.Errorf("lecture de l'ordre : %w", err)
			}
			existing[id] = true
		}
		_ = rows.Close()
		if err := rows.Err(); err != nil {
			return fmt.Errorf("lecture de l'ordre : %w", err)
		}

		if len(ids) != len(existing) {
			return domain.ErrOrderMismatch
		}
		seen := map[string]bool{}
		for _, id := range ids {
			if !existing[id] || seen[id] {
				return domain.ErrOrderMismatch
			}
			seen[id] = true
		}

		for position, id := range ids {
			if _, err := tx.ExecContext(ctx, table.setPosition, position, id); err != nil {
				return fmt.Errorf("écriture de l'ordre : %w", err)
			}
		}
		return nil
	})
}

// inTx exécute fn dans une transaction, annulée si fn échoue.
func (s *Store) inTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("ouverture de la transaction : %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("validation de la transaction : %w", err)
	}
	return nil
}
