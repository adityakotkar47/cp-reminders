package wa

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func TestWatcherFatalEvents(t *testing.T) {
	tests := []struct {
		name string
		evt  any
		want error
	}{
		{"logged out", &events.LoggedOut{Reason: events.ConnectFailureLoggedOut}, ErrLoggedOut},
		{"stream replaced", &events.StreamReplaced{}, ErrStreamReplaced},
		{"client outdated", &events.ClientOutdated{}, ErrClientOutdated},
		{"temporary ban", &events.TemporaryBan{Code: events.TempBanSentToTooManyPeople}, ErrTemporaryBan},
		{"connect failure", &events.ConnectFailure{Reason: events.ConnectFailureServiceUnavailable}, ErrConnectFailure},
		{"pair error", &events.PairError{Error: errors.New("bad adv")}, ErrPairing},
		{"stream error", &events.StreamError{Code: "999"}, ErrStream},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := newWatcher()
			if w.Err() != nil {
				t.Fatalf("Err before events: %v", w.Err())
			}
			w.handle(tt.evt)
			if !errors.Is(w.Err(), tt.want) {
				t.Errorf("Err: got %v, want %v", w.Err(), tt.want)
			}
			select {
			case <-w.Done():
			default:
				t.Error("Done not closed after fatal event")
			}
		})
	}
}

func TestWatcherFirstFatalWins(t *testing.T) {
	w := newWatcher()
	w.handle(&events.StreamReplaced{})
	w.handle(&events.LoggedOut{})
	if !errors.Is(w.Err(), ErrStreamReplaced) || errors.Is(w.Err(), ErrLoggedOut) {
		t.Errorf("Err: %v", w.Err())
	}
}

func TestWatcherIgnoresBenignEvents(t *testing.T) {
	w := newWatcher()
	w.handle(&events.Disconnected{})
	w.handle(&events.OfflineSyncCompleted{Count: 3})
	w.handle(&events.Message{})
	if w.Err() != nil {
		t.Errorf("Err: %v", w.Err())
	}
}

func TestWaitConnected(t *testing.T) {
	t.Run("connected", func(t *testing.T) {
		w := newWatcher()
		go w.handle(&events.Connected{})
		if err := w.waitConnected(context.Background(), time.Second); err != nil {
			t.Fatalf("waitConnected: %v", err)
		}
	})
	t.Run("connected before wait", func(t *testing.T) {
		w := newWatcher()
		w.handle(&events.Connected{})
		if err := w.waitConnected(context.Background(), time.Second); err != nil {
			t.Fatalf("waitConnected: %v", err)
		}
	})
	t.Run("fatal", func(t *testing.T) {
		w := newWatcher()
		go w.handle(&events.LoggedOut{OnConnect: true, Reason: events.ConnectFailureLoggedOut})
		if err := w.waitConnected(context.Background(), time.Second); !errors.Is(err, ErrLoggedOut) {
			t.Fatalf("waitConnected: got %v, want ErrLoggedOut", err)
		}
	})
	t.Run("connected then fatal reports fatal", func(t *testing.T) {
		w := newWatcher()
		w.handle(&events.StreamReplaced{})
		w.handle(&events.Connected{})
		if err := w.waitConnected(context.Background(), time.Second); !errors.Is(err, ErrStreamReplaced) {
			t.Fatalf("waitConnected: got %v, want ErrStreamReplaced", err)
		}
	})
	t.Run("timeout", func(t *testing.T) {
		w := newWatcher()
		if err := w.waitConnected(context.Background(), 20*time.Millisecond); !errors.Is(err, ErrConnectTimeout) {
			t.Fatalf("waitConnected: got %v, want ErrConnectTimeout", err)
		}
	})
	t.Run("context cancelled", func(t *testing.T) {
		w := newWatcher()
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if err := w.waitConnected(ctx, time.Second); !errors.Is(err, context.Canceled) {
			t.Fatalf("waitConnected: got %v, want context.Canceled", err)
		}
	})
}

func feed(items ...whatsmeow.QRChannelItem) <-chan whatsmeow.QRChannelItem {
	ch := make(chan whatsmeow.QRChannelItem, len(items))
	for _, it := range items {
		ch <- it
	}
	close(ch)
	return ch
}

func code(c string) whatsmeow.QRChannelItem {
	return whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: c}
}

func TestPairLoopSuccess(t *testing.T) {
	var shown []string
	err := pairLoop(context.Background(), feed(code("A"), code("B"), whatsmeow.QRChannelSuccess), func(c string) error {
		shown = append(shown, c)
		return nil
	})
	if err != nil {
		t.Fatalf("pairLoop: %v", err)
	}
	if len(shown) != 2 || shown[0] != "A" || shown[1] != "B" {
		t.Errorf("codes shown: %v", shown)
	}
}

func TestPairLoopFailures(t *testing.T) {
	noop := func(string) error { return nil }
	tests := []struct {
		name  string
		items []whatsmeow.QRChannelItem
		want  error
	}{
		{"timeout", []whatsmeow.QRChannelItem{code("A"), whatsmeow.QRChannelTimeout}, ErrPairing},
		{"error", []whatsmeow.QRChannelItem{{Event: whatsmeow.QRChannelEventError, Error: errors.New("adv mismatch")}}, ErrPairing},
		{"outdated", []whatsmeow.QRChannelItem{whatsmeow.QRChannelClientOutdated}, ErrPairing},
		{"passkey", []whatsmeow.QRChannelItem{{Event: whatsmeow.QRChannelEventPasskeyRequest}}, ErrPasskeyUnsupported},
		{"closed", nil, ErrPairing},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := pairLoop(context.Background(), feed(tt.items...), noop); !errors.Is(err, tt.want) {
				t.Errorf("pairLoop: got %v, want %v", err, tt.want)
			}
		})
	}
}

func TestPairLoopCallbackErrorStops(t *testing.T) {
	boom := errors.New("pair phone: 400")
	err := pairLoop(context.Background(), feed(code("A"), whatsmeow.QRChannelSuccess), func(string) error { return boom })
	if !errors.Is(err, boom) {
		t.Fatalf("pairLoop: got %v, want %v", err, boom)
	}
}

func TestPairLoopContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ch := make(chan whatsmeow.QRChannelItem)
	if err := pairLoop(ctx, ch, func(string) error { return nil }); !errors.Is(err, context.Canceled) {
		t.Fatalf("pairLoop: got %v", err)
	}
}

func TestIsAdmin(t *testing.T) {
	pn := types.NewADJID("919999999999", 0, 12)
	lid := types.NewJID("123456789012345", types.HiddenUserServer)
	lidAD := lid
	lidAD.Device = 12
	other := types.NewJID("918888888888", types.DefaultUserServer)

	group := func(ps ...types.GroupParticipant) *types.GroupInfo {
		return &types.GroupInfo{Participants: ps}
	}
	tests := []struct {
		name string
		info *types.GroupInfo
		want bool
	}{
		{"admin by phone JID", group(types.GroupParticipant{JID: pn.ToNonAD(), IsAdmin: true}), true},
		{"super admin by LID", group(types.GroupParticipant{JID: lid, IsSuperAdmin: true}), true},
		{"admin by phone number field", group(types.GroupParticipant{JID: lid, PhoneNumber: pn.ToNonAD(), IsAdmin: true}), true},
		{"member only", group(types.GroupParticipant{JID: pn.ToNonAD()}), false},
		{"someone else admin", group(types.GroupParticipant{JID: other, IsAdmin: true}, types.GroupParticipant{JID: pn.ToNonAD()}), false},
		{"not a participant", group(types.GroupParticipant{JID: other, IsAdmin: true}), false},
		{"nil info", nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsAdmin(tt.info, pn, lidAD); got != tt.want {
				t.Errorf("IsAdmin: got %v, want %v", got, tt.want)
			}
		})
	}
	if IsAdmin(group(types.GroupParticipant{JID: types.EmptyJID, IsAdmin: true}), types.EmptyJID) {
		t.Error("empty self JID matched an empty participant JID")
	}
}

func TestTextMessageIsPlainConversationWithoutPreview(t *testing.T) {
	const text = "Codeforces Round starts in 75 min\nhttps://codeforces.com/contests/2000"
	msg := textMessage(text)
	if msg.GetConversation() != text {
		t.Errorf("Conversation: got %q, want %q", msg.GetConversation(), text)
	}
	if msg.ExtendedTextMessage != nil {
		t.Errorf("ExtendedTextMessage set: %v", msg.ExtendedTextMessage)
	}
	if want := (&waE2E.Message{Conversation: proto.String(text)}); !proto.Equal(msg, want) {
		t.Errorf("message has fields beyond Conversation: %v", msg)
	}
}
