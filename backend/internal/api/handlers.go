package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/BananaOps/bricks/backend/internal/domain"
)

func (s *Server) getBoard(w http.ResponseWriter, r *http.Request) {
	board, err := s.store.Board(r.Context(), r.PathValue("roadmapID"))
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, board)
}

func (s *Server) getCapacity(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("roadmapID")
	teams, err := s.store.Teams(r.Context(), id)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	bricks, err := s.store.Bricks(r.Context(), id)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, domain.ComputeCapacity(teams, bricks))
}

// createBrickRequest is the payload for POST .../bricks.
//
// Optional fields are pointers so "absent" is distinguishable from "zero": a
// brick created by clicking an empty cell sends only a title and a position and
// inherits sensible defaults for the rest.
type createBrickRequest struct {
	TeamID     string   `json:"teamId"`
	ThemeID    *string  `json:"themeId"`
	Kind       *string  `json:"kind"`
	Title      string   `json:"title"`
	ETP        *float64 `json:"etp"`
	StartMonth int      `json:"startMonth"`
	Duration   *int     `json:"duration"`
	Link       *string  `json:"link"`
}

func (s *Server) createBrick(w http.ResponseWriter, r *http.Request) {
	roadmapID := r.PathValue("roadmapID")

	var req createBrickRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}

	kind := domain.KindWork
	if req.Kind != nil {
		kind = domain.Kind(*req.Kind)
	}

	b := domain.Brick{
		ID:         newID("bk"),
		RoadmapID:  roadmapID,
		TeamID:     req.TeamID,
		ThemeID:    req.ThemeID,
		Kind:       kind,
		Title:      strings.TrimSpace(req.Title),
		ETP:        1,
		StartMonth: req.StartMonth,
		Duration:   2,
	}
	if req.ETP != nil {
		b.ETP = *req.ETP
	}
	if req.Duration != nil {
		b.Duration = *req.Duration
	}
	if req.Link != nil {
		b.Link = strings.TrimSpace(*req.Link)
	}

	// A brick dropped near December gets the months that are left rather than
	// being rejected for overflowing the year.
	if b.StartMonth >= 0 && b.StartMonth < domain.MonthsPerYear && b.StartMonth+b.Duration > domain.MonthsPerYear {
		b.Duration = domain.MonthsPerYear - b.StartMonth
	}

	// An absence carries no theme; a work brick with none falls back to the
	// roadmap's first theme, which is what the grid's quick-add does.
	switch b.Kind {
	case domain.KindAbsence:
		b.ThemeID = nil
		if b.Title == "" {
			b.Title = "Absence"
		}
	case domain.KindWork:
		if b.ThemeID == nil || *b.ThemeID == "" {
			first, err := s.firstThemeID(r, roadmapID)
			if err != nil {
				s.writeDomainError(w, err)
				return
			}
			b.ThemeID = &first
		}
	}

	if err := b.Validate(); err != nil {
		s.writeDomainError(w, err)
		return
	}
	created, err := s.store.CreateBrick(r.Context(), b)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

// patchBrickRequest carries only the fields the caller means to change. Every
// field is a pointer: dragging a brick sends a start month and a team, and must
// not reset its title or its link to zero values along the way.
type patchBrickRequest struct {
	TeamID     *string  `json:"teamId"`
	ThemeID    *string  `json:"themeId"`
	Kind       *string  `json:"kind"`
	Title      *string  `json:"title"`
	ETP        *float64 `json:"etp"`
	StartMonth *int     `json:"startMonth"`
	Duration   *int     `json:"duration"`
	Link       *string  `json:"link"`
}

func (s *Server) patchBrick(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("brickID")

	var req patchBrickRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}

	b, err := s.store.Brick(r.Context(), id)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}

	if req.TeamID != nil {
		b.TeamID = *req.TeamID
	}
	if req.Title != nil {
		b.Title = strings.TrimSpace(*req.Title)
	}
	if req.ETP != nil {
		b.ETP = *req.ETP
	}
	if req.StartMonth != nil {
		b.StartMonth = *req.StartMonth
	}
	if req.Duration != nil {
		b.Duration = *req.Duration
	}
	if req.Link != nil {
		b.Link = strings.TrimSpace(*req.Link)
	}
	if req.ThemeID != nil {
		v := *req.ThemeID
		if v == "" {
			b.ThemeID = nil
		} else {
			b.ThemeID = &v
		}
	}

	// Switching kind rewrites the fields the other kind cannot hold, so the
	// inspector's Projet/Absence toggle never produces an invalid brick.
	if req.Kind != nil {
		kind := domain.Kind(*req.Kind)
		if kind != b.Kind {
			switch kind {
			case domain.KindAbsence:
				b.ThemeID = nil
				b.Link = ""
			case domain.KindWork:
				if b.ThemeID == nil {
					first, err := s.firstThemeID(r, b.RoadmapID)
					if err != nil {
						s.writeDomainError(w, err)
						return
					}
					b.ThemeID = &first
				}
			}
		}
		b.Kind = kind
	}

	if err := b.Validate(); err != nil {
		s.writeDomainError(w, err)
		return
	}
	updated, err := s.store.UpdateBrick(r.Context(), b)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteBrick(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteBrick(r.Context(), r.PathValue("brickID")); err != nil {
		s.writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type createDependencyRequest struct {
	FromID string `json:"fromId"`
	ToID   string `json:"toId"`
}

func (s *Server) createDependency(w http.ResponseWriter, r *http.Request) {
	roadmapID := r.PathValue("roadmapID")

	var req createDependencyRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "corps de requête invalide : "+err.Error())
		return
	}
	if req.FromID == "" || req.ToID == "" {
		writeError(w, http.StatusBadRequest, "fromId et toId sont obligatoires")
		return
	}
	if req.FromID == req.ToID {
		s.writeDomainError(w, domain.ErrSelfDependency)
		return
	}

	// Both ends must exist and belong to this roadmap: a link across boards
	// would draw an arrow to nowhere.
	for _, id := range []string{req.FromID, req.ToID} {
		b, err := s.store.Brick(r.Context(), id)
		if err != nil {
			s.writeDomainError(w, err)
			return
		}
		if b.RoadmapID != roadmapID {
			writeError(w, http.StatusBadRequest, "les deux briques doivent appartenir à la même roadmap")
			return
		}
	}

	existing, err := s.store.Dependencies(r.Context(), roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	// Links express sequencing, so a cycle is an unsatisfiable plan. Reject it
	// before it reaches the database, where nothing would catch it.
	if domain.WouldCycle(existing, req.FromID, req.ToID) {
		s.writeDomainError(w, domain.ErrDependencyLoop)
		return
	}

	d := domain.Dependency{ID: newID("dep"), FromID: req.FromID, ToID: req.ToID}
	created, err := s.store.CreateDependency(r.Context(), d, roadmapID)
	if err != nil {
		s.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) deleteDependency(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteDependency(r.Context(), r.PathValue("depID")); err != nil {
		s.writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// firstThemeID returns the roadmap's leading theme, used as the default for
// work bricks created without one.
func (s *Server) firstThemeID(r *http.Request, roadmapID string) (string, error) {
	themes, err := s.store.Themes(r.Context(), roadmapID)
	if err != nil {
		return "", err
	}
	if len(themes) == 0 {
		return "", errors.New("cette roadmap n'a aucun thème")
	}
	return themes[0].ID, nil
}
