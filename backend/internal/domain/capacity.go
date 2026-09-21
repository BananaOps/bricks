package domain

import "sort"

// MonthlyLoad sums the ETP consumed in each of the twelve months by the given
// bricks. Absences count: leave subtracts from what a team can actually deliver,
// so it loads the row exactly like project work does.
func MonthlyLoad(bricks []Brick) [MonthsPerYear]float64 {
	var load [MonthsPerYear]float64
	for _, b := range bricks {
		for m := b.StartMonth; m <= b.EndMonth() && m < MonthsPerYear; m++ {
			load[m] += b.ETP
		}
	}
	return load
}

// TeamCapacity is the per-team verdict the capacity banner and the row meters
// are built from.
type TeamCapacity struct {
	TeamID string `json:"teamId"`
	// Capacity is the team's ETP ceiling.
	Capacity float64 `json:"capacity"`
	// Load is the ETP consumed each month, January first.
	Load []float64 `json:"load"`
	// Peak is the highest monthly load across the year.
	Peak float64 `json:"peak"`
	// Overloaded is true when any month exceeds Capacity.
	Overloaded bool `json:"overloaded"`
	// OverloadedMonths lists the offending month indices, ascending.
	OverloadedMonths []int `json:"overloadedMonths"`
	// Overflow is how far Peak sits above Capacity, 0 when within budget.
	Overflow float64 `json:"overflow"`
}

// CapacityReport is the whole-board summary served by GET .../capacity.
type CapacityReport struct {
	Teams []TeamCapacity `json:"teams"`
	// TotalCapacity is the sum of every team's ceiling.
	TotalCapacity float64 `json:"totalCapacity"`
	// TotalLoad is the board-wide ETP consumed each month, driving the month
	// and quarter headers.
	TotalLoad []float64 `json:"totalLoad"`
	// OverloadedTeams counts rows in the red.
	OverloadedTeams int `json:"overloadedTeams"`
	// OverloadedMonths is the union of every team's offending months.
	OverloadedMonths []int `json:"overloadedMonths"`
}

// capacityEpsilon absorbs float error so a load of exactly 4.0 against a
// capacity of 4.0 never reports as an overload.
const capacityEpsilon = 1e-6

// ComputeCapacity derives the full capacity picture from the board's raw rows.
//
// This lives on the server so the banner, the row meters, the quarter headers
// and any future export or digest all agree on one definition of "overloaded"
// rather than each re-deriving it.
func ComputeCapacity(teams []Team, bricks []Brick) CapacityReport {
	byTeam := make(map[string][]Brick, len(teams))
	for _, b := range bricks {
		byTeam[b.TeamID] = append(byTeam[b.TeamID], b)
	}

	report := CapacityReport{
		Teams:     make([]TeamCapacity, 0, len(teams)),
		TotalLoad: make([]float64, MonthsPerYear),
	}
	overallMonths := map[int]bool{}

	for _, t := range teams {
		load := MonthlyLoad(byTeam[t.ID])
		tc := TeamCapacity{
			TeamID:           t.ID,
			Capacity:         t.Capacity,
			Load:             make([]float64, MonthsPerYear),
			OverloadedMonths: []int{},
		}
		for m, v := range load {
			tc.Load[m] = v
			report.TotalLoad[m] += v
			if v > tc.Peak {
				tc.Peak = v
			}
			if v > t.Capacity+capacityEpsilon {
				tc.Overloaded = true
				tc.OverloadedMonths = append(tc.OverloadedMonths, m)
				overallMonths[m] = true
			}
		}
		if tc.Overloaded {
			tc.Overflow = tc.Peak - t.Capacity
			report.OverloadedTeams++
		}
		report.TotalCapacity += t.Capacity
		report.Teams = append(report.Teams, tc)
	}

	report.OverloadedMonths = make([]int, 0, len(overallMonths))
	for m := range overallMonths {
		report.OverloadedMonths = append(report.OverloadedMonths, m)
	}
	sort.Ints(report.OverloadedMonths)
	return report
}

// WouldCycle reports whether adding from→to closes a loop in the dependency
// graph. Dependencies express sequencing ("ship the warehouse migration before
// e-invoicing"), so a cycle is an unsatisfiable plan, not just untidy data.
func WouldCycle(deps []Dependency, from, to string) bool {
	if from == to {
		return true
	}
	// A cycle appears exactly when `to` can already reach `from`.
	next := make(map[string][]string, len(deps))
	for _, d := range deps {
		next[d.FromID] = append(next[d.FromID], d.ToID)
	}
	seen := map[string]bool{to: true}
	stack := []string{to}
	for len(stack) > 0 {
		cur := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if cur == from {
			return true
		}
		for _, n := range next[cur] {
			if !seen[n] {
				seen[n] = true
				stack = append(stack, n)
			}
		}
	}
	return false
}
