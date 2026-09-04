import test from "node:test";
import assert from "node:assert/strict";
import { isNonPublicAddress } from "../src/lib/safe-url.ts";

test("rejects private, link-local, carrier-grade NAT, mapped, and documentation addresses", () => {
  for (const address of [
    "127.0.0.1", "10.0.0.1", "100.64.0.1", "169.254.1.1", "172.16.0.1",
    "192.168.1.1", "198.18.0.1", "203.0.113.8", "::1", "fe80::1",
    "fc00::1", "::ffff:127.0.0.1", "2001:db8::1",
  ]) assert.equal(isNonPublicAddress(address), true, address);
});

test("accepts representative public IPv4 and IPv6 addresses", () => {
  assert.equal(isNonPublicAddress("1.1.1.1"), false);
  assert.equal(isNonPublicAddress("2606:4700:4700::1111"), false);
});
