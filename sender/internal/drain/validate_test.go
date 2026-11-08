package drain

import (
	"strings"
	"testing"

	"github.com/adityakotkar47/cp-reminders/sender/internal/outbox"
)

func item(key, text string) outbox.Item {
	return outbox.Item{Key: key, Text: text, StartUTC: "2026-11-07T14:35:00Z", DeadlineUTC: "2026-11-07T14:25:00Z"}
}

func TestValidateItems(t *testing.T) {
	tests := []struct {
		name    string
		items   []outbox.Item
		invalid []bool
	}{
		{"ok", []outbox.Item{item("a", "hi"), item("b", "there")}, []bool{false, false}},
		{"empty text", []outbox.Item{item("a", "")}, []bool{true}},
		{"whitespace text", []outbox.Item{item("a", " \n\t")}, []bool{true}},
		{"1000 multibyte runes ok", []outbox.Item{item("a", strings.Repeat("é", MaxTextRunes))}, []bool{false}},
		{"1001 runes", []outbox.Item{item("a", strings.Repeat("x", MaxTextRunes+1))}, []bool{true}},
		{"empty key", []outbox.Item{item("", "hi")}, []bool{true}},
		{"duplicate key", []outbox.Item{item("a", "hi"), item("a", "again")}, []bool{false, true}},
		{"too many items", []outbox.Item{item("1", "x"), item("2", "x"), item("3", "x"), item("4", "x"), item("5", "x"), item("6", "x")}, []bool{true, true, true, true, true, true}},
		{"max items ok", []outbox.Item{item("1", "x"), item("2", "x"), item("3", "x"), item("4", "x"), item("5", "x")}, []bool{false, false, false, false, false}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateItems(tt.items)
			if len(errs) != len(tt.items) {
				t.Fatalf("got %d results for %d items", len(errs), len(tt.items))
			}
			for i, err := range errs {
				if (err != nil) != tt.invalid[i] {
					t.Errorf("item %d: err=%v, want invalid=%v", i, err, tt.invalid[i])
				}
			}
		})
	}
}

func TestValidateTarget(t *testing.T) {
	for _, tc := range []struct {
		jid string
		ok  bool
	}{
		{"120363012345678901@g.us", true},
		{"", false},
		{"  ", false},
		{"919999999999@s.whatsapp.net", false},
		{"120363012345678901@g.us ", false},
		{"@g.us", false},
		{"120363012345678901@newsletter", false},
	} {
		if err := ValidateTarget(tc.jid); (err == nil) != tc.ok {
			t.Errorf("ValidateTarget(%q) = %v, want ok=%v", tc.jid, err, tc.ok)
		}
	}
}
