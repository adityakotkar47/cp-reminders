package wa

import (
	"slices"

	"go.mau.fi/whatsmeow/types"
)

// IsAdmin reports whether any of self is an admin or super admin of the group.
// Participants are matched by JID, LID or phone number, ignoring device parts.
func IsAdmin(info *types.GroupInfo, self ...types.JID) bool {
	if info == nil {
		return false
	}
	var ids []types.JID
	for _, j := range self {
		if !j.IsEmpty() {
			ids = append(ids, j.ToNonAD())
		}
	}
	for _, p := range info.Participants {
		if !p.IsAdmin && !p.IsSuperAdmin {
			continue
		}
		for _, j := range []types.JID{p.JID, p.LID, p.PhoneNumber} {
			if !j.IsEmpty() && slices.Contains(ids, j.ToNonAD()) {
				return true
			}
		}
	}
	return false
}
