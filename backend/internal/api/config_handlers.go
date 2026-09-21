package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/BananaOps/bricks/backend/internal/domain"
)

// ---- équipes

type teamRequest struct {
	Name     *string  `json:"name"`
	Capacity *float64 `json:"capacity"`
}

func (s *Server) createTeam(w http.ResponseWriter, r *http.Request) {
	roadmapID := r.PathValue("roadmapID")
	if _, err := s.store.Roadmap(r.Context(), roadmapID); err != nil {
		s.writeDomainError(w, err)
		return
	}

	var req teamRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}

	team := domain.Team{ID: newID("team"), Capacity: 3}
	if req.Name != nil {
		team.Name = strings.TrimSpace(*req.Name)
	}
	if req.Capacity != nil {
		team.Capacity = *req.Capacity
	}
	if err := team.Validate(); err != nil {
		s.writeDomainError(w, err)
		return
	}

	created, err := s.store.CreateTeam(r.Context(), team, roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) patchTeam(w http.ResponseWriter, r *http.Request) {
	var req teamRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}

	team, err := s.store.Team(r.Context(), r.PathValue("teamID"))
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	if req.Name != nil {
		team.Name = strings.TrimSpace(*req.Name)
	}
	if req.Capacity != nil {
		team.Capacity = *req.Capacity
	}
	if err := team.Validate(); err != nil {
		s.writeDomainError(w, err)
		return
	}

	updated, err := s.store.UpdateTeam(r.Context(), team)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteTeam(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("teamID")
	reassignTo := r.URL.Query().Get("reassignTo")

	roadmapID, err := s.store.RoadmapOfTeam(r.Context(), id)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}

	teams, err := s.store.Teams(r.Context(), roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	// A brick always belongs to a team, so a roadmap with none can hold nothing.
	if len(teams) <= 1 {
		s.writeDomainError(w, domain.ErrLastTeam)
		return
	}

	if err := s.checkReassign(r, id, reassignTo, roadmapID, teams, nil); err != nil {
		s.writeDomainError(w, err)
		return
	}

	counts, err := s.store.BrickCountsByTeam(r.Context(), roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	// Refusing rather than cascading: deleting a team would take its bricks with
	// it, and losing a quarter of the plan to one click is not a recoverable
	// mistake. The caller says where the work goes instead.
	if counts[id] > 0 && reassignTo == "" {
		s.writeDomainError(w, domain.ErrTeamInUse)
		return
	}

	if err := s.store.DeleteTeam(r.Context(), id, reassignTo); err != nil {
		s.writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- thèmes

type themeRequest struct {
	Name *string `json:"name"`
	// Base seul suffit : les trois autres teintes en sont dérivées, sauf si
	// l'appelant les fournit explicitement.
	Base     *string `json:"base"`
	Tint     *string `json:"tint"`
	Ink      *string `json:"ink"`
	Line     *string `json:"line"`
	IconPath *string `json:"iconPath"`
}

// applyTo reporte les champs fournis sur un thème, en dérivant la palette
// lorsque la couleur de base change sans que les autres teintes soient données.
func (req themeRequest) applyTo(theme *domain.Theme) error {
	if req.Name != nil {
		theme.Name = strings.TrimSpace(*req.Name)
	}
	if req.IconPath != nil {
		theme.IconPath = strings.TrimSpace(*req.IconPath)
	}

	if req.Base != nil && *req.Base != theme.Base {
		theme.Base = *req.Base
		tint, ink, line, err := domain.DerivePalette(theme.Base)
		if err != nil {
			return err
		}
		theme.Tint, theme.Ink, theme.Line = tint, ink, line
	}

	// Une teinte explicite l'emporte sur la dérivation : une palette dessinée à
	// la main reste modifiable au détail près.
	for _, override := range []struct {
		value *string
		field *string
	}{
		{req.Tint, &theme.Tint},
		{req.Ink, &theme.Ink},
		{req.Line, &theme.Line},
	} {
		if override.value != nil {
			*override.field = *override.value
		}
	}
	return nil
}

func (s *Server) createTheme(w http.ResponseWriter, r *http.Request) {
	roadmapID := r.PathValue("roadmapID")
	if _, err := s.store.Roadmap(r.Context(), roadmapID); err != nil {
		s.writeDomainError(w, err)
		return
	}

	var req themeRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}
	if req.Base == nil {
		writeError(w, http.StatusBadRequest, "la couleur de base est obligatoire")
		return
	}

	theme := domain.Theme{ID: newID("theme")}
	if err := req.applyTo(&theme); err != nil {
		s.writeDomainError(w, err)
		return
	}
	if err := theme.Validate(); err != nil {
		s.writeDomainError(w, err)
		return
	}

	created, err := s.store.CreateTheme(r.Context(), theme, roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) patchTheme(w http.ResponseWriter, r *http.Request) {
	var req themeRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}

	theme, err := s.store.Theme(r.Context(), r.PathValue("themeID"))
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	if err := req.applyTo(&theme); err != nil {
		s.writeDomainError(w, err)
		return
	}
	if err := theme.Validate(); err != nil {
		s.writeDomainError(w, err)
		return
	}

	updated, err := s.store.UpdateTheme(r.Context(), theme)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteTheme(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("themeID")
	reassignTo := r.URL.Query().Get("reassignTo")

	roadmapID, err := s.store.RoadmapOfTheme(r.Context(), id)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}

	themes, err := s.store.Themes(r.Context(), roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	// A work brick must carry a theme, so the last one cannot go.
	if len(themes) <= 1 {
		s.writeDomainError(w, domain.ErrLastTheme)
		return
	}

	if err := s.checkReassign(r, id, reassignTo, roadmapID, nil, themes); err != nil {
		s.writeDomainError(w, err)
		return
	}

	counts, err := s.store.BrickCountsByTheme(r.Context(), roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	if counts[id] > 0 && reassignTo == "" {
		s.writeDomainError(w, domain.ErrThemeInUse)
		return
	}

	if err := s.store.DeleteTheme(r.Context(), id, reassignTo); err != nil {
		s.writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- ordre d'affichage

type reorderRequest struct {
	IDs []string `json:"ids"`
}

func (s *Server) reorderTeams(w http.ResponseWriter, r *http.Request) {
	s.reorder(w, r, s.store.ReorderTeams)
}

func (s *Server) reorderThemes(w http.ResponseWriter, r *http.Request) {
	s.reorder(w, r, s.store.ReorderThemes)
}

func (s *Server) reorder(
	w http.ResponseWriter, r *http.Request,
	apply func(ctx context.Context, roadmapID string, ids []string) error,
) {
	var req reorderRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}
	if err := apply(r.Context(), r.PathValue("roadmapID"), req.IDs); err != nil {
		s.writeDomainError(w, err)
		return
	}
	board, err := s.store.Board(r.Context(), r.PathValue("roadmapID"))
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, board)
}

// checkReassign valide la cible d'une réaffectation : elle doit exister, vivre
// sur la même roadmap, et ne pas être l'élément que l'on supprime.
func (s *Server) checkReassign(
	r *http.Request, id, reassignTo, roadmapID string,
	teams []domain.Team, themes []domain.Theme,
) error {
	if reassignTo == "" {
		return nil
	}
	if reassignTo == id {
		return domain.ErrReassignSelf
	}

	var otherRoadmap string
	var err error
	if teams != nil {
		otherRoadmap, err = s.store.RoadmapOfTeam(r.Context(), reassignTo)
	} else {
		_ = themes
		otherRoadmap, err = s.store.RoadmapOfTheme(r.Context(), reassignTo)
	}
	if err != nil {
		return err
	}
	if otherRoadmap != roadmapID {
		return domain.ErrNotFound
	}
	return nil
}
