package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/BananaOps/bricks/backend/internal/api"
	"github.com/BananaOps/bricks/backend/internal/db"
	"github.com/BananaOps/bricks/backend/internal/domain"
	"github.com/BananaOps/bricks/backend/internal/store"
)

// newTestServer spins the real stack — migrations, seed data and all — against
// a throwaway SQLite file, so these tests exercise the same code path as
// production rather than a mock.
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()

	dsn := "file:" + filepath.Join(t.TempDir(), "test.db")
	conn, err := db.Open(context.Background(), dsn, "")
	if err != nil {
		t.Fatalf("ouverture de la base de test : %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	srv := httptest.NewServer(api.NewServer(store.New(conn), slog.New(slog.DiscardHandler), "*", nil).Routes())
	t.Cleanup(srv.Close)
	return srv
}

func do(t *testing.T, srv *httptest.Server, method, path string, body any) (*http.Response, []byte) {
	t.Helper()

	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("encodage du corps : %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, srv.URL+path, reader)
	if err != nil {
		t.Fatalf("construction de la requête : %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s : %v", method, path, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return res, raw
}

func TestGetBoardReturnsTheSeededRoadmap(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var board domain.Board
	if err := json.Unmarshal(raw, &board); err != nil {
		t.Fatalf("décodage : %v", err)
	}
	if board.Roadmap.Year != 2026 {
		t.Errorf("année %d, attendu 2026", board.Roadmap.Year)
	}
	if len(board.Teams) != 11 {
		t.Errorf("%d équipes, attendu 11", len(board.Teams))
	}
	if len(board.Themes) != 6 {
		t.Errorf("%d thèmes, attendu 6", len(board.Themes))
	}
	if len(board.Bricks) != 49 {
		t.Errorf("%d briques, attendu 49", len(board.Bricks))
	}
	if len(board.Dependencies) != 4 {
		t.Errorf("%d dépendances, attendu 4", len(board.Dependencies))
	}
}

func TestUnknownRoadmapIsNotFound(t *testing.T) {
	srv := newTestServer(t)
	res, _ := do(t, srv, http.MethodGet, "/api/v1/roadmaps/nope/board", nil)
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("statut %d, attendu 404", res.StatusCode)
	}
}

func TestCreateBrickAppliesDefaults(t *testing.T) {
	srv := newTestServer(t)

	// The grid's quick-add sends only a team, a month and a title.
	res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/bricks", map[string]any{
		"teamId": "payment", "title": "Nouveau sujet", "startMonth": 3,
	})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var b domain.Brick
	if err := json.Unmarshal(raw, &b); err != nil {
		t.Fatalf("décodage : %v", err)
	}
	if b.Kind != domain.KindWork {
		t.Errorf("type %q, attendu work", b.Kind)
	}
	if b.ETP != 1 || b.Duration != 2 {
		t.Errorf("charge %v sur %d mois, attendu 1 ETP sur 2 mois", b.ETP, b.Duration)
	}
	if b.ThemeID == nil {
		t.Error("une brique de projet doit recevoir un thème par défaut")
	}
}

// A brick dropped in December gets the months that are left rather than a 400.
func TestCreateBrickNearYearEndIsClampedNotRejected(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/bricks", map[string]any{
		"teamId": "payment", "title": "Fin d'année", "startMonth": 11, "duration": 4,
	})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var b domain.Brick
	json.Unmarshal(raw, &b)
	if b.Duration != 1 {
		t.Errorf("durée %d, attendu 1 — décembre ne laisse qu'un mois", b.Duration)
	}
}

func TestCreateBrickRejectsInvalidLoad(t *testing.T) {
	srv := newTestServer(t)
	res, _ := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/bricks", map[string]any{
		"teamId": "payment", "title": "Trop lourd", "startMonth": 0, "etp": 9,
	})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400", res.StatusCode)
	}
}

// Dragging a brick sends a month and a team; it must not blank the title.
func TestPatchBrickLeavesUntouchedFieldsAlone(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPatch, "/api/v1/bricks/b1", map[string]any{
		"startMonth": 4, "teamId": "checkout",
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var b domain.Brick
	json.Unmarshal(raw, &b)
	if b.StartMonth != 4 || b.TeamID != "checkout" {
		t.Errorf("déplacement non appliqué : mois %d, équipe %s", b.StartMonth, b.TeamID)
	}
	if b.Title != "Refonte du tunnel de paiement" {
		t.Errorf("titre écrasé : %q", b.Title)
	}
	if b.Link != "notion.so/tunnel-paiement" {
		t.Errorf("lien écrasé : %q", b.Link)
	}
}

// Switching to Absence must drop the theme and the link, which an absence
// cannot hold — otherwise the write would fail the table's CHECK constraint.
func TestSwitchingKindToAbsenceClearsThemeAndLink(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPatch, "/api/v1/bricks/b1", map[string]any{"kind": "absence"})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var b domain.Brick
	json.Unmarshal(raw, &b)
	if b.ThemeID != nil {
		t.Errorf("thème conservé : %v", *b.ThemeID)
	}
	if b.Link != "" {
		t.Errorf("lien conservé : %q", b.Link)
	}
}

// And switching back must restore a theme, since work bricks require one.
func TestSwitchingKindBackToWorkRestoresATheme(t *testing.T) {
	srv := newTestServer(t)

	do(t, srv, http.MethodPatch, "/api/v1/bricks/b1", map[string]any{"kind": "absence"})
	res, raw := do(t, srv, http.MethodPatch, "/api/v1/bricks/b1", map[string]any{"kind": "work"})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var b domain.Brick
	json.Unmarshal(raw, &b)
	if b.ThemeID == nil {
		t.Error("une brique repassée en projet doit retrouver un thème")
	}
}

func TestDeleteBrickRemovesItsDependencies(t *testing.T) {
	srv := newTestServer(t)

	// b18 → b11 is seeded.
	res, _ := do(t, srv, http.MethodDelete, "/api/v1/bricks/b18", nil)
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("statut %d, attendu 204", res.StatusCode)
	}

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var board domain.Board
	json.Unmarshal(raw, &board)
	for _, d := range board.Dependencies {
		if d.FromID == "b18" || d.ToID == "b18" {
			t.Errorf("lien orphelin conservé : %s → %s", d.FromID, d.ToID)
		}
	}
	if len(board.Bricks) != 48 {
		t.Errorf("%d briques, attendu 48", len(board.Bricks))
	}
}

func TestDependencyRules(t *testing.T) {
	cases := []struct {
		name     string
		from, to string
		want     int
	}{
		{"lien valide", "b2", "b3", http.StatusCreated},
		{"lien existant", "b18", "b11", http.StatusConflict},
		{"brique sur elle-même", "b2", "b2", http.StatusBadRequest},
		{"brique inconnue", "b2", "fantome", http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := newTestServer(t)
			res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/dependencies",
				map[string]any{"fromId": tc.from, "toId": tc.to})
			if res.StatusCode != tc.want {
				t.Errorf("statut %d, attendu %d : %s", res.StatusCode, tc.want, raw)
			}
		})
	}
}

// Links express sequencing, so closing a loop is an unsatisfiable plan.
func TestDependencyCycleIsRejected(t *testing.T) {
	srv := newTestServer(t)

	if res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/dependencies",
		map[string]any{"fromId": "b2", "toId": "b3"}); res.StatusCode != http.StatusCreated {
		t.Fatalf("premier lien refusé : %d %s", res.StatusCode, raw)
	}
	res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/dependencies",
		map[string]any{"fromId": "b3", "toId": "b2"})
	if res.StatusCode != http.StatusConflict {
		t.Errorf("statut %d, attendu 409 : %s", res.StatusCode, raw)
	}
}

func TestCapacityReportMatchesTheSeededBoard(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/capacity", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var rep domain.CapacityReport
	json.Unmarshal(raw, &rep)
	if len(rep.Teams) != 11 {
		t.Fatalf("%d équipes, attendu 11", len(rep.Teams))
	}
	if len(rep.TotalLoad) != domain.MonthsPerYear {
		t.Errorf("charge totale sur %d mois, attendu 12", len(rep.TotalLoad))
	}
	// 4+3,5+3+3+4+4,5+3+4+3+2,5+3
	if rep.TotalCapacity != 37.5 {
		t.Errorf("capacité totale %v, attendu 37,5", rep.TotalCapacity)
	}
	// The mockup's banner is lit, so the seeded board must contain overloads.
	if rep.OverloadedTeams == 0 {
		t.Error("le jeu de données de référence doit présenter des surcharges")
	}
}

func TestPatchTeamCapacityChangesTheOverloadVerdict(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPatch, "/api/v1/teams/payment", map[string]any{"capacity": 20})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	_, raw = do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/capacity", nil)
	var rep domain.CapacityReport
	json.Unmarshal(raw, &rep)
	for _, tc := range rep.Teams {
		if tc.TeamID == "payment" && tc.Overloaded {
			t.Error("l'équipe payment ne devrait plus être en surcharge à 20 ETP")
		}
	}
}

func TestUnknownFieldInPayloadIsRejected(t *testing.T) {
	srv := newTestServer(t)
	res, _ := do(t, srv, http.MethodPatch, "/api/v1/bricks/b1", map[string]any{"titel": "faute de frappe"})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400 — un champ inconnu doit échouer bruyamment", res.StatusCode)
	}
}

func TestHealthz(t *testing.T) {
	srv := newTestServer(t)
	res, raw := do(t, srv, http.MethodGet, "/healthz", nil)
	if res.StatusCode != http.StatusOK {
		t.Errorf("statut %d : %s", res.StatusCode, raw)
	}
}
