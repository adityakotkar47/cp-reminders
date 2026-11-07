package wa

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow"
)

func pairLoop(ctx context.Context, ch <-chan whatsmeow.QRChannelItem, onCode func(code string) error) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case item, ok := <-ch:
			if !ok {
				return fmt.Errorf("%w: pairing channel closed", ErrPairing)
			}
			switch item.Event {
			case whatsmeow.QRChannelEventCode:
				if err := onCode(item.Code); err != nil {
					return err
				}
			case whatsmeow.QRChannelSuccess.Event:
				return nil
			case whatsmeow.QRChannelEventError:
				return fmt.Errorf("%w: %w", ErrPairing, item.Error)
			case whatsmeow.QRChannelEventPasskeyRequest, whatsmeow.QRChannelEventPasskeyResponse:
				return ErrPasskeyUnsupported
			default:
				return fmt.Errorf("%w: %s", ErrPairing, item.Event)
			}
		}
	}
}
