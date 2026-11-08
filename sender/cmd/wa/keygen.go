package main

import (
	"context"
	"fmt"
	"io"
	"time"

	"cp-reminders/sender/internal/state"
)

func runKeygen(ctx context.Context, args []string, getenv func(string) string, out io.Writer) error {
	if err := newFlags("keygen", out, false).parse(args); err != nil {
		return err
	}
	identity, recipient, err := state.GenerateIdentity()
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(out, "# created: %s\n# public key: %s\n%s\n",
		time.Now().UTC().Format(time.RFC3339), recipient, identity)
	return err
}
