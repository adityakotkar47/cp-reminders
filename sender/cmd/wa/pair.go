package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow/store"

	"cp-reminders/sender/internal/state"
	"cp-reminders/sender/internal/wa"
)

const deviceOSName = "cp-reminders"

func runPair(ctx context.Context, args []string, getenv func(string) string, out io.Writer) error {
	f := newFlags("pair", out, true)
	phone := f.String("phone", "", "pair with a code entered on the phone instead of a QR; international format without +, e.g. 91XXXXXXXXXX")
	force := f.Bool("force", false, "replace an existing session in --state")
	timeout := f.Duration("timeout", 5*time.Minute, "limit for the whole pairing")
	connectTimeout := f.Duration("connect-timeout", 60*time.Second, "limit for the first login after pairing")
	settle := f.Duration("settle", 10*time.Second, "how long to stay connected after the first login")
	if err := f.parse(args); err != nil {
		return err
	}
	v, err := vaultFromEnv(getenv)
	if err != nil {
		return err
	}
	if state.SessionExists(*f.state) && !*force {
		return fmt.Errorf("%s already exists; pass --force to replace it", filepath.Join(*f.state, state.SessionFile))
	}
	if err := os.MkdirAll(*f.state, 0o700); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, *timeout)
	defer cancel()
	log := f.logger()
	store.SetOSInfo(deviceOSName, [3]uint32{1, 0, 0})
	sess, err := state.CreateSession(ctx, *f.state, v, log.Sub("Store"))
	if err != nil {
		return err
	}
	cli := wa.NewClient(sess.Container.NewDevice(), log.Sub("Client"))

	if *phone != "" {
		err = cli.PairWithPhone(ctx, *phone, func(code string) {
			fmt.Fprintf(out, "Pairing code: %s\nOn the phone: WhatsApp > Linked devices > Link a device > Link with phone number instead.\n", code)
		})
	} else {
		fmt.Fprintln(out, "On the phone: WhatsApp > Linked devices > Link a device, then scan:")
		err = cli.PairQR(ctx, func(code string) {
			qrterminal.GenerateHalfBlock(code, qrterminal.L, out)
		})
	}
	if err != nil {
		cli.Disconnect()
		return errors.Join(err, sess.Discard())
	}
	fmt.Fprintf(out, "paired as %s; waiting for first login\n", joinJIDs(cli.SelfJIDs()))

	err = cli.WaitConnected(ctx, *connectTimeout)
	if err == nil {
		err = settleFor(ctx, cli, *settle)
	}
	cli.Disconnect()
	if cerr := sess.Commit(); cerr != nil {
		return errors.Join(err, cerr)
	}
	fmt.Fprintf(out, "session saved to %s\n", filepath.Join(*f.state, state.SessionFile))
	return err
}

func settleFor(ctx context.Context, cli *wa.Client, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-cli.Done():
		return cli.Err()
	case <-ctx.Done():
		return ctx.Err()
	}
}
