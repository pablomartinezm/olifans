// node --test lib/uli.test.ts  (Node ≥ 22.6 quita los tipos solo)
import assert from "node:assert/strict";
import { test } from "node:test";
import { nivelNombre, tier } from "./uli.ts";

test("tier: el margen de acierto crece hacia fuera y es simétrico", () => {
  assert.equal(tier(0), "justo");
  assert.equal(tier(-1), "justo");
  assert.equal(tier(2.9), "bien");
  assert.equal(tier(-4), "casi");
  assert.equal(tier(4.6), "ojo");
});

test("nivelNombre: sobrio a como una cuba", () => {
  assert.equal(nivelNombre(0), "Sobrio");
  assert.equal(nivelNombre(5), "Piripi");
  assert.equal(nivelNombre(9), "Como una cuba");
});
