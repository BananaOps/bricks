package domain

import (
	"math"
	"testing"
)

func work(team string, etp float64, start, dur int) Brick {
	theme := "t1"
	return Brick{TeamID: team, ThemeID: &theme, Kind: KindWork, Title: "x", ETP: etp, StartMonth: start, Duration: dur}
}

func TestMonthlyLoadSpansEveryMonthOfABrick(t *testing.T) {
	load := MonthlyLoad([]Brick{work("a", 1.5, 2, 3)})
	for m := 0; m < MonthsPerYear; m++ {
		want := 0.0
		if m >= 2 && m <= 4 {
			want = 1.5
		}
		if load[m] != want {
			t.Errorf("mois %d : charge %v, attendu %v", m, load[m], want)
		}
	}
}

func TestMonthlyLoadAccumulatesOverlappingBricks(t *testing.T) {
	load := MonthlyLoad([]Brick{work("a", 2, 0, 3), work("a", 1, 2, 2)})
	if load[2] != 3 {
		t.Errorf("mars : charge %v, attendu 3 (2 + 1 en recouvrement)", load[2])
	}
	if load[3] != 1 {
		t.Errorf("avril : charge %v, attendu 1", load[3])
	}
}

func TestAbsencesConsumeCapacityLikeWork(t *testing.T) {
	absence := Brick{TeamID: "a", Kind: KindAbsence, Title: "Congés", ETP: 1, StartMonth: 7, Duration: 1}
	load := MonthlyLoad([]Brick{work("a", 3, 7, 1), absence})
	if load[7] != 4 {
		t.Errorf("août : charge %v, attendu 4 — une absence retire bien de la capacité", load[7])
	}
}

func TestComputeCapacityFlagsOnlyTeamsPastTheirCeiling(t *testing.T) {
	teams := []Team{{ID: "a", Capacity: 3}, {ID: "b", Capacity: 5}}
	bricks := []Brick{
		work("a", 2, 0, 2), work("a", 2, 1, 2), // 4 ETP en février > 3
		work("b", 2, 0, 3), // toujours sous le plafond
	}

	rep := ComputeCapacity(teams, bricks)

	if rep.OverloadedTeams != 1 {
		t.Fatalf("équipes en surcharge : %d, attendu 1", rep.OverloadedTeams)
	}
	if !rep.Teams[0].Overloaded {
		t.Error("l'équipe a dépasse 3 ETP en février et devrait être signalée")
	}
	if rep.Teams[1].Overloaded {
		t.Error("l'équipe b reste sous son plafond et ne devrait pas être signalée")
	}
	if got := rep.Teams[0].Peak; got != 4 {
		t.Errorf("pointe de l'équipe a : %v, attendu 4", got)
	}
	if got := rep.Teams[0].Overflow; got != 1 {
		t.Errorf("dépassement de l'équipe a : %v, attendu 1", got)
	}
	if len(rep.Teams[0].OverloadedMonths) != 1 || rep.Teams[0].OverloadedMonths[0] != 1 {
		t.Errorf("mois en surcharge : %v, attendu [1]", rep.Teams[0].OverloadedMonths)
	}
	if rep.TotalCapacity != 8 {
		t.Errorf("capacité totale : %v, attendu 8", rep.TotalCapacity)
	}
	if rep.TotalLoad[1] != 6 {
		t.Errorf("charge totale en février : %v, attendu 6", rep.TotalLoad[1])
	}
}

// A load that exactly matches capacity is a full team, not an overloaded one —
// and float arithmetic on 0.5 steps must not turn it into one.
func TestLoadExactlyAtCapacityIsNotAnOverload(t *testing.T) {
	teams := []Team{{ID: "a", Capacity: 3.5}}
	bricks := []Brick{work("a", 0.5, 0, 1), work("a", 1.5, 0, 1), work("a", 1.5, 0, 1)}

	rep := ComputeCapacity(teams, bricks)

	if math.Abs(rep.Teams[0].Peak-3.5) > 1e-9 {
		t.Fatalf("pointe : %v, attendu 3,5", rep.Teams[0].Peak)
	}
	if rep.Teams[0].Overloaded {
		t.Error("une charge égale au plafond ne doit pas compter comme une surcharge")
	}
}

func TestWouldCycleDetectsDirectAndIndirectLoops(t *testing.T) {
	deps := []Dependency{{FromID: "a", ToID: "b"}, {FromID: "b", ToID: "c"}}

	cases := []struct {
		name     string
		from, to string
		want     bool
	}{
		{"boucle sur soi-même", "a", "a", true},
		{"lien inverse direct", "b", "a", true},
		{"boucle transitive", "c", "a", true},
		{"lien en avant", "a", "c", false},
		{"branche parallèle", "a", "d", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := WouldCycle(deps, tc.from, tc.to); got != tc.want {
				t.Errorf("WouldCycle(%s→%s) = %v, attendu %v", tc.from, tc.to, got, tc.want)
			}
		})
	}
}
