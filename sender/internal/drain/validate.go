package drain

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/adityakotkar47/cp-reminders/sender/internal/outbox"
)

// Limits applied to every claim.
const (
	MaxItems     = 5
	MaxTextRunes = 1000
)

const groupServer = "@g.us"

// ErrInvalidTarget is returned when ANNOUNCE_JID is not a group JID.
var ErrInvalidTarget = errors.New("ANNOUNCE_JID must be a group JID like 120363...@g.us")

// ValidateItems returns one error per item, nil for items that may be sent.
func ValidateItems(items []outbox.Item) []error {
	errs := make([]error, len(items))
	if len(items) > MaxItems {
		err := fmt.Errorf("claim returned %d items, more than the limit of %d", len(items), MaxItems)
		for i := range errs {
			errs[i] = err
		}
		return errs
	}
	seen := make(map[string]bool, len(items))
	for i, it := range items {
		switch {
		case it.Key == "":
			errs[i] = errors.New("empty key")
		case seen[it.Key]:
			errs[i] = errors.New("duplicate key in claim")
		case strings.TrimSpace(it.Text) == "":
			errs[i] = errors.New("empty text")
		case utf8.RuneCountInString(it.Text) > MaxTextRunes:
			errs[i] = fmt.Errorf("text is %d characters, more than the limit of %d", utf8.RuneCountInString(it.Text), MaxTextRunes)
		}
		seen[it.Key] = true
	}
	return errs
}

// ValidateTarget checks that jid is a group JID.
func ValidateTarget(jid string) error {
	user, ok := strings.CutSuffix(jid, groupServer)
	if !ok || user == "" || strings.Trim(user, "0123456789-") != "" {
		return ErrInvalidTarget
	}
	return nil
}
