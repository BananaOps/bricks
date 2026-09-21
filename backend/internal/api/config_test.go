package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/BananaOps/bricks/backend/internal/domain"
)

// ---- équipes

func TestCreateTeamAppendsItAtTheEnd(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/teams",
		map[string]any{"name": "Plateforme", "capacity": 2.5})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var team domain.Team
	json.Unmarshal(raw, &team)
	if team.Name != "Plateforme" || team.Capacity != 2.5 {
		t.Errorf("équipe créée : %+v", team)
	}
	// Onze équipes semées, la nouvelle prend la douzième place.
	if team.Position != 11 {
		t.Errorf("position %d, attendu 11", team.Position)
	}
}

func TestCreateTeamRejectsInvalidInput(t *testing.T) {
	cases := []struct {
		name string
		body map[string]any
	}{
		{"nom vide", map[string]any{"name": "  ", "capacity": 3}},
		{"capacité nulle", map[string]any{"name": "X", "capacity": 0}},
		{"capacité démesurée", map[string]any{"name": "X", "capacity": 999}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := newTestServer(t)
			res, _ := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/teams", tc.body)
			if res.StatusCode != http.StatusBadRequest {
				t.Errorf("statut %d, attendu 400", res.StatusCode)
			}
		})
	}
}

func TestPatchTeamRenamesWithoutTouchingCapacity(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPatch, "/api/v1/teams/payment", map[string]any{"name": "Paiements"})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var team domain.Team
	json.Unmarshal(raw, &team)
	if team.Name != "Paiements" {
		t.Errorf("nom %q", team.Name)
	}
	if team.Capacity != 4 {
		t.Errorf("capacité %v écrasée, attendu 4", team.Capacity)
	}
}

// Supprimer une équipe emporterait ses briques : le serveur refuse tant que la
// destination du travail n'est pas dite.
func TestDeleteTeamRefusesToDropItsBricks(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodDelete, "/api/v1/teams/payment", nil)
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("statut %d, attendu 409 : %s", res.StatusCode, raw)
	}

	_, raw = do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)
	if len(b.Bricks) != 49 {
		t.Errorf("%d briques après un refus, attendu 49", len(b.Bricks))
	}
}

func TestDeleteTeamMovesItsBricksToTheChosenTeam(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodDelete, "/api/v1/teams/payment?reassignTo=checkout", nil)
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	_, raw = do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)

	if len(b.Teams) != 10 {
		t.Errorf("%d équipes, attendu 10", len(b.Teams))
	}
	// Rien ne se perd : les 49 briques sont toujours là.
	if len(b.Bricks) != 49 {
		t.Errorf("%d briques, attendu 49 — la réaffectation ne doit rien perdre", len(b.Bricks))
	}
	for _, brick := range b.Bricks {
		if brick.TeamID == "payment" {
			t.Fatalf("la brique %s pointe encore sur l'équipe supprimée", brick.ID)
		}
	}
}

func TestDeleteTeamRejectsAnUnusableTarget(t *testing.T) {
	cases := []struct {
		name  string
		query string
		want  int
	}{
		{"vers elle-même", "?reassignTo=payment", http.StatusBadRequest},
		{"vers une équipe inconnue", "?reassignTo=fantome", http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := newTestServer(t)
			res, raw := do(t, srv, http.MethodDelete, "/api/v1/teams/payment"+tc.query, nil)
			if res.StatusCode != tc.want {
				t.Errorf("statut %d, attendu %d : %s", res.StatusCode, tc.want, raw)
			}
		})
	}
}

// Une brique appartient toujours à une équipe : une roadmap sans aucune ligne
// ne pourrait plus rien porter.
func TestDeleteTeamRefusesTheLastOne(t *testing.T) {
	srv := newTestServer(t)

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)

	survivor := b.Teams[0].ID
	for _, team := range b.Teams[1:] {
		res, body := do(t, srv, http.MethodDelete,
			fmt.Sprintf("/api/v1/teams/%s?reassignTo=%s", team.ID, survivor), nil)
		if res.StatusCode != http.StatusNoContent {
			t.Fatalf("suppression de %s : statut %d %s", team.ID, res.StatusCode, body)
		}
	}

	res, body := do(t, srv, http.MethodDelete, "/api/v1/teams/"+survivor, nil)
	if res.StatusCode != http.StatusConflict {
		t.Errorf("statut %d, attendu 409 : %s", res.StatusCode, body)
	}
}

func TestReorderTeams(t *testing.T) {
	srv := newTestServer(t)

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var before domain.Board
	json.Unmarshal(raw, &before)

	ids := make([]string, len(before.Teams))
	for i, team := range before.Teams {
		ids[i] = team.ID
	}
	reversed := make([]string, len(ids))
	for i, id := range ids {
		reversed[len(ids)-1-i] = id
	}

	res, raw := do(t, srv, http.MethodPut, "/api/v1/roadmaps/rm-2026/teams/order",
		map[string]any{"ids": reversed})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var after domain.Board
	json.Unmarshal(raw, &after)
	for i, team := range after.Teams {
		if team.ID != reversed[i] {
			t.Fatalf("position %d : %s, attendu %s", i, team.ID, reversed[i])
		}
	}
}

// Un ordre partiel laisserait des lignes avec une position périmée, donc un
// affichage arbitraire : la liste doit être complète.
func TestReorderRejectsAPartialList(t *testing.T) {
	srv := newTestServer(t)
	res, raw := do(t, srv, http.MethodPut, "/api/v1/roadmaps/rm-2026/teams/order",
		map[string]any{"ids": []string{"payment", "checkout"}})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400 : %s", res.StatusCode, raw)
	}
}

func TestReorderRejectsDuplicates(t *testing.T) {
	srv := newTestServer(t)

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)

	ids := make([]string, len(b.Teams))
	for i := range b.Teams {
		ids[i] = b.Teams[0].ID // même identifiant partout
	}

	res, body := do(t, srv, http.MethodPut, "/api/v1/roadmaps/rm-2026/teams/order",
		map[string]any{"ids": ids})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400 : %s", res.StatusCode, body)
	}
}

// ---- thèmes

// La couleur de base suffit : les trois autres teintes en découlent, ce qui
// garantit qu'une brique reste lisible sur son propre fond.
func TestCreateThemeDerivesItsPaletteFromTheBaseColour(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/themes",
		map[string]any{"name": "Plateforme", "base": "#2563eb"})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var theme domain.Theme
	json.Unmarshal(raw, &theme)
	if theme.Base != "#2563EB" {
		t.Errorf("base %q, attendu la forme canonique #2563EB", theme.Base)
	}
	for label, shade := range map[string]string{"tint": theme.Tint, "ink": theme.Ink, "line": theme.Line} {
		if shade == "" {
			t.Errorf("teinte %s non dérivée", label)
		}
	}
	if theme.Tint == theme.Ink {
		t.Error("le fond et l'encre doivent différer")
	}
}

func TestCreateThemeRequiresABaseColour(t *testing.T) {
	srv := newTestServer(t)
	res, _ := do(t, srv, http.MethodPost, "/api/v1/roadmaps/rm-2026/themes", map[string]any{"name": "Sans couleur"})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400", res.StatusCode)
	}
}

func TestPatchThemeBaseColourRedrivesTheWholePalette(t *testing.T) {
	srv := newTestServer(t)

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var before domain.Board
	json.Unmarshal(raw, &before)
	original := before.Themes[0]

	res, raw := do(t, srv, http.MethodPatch, "/api/v1/themes/"+original.ID, map[string]any{"base": "#DC2626"})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var updated domain.Theme
	json.Unmarshal(raw, &updated)
	if updated.Tint == original.Tint || updated.Ink == original.Ink {
		t.Error("changer la base doit redériver le fond et l'encre")
	}
	if updated.Name != original.Name {
		t.Errorf("nom %q écrasé", updated.Name)
	}
}

// Une palette dessinée à la main reste modifiable au détail près.
func TestPatchThemeHonoursAnExplicitShade(t *testing.T) {
	srv := newTestServer(t)

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)

	res, raw := do(t, srv, http.MethodPatch, "/api/v1/themes/"+b.Themes[0].ID,
		map[string]any{"base": "#DC2626", "tint": "#FFF5F5"})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var theme domain.Theme
	json.Unmarshal(raw, &theme)
	if theme.Tint != "#FFF5F5" {
		t.Errorf("fond %q, attendu la valeur explicite #FFF5F5", theme.Tint)
	}
}

func TestPatchThemeRejectsAnInvalidColour(t *testing.T) {
	srv := newTestServer(t)
	res, _ := do(t, srv, http.MethodPatch, "/api/v1/themes/t1", map[string]any{"base": "rouge vif"})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400", res.StatusCode)
	}
}

// Le tracé d'une icône finit dans un attribut `d` : il est borné à la grammaire
// SVG plutôt que recopié tel quel.
func TestPatchThemeRejectsAMaliciousIconPath(t *testing.T) {
	srv := newTestServer(t)
	res, raw := do(t, srv, http.MethodPatch, "/api/v1/themes/t1",
		map[string]any{"iconPath": `"><script>alert(1)</script>`})
	if res.StatusCode != http.StatusBadRequest {
		t.Errorf("statut %d, attendu 400 : %s", res.StatusCode, raw)
	}
}

func TestDeleteThemeRefusesWhileBricksCarryIt(t *testing.T) {
	srv := newTestServer(t)
	res, raw := do(t, srv, http.MethodDelete, "/api/v1/themes/t1", nil)
	if res.StatusCode != http.StatusConflict {
		t.Errorf("statut %d, attendu 409 : %s", res.StatusCode, raw)
	}
}

func TestDeleteThemeMovesItsBricksToTheChosenTheme(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodDelete, "/api/v1/themes/t1?reassignTo=t2", nil)
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	_, raw = do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)

	if len(b.Themes) != 5 {
		t.Errorf("%d thèmes, attendu 5", len(b.Themes))
	}
	if len(b.Bricks) != 49 {
		t.Errorf("%d briques, attendu 49", len(b.Bricks))
	}
	for _, brick := range b.Bricks {
		if brick.ThemeID != nil && *brick.ThemeID == "t1" {
			t.Fatalf("la brique %s porte encore le thème supprimé", brick.ID)
		}
		// Le CHECK de la table l'impose déjà, mais l'invariant mérite d'être
		// vérifié ici : une réaffectation ratée le briserait en silence.
		if brick.Kind == domain.KindWork && brick.ThemeID == nil {
			t.Fatalf("la brique de projet %s s'est retrouvée sans thème", brick.ID)
		}
	}
}

func TestDeleteThemeRefusesTheLastOne(t *testing.T) {
	srv := newTestServer(t)

	_, raw := do(t, srv, http.MethodGet, "/api/v1/roadmaps/rm-2026/board", nil)
	var b domain.Board
	json.Unmarshal(raw, &b)

	survivor := b.Themes[0].ID
	for _, theme := range b.Themes[1:] {
		res, body := do(t, srv, http.MethodDelete,
			fmt.Sprintf("/api/v1/themes/%s?reassignTo=%s", theme.ID, survivor), nil)
		if res.StatusCode != http.StatusNoContent {
			t.Fatalf("suppression de %s : statut %d %s", theme.ID, res.StatusCode, body)
		}
	}

	res, body := do(t, srv, http.MethodDelete, "/api/v1/themes/"+survivor, nil)
	if res.StatusCode != http.StatusConflict {
		t.Errorf("statut %d, attendu 409 : %s", res.StatusCode, body)
	}
}

func TestReorderThemes(t *testing.T) {
	srv := newTestServer(t)

	res, raw := do(t, srv, http.MethodPut, "/api/v1/roadmaps/rm-2026/themes/order",
		map[string]any{"ids": []string{"t6", "t5", "t4", "t3", "t2", "t1"}})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("statut %d : %s", res.StatusCode, raw)
	}

	var b domain.Board
	json.Unmarshal(raw, &b)
	if b.Themes[0].ID != "t6" || b.Themes[5].ID != "t1" {
		t.Errorf("ordre obtenu : %s … %s", b.Themes[0].ID, b.Themes[5].ID)
	}
}
