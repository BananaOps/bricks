package domain

import (
	"fmt"
	"math"
	"strings"
)

// Lightness targets for the three shades derived from a theme's base colour.
//
// A theme carries four colours that have to stay in a fixed relationship:
// `tint` fills a brick, `ink` writes on that fill, `line` outlines it, and
// `base` is the swatch. Letting someone pick all four independently is how you
// end up with unreadable blocks, so only the base is chosen and the rest follow.
const (
	tintLightness = 0.97
	lineLightness = 0.90
	inkLightness  = 0.36
)

// Saturation bounds for derived shades. A base that is nearly grey would give
// washed-out fills, and a fully saturated one would give a garish outline.
const (
	minDerivedSaturation = 0.45
	maxDerivedSaturation = 0.92
)

// DerivePalette returns the tint, ink and line shades for a base colour.
//
// Hue is preserved so the four colours read as one family; only lightness moves.
func DerivePalette(base string) (tint, ink, line string, err error) {
	h, s, _, err := hexToHSL(base)
	if err != nil {
		return "", "", "", err
	}
	derived := math.Min(maxDerivedSaturation, math.Max(minDerivedSaturation, s))
	return hslToHex(h, derived, tintLightness),
		hslToHex(h, derived, inkLightness),
		hslToHex(h, derived, lineLightness),
		nil
}

// NormalizeHex upper-cases a colour and expands the three-digit form, so two
// spellings of the same colour compare equal in the database.
func NormalizeHex(value string) (string, error) {
	v := strings.TrimSpace(value)
	if !strings.HasPrefix(v, "#") {
		return "", fmt.Errorf("%w : %q", ErrColorInvalid, value)
	}
	digits := strings.ToUpper(v[1:])
	switch len(digits) {
	case 3:
		var b strings.Builder
		b.WriteByte('#')
		for _, c := range digits {
			if !isHexDigit(byte(c)) {
				return "", fmt.Errorf("%w : %q", ErrColorInvalid, value)
			}
			b.WriteRune(c)
			b.WriteRune(c)
		}
		return b.String(), nil
	case 6:
		for i := 0; i < 6; i++ {
			if !isHexDigit(digits[i]) {
				return "", fmt.Errorf("%w : %q", ErrColorInvalid, value)
			}
		}
		return "#" + digits, nil
	default:
		return "", fmt.Errorf("%w : %q", ErrColorInvalid, value)
	}
}

func isHexDigit(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')
}

func hexToHSL(value string) (h, s, l float64, err error) {
	normalized, err := NormalizeHex(value)
	if err != nil {
		return 0, 0, 0, err
	}
	var ri, gi, bi int
	if _, err := fmt.Sscanf(normalized[1:], "%02X%02X%02X", &ri, &gi, &bi); err != nil {
		return 0, 0, 0, fmt.Errorf("%w : %q", ErrColorInvalid, value)
	}

	r, g, b := float64(ri)/255, float64(gi)/255, float64(bi)/255
	max := math.Max(r, math.Max(g, b))
	min := math.Min(r, math.Min(g, b))
	l = (max + min) / 2

	if max == min {
		// Grey: hue is undefined, and any value would do. Zero keeps the
		// round-trip deterministic.
		return 0, 0, l, nil
	}

	d := max - min
	if l > 0.5 {
		s = d / (2 - max - min)
	} else {
		s = d / (max + min)
	}

	switch max {
	case r:
		h = (g - b) / d
		if g < b {
			h += 6
		}
	case g:
		h = (b-r)/d + 2
	default:
		h = (r-g)/d + 4
	}
	return h * 60, s, l, nil
}

func hslToHex(h, s, l float64) string {
	if s == 0 {
		v := int(math.Round(l * 255))
		return fmt.Sprintf("#%02X%02X%02X", v, v, v)
	}

	var q float64
	if l < 0.5 {
		q = l * (1 + s)
	} else {
		q = l + s - l*s
	}
	p := 2*l - q
	hk := h / 360

	channel := func(t float64) int {
		if t < 0 {
			t++
		}
		if t > 1 {
			t--
		}
		switch {
		case t < 1.0/6:
			return int(math.Round((p + (q-p)*6*t) * 255))
		case t < 1.0/2:
			return int(math.Round(q * 255))
		case t < 2.0/3:
			return int(math.Round((p + (q-p)*(2.0/3-t)*6) * 255))
		default:
			return int(math.Round(p * 255))
		}
	}
	return fmt.Sprintf("#%02X%02X%02X", channel(hk+1.0/3), channel(hk), channel(hk-1.0/3))
}
