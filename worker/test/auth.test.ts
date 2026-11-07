import { describe, expect, it } from "vitest";
import { isAuthorized, safeEqual } from "../src/auth.ts";

const req = (headers: Record<string, string> = {}, url = "https://w.test/x") => new Request(url, { headers });

describe("safeEqual", () => {
  it("compares by value regardless of length", async () => {
    expect(await safeEqual("abc", "abc")).toBe(true);
    expect(await safeEqual("abc", "abd")).toBe(false);
    expect(await safeEqual("abc", "abcd")).toBe(false);
    expect(await safeEqual("", "abc")).toBe(false);
  });
});

describe("isAuthorized", () => {
  it("accepts the exact bearer token", async () => {
    expect(await isAuthorized(req({ Authorization: "Bearer s3cret" }), "s3cret")).toBe(true);
  });

  it("rejects a missing, wrong or non-bearer credential", async () => {
    expect(await isAuthorized(req(), "s3cret")).toBe(false);
    expect(await isAuthorized(req({ Authorization: "Bearer nope" }), "s3cret")).toBe(false);
    expect(await isAuthorized(req({ Authorization: "s3cret" }), "s3cret")).toBe(false);
    expect(await isAuthorized(req({ Authorization: "Basic s3cret" }), "s3cret")).toBe(false);
  });

  it("never accepts a token passed in the query string", async () => {
    expect(await isAuthorized(req({}, "https://w.test/x?token=s3cret"), "s3cret")).toBe(false);
  });

  it("rejects everything when the expected secret is unset or empty", async () => {
    expect(await isAuthorized(req({ Authorization: "Bearer " }), "")).toBe(false);
    expect(await isAuthorized(req({ Authorization: "Bearer x" }), undefined)).toBe(false);
  });
});
