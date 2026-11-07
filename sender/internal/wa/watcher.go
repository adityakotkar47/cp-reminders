package wa

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types/events"
)

type watcher struct {
	connected chan struct{}
	done      chan struct{}
	once      sync.Once
	mu        sync.Mutex
	err       error
}

func newWatcher() *watcher {
	return &watcher{connected: make(chan struct{}, 1), done: make(chan struct{})}
}

func (w *watcher) handle(evt any) {
	switch e := evt.(type) {
	case *events.Connected:
		select {
		case w.connected <- struct{}{}:
		default:
		}
	case *events.LoggedOut:
		w.fail(fmt.Errorf("%w (reason: %s)", ErrLoggedOut, e.Reason))
	case *events.StreamReplaced:
		w.fail(ErrStreamReplaced)
	case *events.ClientOutdated:
		w.fail(ErrClientOutdated)
	case *events.TemporaryBan:
		w.fail(fmt.Errorf("%w: %s", ErrTemporaryBan, e))
	case *events.ConnectFailure:
		w.fail(fmt.Errorf("%w: %s %s", ErrConnectFailure, e.Reason, e.Message))
	case *events.PairError:
		w.fail(fmt.Errorf("%w: %w", ErrPairing, e.Error))
	case *events.StreamError:
		w.fail(fmt.Errorf("%w: code %s", ErrStream, e.Code))
	}
}

func (w *watcher) fail(err error) {
	w.once.Do(func() {
		w.mu.Lock()
		w.err = err
		w.mu.Unlock()
		close(w.done)
	})
}

// Err returns the first fatal event seen, if any.
func (w *watcher) Err() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.err
}

// Done is closed when a fatal event is seen.
func (w *watcher) Done() <-chan struct{} { return w.done }

func (w *watcher) waitConnected(ctx context.Context, timeout time.Duration) error {
	t := time.NewTimer(timeout)
	defer t.Stop()
	select {
	case <-w.connected:
		return w.Err()
	case <-w.done:
		return w.Err()
	case <-t.C:
		return fmt.Errorf("%w after %s", ErrConnectTimeout, timeout)
	case <-ctx.Done():
		return ctx.Err()
	}
}
