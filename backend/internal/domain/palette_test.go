package domain

import (
	"errors"
	"testing"
)

func TestNormalizeHex(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"#2563eb", "#2563EB"},
		{"#2563EB", "#2563EB"},
		{"  #7c3aed  ", "#7C3AED"},
		{"#abc", "#AABBCC"},
	}
	for _, tc := range cases {
		got, err := NormalizeHex(tc.in)
		if err != nil {
			t.Errorf("NormalizeHex(%q) a échoué : %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("NormalizeHex(%q) = %q, attendu %q", tc.in, got, tc.want)
		}
	}

	for _, bad := range []string{"", "2563EB", "#12345", "#GGGGGG", "rouge", "#"} {
		if _, err := NormalizeHex(bad); !errors.Is(err, ErrColorInvalid) {
			t.Errorf("NormalizeHex(%q) = %v, attendu ErrColorInvalid", bad, err)
		}
	}
}

// Une teinte dérivée doit rester dans la même famille que sa base : c'est ce
// qui fait lire les quatre couleurs d'un thème comme un ensemble.
func TestDerivePaletteKeepsTheHueOfItsBase(t *testing.T) {
	for _, base := range []string{"#7C3AED", "#0D9488", "#DB2777", "#CA8A04"} {
		tint, ink, line, err := DerivePalette(base)
		if err != nil {
			t.Fatalf("DerivePalette(%q) a échoué : %v", base, err)
		}

		baseHue, _, _, _ := hexToHSL(base)
		for label, shade := range map[string]string{"tint": tint, "ink": ink, "line": line} {
			hue, _, _, err := hexToHSL(shade)
			if err != nil {
				t.Fatalf("teinte %s illisible : %v", label, err)
			}
			// Tolérance large : près du blanc, les trois canaux se resserrent
			// et l'arrondi à l'entier déplace la teinte de quelques degrés.
			// À cette clarté l'écart est invisible ; le resserrer ne testerait
			// que les limites du codage 8 bits.
			if diff := hueDistance(hue, baseHue); diff > 6 {
				t.Errorf("%s de %s : teinte %.1f° contre %.1f° pour la base", label, base, hue, baseHue)
			}
		}
	}
}

// Le fond doit être clair, l'encre sombre : sans cet écart, le texte d'une
// brique devient illisible sur son propre remplissage.
func TestDerivePaletteOrdersShadesFromLightToDark(t *testing.T) {
	tint, ink, line, err := DerivePalette("#2563EB")
	if err != nil {
		t.Fatalf("DerivePalette a échoué : %v", err)
	}

	_, _, tintL, _ := hexToHSL(tint)
	_, _, lineL, _ := hexToHSL(line)
	_, _, inkL, _ := hexToHSL(ink)

	if !(tintL > lineL && lineL > inkL) {
		t.Errorf("clartés attendues tint > line > ink, obtenu %.2f / %.2f / %.2f", tintL, lineL, inkL)
	}
	if tintL < 0.9 {
		t.Errorf("le fond doit rester très clair, clarté %.2f", tintL)
	}
	if inkL > 0.5 {
		t.Errorf("l'encre doit rester sombre, clarté %.2f", inkL)
	}
}

// Une base quasi grise ne doit pas donner un fond délavé indistinguable du
// papier : la saturation dérivée est bornée par le bas.
func TestDerivePaletteLiftsNearlyGreyBases(t *testing.T) {
	tint, _, _, err := DerivePalette("#71717A")
	if err != nil {
		t.Fatalf("DerivePalette a échoué : %v", err)
	}
	if _, s, _, _ := hexToHSL(tint); s < minDerivedSaturation-0.01 {
		t.Errorf("saturation du fond %.2f, plancher attendu %.2f", s, minDerivedSaturation)
	}
}

func TestDerivePaletteRejectsAnInvalidBase(t *testing.T) {
	if _, _, _, err := DerivePalette("bleu"); !errors.Is(err, ErrColorInvalid) {
		t.Errorf("DerivePalette(\"bleu\") = %v, attendu ErrColorInvalid", err)
	}
}

func hueDistance(a, b float64) float64 {
	d := a - b
	for d < -180 {
		d += 360
	}
	for d > 180 {
		d -= 360
	}
	if d < 0 {
		return -d
	}
	return d
}

func TestTeamValidate(t *testing.T) {
	valid := Team{ID: "t", Name: "Payment", Capacity: 4}
	if err := valid.Validate(); err != nil {
		t.Fatalf("une équipe correcte a été rejetée : %v", err)
	}

	cases := []struct {
		name  string
		mutex func(*Team)
		want  error
	}{
		{"nom vide", func(x *Team) { x.Name = "" }, ErrTeamNameEmpty},
		{"nom en espaces", func(x *Team) { x.Name = "   " }, ErrTeamNameEmpty},
		{"capacité nulle", func(x *Team) { x.Capacity = 0 }, ErrCapacityRange},
		{"capacité négative", func(x *Team) { x.Capacity = -1 }, ErrCapacityRange},
		{"capacité démesurée", func(x *Team) { x.Capacity = 500 }, ErrCapacityRange},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			team := valid
			tc.mutex(&team)
			if err := team.Validate(); !errors.Is(err, tc.want) {
				t.Errorf("Validate() = %v, attendu %v", err, tc.want)
			}
		})
	}
}

func TestThemeValidateNormalizesColors(t *testing.T) {
	theme := Theme{
		Name: "Socle technique",
		Base: "#0d9488", Tint: "#f0fdfa", Ink: "#115e59", Line: "#99f6e4",
		IconPath: "M2 2.4h10v3.4H2z",
	}
	if err := theme.Validate(); err != nil {
		t.Fatalf("un thème correct a été rejeté : %v", err)
	}
	if theme.Base != "#0D9488" || theme.Tint != "#F0FDFA" {
		t.Errorf("couleurs non normalisées : %s / %s", theme.Base, theme.Tint)
	}
}

func TestThemeValidateRejects(t *testing.T) {
	valid := Theme{Name: "Thème", Base: "#111111", Tint: "#EEEEEE", Ink: "#222222", Line: "#DDDDDD"}

	cases := []struct {
		name  string
		mutex func(*Theme)
		want  error
	}{
		{"nom vide", func(x *Theme) { x.Name = " " }, ErrThemeNameEmpty},
		{"base invalide", func(x *Theme) { x.Base = "bleu" }, ErrColorInvalid},
		{"fond invalide", func(x *Theme) { x.Tint = "#ZZZ" }, ErrColorInvalid},
		{"icône avec balise", func(x *Theme) { x.IconPath = "<script>alert(1)</script>" }, ErrIconInvalid},
		{"icône démesurée", func(x *Theme) { x.IconPath = string(make([]byte, 600)) }, ErrIconInvalid},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			theme := valid
			tc.mutex(&theme)
			if err := theme.Validate(); !errors.Is(err, tc.want) {
				t.Errorf("Validate() = %v, attendu %v", err, tc.want)
			}
		})
	}
}

// Une icône vide est légitime : un thème peut n'avoir que sa couleur.
func TestThemeValidateAcceptsAnEmptyIcon(t *testing.T) {
	theme := Theme{Name: "Thème", Base: "#111111", Tint: "#EEEEEE", Ink: "#222222", Line: "#DDDDDD"}
	if err := theme.Validate(); err != nil {
		t.Errorf("icône vide rejetée : %v", err)
	}
}
