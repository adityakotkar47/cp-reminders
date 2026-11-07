package state

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestVault(t *testing.T) *Vault {
	t.Helper()
	identity, _, err := GenerateIdentity()
	if err != nil {
		t.Fatalf("GenerateIdentity: %v", err)
	}
	v, err := NewVault(identity)
	if err != nil {
		t.Fatalf("NewVault: %v", err)
	}
	return v
}

func TestGenerateIdentity(t *testing.T) {
	identity, recipient, err := GenerateIdentity()
	if err != nil {
		t.Fatalf("GenerateIdentity: %v", err)
	}
	if !strings.HasPrefix(identity, "AGE-SECRET-KEY-1") {
		t.Errorf("identity prefix: got %.16q", identity)
	}
	if !strings.HasPrefix(recipient, "age1") {
		t.Errorf("recipient prefix: got %q", recipient)
	}
	v, err := NewVault(identity)
	if err != nil {
		t.Fatalf("NewVault: %v", err)
	}
	if v.Recipient() != recipient {
		t.Errorf("Recipient: got %q, want %q", v.Recipient(), recipient)
	}
}

func TestNewVaultRejectsInvalidIdentityWithoutEchoingIt(t *testing.T) {
	secret := "AGE-SECRET-KEY-1NOTAREALKEYBUTSECRETLOOKING"
	_, err := NewVault(secret)
	if err == nil {
		t.Fatal("expected error for invalid identity")
	}
	if strings.Contains(err.Error(), "NOTAREALKEY") {
		t.Errorf("error leaks identity material: %v", err)
	}
	if _, err := NewVault(""); err == nil {
		t.Error("expected error for empty identity")
	}
}

func TestNewVaultTrimsWhitespace(t *testing.T) {
	identity, _, err := GenerateIdentity()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewVault("  " + identity + "\r\n"); err != nil {
		t.Errorf("NewVault with surrounding whitespace: %v", err)
	}
}

func TestSealUnsealRoundTrip(t *testing.T) {
	v := newTestVault(t)
	dir := t.TempDir()
	plain := filepath.Join(dir, "session.db")
	sealed := filepath.Join(dir, "session.db.age")
	restored := filepath.Join(dir, "restored.db")
	want := bytes.Repeat([]byte("sqlite page\x00\x01"), 10000)
	if err := os.WriteFile(plain, want, 0o600); err != nil {
		t.Fatal(err)
	}

	if err := v.Seal(sealed, plain); err != nil {
		t.Fatalf("Seal: %v", err)
	}
	ciphertext, err := os.ReadFile(sealed)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("sqlite page")) {
		t.Fatal("sealed file contains plaintext")
	}
	if err := v.Unseal(restored, sealed); err != nil {
		t.Fatalf("Unseal: %v", err)
	}
	got, err := os.ReadFile(restored)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("round trip mismatch: got %d bytes, want %d", len(got), len(want))
	}
}

func TestSealReplacesExistingFileAndLeavesNoTemp(t *testing.T) {
	v := newTestVault(t)
	dir := t.TempDir()
	plain := filepath.Join(dir, "p")
	sealed := filepath.Join(dir, "s.age")
	if err := os.WriteFile(sealed, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(plain, []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := v.Seal(sealed, plain); err != nil {
		t.Fatalf("Seal: %v", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Errorf("unexpected files after Seal: %v", names)
	}
}

func TestUnsealWithWrongIdentityFails(t *testing.T) {
	a, b := newTestVault(t), newTestVault(t)
	dir := t.TempDir()
	plain := filepath.Join(dir, "p")
	sealed := filepath.Join(dir, "s.age")
	if err := os.WriteFile(plain, []byte("data"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := a.Seal(sealed, plain); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(dir, "out")
	if err := b.Unseal(out, sealed); err == nil {
		t.Fatal("Unseal with wrong identity succeeded")
	}
	if _, err := os.Stat(out); !os.IsNotExist(err) {
		t.Errorf("partial output left behind: %v", err)
	}
}
