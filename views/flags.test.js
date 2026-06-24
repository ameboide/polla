import { test } from "node:test";
import assert from "node:assert/strict";
import { flagFor } from "./flags.js";

test("maps a country name to its regional-indicator flag", () => {
  assert.equal(flagFor("Brazil"), String.fromCodePoint(0x1f1e7, 0x1f1f7)); // 🇧🇷
  assert.equal(flagFor("Spain"), String.fromCodePoint(0x1f1ea, 0x1f1f8)); // 🇪🇸
});

test("uses subdivision tag flags for England and Scotland", () => {
  const eng = flagFor("England");
  assert.equal(eng.codePointAt(0), 0x1f3f4); // waving black flag base
  assert.ok(eng.endsWith(String.fromCodePoint(0xe007f))); // cancel tag
  assert.notEqual(flagFor("Scotland"), eng);
});

test("returns empty string for an unknown country", () => {
  assert.equal(flagFor("Atlantis"), "");
});
