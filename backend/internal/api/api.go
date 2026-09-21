// Package api exposes the roadmap over HTTP.
//
// Routing uses the standard library's method-and-wildcard patterns, so the
// service carries no web framework dependency.
package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/BananaOps/bricks/backend/internal/domain"
	"github.com/BananaOps/bricks/backend/internal/store"
)

// Server holds the handler dependencies.
type Server struct {
	store  *store.Store
	log    *slog.Logger
	origin string
	web    http.Handler
}

// NewServer builds the API. allowedOrigin is the frontend origin permitted by
// CORS; "*" disables the check. web sert l'interface compilée et peut être nil
// lorsque l'API tourne seule, Vite s'en chargeant en développement.
func NewServer(st *store.Store, log *slog.Logger, allowedOrigin string, web http.Handler) *Server {
	if web == nil {
		web = http.NotFoundHandler()
	}
	return &Server{store: st, log: log, origin: allowedOrigin, web: web}
}

// Routes returns the fully wired handler.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.health)

	// One call boots the whole board.
	mux.HandleFunc("GET /api/v1/roadmaps/{roadmapID}/board", s.getBoard)
	// The capacity verdict, derived server-side so every consumer agrees.
	mux.HandleFunc("GET /api/v1/roadmaps/{roadmapID}/capacity", s.getCapacity)

	mux.HandleFunc("POST /api/v1/roadmaps/{roadmapID}/bricks", s.createBrick)
	mux.HandleFunc("PATCH /api/v1/bricks/{brickID}", s.patchBrick)
	mux.HandleFunc("DELETE /api/v1/bricks/{brickID}", s.deleteBrick)

	mux.HandleFunc("POST /api/v1/roadmaps/{roadmapID}/dependencies", s.createDependency)
	mux.HandleFunc("DELETE /api/v1/dependencies/{depID}", s.deleteDependency)

	// Configuration du plateau : les lignes de la grille et l'identité des
	// briques, éditées depuis les pages Équipes et Thèmes.
	mux.HandleFunc("POST /api/v1/roadmaps/{roadmapID}/teams", s.createTeam)
	mux.HandleFunc("PUT /api/v1/roadmaps/{roadmapID}/teams/order", s.reorderTeams)
	mux.HandleFunc("PATCH /api/v1/teams/{teamID}", s.patchTeam)
	mux.HandleFunc("DELETE /api/v1/teams/{teamID}", s.deleteTeam)

	mux.HandleFunc("POST /api/v1/roadmaps/{roadmapID}/themes", s.createTheme)
	mux.HandleFunc("PUT /api/v1/roadmaps/{roadmapID}/themes/order", s.reorderThemes)
	mux.HandleFunc("PATCH /api/v1/themes/{themeID}", s.patchTheme)
	mux.HandleFunc("DELETE /api/v1/themes/{themeID}", s.deleteTheme)

	// Motif de plus faible précédence : tout ce qui n'est pas une route de
	// l'API tombe sur l'interface.
	mux.Handle("/", s.web)

	return s.recoverPanic(s.logRequests(s.cors(mux)))
}

// ---- middleware

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if s.origin == "*" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && origin == s.origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		s.log.Info("request",
			"method", r.Method, "path", r.URL.Path,
			"status", rec.status, "duration", time.Since(start).Round(time.Microsecond))
	})
}

// recoverPanic keeps one bad request from taking the process down.
func (s *Server) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				s.log.Error("panic", "path", r.URL.Path, "value", v)
				writeError(w, http.StatusInternalServerError, "erreur interne")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// ---- responses

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

// writeDomainError maps a domain error to the status that fits it, so handlers
// stay free of HTTP-status branching.
func (s *Server) writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrDuplicateDep), errors.Is(err, domain.ErrDependencyLoop),
		errors.Is(err, domain.ErrTeamInUse), errors.Is(err, domain.ErrThemeInUse),
		errors.Is(err, domain.ErrLastTeam), errors.Is(err, domain.ErrLastTheme):
		writeError(w, http.StatusConflict, err.Error())
	case isValidation(err):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		s.log.Error("unhandled", "err", err)
		writeError(w, http.StatusInternalServerError, "erreur interne")
	}
}

func isValidation(err error) bool {
	for _, v := range []error{
		domain.ErrTitleEmpty, domain.ErrETPRange, domain.ErrETPStep, domain.ErrMonthRange,
		domain.ErrDurationRange, domain.ErrOverflowsYear, domain.ErrKindInvalid,
		domain.ErrAbsenceTheme, domain.ErrWorkNeedsTheme, domain.ErrSelfDependency,
		domain.ErrTeamNameEmpty, domain.ErrCapacityRange, domain.ErrThemeNameEmpty,
		domain.ErrColorInvalid, domain.ErrIconInvalid, domain.ErrReassignSelf,
		domain.ErrOrderMismatch,
	} {
		if errors.Is(err, v) {
			return true
		}
	}
	return false
}

// decode reads a JSON body, rejecting unknown fields so a typo in a client
// payload fails loudly instead of silently doing nothing.
func decode(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

// newID returns a short random identifier. Prefixes keep ids readable in logs
// and in the database.
func newID(prefix string) string {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		// crypto/rand does not fail in practice; fall back to a time seed
		// rather than propagating an error through every create path.
		return prefix + "-" + strings.ReplaceAll(time.Now().UTC().Format("150405.000000"), ".", "")
	}
	return prefix + "-" + hex.EncodeToString(buf[:])
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.DB().PingContext(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "down", "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
