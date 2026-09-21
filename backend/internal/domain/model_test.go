package domain

import (
	"errors"
	"testing"
)

func TestBrickValidate(t *testing.T) {
	theme := "t1"
	valid := Brick{TeamID: "a", ThemeID: &theme, Kind: KindWork, Title: "Refonte", ETP: 1.5, StartMonth: 0, Duration: 3}

	if err := valid.Validate(); err != nil {
		t.Fatalf("une brique correcte a été rejetée : %v", err)
	}

	cases := []struct {
		name  string
		mutex func(*Brick)
		want  error
	}{
		{"titre vide", func(b *Brick) { b.Title = "" }, ErrTitleEmpty},
		{"type inconnu", func(b *Brick) { b.Kind = "milestone" }, ErrKindInvalid},
		{"charge sous le minimum", func(b *Brick) { b.ETP = 0.25 }, ErrETPRange},
		{"charge au-dessus du maximum", func(b *Brick) { b.ETP = 7 }, ErrETPRange},
		{"charge hors palier", func(b *Brick) { b.ETP = 1.3 }, ErrETPStep},
		{"mois négatif", func(b *Brick) { b.StartMonth = -1 }, ErrMonthRange},
		{"mois au-delà de décembre", func(b *Brick) { b.StartMonth = 12 }, ErrMonthRange},
		{"durée nulle", func(b *Brick) { b.Duration = 0 }, ErrDurationRange},
		{"débordement de l'année", func(b *Brick) { b.StartMonth = 10; b.Duration = 4 }, ErrOverflowsYear},
		{"absence avec thème", func(b *Brick) { b.Kind = KindAbsence }, ErrAbsenceTheme},
		{"projet sans thème", func(b *Brick) { b.ThemeID = nil }, ErrWorkNeedsTheme},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b := valid
			tc.mutex(&b)
			err := b.Validate()
			if !errors.Is(err, tc.want) {
				t.Errorf("Validate() = %v, attendu %v", err, tc.want)
			}
		})
	}
}

// The 0.5 ladder must accept every step the UI offers; binary floats make this
// worth asserting rather than assuming.
func TestEveryETPStepOfferedByTheInspectorIsAccepted(t *testing.T) {
	theme := "t1"
	for _, etp := range []float64{0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6} {
		b := Brick{TeamID: "a", ThemeID: &theme, Kind: KindWork, Title: "x", ETP: etp, StartMonth: 0, Duration: 1}
		if err := b.Validate(); err != nil {
			t.Errorf("%v ETP rejeté : %v", etp, err)
		}
	}
}

func TestBrickSpansItsWholeWindow(t *testing.T) {
	b := Brick{StartMonth: 3, Duration: 4}
	if b.EndMonth() != 6 {
		t.Fatalf("EndMonth = %d, attendu 6", b.EndMonth())
	}
	for m, want := range map[int]bool{2: false, 3: true, 6: true, 7: false} {
		if b.Spans(m) != want {
			t.Errorf("Spans(%d) = %v, attendu %v", m, b.Spans(m), want)
		}
	}
}
