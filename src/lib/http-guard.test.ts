import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isLocalhostRequest } from "@/lib/http-guard";

function requestWithHost(host: string | null): Request {
  const headers = new Headers();
  if (host !== null) headers.set("host", host);
  return new Request("http://placeholder.invalid/", { headers });
}

describe("isLocalhostRequest", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "localhost", "127.0.0.1", "[::1]:3000", "[::1]"]) {
    test(`accepts ${host}`, () => {
      assert.equal(isLocalhostRequest(requestWithHost(host)), true);
    });
  }

  for (const host of ["evil.example.com", "100.84.129.39:3000", "0.0.0.0:3000", "localhost.evil.com"]) {
    test(`rejects ${host}`, () => {
      assert.equal(isLocalhostRequest(requestWithHost(host)), false);
    });
  }

  test("rejects a missing Host header", () => {
    assert.equal(isLocalhostRequest(requestWithHost(null)), false);
  });
});
