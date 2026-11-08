package state

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"filippo.io/age"
)

var errInvalidIdentity = errors.New("invalid age X25519 identity")

// Vault encrypts and decrypts state files to a single age X25519 identity.
type Vault struct {
	id *age.X25519Identity
}

// GenerateIdentity returns a new age identity and its recipient.
func GenerateIdentity() (identity, recipient string, err error) {
	id, err := age.GenerateX25519Identity()
	if err != nil {
		return "", "", fmt.Errorf("generate identity: %w", err)
	}
	return id.String(), id.Recipient().String(), nil
}

// NewVault parses an AGE-SECRET-KEY-1... identity.
func NewVault(identity string) (*Vault, error) {
	id, err := age.ParseX25519Identity(strings.TrimSpace(identity))
	if err != nil {
		return nil, errInvalidIdentity
	}
	return &Vault{id: id}, nil
}

// Recipient returns the public recipient of the vault's identity.
func (v *Vault) Recipient() string {
	return v.id.Recipient().String()
}

// Seal encrypts src into dst, replacing dst atomically.
func (v *Vault) Seal(dst, src string) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("seal: %w", err)
	}
	defer in.Close()
	err = writeAtomic(dst, func(w io.Writer) error {
		enc, err := age.Encrypt(w, v.id.Recipient())
		if err != nil {
			return err
		}
		if _, err := io.Copy(enc, in); err != nil {
			return err
		}
		return enc.Close()
	})
	if err != nil {
		return fmt.Errorf("seal %s: %w", dst, err)
	}
	return nil
}

// Unseal decrypts src into dst.
func (v *Vault) Unseal(dst, src string) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("unseal: %w", err)
	}
	defer in.Close()
	err = writeAtomic(dst, func(w io.Writer) error {
		dec, err := age.Decrypt(in, v.id)
		if err != nil {
			return err
		}
		_, err = io.Copy(w, dec)
		return err
	})
	if err != nil {
		return fmt.Errorf("unseal %s: %w", src, err)
	}
	return nil
}
