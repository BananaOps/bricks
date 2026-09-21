// Package domain holds the roadmap model and the rules that govern it.
//
// A roadmap is a 12-month grid. Rows are teams, each with a capacity in ETP
// (équivalent temps plein / full-time equivalent). Cells hold bricks: a brick
// occupies `Duration` consecutive months starting at `StartMonth` and consumes
// `ETP` of its team's capacity for every month it spans.
package domain

import (
	"errors"
	"regexp"
	"strings"
)

// MonthsPerYear is the width of the grid. The UI renders exactly 12 columns
// grouped into four quarters, so a brick can never spill past December.
const MonthsPerYear = 12

// ETP bounds. Loads are half-time granular: the vertical resize handle moves in
// 0.5 steps and the inspector exposes the same ladder.
const (
	MinETP  = 0.5
	MaxETP  = 6.0
	ETPStep = 0.5
)

// Kind distinguishes the two block types the inspector toggles between.
type Kind string

const (
	// KindWork is a project brick: it carries a theme and shows up in the
	// review-by-theme view.
	KindWork Kind = "work"
	// KindAbsence is leave or on-call: it eats team capacity without carrying a
	// theme, sinks to the bottom of the stack, and is hidden from review.
	KindAbsence Kind = "absence"
)

func (k Kind) Valid() bool { return k == KindWork || k == KindAbsence }

// Roadmap scopes a board to a year; quarter labels are derived from Year.
type Roadmap struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Year int    `json:"year"`
}

// Team is a row in the capacity view. Capacity is the ETP ceiling drawn as the
// dashed line across the row.
type Team struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Capacity float64 `json:"capacity"`
	Position int     `json:"position"`
}

// Theme is a row in the review view and the colour identity of a work brick.
// The palette fields travel with the theme so the frontend never hardcodes
// colours for data that lives in the database.
type Theme struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Base     string `json:"base"`
	Tint     string `json:"tint"`
	Ink      string `json:"ink"`
	Line     string `json:"line"`
	IconPath string `json:"iconPath"`
	Position int    `json:"position"`
}

// Brick is one block on the grid.
//
// ThemeID is nil for absences: the kind and the theme are kept consistent by
// Validate rather than by convention.
type Brick struct {
	ID         string  `json:"id"`
	RoadmapID  string  `json:"roadmapId"`
	TeamID     string  `json:"teamId"`
	ThemeID    *string `json:"themeId"`
	Kind       Kind    `json:"kind"`
	Title      string  `json:"title"`
	ETP        float64 `json:"etp"`
	StartMonth int     `json:"startMonth"`
	Duration   int     `json:"duration"`
	Link       string  `json:"link"`
}

// EndMonth is the index of the last month the brick occupies, inclusive.
func (b Brick) EndMonth() int { return b.StartMonth + b.Duration - 1 }

// Spans reports whether the brick consumes capacity in month m.
func (b Brick) Spans(m int) bool { return m >= b.StartMonth && m <= b.EndMonth() }

// Dependency is a directed link drawn from one brick to another.
type Dependency struct {
	ID     string `json:"id"`
	FromID string `json:"fromId"`
	ToID   string `json:"toId"`
}

// Board is the full snapshot the frontend loads in one request.
type Board struct {
	Roadmap      Roadmap      `json:"roadmap"`
	Teams        []Team       `json:"teams"`
	Themes       []Theme      `json:"themes"`
	Bricks       []Brick      `json:"bricks"`
	Dependencies []Dependency `json:"dependencies"`
}

// Validation errors. Handlers map these to 400 and 409 responses.
var (
	ErrTitleEmpty     = errors.New("le titre est obligatoire")
	ErrETPRange       = errors.New("la charge doit être comprise entre 0,5 et 6 ETP")
	ErrETPStep        = errors.New("la charge doit être un multiple de 0,5 ETP")
	ErrMonthRange     = errors.New("le mois de départ doit être compris entre 0 et 11")
	ErrDurationRange  = errors.New("la durée doit être d'au moins 1 mois")
	ErrOverflowsYear  = errors.New("la brique dépasse la fin de l'année")
	ErrKindInvalid    = errors.New("type de bloc inconnu")
	ErrAbsenceTheme   = errors.New("une absence ne porte pas de thème")
	ErrWorkNeedsTheme = errors.New("une brique de projet doit porter un thème")
	ErrSelfDependency = errors.New("une brique ne peut pas dépendre d'elle-même")
	ErrDuplicateDep   = errors.New("ce lien existe déjà")
	ErrDependencyLoop = errors.New("ce lien créerait un cycle de dépendances")
	ErrNotFound       = errors.New("ressource introuvable")
)

// Erreurs de configuration du plateau : équipes et thèmes.
var (
	ErrTeamNameEmpty  = errors.New("le nom de l'équipe est obligatoire")
	ErrCapacityRange  = errors.New("la capacité doit être comprise entre 0,5 et 100 ETP")
	ErrThemeNameEmpty = errors.New("le nom du thème est obligatoire")
	ErrColorInvalid   = errors.New("couleur invalide, un code hexadécimal est attendu")
	ErrIconInvalid    = errors.New("le tracé de l'icône contient des caractères interdits")
	ErrTeamInUse      = errors.New("cette équipe porte encore des briques")
	ErrThemeInUse     = errors.New("ce thème est encore porté par des briques")
	ErrLastTeam       = errors.New("la dernière équipe ne peut pas être supprimée")
	ErrLastTheme      = errors.New("le dernier thème ne peut pas être supprimé")
	ErrReassignSelf   = errors.New("impossible de réaffecter vers l'élément supprimé")
	ErrOrderMismatch  = errors.New("la liste ordonnée doit contenir exactement les éléments existants")
)

// Bornes de capacité d'une équipe. Le plancher vaut le pas de charge d'une
// brique : une équipe qui ne peut pas porter une demi-brique n'est pas une
// ligne utile du plateau.
const (
	MinCapacity = 0.5
	MaxCapacity = 100
)

// Validate contrôle une équipe avant écriture.
func (t Team) Validate() error {
	if strings.TrimSpace(t.Name) == "" {
		return ErrTeamNameEmpty
	}
	if t.Capacity < MinCapacity || t.Capacity > MaxCapacity {
		return ErrCapacityRange
	}
	return nil
}

// iconPathPattern n'autorise que la grammaire des tracés SVG : commandes,
// nombres et séparateurs. Un thème est saisi par un humain puis rendu dans un
// attribut `d`, donc le contenu est borné plutôt que recopié tel quel.
var iconPathPattern = regexp.MustCompile(`^[MmLlHhVvCcSsQqTtAaZz0-9eE ,.+-]*$`)

// Validate contrôle un thème avant écriture et normalise ses couleurs.
//
// Le récepteur est un pointeur : la méthode réécrit les couleurs sous leur
// forme canonique, de sorte que deux orthographes d'une même teinte ne
// produisent pas deux lignes différentes en base.
func (t *Theme) Validate() error {
	if strings.TrimSpace(t.Name) == "" {
		return ErrThemeNameEmpty
	}
	for _, field := range []*string{&t.Base, &t.Tint, &t.Ink, &t.Line} {
		normalized, err := NormalizeHex(*field)
		if err != nil {
			return err
		}
		*field = normalized
	}
	if len(t.IconPath) > 512 || !iconPathPattern.MatchString(t.IconPath) {
		return ErrIconInvalid
	}
	return nil
}

// Validate enforces every invariant the grid relies on. The frontend clamps the
// same ranges while dragging, but the server is the authority: a brick that
// escaped these bounds would break the packing algorithm and the capacity math.
func (b Brick) Validate() error {
	if b.Title == "" {
		return ErrTitleEmpty
	}
	if !b.Kind.Valid() {
		return ErrKindInvalid
	}
	if b.ETP < MinETP || b.ETP > MaxETP {
		return ErrETPRange
	}
	// Compare in tenths to dodge binary-float surprises on values like 1.5.
	if int(b.ETP*10)%int(ETPStep*10) != 0 {
		return ErrETPStep
	}
	if b.StartMonth < 0 || b.StartMonth >= MonthsPerYear {
		return ErrMonthRange
	}
	if b.Duration < 1 {
		return ErrDurationRange
	}
	if b.StartMonth+b.Duration > MonthsPerYear {
		return ErrOverflowsYear
	}
	switch b.Kind {
	case KindAbsence:
		if b.ThemeID != nil {
			return ErrAbsenceTheme
		}
	case KindWork:
		if b.ThemeID == nil || *b.ThemeID == "" {
			return ErrWorkNeedsTheme
		}
	}
	return nil
}
